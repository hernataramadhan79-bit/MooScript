import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { serializeSvgFrame, getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { exportMooProjectToMP4 } from '../src/engine/export/mp4Exporter';
import * as compRendererModule from '../src/engine/composition/compositionFrameRenderer';
import { createMockCanvas } from './mocks/mockCanvas';
import type { MooProject } from '../src/types';

class MockEventTarget {
  private listeners = new Map<string, Set<(e: any) => void>>();

  addEventListener(type: string, listener: (e: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; [key: string]: any }) {
    this.listeners.get(event.type)?.forEach((l) => l(event));
  }
}

class MockEncodedVideoChunk {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  byteLength: number;
  private data: Uint8Array;

  constructor(init: { type: 'key' | 'delta'; timestamp: number; duration?: number; data: Uint8Array }) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration;
    this.data = init.data;
    this.byteLength = init.data.byteLength;
  }

  copyTo(dest: ArrayBufferView | ArrayBuffer) {
    const target =
      'buffer' in dest ? new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength) : new Uint8Array(dest);
    target.set(this.data.subarray(0, target.length));
  }
}

class MockEncodedAudioChunk {
  type: 'key' | 'delta';
  timestamp: number;
  duration?: number;
  byteLength: number;
  private data: Uint8Array;

  constructor(init: { type: 'key' | 'delta'; timestamp: number; duration?: number; data: Uint8Array }) {
    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration;
    this.data = init.data;
    this.byteLength = init.data.byteLength;
  }

  copyTo(dest: ArrayBufferView | ArrayBuffer) {
    const target =
      'buffer' in dest ? new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength) : new Uint8Array(dest);
    target.set(this.data.subarray(0, target.length));
  }
}

class MockVideoFrame {
  timestamp: number;
  duration: number;
  codedWidth: number;
  codedHeight: number;
  displayWidth: number;
  displayHeight: number;
  closed = false;

  constructor(source: any, init: { timestamp: number; duration: number }) {
    this.timestamp = init.timestamp;
    this.duration = init.duration;
    this.codedWidth = source.width || 1080;
    this.codedHeight = source.height || 1920;
    this.displayWidth = this.codedWidth;
    this.displayHeight = this.codedHeight;
  }

  close() {
    this.closed = true;
  }
}

class MockAudioData {
  timestamp: number;
  numberOfFrames: number;
  numberOfChannels: number;
  sampleRate: number;
  format: string;
  closed = false;

  constructor(init: any) {
    this.timestamp = init.timestamp;
    this.numberOfFrames = init.numberOfFrames;
    this.numberOfChannels = init.numberOfChannels;
    this.sampleRate = init.sampleRate;
    this.format = init.format;
  }

  close() {
    this.closed = true;
  }
}

class MockVideoEncoder extends MockEventTarget {
  static isConfigSupported = vi.fn().mockResolvedValue({ supported: true, config: {} });
  encodeQueueSize = 0;
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  output: (chunk: any, meta?: any) => void;
  error: (err: any) => void;

  constructor(init: { output: (chunk: any, meta?: any) => void; error: (err: any) => void }) {
    super();
    this.output = init.output;
    this.error = init.error;
  }

  configure() {
    this.state = 'configured';
  }

  encode(frame: MockVideoFrame, _opts?: any) {
    const chunk = new MockEncodedVideoChunk({
      type: 'key',
      timestamp: frame.timestamp,
      duration: frame.duration,
      data: new Uint8Array(100)
    });
    this.output(chunk, {
      decoderConfig: {
        codec: 'avc1.4d002a',
        codedWidth: 1080,
        codedHeight: 1920,
        description: new Uint8Array([1, 2, 3, 4])
      }
    });
    this.dispatchEvent({ type: 'dequeue' });
  }

  flush() {
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
  }
}

class MockAudioEncoder extends MockEventTarget {
  static isConfigSupported = vi.fn().mockResolvedValue({ supported: true, config: {} });
  encodeQueueSize = 0;
  state: 'unconfigured' | 'configured' | 'closed' = 'unconfigured';
  output: (chunk: any, meta?: any) => void;
  error: (err: any) => void;

