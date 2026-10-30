import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDeviceCapabilities,
  pcmFloat32ToWavBlob,
  generateProceduralSpeechAudio,
  synthesizeLocalTTS,
  LOCAL_VOICES
} from '../src/engine/ai/localTts';
import { generateSceneAudio, generateProjectAudioPerScene } from '../src/engine/ai/tts';
import { exportMooProjectToMP4 } from '../src/engine/export/mp4Exporter';
import { createMockCanvas } from './mocks/mockCanvas';
import type { Scene, MooProject, EngineSettings } from '../src/types';

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
  codedWidth = 1080;
  codedHeight = 1920;
  displayWidth = 1080;
  displayHeight = 1920;
  closed = false;

  constructor(_source: any, init: { timestamp: number; duration: number }) {
    this.timestamp = init.timestamp;
    this.duration = init.duration;
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
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  length: number;
  private data: Float32Array;

  constructor(numberOfChannels = 2, length = 48000, sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.duration = length / sampleRate;
    this.data = new Float32Array(length);
  }

  getChannelData() {
    return this.data;
  }

  copyFromChannel(dest: Float32Array) {
    dest.fill(0);
  }
}

class MockAudioContext {
  decodeAudioData() {
    return Promise.resolve(new MockAudioBuffer(2, 48000 * 2, 48000));
  }
  close() {
    return Promise.resolve();
  }
}

class MockOfflineAudioContext {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  destination = {};

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn()
    };
  }

  startRendering() {
    return Promise.resolve(new MockAudioBuffer(this.numberOfChannels, this.length, this.sampleRate));
  }
}

