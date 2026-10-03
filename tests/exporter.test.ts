import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportMooProjectToMP4 } from '../src/engine/export/mp4Exporter';
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
  duration = 1.0;
  length = 48000;
  getChannelData() {
    return new Float32Array(48000);
  }
  copyFromChannel(dest: Float32Array) {
    dest.fill(0);
  }
}

const TEST_PROJECT: MooProject = {
  id: 'export-test-project',
  title: 'Export Test',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#121214',
    textPrimary: '#ffffff',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center'
  },
  scenes: [
    {
      id: 'sc-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'One second test',
      text: 'One second test',
      visualData: {
        title: 'Test Scene',
        focusWords: ['test']
      },
      focusWords: ['test'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 1.0,
      wordTimestamps: [{ word: 'One', start: 0, end: 1.0 }]
    }
  ],
  audioDuration: 1.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('MP4 Exporter Engine (Mediabunny)', () => {
  let origVideoEncoder: any;
  let origAudioEncoder: any;
  let origVideoFrame: any;
  let origAudioData: any;
  let origEncodedVideoChunk: any;
  let origEncodedAudioChunk: any;
  let origOffscreenCanvas: any;
  let origAudioBuffer: any;
  let origCreateObjectURL: any;

  beforeEach(() => {
    origVideoEncoder = (globalThis as any).VideoEncoder;
    origAudioEncoder = (globalThis as any).AudioEncoder;
    origVideoFrame = (globalThis as any).VideoFrame;
    origAudioData = (globalThis as any).AudioData;
    origEncodedVideoChunk = (globalThis as any).EncodedVideoChunk;
    origEncodedAudioChunk = (globalThis as any).EncodedAudioChunk;
    origOffscreenCanvas = (globalThis as any).OffscreenCanvas;
    origAudioBuffer = (globalThis as any).AudioBuffer;
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
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-export-url');
  });

  afterEach(() => {
    (globalThis as any).VideoEncoder = origVideoEncoder;
    (globalThis as any).AudioEncoder = origAudioEncoder;
    (globalThis as any).VideoFrame = origVideoFrame;
    (globalThis as any).AudioData = origAudioData;
    (globalThis as any).EncodedVideoChunk = origEncodedVideoChunk;
    (globalThis as any).EncodedAudioChunk = origEncodedAudioChunk;
    (globalThis as any).OffscreenCanvas = origOffscreenCanvas;
    (globalThis as any).AudioBuffer = origAudioBuffer;
    URL.createObjectURL = origCreateObjectURL;
  });

  it('successfully exports a project to MP4 with clean progress updates via Mediabunny', async () => {
    const progressUpdates: number[] = [];

    const result = await exportMooProjectToMP4(
      TEST_PROJECT,
      (progress) => progressUpdates.push(progress.percent),
      undefined,
      { hud: false, watermark: false }
    );

    expect(result).toBeDefined();
    expect(result.durationSeconds).toBe(1.0);
    expect(result.objectUrl).toBe('blob:mock-export-url');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(progressUpdates.length).toBeGreaterThan(5);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });

  it('manages encoder backpressure via Mediabunny dequeue queue', async () => {
    let dequeueTriggered = false;

    class BackpressureVideoEncoder extends MockVideoEncoder {
      encode(frame: MockVideoFrame, opts?: any) {
        this.encodeQueueSize = 5; // Triggers dequeue wait (>= 4)
        setTimeout(() => {
          this.encodeQueueSize = 0;
          dequeueTriggered = true;
          this.dispatchEvent({ type: 'dequeue' });
        }, 15);
        super.encode(frame, opts);
      }
    }

    (globalThis as any).VideoEncoder = BackpressureVideoEncoder;

    const result = await exportMooProjectToMP4(TEST_PROJECT, () => {});
    expect(result).toBeDefined();
    expect(dequeueTriggered).toBe(true);
  });

  it('captures VideoEncoder errors and rejects cleanly without returning a successful file', async () => {
    class FailingVideoEncoder extends MockVideoEncoder {
      encode(_frame: MockVideoFrame, _opts?: any) {
        this.error(new Error('GPU context lost during encoding'));
      }
    }

    (globalThis as any).VideoEncoder = FailingVideoEncoder;

    await expect(exportMooProjectToMP4(TEST_PROJECT, () => {})).rejects.toThrow(/GPU context lost during encoding/);
  });

  it('aborts export cleanly when AbortSignal triggers', async () => {
    const controller = new AbortController();

    class StallingVideoEncoder extends MockVideoEncoder {
      encode(frame: MockVideoFrame, opts?: any) {
        if (frame.timestamp >= 66000) {
          controller.abort(new DOMException('Export was cancelled by user', 'AbortError'));
        }
        super.encode(frame, opts);
      }
    }

    (globalThis as any).VideoEncoder = StallingVideoEncoder;

    await expect(exportMooProjectToMP4(TEST_PROJECT, () => {}, controller.signal)).rejects.toThrow(/cancelled/i);
  });

  it('warns and produces video-only export when browser lacks AudioEncoder', async () => {
    delete (globalThis as any).AudioEncoder;

    const projectWithAudio: MooProject = {
      ...TEST_PROJECT,
      audioBlob: new Blob(['fake audio bytes'], { type: 'audio/mp3' })
    };

    const result = await exportMooProjectToMP4(projectWithAudio, () => {});
    expect(result).toBeDefined();
    expect(result.hasAudio).toBe(false);
    expect(result.warnings.some((w) => w.includes('AudioEncoder tidak didukung'))).toBe(true);
  });
});
