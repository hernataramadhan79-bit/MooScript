import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeDeterministicWordAlignment,
  calculateFallbackSceneDuration,
  generateSceneAudio
} from '../src/engine/ai/tts';
import * as mooDb from '../src/db/mooDb';
import * as localTts from '../src/engine/ai/localTts';

describe('TTS Alignment & Duration Algorithms', () => {
  describe('computeDeterministicWordAlignment', () => {
    it('returns empty array for empty or whitespace-only text', () => {
      expect(computeDeterministicWordAlignment('', 5.0)).toEqual([]);
      expect(computeDeterministicWordAlignment('   \n\t  ', 5.0)).toEqual([]);
    });

    it('distributes duration such that total duration matches input', () => {
      const text = 'Deterministic client-side motion graphics rendering in browser tabs.';
      const totalDur = 4.5;
      const offset = 1.0;
      const alignment = computeDeterministicWordAlignment(text, totalDur, offset);

      expect(alignment.length).toBe(8);
      expect(alignment[0].start).toBe(offset);
      // Last word end should match offset + totalDur (allowing slight rounding tolerance)
      const lastWord = alignment[alignment.length - 1];
      expect(lastWord.end).toBeCloseTo(offset + totalDur, 2);

      // Each word should strictly follow sequentially
      for (let i = 1; i < alignment.length; i++) {
        expect(alignment[i].start).toBeCloseTo(alignment[i - 1].end, 2);
      }
    });

    it('assigns greater duration to punctuated words (comma, period)', () => {
      // Compare equal-length words: 'word', 'word,', 'word.'
      const text = 'test test, test.';
      const alignment = computeDeterministicWordAlignment(text, 6.0, 0);

      expect(alignment.length).toBe(3);
      const durPlain = alignment[0].end - alignment[0].start;
      const durComma = alignment[1].end - alignment[1].start;
      const durPeriod = alignment[2].end - alignment[2].start;

      // test (weight 4), test, (weight 4+4=8), test. (weight 4+7=11)
      expect(durComma).toBeGreaterThan(durPlain);
      expect(durPeriod).toBeGreaterThan(durComma);
    });

    it('is 100% deterministic on repeated runs', () => {
      const text = 'Zero server rendering directly inside browser tabs.';
      const run1 = computeDeterministicWordAlignment(text, 3.2);
      const run2 = computeDeterministicWordAlignment(text, 3.2);
      expect(run1).toEqual(run2);
    });
  });

  describe('calculateFallbackSceneDuration', () => {
    it('returns 2.0s minimum fallback for empty text', () => {
      expect(calculateFallbackSceneDuration('')).toBe(2.0);
      expect(calculateFallbackSceneDuration('   ')).toBe(2.0);
    });

    it('calculates duration correctly using (wordCount / 130) * 60 + 1.2', () => {
      // 13 words at 130 WPM => (13 / 130) * 60 = 6s + 1.2s = 7.2s
      const text = 'One two three four five six seven eight nine ten eleven twelve thirteen';
      expect(calculateFallbackSceneDuration(text, 130)).toBe(7.2);
    });

    it('respects custom reading speeds', () => {
      const text = 'Fast speaking rate testing';
      // 4 words at 200 WPM => (4 / 200) * 60 + 1.2 = 1.2 + 1.2 = 2.4s
      expect(calculateFallbackSceneDuration(text, 200)).toBe(2.4);
    });
  });
});

describe('generateSceneAudio', () => {
  class MockAudioBuffer {
    sampleRate = 22050;
    numberOfChannels = 1;
    duration = 2.5;
    length = 22050 * 2.5;
    getChannelData() {
      return new Float32Array(this.length);
    }
  }

  beforeEach(() => {
    (globalThis as any).AudioContext = class {
      decodeAudioData() {
        return Promise.resolve(new MockAudioBuffer());
      }
      close() {
        return Promise.resolve();
      }
    };
  });

  it('keeps a scene without narration silent for its own length, without calling a TTS provider', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const segment = await generateSceneAudio({
      scene: { id: 'quiet', narrationText: '   ', durationInSeconds: 2.5, wordTimestamps: [] },
      provider: 'openai',
      apiKeys: {},
      voiceId: 'alloy'
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(segment.paddedDuration).toBe(2.5);
    expect(segment.wordTimestamps).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('caches Piper audio per expressiveness setting', async () => {
    const getSpy = vi.spyOn(mooDb, 'getCachedSceneAudio').mockResolvedValue(undefined);
    vi.spyOn(localTts, 'synthesizeLocalTTS').mockResolvedValue({
      audioBlob: new Blob(['wav']),
      wordTimestamps: []
    } as Awaited<ReturnType<typeof localTts.synthesizeLocalTTS>>);
    vi.spyOn(mooDb, 'putCachedSceneAudio').mockResolvedValue();

    const scene = { id: 'pip', narrationText: 'Halo dunia', durationInSeconds: 2, wordTimestamps: [] };
    await generateSceneAudio({ scene, provider: 'local', apiKeys: {}, voiceId: 'id_ID-news_tts', noiseScale: 0.3 });
    await generateSceneAudio({ scene, provider: 'local', apiKeys: {}, voiceId: 'id_ID-news_tts', noiseScale: 0.9 });

    const keys = getSpy.mock.calls.map((c) => c[0]);
    expect(keys[0]).not.toBe(keys[1]);
    vi.restoreAllMocks();
  });
});