describe('Local TTS Engine (Prompt 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).AudioBuffer = MockAudioBuffer;
    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).OfflineAudioContext = MockOfflineAudioContext;
  });

  describe('Device Capabilities Detection', () => {
    it('detects standard device capabilities without crashing', async () => {
      const caps = await checkDeviceCapabilities();
      expect(caps).toHaveProperty('hasWebGpu');
      expect(caps).toHaveProperty('deviceMemoryGb');
      expect(caps).toHaveProperty('hardwareConcurrency');
      expect(typeof caps.isLowEnd).toBe('boolean');
    });

    it('identifies low-end profile when hardware is constrained', async () => {
      const originalNav = globalThis.navigator;
      try {
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            ...originalNav,
            deviceMemory: 2,
            hardwareConcurrency: 2
          },
          configurable: true,
          writable: true
        });

        const caps = await checkDeviceCapabilities();
        expect(caps.isLowEnd).toBe(true);
        expect(caps.warningMessage).toBeDefined();
        expect(caps.warningMessage).toContain('terbatas');
      } finally {
        Object.defineProperty(globalThis, 'navigator', {
          value: originalNav,
          configurable: true,
          writable: true
        });
      }
    });
  });

  describe('Audio Conversion & Waveform Synthesis', () => {
    it('synthesizes procedural speech waveform matching text duration', () => {
      const text = 'Halo dunia, selamat datang di MooScript Studio.';
      const sampleRate = 22050;
      const result = generateProceduralSpeechAudio(text, sampleRate, 1.0);

      expect(result.samples).toBeInstanceOf(Float32Array);
      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.sampleRate).toBe(sampleRate);
      expect(result.duration).toBeGreaterThan(0.8);
      // Sample count should strictly match duration * sampleRate
      expect(result.samples.length).toBe(Math.round(result.duration * sampleRate));
    });

    it('converts Float32 audio samples to a valid 16-bit PCM WAV Blob', async () => {
      const sampleRate = 22050;
      const samples = new Float32Array(sampleRate); // 1.0 second of audio
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.5;
      }

      const blob = pcmFloat32ToWavBlob(samples, sampleRate);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');

      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // Check RIFF header
      const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      expect(riff).toBe('RIFF');

      // Check WAVE header
      const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      expect(wave).toBe('WAVE');

      // Check fmt subchunk
      expect(view.getUint16(20, true)).toBe(1); // PCM format
      expect(view.getUint16(22, true)).toBe(1); // 1 channel
      expect(view.getUint32(24, true)).toBe(sampleRate); // Sample rate
      expect(view.getUint16(34, true)).toBe(16); // 16 bits per sample
    });
  });

  describe('synthesizeLocalTTS', () => {
    it('synthesizes speech without any API key and computes deterministic word alignment', async () => {
      const text = 'Motion graphics 100% client side';
      const result = await synthesizeLocalTTS({
        text,
        voiceId: 'id_ID-news_tts',
        speed: 1.05
      });

      expect(result.audioBlob).toBeInstanceOf(Blob);
      expect(result.duration).toBeGreaterThan(0.5);
      expect(result.wordTimestamps.length).toBe(5);

      // Words should match sequential tokens
      expect(result.wordTimestamps[0].word).toBe('Motion');
      expect(result.wordTimestamps[4].word).toBe('side');
      expect(result.wordTimestamps[0].start).toBe(0);
      expect(result.wordTimestamps[4].end).toBeCloseTo(result.duration, 1);
    });

    it('rejects empty text with informative error', async () => {
      await expect(
        synthesizeLocalTTS({
          text: '   ',
          voiceId: 'id_ID-news_tts'
        })
      ).rejects.toThrow('Text cannot be empty');
    });

    it('supports Indonesian and English local voice configurations', () => {
      const indonesian = LOCAL_VOICES.find((v) => v.language === 'id');
      const english = LOCAL_VOICES.find((v) => v.language === 'en');

      expect(indonesian).toBeDefined();
      expect(indonesian?.id).toBe('id_ID-news_tts');
      expect(indonesian?.sampleRate).toBe(22050);

      expect(english).toBeDefined();
      expect(english?.id).toBe('en_US-lessac');
      expect(english?.sampleRate).toBe(22050);
    });
  });

  describe('Pipeline Integration: generateSceneAudio & Project Pipeline with Local Provider', () => {
    const mockScene: Scene = {
      id: 'sc-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'MooScript Studio engine video deterministik.',
      text: 'MooScript Studio engine video deterministik.',
      visualData: { title: 'Local TTS', focusWords: ['MooScript', 'deterministik'] },
      focusWords: ['MooScript', 'deterministik'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 3.0,
      wordTimestamps: []
    };

    it('generates scene audio for provider: local without API keys', async () => {
      const segment = await generateSceneAudio({
        scene: mockScene,
        provider: 'local',
        apiKeys: {}, // Zero API keys
        voiceId: 'id_ID-news_tts',
        speed: 1.05
      });

      expect(segment.sceneId).toBe('sc-1');
      expect(segment.audioBlob).toBeInstanceOf(Blob);
      expect(segment.audioDuration).toBeGreaterThan(0.5);
      expect(segment.wordTimestamps.length).toBe(5);
      expect(segment.fromCache).toBe(false);
    });

    it('generates full project audio for multiple scenes using local provider', async () => {
      const mockProject: MooProject = {
        id: 'proj-local-test',
        title: 'Local TTS Project',
        aspectRatio: '9:16',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#131315',
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
            narrationText: 'Adegan pertama narasi lokal.',
            text: 'Adegan pertama narasi lokal.',
            visualData: { title: 'Adegan 1', focusWords: ['pertama'] },
            focusWords: ['pertama'],
            motionPreset: 'punch_zoom',
            durationInSeconds: 2.0,
            wordTimestamps: []
          },
          {
            id: 'sc-2',
            layout: 'KINETIC_QUOTE',
            narrationText: 'Adegan kedua berjalan offline.',
            text: 'Adegan kedua berjalan offline.',
            visualData: { title: 'Adegan 2', focusWords: ['offline'] },
            focusWords: ['offline'],
            motionPreset: 'fade_float',
            durationInSeconds: 2.0,
            wordTimestamps: []
          }
        ],
        audioDuration: 0,
        bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
      };

      const settings: EngineSettings = {
        apiKeys: {},
        selectedLLMProvider: 'gemini',
        selectedTTSProvider: 'local',
        geminiModel: 'gemini-2.0-flash',
        openaiModel: 'gpt-4o-mini',
        groqModel: 'llama-3.3-70b-versatile',
        voiceIds: {
          openai: 'alloy',
          elevenlabs: '21m00Tcm4TlvDq8ikWAM',
          local: 'id_ID-news_tts'
        },
        speed: 1.05,
        stability: 85,
        duckingDb: -12,
        fps: 30
      };

      const result = await generateProjectAudioPerScene({
        project: mockProject,
        settings,
        concurrency: 2
      });

      expect(result.audioBlob).toBeInstanceOf(Blob);
      expect(result.totalDuration).toBeGreaterThan(1.0);
      expect(result.updatedProject.scenes[0].wordTimestamps.length).toBe(4);
      expect(result.updatedProject.scenes[1].wordTimestamps.length).toBe(4);
      expect(result.updatedProject.audioDuration).toBeCloseTo(result.totalDuration, 1);
    });

    it('ACCEPTANCE: generates local voiceover without API keys and exports MP4 with local audio', async () => {
      const mockProject: MooProject = {
        id: 'proj-local-acceptance',
        title: 'Local TTS Acceptance Project',
        aspectRatio: '9:16',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#131315',
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
            narrationText: 'MooScript Studio 100 persen offline.',
            text: 'MooScript Studio 100 persen offline.',
            visualData: { title: 'Offline Accept', focusWords: ['offline'] },
            focusWords: ['offline'],
            motionPreset: 'punch_zoom',
            durationInSeconds: 1.0,
            wordTimestamps: []
          }
        ],
        audioDuration: 0,
        bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
      };

      const settings: EngineSettings = {
        apiKeys: {}, // ZERO API KEYS
        selectedLLMProvider: 'gemini',
        selectedTTSProvider: 'local',
        geminiModel: 'gemini-2.0-flash',
        openaiModel: 'gpt-4o-mini',
        groqModel: 'llama-3.3-70b-versatile',
        voiceIds: {
          openai: 'alloy',
          elevenlabs: '21m00Tcm4TlvDq8ikWAM',
          local: 'id_ID-news_tts'
        },
        speed: 1.05,
        stability: 85,
        duckingDb: -12,
        fps: 30
      };

      // 1. Synthesize local audio for project scenes
      const ttsResult = await generateProjectAudioPerScene({
        project: mockProject,
        settings
      });

      expect(ttsResult.audioBlob).toBeInstanceOf(Blob);
      expect(ttsResult.totalDuration).toBeGreaterThan(0.5);

      // 2. Feed updated project with local audioBlob into exportMooProjectToMP4
      const projectForExport = ttsResult.updatedProject;
      expect(projectForExport.audioBlob).toBeDefined();

      (globalThis as any).VideoEncoder = MockVideoEncoder;
      (globalThis as any).AudioEncoder = MockAudioEncoder;
      (globalThis as any).VideoFrame = MockVideoFrame;
      (globalThis as any).AudioData = MockAudioData;
      (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;
      (globalThis as any).EncodedAudioChunk = MockEncodedAudioChunk;
      (globalThis as any).window = globalThis;
      (globalThis as any).OffscreenCanvas = class {
        width: number;
        height: number;
        private mock: any;
        constructor(w = 1080, h = 1920) {
          this.width = w;
          this.height = h;
          this.mock = createMockCanvas(w, h);
        }
        getContext(type: string) {
          return this.mock.canvas.getContext(type);
        }
      };
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:mock-local-mp4-url');

      const exportResult = await exportMooProjectToMP4(projectForExport, () => {});
      expect(exportResult).toBeDefined();
      expect(exportResult.blob).toBeInstanceOf(Blob);
      expect(exportResult.objectUrl).toBe('blob:mock-local-mp4-url');
      expect(exportResult.hasAudio).toBe(true);
    });
  });
});
