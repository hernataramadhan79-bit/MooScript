import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import { purgeLocalModel, isLocalModelCached, synthesizeLocalTTS, LOCAL_VOICES } from '../src/engine/ai/localTts';
import { generateSceneAudio } from '../src/engine/ai/tts';
import type { MooProject, Scene } from '../src/types';

class MockAudioBuffer {
  sampleRate = 48000;
  numberOfChannels = 2;
  duration = 2.0;
  length = 96000;
  getChannelData() {
    return new Float32Array(96000);
  }
}

class MockAudioContext {
  decodeAudioData() {
    return Promise.resolve(new MockAudioBuffer());
  }
  close() {
    return Promise.resolve();
  }
}

describe('Offline TTS Fix & Audio Deletion Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).AudioBuffer = MockAudioBuffer;
    (globalThis as any).AudioContext = MockAudioContext;
  });
  describe('deleteAudio store action', () => {
    it('clears project audioBlob, audioDuration, rawVoiceBlob, waveformPeaks and scene timestamps', async () => {

      const initialProject: MooProject = {
        id: 'test-delete-audio-project',
        title: 'Delete Audio Test',
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
            id: 'scene-1',
            layout: 'KINETIC_QUOTE',
            narrationText: 'Teks dengan suara tergenerate.',
            text: 'Teks dengan suara tergenerate.',
            visualData: { title: 'Scene 1', focusWords: ['suara'] },
            focusWords: ['suara'],
            motionPreset: 'punch_zoom',
            durationInSeconds: 3.5,
            wordTimestamps: [
              { word: 'Teks', start: 0, end: 0.5 },
              { word: 'dengan', start: 0.5, end: 1.0 },
              { word: 'suara', start: 1.0, end: 1.8 }
            ]
          }
        ],
        audioBlob: new Blob(['fake-audio-bytes'], { type: 'audio/wav' }),
        audioDuration: 3.5
      };

      // Set initial store state with audio present
      useMooStore.setState({
        project: initialProject,
        audioBlobUrl: 'blob:http://localhost/test-audio',
        rawVoiceBlob: new Blob(['raw-voice'], { type: 'audio/wav' }),
        waveformPeaks: [0.2, 0.5, 0.8, 0.4],
        audioStale: false
      });

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // Call deleteAudio action
      await useMooStore.getState().deleteAudio();

      const updatedState = useMooStore.getState();
      expect(updatedState.project.audioBlob).toBeUndefined();
      expect(updatedState.project.audioDuration).toBe(0);
      expect(updatedState.audioBlobUrl).toBeNull();
      expect(updatedState.rawVoiceBlob).toBeNull();
      expect(updatedState.waveformPeaks).toBeNull();
      expect(updatedState.audioStale).toBe(false);
      expect(updatedState.project.scenes[0].wordTimestamps).toEqual([]);
      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/test-audio');
    });
  });

  describe('purgeLocalModel & Cache Management', () => {
    it('deletes model from CacheStorage successfully', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockMatch = vi.fn().mockResolvedValue(null);
      const mockCache = {
        delete: mockDelete,
        match: mockMatch
      };

      (globalThis as any).caches = {
        open: vi.fn().mockResolvedValue(mockCache),
        delete: vi.fn().mockResolvedValue(true)
      };

      const voice = LOCAL_VOICES[0];
      await purgeLocalModel(voice.id);

      expect(mockDelete).toHaveBeenCalledWith(voice.configUrl);
      expect(mockDelete).toHaveBeenCalledWith(voice.modelUrl);
    });

    it('reports isLocalModelCached as false when items missing in cache', async () => {
      const mockCache = {
        match: vi.fn().mockResolvedValue(null)
      };
      (globalThis as any).caches = {
        open: vi.fn().mockResolvedValue(mockCache)
      };

      const isCached = await isLocalModelCached('id_ID-news_tts');
      expect(isCached).toBe(false);
    });
  });

  describe('synthesizeLocalTTS customization parameters', () => {
    it('accepts noiseScale and noiseW parameters without throwing', async () => {
      const result = await synthesizeLocalTTS({
        text: 'Pengujian kustomisasi intonasi dan ritme.',
        voiceId: 'id_ID-news_tts',
        speed: 1.25,
        noiseScale: 0.75,
        noiseW: 0.9
      });

      expect(result.audioBlob).toBeInstanceOf(Blob);
      expect(result.duration).toBeGreaterThan(0.5);
      expect(result.wordTimestamps.length).toBeGreaterThan(0);
    });
  });

  describe('generateSceneAudio for timer/fallback provider', () => {
    const mockScene: Scene = {
      id: 'sc-timer',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Teks mode tanpa suara untuk menghitung durasi saja.',
      text: 'Teks mode tanpa suara untuk menghitung durasi saja.',
      visualData: { title: 'Timer Test', focusWords: ['durasi'] },
      focusWords: ['durasi'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    };

    it('generates silent audio with valid word alignment and estimated duration', async () => {
      const segment = await generateSceneAudio({
        scene: mockScene,
        provider: 'timer',
        apiKeys: {},
        voiceId: 'id_ID-news_tts',
        speed: 1.0
      });

      expect(segment.sceneId).toBe('sc-timer');
      expect(segment.audioBlob).toBeInstanceOf(Blob);
      expect(segment.audioDuration).toBeGreaterThan(1.0);
      expect(segment.wordTimestamps.length).toBeGreaterThan(0);
      expect(segment.fromCache).toBe(false);
    });
  });
});
