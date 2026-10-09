/**
 * tests/audioBgmStandalone.test.ts
 * Tests for AUDIO-001 (BGM Decoupling & Independent Audio Track):
 * 1. renderStandaloneBgm generates valid blobs with correct duration
 * 2. remixAudio re-mixes audio without re-triggering TTS API
 * 3. updateBgmPreset / Level / DuckRatio automatically triggers remixAudio when rawVoiceBlob exists
 * 4. generateBgmOnlyAudio generates standalone BGM audio when project has no vocals
 * 5. generateAudio with fallback provider generates standalone BGM if preset !== 'none'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderStandaloneBgm } from '../src/engine/audio/bgmMixer';
import * as bgmMixerModule from '../src/engine/audio/bgmMixer';
import * as ttsModule from '../src/engine/ai/tts';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

// ── Web Audio Mocks ─────────────────────────────────────────────────────────

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

  getChannelData(_channelIndex = 0) {
    return this.data;
  }

  copyFromChannel(dest: Float32Array) {
    dest.fill(0);
  }
}

class MockAudioParam {
  value = 1;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
}

class MockOscillatorNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  loop = false;
  connect = vi.fn();
  start = vi.fn();
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

  createBuffer(channels: number, len: number, sr: number) {
    return new MockAudioBuffer(channels, len, sr);
  }

  createBufferSource() {
    return new MockBufferSourceNode();
  }

  createOscillator() {
    return new MockOscillatorNode();
  }

  createGain() {
    return new MockGainNode();
  }

  startRendering() {
    return Promise.resolve(new MockAudioBuffer(this.numberOfChannels, this.length, this.sampleRate));
  }
}

class MockAudioContext {
  decodeAudioData(_arrayBuffer: ArrayBuffer) {
    return Promise.resolve(new MockAudioBuffer(2, 48000 * 3, 48000));
  }
  close() {
    return Promise.resolve();
  }
}

// ── Test Project Fixtures ──────────────────────────────────────────────────

const createTestProject = (): MooProject => ({
  id: 'proj-bgm-standalone-test',
  title: 'BGM Standalone Test',
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
      narrationText: 'Scene one vocal narration',
      text: 'Scene one vocal narration',
      durationInSeconds: 2.0,
      wordTimestamps: [
        { word: 'Scene', start: 0, end: 0.5 },
        { word: 'one', start: 0.5, end: 1.0 },
        { word: 'vocal', start: 1.0, end: 1.5 },
        { word: 'narration', start: 1.5, end: 2.0 }
      ]
    },
    {
      id: 'sc-2',
      layout: 'METRIC_COUNTER',
      narrationText: 'Scene two short',
      text: 'Scene two short',
      durationInSeconds: 1.5,
      wordTimestamps: [
        { word: 'Scene', start: 0, end: 0.5 },
        { word: 'two', start: 0.5, end: 1.0 },
        { word: 'short', start: 1.0, end: 1.5 }
      ]
    }
  ],
  audioDuration: 3.5,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
});

describe('AUDIO-001: BGM Decoupling & Independent Audio Track', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).AudioBuffer = MockAudioBuffer;
    (globalThis as any).AudioContext = MockAudioContext;
    (globalThis as any).OfflineAudioContext = MockOfflineAudioContext;

    let urlCounter = 0;
    globalThis.URL.createObjectURL = vi.fn(() => `blob:mock-url-${++urlCounter}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  describe('renderStandaloneBgm', () => {
    it('returns null for preset "none"', async () => {
      const blob = await renderStandaloneBgm('none', 5.0);
      expect(blob).toBeNull();
    });

    it('returns null for non-positive duration', async () => {
      const blobZero = await renderStandaloneBgm('ambient', 0);
      expect(blobZero).toBeNull();

      const blobNegative = await renderStandaloneBgm('ambient', -1.5);
      expect(blobNegative).toBeNull();
    });

    it('generates a valid WAV Blob for each procedural preset', async () => {
      const presets = ['ambient', 'hiphop', 'cinematic', 'lofi'] as const;

      for (const preset of presets) {
        const durationSec = 3.0;
        const blob = await renderStandaloneBgm(preset, durationSec, 0.2);

        expect(blob).not.toBeNull();
        expect(blob).toBeInstanceOf(Blob);
        expect(blob!.size).toBeGreaterThan(44); // At least WAV header size
      }
    });

    it('renders BGM buffer with matching length based on duration and sampleRate', async () => {
      const duration = 2.5;
      const sr = 48000;
      const expectedLength = Math.ceil(duration * sr);

      let capturedLength = 0;
      let capturedSr = 0;
      const OrigOfflineContext = (globalThis as any).OfflineAudioContext;
      (globalThis as any).OfflineAudioContext = class extends OrigOfflineContext {
        constructor(channels: number, length: number, sampleRate: number) {
          super(channels, length, sampleRate);
          capturedLength = length;
          capturedSr = sampleRate;
        }
      };

      const blob = await renderStandaloneBgm('ambient', duration, 0.25, sr);

      expect(blob).not.toBeNull();
      expect(capturedLength).toBe(expectedLength);
      expect(capturedSr).toBe(sr);

      (globalThis as any).OfflineAudioContext = OrigOfflineContext;
    });
  });

  describe('remixAudio', () => {
    it('re-mixes existing rawVoiceBlob with new BGM settings without calling TTS API', async () => {
      const ttsSpy = vi.spyOn(ttsModule, 'generateProjectAudioPerScene');
      const openaiSpy = vi.spyOn(ttsModule, 'generateOpenAITTS');
      const elevenSpy = vi.spyOn(ttsModule, 'generateElevenLabsTTS');
      const mixSpy = vi.spyOn(bgmMixerModule, 'mixVoiceAndBgm');

      const rawVoiceBlob = new Blob(['mock-raw-voice'], { type: 'audio/wav' });
      const testProj = createTestProject();
      testProj.bgm = { preset: 'ambient', level: 0.2, duckRatio: 0.12 };

      useMooStore.setState({
        project: testProj,
        rawVoiceBlob,
        audioBlobUrl: 'blob:old-url',
        audioStale: false
      });

      await useMooStore.getState().remixAudio();

      // 1. TTS APIs must NOT be called
      expect(ttsSpy).not.toHaveBeenCalled();
      expect(openaiSpy).not.toHaveBeenCalled();
      expect(elevenSpy).not.toHaveBeenCalled();

      // 2. mixVoiceAndBgm must be called with the decoded voice and active BGM settings
      expect(mixSpy).toHaveBeenCalledTimes(1);
      const mixArgs = mixSpy.mock.calls[0];
      expect(mixArgs[1].bgmPreset).toBe('ambient');
      expect(mixArgs[1].bgmLevel).toBe(0.2);
      expect(mixArgs[1].duckRatio).toBe(0.12);

      // 3. Audio state updated
      const state = useMooStore.getState();
      expect(state.project.audioBlob).toBeDefined();
      expect(state.audioBlobUrl).not.toBe('blob:old-url');
      expect(state.audioStale).toBe(false);

      mixSpy.mockRestore();
    });

    it('restores rawVoiceBlob when preset is "none" without re-synthesizing voice', async () => {
      const mixSpy = vi.spyOn(bgmMixerModule, 'mixVoiceAndBgm');
      const rawVoiceBlob = new Blob(['mock-raw-voice-clean'], { type: 'audio/wav' });

      const testProj = createTestProject();
      testProj.bgm = { preset: 'none', level: 0.18, duckRatio: 0.15 };

      useMooStore.setState({
        project: testProj,
        rawVoiceBlob,
        audioBlobUrl: 'blob:old-url',
        audioStale: false
      });

      await useMooStore.getState().remixAudio();

      expect(mixSpy).not.toHaveBeenCalled();
      const state = useMooStore.getState();
      expect(state.project.audioBlob).toBe(rawVoiceBlob);
      expect(state.audioStale).toBe(false);

      mixSpy.mockRestore();
    });

    it('does nothing if rawVoiceBlob is not present', async () => {
      const mixSpy = vi.spyOn(bgmMixerModule, 'mixVoiceAndBgm');

      useMooStore.setState({
        project: createTestProject(),
        rawVoiceBlob: null,
        audioBlobUrl: null,
        audioStale: false
      });

      await useMooStore.getState().remixAudio();

      expect(mixSpy).not.toHaveBeenCalled();
      mixSpy.mockRestore();
    });
  });

  describe('bgmSlice reactivity with rawVoiceBlob', () => {
    it('automatically remixes audio and preserves audioStale: false when updateBgmPreset is called', async () => {
      const rawVoiceBlob = new Blob(['voice-data'], { type: 'audio/wav' });
      const testProj = createTestProject();
      const toastSpy = vi.fn();

      useMooStore.setState({
        project: testProj,
        rawVoiceBlob,
        audioBlobUrl: 'blob:voice-url',
        audioStale: false,
        addToast: toastSpy
      });

      await useMooStore.getState().updateBgmPreset('hiphop');

      const state = useMooStore.getState();
      expect(state.project.bgm?.preset).toBe('hiphop');
      expect(state.audioStale).toBe(false);
      expect(state.project.audioBlob).toBeDefined();

      // Must not show "BGM berubah. Generate ulang audio..."
      expect(
        toastSpy.mock.calls.some((call) => call[0].includes('Generate ulang audio'))
      ).toBe(false);
    });

    it('automatically remixes audio when updateBgmLevel or updateBgmDuckRatio is called', async () => {
      const rawVoiceBlob = new Blob(['voice-data'], { type: 'audio/wav' });
      const testProj = createTestProject();
      testProj.bgm = { preset: 'ambient', level: 0.18, duckRatio: 0.15 };

      useMooStore.setState({
        project: testProj,
        rawVoiceBlob,
        audioBlobUrl: 'blob:voice-url',
        audioStale: false
      });

      await useMooStore.getState().updateBgmLevel(0.4);
      expect(useMooStore.getState().project.bgm?.level).toBe(0.4);
      expect(useMooStore.getState().audioStale).toBe(false);

      await useMooStore.getState().updateBgmDuckRatio(0.3);
      expect(useMooStore.getState().project.bgm?.duckRatio).toBe(0.3);
      expect(useMooStore.getState().audioStale).toBe(false);
    });
  });

  describe('generateBgmOnlyAudio', () => {
    it('generates standalone BGM audio for total scene duration when project has no vocal track', async () => {
      const testProj = createTestProject();
      testProj.bgm = { preset: 'cinematic', level: 0.25, duckRatio: 0.15 };
      // Scenes total duration: 2.0 + 1.5 = 3.5s

      useMooStore.setState({
        project: testProj,
        rawVoiceBlob: null,
        audioBlobUrl: null,
        audioStale: false
      });

      await useMooStore.getState().generateBgmOnlyAudio();

      const state = useMooStore.getState();
      expect(state.project.audioBlob).toBeDefined();
      expect(state.project.audioDuration).toBe(3.5);
      expect(state.audioBlobUrl).toBeDefined();
      expect(state.audioStale).toBe(false);
    });

    it('calling updateBgmPreset with no vocal track automatically triggers generateBgmOnlyAudio', async () => {
      const testProj = createTestProject();
      testProj.bgm = { preset: 'none', level: 0.18, duckRatio: 0.15 };

      useMooStore.setState({
        project: testProj,
        rawVoiceBlob: null,
        audioBlobUrl: null,
        audioStale: false
      });

      await useMooStore.getState().updateBgmPreset('lofi');

      const state = useMooStore.getState();
      expect(state.project.bgm?.preset).toBe('lofi');
      expect(state.project.audioBlob).toBeDefined();
      expect(state.audioBlobUrl).toBeDefined();
      expect(state.audioStale).toBe(false);
    });
  });

  describe('generateAudio with fallback provider and BGM preset', () => {
    it('generates standalone BGM audio in fallback mode when preset !== "none"', async () => {
      const testProj = createTestProject();
      testProj.bgm = { preset: 'ambient', level: 0.2, duckRatio: 0.15 };

      useMooStore.setState({
        project: testProj,
        settings: {
          ...useMooStore.getState().settings,
          selectedTTSProvider: 'fallback'
        },
        rawVoiceBlob: null,
        audioBlobUrl: null,
        audioStale: false
      });

      await useMooStore.getState().generateAudio();

      const state = useMooStore.getState();
      // Should have audioBlob so video is not silent!
      expect(state.project.audioBlob).toBeDefined();
      expect(state.audioBlobUrl).not.toBeNull();
      expect(state.audioStale).toBe(false);
      expect(state.rawVoiceBlob).toBeNull();
    });
  });
});
