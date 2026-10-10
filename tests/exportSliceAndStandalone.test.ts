import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { safeFileName, triggerFileDownload } from '../src/utils/fileUtils';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

describe('Export Safe Filename Helper (Phase 5b)', () => {
  it('replaces illegal characters with dashes, trims, and falls back to mooscript', () => {
    expect(safeFileName('My:Video/Export*Name?')).toBe('My-Video-Export-Name-');
    expect(safeFileName('  Clean Title  ')).toBe('Clean Title');
    expect(safeFileName('Invalid/\\:*?"<>|Characters')).toBe('Invalid-Characters');
    expect(safeFileName('')).toBe('mooscript');
    expect(safeFileName(undefined)).toBe('mooscript');
    expect(safeFileName('   :::   ')).toBe('-');
  });

  describe('Adversarial Stress: safeFileName', () => {
    it('neutralizes unix, windows, and UNC path traversal attempts', () => {
      expect(safeFileName('../../etc/passwd')).toBe('..-..-etc-passwd');
      expect(safeFileName('../../../../root/secret.key')).toBe('..-..-..-..-root-secret.key');
      expect(safeFileName('C:\\Windows\\System32\\cmd.exe')).toBe('C-Windows-System32-cmd.exe');
      expect(safeFileName('\\\\server\\share\\subfolder\\file.txt')).toBe('-server-share-subfolder-file.txt');
    });

    it('neutralizes all 9 forbidden filesystem characters (< > : " / \\ | ? *)', () => {
      const forbidden = '<>:"/\\|?*';
      const result = safeFileName(`test${forbidden}file`);
      expect(result).toBe('test-file');
      expect(/[\\/:*?"<>|]/.test(result)).toBe(false);
      expect(safeFileName('alpha:::::::beta??????gamma')).toBe('alpha-beta-gamma');
      expect(safeFileName(':::***???///\\\\\\')).toBe('-');
      expect(safeFileName(':leading-colon')).toBe('-leading-colon');
      expect(safeFileName('trailing-colon:')).toBe('trailing-colon-');
    });

    it('handles falsy, nullish, and whitespace inputs safely', () => {
      expect(safeFileName(undefined)).toBe('mooscript');
      expect(safeFileName('')).toBe('mooscript');
      // @ts-expect-error testing null input runtime safety
      expect(safeFileName(null)).toBe('mooscript');
      expect(safeFileName('   ')).toBe('mooscript');
      expect(safeFileName('\t\n\r  \t')).toBe('mooscript');
      expect(safeFileName('   My Project Title   ')).toBe('My Project Title');
    });

    it('preserves multilingual unicode, accents, RTL scripts, and emojis', () => {
      expect(safeFileName('ムービースクリプト_動画制作2026')).toBe('ムービースクリプト_動画制作2026');
      expect(safeFileName('Проект_Видео_Анимация')).toBe('Проект_Видео_Анимация');
      expect(safeFileName('مشروع_فيديو_رائع')).toBe('مشروع_فيديو_رائع');
      expect(safeFileName('Über_Café_Niño_Ålesund')).toBe('Über_Café_Niño_Ålesund');
      expect(safeFileName('🎬 MooScript Studio 🚀 🔥 100%')).toBe('🎬 MooScript Studio 🚀 🔥 100%');
      expect(safeFileName('🎬 Video: "Special Cut" / 2026?')).toBe('🎬 Video- -Special Cut- - 2026-');
    });

    it('handles boundary conditions, scale (10,000 chars), and script injection', () => {
      expect(safeFileName('.')).toBe('.');
      expect(safeFileName('..')).toBe('..');
      expect(safeFileName('...')).toBe('...');

      const largeTitle = 'a/b*c:d?e<f>g|h\\i'.repeat(1000);
      const start = performance.now();
      const result = safeFileName(largeTitle);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
      expect(result).toBe('a-b-c-d-e-f-g-h-i'.repeat(1000));

      const malicious = '<script>alert(document.cookie)</script>';
      expect(safeFileName(malicious)).toBe('-script-alert(document.cookie)-script-');

      const benign = 'My-File_v1.0.0 (Final) [Draft] {OK} $100 & 50% + 20=70! ~tag';
      expect(safeFileName(benign)).toBe(benign);
    });
  });

  describe('Adversarial Stress: triggerFileDownload', () => {
    it('safely no-ops in Node / SSR environments where document is undefined', () => {
      const origDoc = globalThis.document;
      // @ts-expect-error simulating ssr
      delete globalThis.document;

      expect(() => {
        triggerFileDownload('https://example.com/asset.mp4', 'asset.mp4');
      }).not.toThrow();

      globalThis.document = origDoc;
    });

    it('creates an anchor attached to body, triggers click, and removes it', () => {
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const mockBody = {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        contains: vi.fn().mockReturnValue(true)
      };
      const origDoc = globalThis.document;
      // @ts-expect-error mocking minimal document for node test env
      globalThis.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: mockBody
      };

      triggerFileDownload('blob:http://localhost/test-video.mp4', 'test-video.mp4');

      expect(mockAnchor.href).toBe('blob:http://localhost/test-video.mp4');
      expect(mockAnchor.download).toBe('test-video.mp4');
      expect(mockBody.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();

      globalThis.document = origDoc;
    });

    it('guards against null document.body or uncontained elements during timer cleanup', () => {
      vi.useFakeTimers();

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const removeChildMock = vi.fn();
      const mockBody = {
        appendChild: vi.fn(),
        contains: vi.fn().mockReturnValue(false),
        removeChild: removeChildMock
      };

      const origDoc = globalThis.document;
      // @ts-expect-error mocking minimal document
      globalThis.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: mockBody
      };

      triggerFileDownload('blob:test', 'test.mp4');
      vi.advanceTimersByTime(100);

      // Element was not contained in body, so removeChild should not be called
      expect(removeChildMock).not.toHaveBeenCalled();

      // Now test with null body during timer firing
      // @ts-expect-error testing null body
      globalThis.document.body = null;
      expect(() => {
        vi.advanceTimersByTime(100);
      }).not.toThrow();

      globalThis.document = origDoc;
      vi.useRealTimers();
    });
  });
});

describe('Standalone Composition Document (Phase 5e)', () => {
  const mockProject: MooProject = {
    id: 'test-proj-standalone',
    title: 'Standalone Test',
    renderMode: 'composition',
    aspectRatio: '9:16',
    fps: 30,
    width: 1080,
    height: 1920,
    theme: {
      bg: '#09090b',
      textPrimary: '#ffffff',
      textHighlight: '#84cc16',
      fontFamily: 'Jakarta',
      captionStyle: 'boxed',
      captionPosition: 'center',
      showSubtitles: false
    },
    scenes: [
      {
        id: 'sc-1',
        layout: 'KINETIC_QUOTE',
        narrationText: 'Scene 1 text',
        text: 'Scene 1 text',
        durationInSeconds: 3.5,
        wordTimestamps: [],
        motionPreset: 'punch_zoom',
        visualData: {}
      }
    ],
    audioDuration: 3.5,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
    composition: {
      id: 'comp-standalone',
      width: 1080,
      height: 1920,
      fps: 30,
      globalCss: '',
      scenes: [
        {
          beatId: 'sc-1',
          html: '<div class="test">Scene 1</div>',
          css: '.test { color: #84cc16; }',
          buildJs: 'tl.from(".test", { opacity: 0 });',
          status: 'ok',
          version: 1
        }
      ],
      createdAt: 1700000000000
    }
  };

  it('default output does not contain the standalone controller and runtime exposes __MOO_SEEK__', () => {
    const defaultDoc = buildCompositionDocument(mockProject);
    expect(defaultDoc).not.toContain('moo-standalone-controller');
    expect(defaultDoc).not.toContain('moo-play-btn');
    expect(defaultDoc).not.toContain('moo-time-slider');
    expect(defaultDoc).toContain('window.__MOO_SEEK__');
  });

  it('standalone output contains the interactive player controller and seek loop', () => {
    const standaloneDoc = buildCompositionDocument(mockProject, { standalone: true });
    expect(standaloneDoc).toContain('id="moo-standalone-controller"');
    expect(standaloneDoc).toContain('id="moo-play-btn"');
    expect(standaloneDoc).toContain('id="moo-time-slider"');
    expect(standaloneDoc).toContain('window.__MOO_SEEK__');
    expect(standaloneDoc).toContain('requestAnimationFrame');
    expect(standaloneDoc).toContain('window.parent !== window');
  });

  it('standalone output embeds audio element when audioDataUrl is provided', () => {
    const mockAudioUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    const standaloneDocWithAudio = buildCompositionDocument(mockProject, {
      standalone: true,
      audioDataUrl: mockAudioUrl
    });
    expect(standaloneDocWithAudio).toContain('id="moo-standalone-audio"');
    expect(standaloneDocWithAudio).toContain(mockAudioUrl);
  });
});

describe('Export Store Slice (Phase 5a, 5c)', () => {
  beforeEach(() => {
    useMooStore.setState({
      isExporting: false,
      exportProgress: null,
      exportResult: null
    });
  });

  it('startExport refuses to start if project.scenes is empty', async () => {
    const toastSpy = vi.fn();
    useMooStore.setState({
      project: {
        ...useMooStore.getState().project,
        scenes: []
      },
      addToast: toastSpy
    });

    await useMooStore.getState().startExport();

    expect(useMooStore.getState().isExporting).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith('Cannot export: project has no scenes.', 'warning');
  });

  it('cancelExport aborts export and resets isExporting to false', () => {
    useMooStore.setState({
      isExporting: true,
      exportProgress: { percent: 50, currentFrame: 15, totalFrames: 30, statusText: 'Rendering' }
    });

    useMooStore.getState().cancelExport();

    expect(useMooStore.getState().isExporting).toBe(false);
    expect(useMooStore.getState().exportProgress).toBeNull();
  });

  it('revokeExportResult revokes objectUrl and resets exportResult', () => {
    const mockRevoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    useMooStore.setState({
      exportResult: {
        blob: new Blob(['mp4']),
        objectUrl: 'blob:http://localhost/test-export',
        fileSizeBytes: 100,
        durationSeconds: 3,
        hasAudio: false,
        warnings: []
      }
    });

    useMooStore.getState().revokeExportResult();

    expect(mockRevoke).toHaveBeenCalledWith('blob:http://localhost/test-export');
    expect(useMooStore.getState().exportResult).toBeNull();

    mockRevoke.mockRestore();
  });
});