  constructor(init: { output: (chunk: any, meta?: any) => void; error: (err: any) => void }) {
    super();
    this.output = init.output;
    this.error = init.error;
  }

  configure() {
    this.state = 'configured';
  }

  encode(data: MockAudioData) {
    const chunk = new MockEncodedAudioChunk({
      type: 'key',
      timestamp: data.timestamp,
      data: new Uint8Array(50)
    });
    this.output(chunk, {
      decoderConfig: {
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        description: new Uint8Array([5, 6])
      }
    });
    this.dispatchEvent({ type: 'dequeue' });
  }

  flush() {
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
  }
}

class MockAudioBuffer {
  sampleRate = 48000;
  numberOfChannels = 2;
  duration = 3.0; // 3.0s audio for testing duration divergence
  length = 48000 * 3;
  getChannelData() {
    return new Float32Array(48000 * 3);
  }
  copyFromChannel(dest: Float32Array) {
    dest.fill(0);
  }
}

describe('Phase 3: Composition & Export Tests', () => {
  describe('3a: Scene Ordering & ID-based Metadata Lookup', () => {
    it('reorders MOO.scene registrations to match project.scenes order and appends leftovers', () => {
      const mockProject: MooProject = {
        id: 'reorder-test',
        title: 'Reorder Test',
        renderMode: 'composition',
        aspectRatio: '9:16',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#000',
          textPrimary: '#fff',
          textHighlight: '#0f0',
          fontFamily: 'Jakarta',
          captionStyle: 'boxed',
          captionPosition: 'center'
        },
        scenes: [
          {
            id: 'scene-second',
            layout: 'KINETIC_QUOTE',
            narrationText: 'Second Scene',
            durationInSeconds: 2,
            wordTimestamps: [],
            motionPreset: 'punch_zoom',
            visualData: {}
          },
          {
            id: 'scene-first',
            layout: 'KINETIC_QUOTE',
            narrationText: 'First Scene',
            durationInSeconds: 2,
            wordTimestamps: [],
            motionPreset: 'punch_zoom',
            visualData: {}
          }
        ],
        audioDuration: 4,
        bgm: { preset: 'none', level: 0, duckRatio: 0 },
        composition: {
          id: 'comp-1',
          width: 1080,
          height: 1920,
          fps: 30,
          globalCss: '',
          scenes: [
            {
              beatId: 'scene-first',
              html: '<div>Scene First Content</div>',
              css: '',
              buildJs: '',
              status: 'ok',
              version: 1
            },
            {
              beatId: 'scene-second',
              html: '<div>Scene Second Content</div>',
              css: '',
              buildJs: '',
              status: 'ok',
              version: 1
            },
            {
              beatId: 'scene-extra-leftover',
              html: '<div>Leftover Content</div>',
              css: '',
              buildJs: '',
              status: 'ok',
              version: 1
            }
          ],
          createdAt: Date.now()
        }
      };

      const doc = buildCompositionDocument(mockProject);
      const secondIdx = doc.indexOf("MOO.scene('scene-second'");
      const firstIdx = doc.indexOf("MOO.scene('scene-first'");
      const leftoverIdx = doc.indexOf("MOO.scene('scene-extra-leftover'");

      expect(secondIdx).toBeGreaterThan(-1);
      expect(firstIdx).toBeGreaterThan(-1);
      expect(leftoverIdx).toBeGreaterThan(-1);

      // scene-second should appear BEFORE scene-first because project.scenes had scene-second first
      expect(secondIdx).toBeLessThan(firstIdx);
      // scene-extra-leftover should appear at the end
      expect(firstIdx).toBeLessThan(leftoverIdx);
    });

    it('contains id-based metadata lookup in getRuntimeScript', () => {
      const script = getRuntimeScript();
      expect(script).toContain('(compositionMeta?.scenes || []).find');
      expect(script).toContain('m.id === sceneItem.id');
    });
  });

  describe('3c: XMLSerializer & SVG ForeignObject Parsing', () => {
    let origXMLSerializer: any;
    let origDOMParser: any;

    beforeEach(() => {
      origXMLSerializer = (globalThis as any).XMLSerializer;
      origDOMParser = (globalThis as any).DOMParser;

      (globalThis as any).XMLSerializer = class {
        serializeToString(node: any) {
          return node.outerHTML || '';
        }
      };

      (globalThis as any).DOMParser = class {
        parseFromString(xml: string, _mime: string) {
          const parserErrors: string[] = [];
          if (xml.includes('&nbsp;')) {
            parserErrors.push('Unescaped entity &nbsp; in XML');
          }
          if (/<br(?!\/|>|\s*\/>)[^>]*>|<br>/i.test(xml)) {
            parserErrors.push('Unclosed <br> tag in XML');
          }
          if (/<img(?![^>]*\/>)[^>]*>/i.test(xml)) {
            parserErrors.push('Unclosed <img> tag in XML');
          }
          return {
            getElementsByTagName: (tag: string) => (tag === 'parsererror' && parserErrors.length > 0 ? parserErrors : []),
            querySelector: (sel: string) => (sel === 'h1' ? { textContent: 'Title\u00A0With\u00A0Spaces' } : null)
          };
        }
      };
    });

    afterEach(() => {
      (globalThis as any).XMLSerializer = origXMLSerializer;
      (globalThis as any).DOMParser = origDOMParser;
    });

    it('serializes HTML with &nbsp;, <br>, and <img> into SVG without XML parse errors', () => {
      // In XMLSerializer output, &nbsp; becomes \u00A0 (or &#160;), and void tags are self-closing
      const mockDiv = {
        outerHTML: '<div><h1>Title\u00A0With\u00A0Spaces</h1><br/><p>Line 2</p><img src="test.png" alt="test"/></div>'
      };

      const serializedSvg = serializeSvgFrame(mockDiv as any, 1080, 1920, 'h1 { color: red; }');

      expect(serializedSvg).toContain('<style><![CDATA[h1 { color: red; }]]></style>');
      expect(serializedSvg).toContain('<foreignObject');

      const parser = new (globalThis as any).DOMParser();
      const parsedDoc = parser.parseFromString(serializedSvg, 'image/svg+xml');
      const parserErrors = parsedDoc.getElementsByTagName('parsererror');

      expect(parserErrors.length).toBe(0);
      expect(parsedDoc.querySelector('h1')?.textContent).toContain('Title\u00A0With\u00A0Spaces');
    });

    it('removes duplicate xmlns attribute on root div if already present', () => {
      const mockDiv = {
        outerHTML: '<div xmlns="http://www.w3.org/1999/xhtml"><span>Test</span></div>'
      };

      const serializedSvg = serializeSvgFrame(mockDiv as any, 1080, 1920, '');
      const parser = new (globalThis as any).DOMParser();
      const parsedDoc = parser.parseFromString(serializedSvg, 'image/svg+xml');
      const parserErrors = parsedDoc.getElementsByTagName('parsererror');

      expect(parserErrors.length).toBe(0);
      // Ensure xmlns is not duplicated
      const matchCount = (serializedSvg.match(/xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g) || []).length;
      expect(matchCount).toBe(1);
    });
  });

  describe('3d: Frame Capture Error & Timeout Rejection', () => {
    let origDocument: any;
    let origWindow: any;
    let messageListeners: Array<(e: any) => void>;
    let mockContentWindow: any;
    let mockIframe: any;

    beforeEach(() => {
      origDocument = (globalThis as any).document;
      origWindow = (globalThis as any).window;
      messageListeners = [];

      mockContentWindow = {
        postMessage: vi.fn()
      };

      mockIframe = {
        style: {},
        setAttribute: vi.fn(),
        srcdoc: '',
        contentWindow: mockContentWindow,
        parentNode: {
          removeChild: vi.fn()
        }
      };

      (globalThis as any).document = {
        createElement: vi.fn().mockImplementation((tag: string) => {
          if (tag === 'iframe') return mockIframe;
          return {};
        }),
        body: {
          appendChild: vi.fn()
        }
      };

      (globalThis as any).window = {
        addEventListener: vi.fn((type: string, cb: (e: any) => void) => {
          if (type === 'message') messageListeners.push(cb);
        }),
        removeEventListener: vi.fn((type: string, cb: (e: any) => void) => {
          if (type === 'message') {
            messageListeners = messageListeners.filter((l) => l !== cb);
          }
        }),
        dispatchEvent: (e: any) => {
          messageListeners.forEach((l) => l(e));
        }
      };
    });

    afterEach(() => {
      (globalThis as any).document = origDocument;
      (globalThis as any).window = origWindow;
      vi.restoreAllMocks();
    });

    const dummyProject: MooProject = {
      id: 'p1',
      title: 'P1',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: { bg: '#000', textPrimary: '#fff', textHighlight: '#0f0', fontFamily: 'Jakarta', captionStyle: 'boxed', captionPosition: 'center' },
      scenes: [],
      audioDuration: 0,
      bgm: { preset: 'none', level: 0, duckRatio: 0 },
      composition: {
        id: 'c1',
        width: 1080,
        height: 1920,
        fps: 30,
        globalCss: '',
        scenes: [{ beatId: 'sc-1', html: '<div>1</div>', css: '', buildJs: '', status: 'ok', version: 1 }],
        createdAt: 0
      }
    };

    it('ignores messages where e.source !== iframe.contentWindow and resolves when source matches', async () => {
      vi.useFakeTimers();

      const rendererPromise = compRendererModule.createCompositionFrameRenderer(dummyProject, 1080, 1920);

      // Dispatch 'ready' with wrong source (should be ignored)
      (globalThis as any).window.dispatchEvent({
        data: { type: 'ready' },
        source: {} // wrong source
      });

      let isResolved = false;
      rendererPromise.then(() => {
        isResolved = true;
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(isResolved).toBe(false);

      // Now dispatch with correct iframe.contentWindow source
      (globalThis as any).window.dispatchEvent({
        data: { type: 'ready' },
        source: mockContentWindow
      });

      const renderer = await rendererPromise;
      expect(renderer).not.toBeNull();
      renderer?.cleanup();

      vi.useRealTimers();
    });

    it('rejects renderFrame when frame capture times out', async () => {
      vi.useFakeTimers();

      const rendererPromise = compRendererModule.createCompositionFrameRenderer(dummyProject, 1080, 1920);

      (globalThis as any).window.dispatchEvent({
        data: { type: 'ready' },
        source: mockContentWindow
      });

      const renderer = await rendererPromise;
      expect(renderer).not.toBeNull();

      const mockCanvas = {} as HTMLCanvasElement;
      const renderPromise = renderer!.renderFrame(4, 0.133, mockCanvas);

      // Advance timer past 3000ms frame capture timeout
      vi.advanceTimersByTime(3500);

      await expect(renderPromise).rejects.toThrow(/Frame capture timed out for frame 4/);

      renderer?.cleanup();
      vi.useRealTimers();
    });

    it('rejects renderFrame when iframe posts frame_error', async () => {
      const rendererPromise = compRendererModule.createCompositionFrameRenderer(dummyProject, 1080, 1920);

      (globalThis as any).window.dispatchEvent({
        data: { type: 'ready' },
        source: mockContentWindow
      });

      const renderer = await rendererPromise;
      expect(renderer).not.toBeNull();

      const mockCanvas = {} as HTMLCanvasElement;
      const renderPromise = renderer!.renderFrame(7, 0.233, mockCanvas);

      // Post frame_error with frame id 7
      (globalThis as any).window.dispatchEvent({
        data: { type: 'frame_error', id: 7, message: 'WebGL context crash' },
        source: mockContentWindow
      });

      await expect(renderPromise).rejects.toThrow(/Frame capture error for frame 7: WebGL context crash/);

      renderer?.cleanup();
    });
  });

  describe('3e & 3f: Export Correctness, Duration, and Failure Handling', () => {
    let origVideoEncoder: any;
    let origAudioEncoder: any;
    let origVideoFrame: any;
    let origAudioData: any;
    let origEncodedVideoChunk: any;
    let origEncodedAudioChunk: any;
    let origAudioBuffer: any;
    let origAudioContext: any;
    let origOffscreenCanvas: any;
    let origCreateObjectURL: any;

    beforeEach(() => {
      origVideoEncoder = (globalThis as any).VideoEncoder;
      origAudioEncoder = (globalThis as any).AudioEncoder;
      origVideoFrame = (globalThis as any).VideoFrame;
      origAudioData = (globalThis as any).AudioData;
      origEncodedVideoChunk = (globalThis as any).EncodedVideoChunk;
      origEncodedAudioChunk = (globalThis as any).EncodedAudioChunk;
      origAudioBuffer = (globalThis as any).AudioBuffer;
      origAudioContext = (globalThis as any).AudioContext;
      origOffscreenCanvas = (globalThis as any).OffscreenCanvas;
      origCreateObjectURL = URL.createObjectURL;

      (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;
      (globalThis as any).EncodedAudioChunk = MockEncodedAudioChunk;
      (globalThis as any).VideoEncoder = MockVideoEncoder;
      (globalThis as any).AudioEncoder = MockAudioEncoder;
      (globalThis as any).VideoFrame = MockVideoFrame;
      (globalThis as any).AudioData = MockAudioData;
      (globalThis as any).AudioBuffer = MockAudioBuffer;
      (globalThis as any).AudioContext = class {
        decodeAudioData() {
          return Promise.resolve(new MockAudioBuffer());
        }
        close() {
          return Promise.resolve();
        }
      };
      (globalThis as any).window = globalThis;
      (globalThis as any).OffscreenCanvas = class {
        width: number;
        height: number;
        private mock: any;
        constructor(w: number, h: number) {
          this.width = w;
          this.height = h;
          this.mock = createMockCanvas(w, h);
        }
        getContext(type: string) {
          return this.mock.canvas.getContext(type);
        }
      };
      MockVideoEncoder.isConfigSupported = vi.fn().mockResolvedValue({ supported: true, config: {} });
      MockAudioEncoder.isConfigSupported = vi.fn().mockResolvedValue({ supported: true, config: {} });
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-export-url');
    });

    afterEach(() => {
      (globalThis as any).VideoEncoder = origVideoEncoder;
      (globalThis as any).AudioEncoder = origAudioEncoder;
      (globalThis as any).VideoFrame = origVideoFrame;
      (globalThis as any).AudioData = origAudioData;
      (globalThis as any).EncodedVideoChunk = origEncodedVideoChunk;
      (globalThis as any).EncodedAudioChunk = origEncodedAudioChunk;
      (globalThis as any).AudioBuffer = origAudioBuffer;
      (globalThis as any).AudioContext = origAudioContext;
      (globalThis as any).OffscreenCanvas = origOffscreenCanvas;
      URL.createObjectURL = origCreateObjectURL;
    });

    const baseProject: MooProject = {
      id: 'export-test',
      title: 'Export Test',
      renderMode: 'composition',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: {
        bg: '#000',
        textPrimary: '#fff',
        textHighlight: '#0f0',
        fontFamily: 'Jakarta',
        captionStyle: 'boxed',
        captionPosition: 'center'
      },
      scenes: [
        {
          id: 'sc-1',
          layout: 'KINETIC_QUOTE',
          narrationText: 'Scene 1',
          durationInSeconds: 1.0,
          wordTimestamps: [],
          motionPreset: 'punch_zoom',
          visualData: {}
        }
      ],
      audioDuration: 1.0,
      bgm: { preset: 'none', level: 0, duckRatio: 0 },
      composition: {
        id: 'comp-1',
        width: 1080,
        height: 1920,
        fps: 30,
        globalCss: '',
        scenes: [
          {
            beatId: 'sc-1',
            html: '<div>Scene 1</div>',
            css: '',
            buildJs: '',
            status: 'ok',
            version: 1
          }
        ],
        createdAt: Date.now()
      }
    };

    it('3e: throws error if isCompositionMode and createCompositionFrameRenderer returns null', async () => {
      vi.spyOn(compRendererModule, 'createCompositionFrameRenderer').mockResolvedValue(null);

      await expect(exportMooProjectToMP4(baseProject, () => {})).rejects.toThrow(
        /Composition renderer gagal diinisialisasi untuk mode komposisi/
      );
    });

    it('3e: aborts export when 3 consecutive frame failures occur in composition mode', async () => {
      let renderCallCount = 0;
      const mockRenderer: compRendererModule.FrameRenderer = {
        renderFrame: vi.fn().mockImplementation(() => {
          renderCallCount++;
          return Promise.reject(new Error(`Simulated render failure ${renderCallCount}`));
        }),
        cleanup: vi.fn()
      };

      vi.spyOn(compRendererModule, 'createCompositionFrameRenderer').mockResolvedValue(mockRenderer);

      await expect(exportMooProjectToMP4(baseProject, () => {})).rejects.toThrow(
        /3 kegagalan frame berturut-turut/
      );
      expect(mockRenderer.cleanup).toHaveBeenCalled();
    });

    it('3e: collects warning count when frame errors are less than 3 consecutive', async () => {
      let renderCallCount = 0;
      const mockRenderer: compRendererModule.FrameRenderer = {
        renderFrame: vi.fn().mockImplementation(() => {
          renderCallCount++;
          // Fail only on frame 2
          if (renderCallCount === 2) {
            return Promise.reject(new Error('Intermittent render failure'));
          }
          return Promise.resolve();
        }),
        cleanup: vi.fn()
      };

      vi.spyOn(compRendererModule, 'createCompositionFrameRenderer').mockResolvedValue(mockRenderer);

      const result = await exportMooProjectToMP4(baseProject, () => {});
      expect(result).toBeDefined();
      expect(result.warnings.some((w) => w.includes('1 frame yang gagal dirender'))).toBe(true);
      expect(mockRenderer.cleanup).toHaveBeenCalled();
    });

    it('3f: uses audioDuration when useAudioDuration is true and warns if divergence > 0.5s', async () => {
      // Audio buffer mock duration is 3.0s, while baseProject scene duration sum is 1.0s (|3.0 - 1.0| = 2.0s > 0.5s)
      const projectWithAudio: MooProject = {
        ...baseProject,
        renderMode: 'legacy-canvas', // Use legacy canvas to test duration without comp renderer
        audioBlob: new Blob(['dummy audio bytes'], { type: 'audio/mp3' })
      };

      const result = await exportMooProjectToMP4(projectWithAudio, () => {}, undefined, {
        useAudioDuration: true
      });

      expect(result.durationSeconds).toBe(3.0);
      expect(result.warnings.some((w) => w.includes('lebih dari 0.5s'))).toBe(true);
    });

    it('3f: uses scene duration sum when useAudioDuration is false', async () => {
      const projectWithAudio: MooProject = {
        ...baseProject,
        renderMode: 'legacy-canvas',
        audioBlob: new Blob(['dummy audio bytes'], { type: 'audio/mp3' })
      };

      const result = await exportMooProjectToMP4(projectWithAudio, () => {}, undefined, {
        useAudioDuration: false
      });

      expect(result.durationSeconds).toBe(1.0);
    });

    it('3f: respects audioStale equivalent when opts.useAudioDuration is not specified', async () => {
      const projectStaleAudio = {
        ...baseProject,
        renderMode: 'legacy-canvas' as const,
        audioBlob: new Blob(['dummy audio bytes'], { type: 'audio/mp3' }),
        audioStale: true
      };

      const result = await exportMooProjectToMP4(projectStaleAudio as any, () => {});
      expect(result.durationSeconds).toBe(1.0); // Uses scenes duration because audioStale is true
    });
  });
});
