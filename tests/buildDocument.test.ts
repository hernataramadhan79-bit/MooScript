import { describe, it, expect } from 'vitest';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import type { MooProject } from '../src/types';

describe('Composition Document Builder', () => {
  it('correctly injects GSAP, MooRuntime, and scene definitions into srcdoc', () => {
    const mockProject: MooProject = {
      id: 'test-proj',
      title: 'Test Mograph',
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
          narrationText: 'Hello world test',
          durationInSeconds: 3,
          wordTimestamps: [],
          motionPreset: 'punch_zoom',
          visualData: {}
        }
      ],
      audioDuration: 3,
      bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
      composition: {
        id: 'comp-1',
        width: 1080,
        height: 1920,
        fps: 30,
        globalCss: 'body { background: #09090b; }',
        scenes: [
          {
            beatId: 'sc-1',
            html: '<div class="test">Hello</div>',
            css: '.test { color: #84cc16; }',
            buildJs: 'tl.from(".test", { opacity: 0 });',
            status: 'ok',
            version: 1
          }
        ],
        createdAt: Date.now()
      }
    };

    const doc = buildCompositionDocument(mockProject);
    expect(doc).toContain('gsap');
    expect(doc).toContain('MOO.scene');
    expect(doc).toContain('Hello');
    expect(doc).toContain('.test { color: #84cc16; }');
    expect(doc).toContain('moo-stage');
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("connect-src 'none'");
  });

  it('ensures getRuntimeScript() compiles without syntax or regex errors and includes try-catch frame capture', () => {
    const script = getRuntimeScript();
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('frame_error');
    expect(script).toContain('encodeURIComponent(svgString)');
  });
});
