import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import * as ttsModule from '../src/engine/ai/tts';
import {
  alignOpenAIAudioWithWhisper,
  calculateFallbackSceneDuration,
  computeDeterministicWordAlignment,
  generateProjectAudioPerScene
} from '../src/engine/ai/tts';
import type { MooProject, Scene } from '../src/types';

describe('Fallback Provider Timer Mode (Phase 6a)', () => {
  const testScenes: Scene[] = [
    {
      id: 'sc-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'First scene with multiple spoken words for timer',
      text: 'First scene with multiple spoken words for timer',
      durationInSeconds: 10, // will be recalculated
      wordTimestamps: []
    },
    {
      id: 'sc-2',
      layout: 'METRIC_COUNTER',
      narrationText: 'Second scene shorter',
      text: 'Second scene shorter',
      durationInSeconds: 10, // will be recalculated
      wordTimestamps: []
    }
  ];

  const testProject: MooProject = {
    id: 'proj-fallback-test',
    title: 'Fallback Test Project',
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
      captionPosition: 'center'
    },
    scenes: testScenes,
    audioDuration: 20,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
  };

  beforeEach(() => {
    useMooStore.setState({
      project: JSON.parse(JSON.stringify(testProject)),
      settings: {
        ...useMooStore.getState().settings,
        selectedTTSProvider: 'fallback'
      },
      audioBlobUrl: 'blob:mock-old-url',
      audioStale: true,
      isGeneratingAudio: false,
      audioProgress: null
    });
  });

  it('recalculates durations, removes audioBlob, sets audioStale: false and emits toast', async () => {
    const toastSpy = vi.fn();
    useMooStore.setState({ addToast: toastSpy });

    await useMooStore.getState().generateAudio();

    const state = useMooStore.getState();
    const updated = state.project;

    // 1. audioBlob must be undefined
    expect(updated.audioBlob).toBeUndefined();

    // 2. audioBlobUrl must be null
    expect(state.audioBlobUrl).toBeNull();

    // 3. audioStale must be false
    expect(state.audioStale).toBe(false);

    // 4. Durations must match calculateFallbackSceneDuration
    const expectedDur1 = calculateFallbackSceneDuration(testScenes[0].narrationText!);
    const expectedDur2 = calculateFallbackSceneDuration(testScenes[1].narrationText!);
    expect(updated.scenes[0].durationInSeconds).toBe(expectedDur1);
    expect(updated.scenes[1].durationInSeconds).toBe(expectedDur2);

    // 5. Word timestamps must match deterministic alignment
    expect(updated.scenes[0].wordTimestamps?.length).toBe(testScenes[0].narrationText!.split(' ').length);
    expect(updated.scenes[1].wordTimestamps?.length).toBe(testScenes[1].narrationText!.split(' ').length);

    // 6. Total duration equals sum
    expect(updated.audioDuration).toBeCloseTo(expectedDur1 + expectedDur2, 2);

    // 7. Toast message
    expect(toastSpy).toHaveBeenCalledWith('Mode timer: durasi dihitung dari panjang teks (tanpa suara).', 'info');
  });
});

describe('Stale Closure Protection in generateAudio (Phase 6b)', () => {
  const baseProject: MooProject = {
    id: 'proj-stale-test',
    title: 'Stale Test Project',
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
      captionPosition: 'center'
    },
    scenes: [
      {
        id: 'sc-1',
        layout: 'KINETIC_QUOTE',
        narrationText: 'Initial text for scene one',
        text: 'Initial text for scene one',
        durationInSeconds: 3.0,
        wordTimestamps: []
      }
    ],
    audioDuration: 3.0,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
  };

  beforeEach(() => {
    useMooStore.setState({
      project: JSON.parse(JSON.stringify(baseProject)),
      settings: {
        ...useMooStore.getState().settings,
        selectedTTSProvider: 'openai'
      },
      isGeneratingAudio: false
    });
  });

  it('drops audio results if active project changed during generation', async () => {
    const toastSpy = vi.fn();
    const mockAudioBlob = new Blob(['mock audio'], { type: 'audio/wav' });

    const spy = vi.spyOn(ttsModule, 'generateProjectAudioPerScene').mockImplementation(async () => {
      // User switches project while generation is underway
      useMooStore.setState({
        project: {
          ...baseProject,
          id: 'proj-switched-another'
        }
      });
      return {
        updatedProject: {
          ...baseProject,
          audioBlob: mockAudioBlob,
          audioDuration: 3.5
        },
        audioBlob: mockAudioBlob,
        totalDuration: 3.5,
        cacheHitCount: 0,
        apiCallCount: 1
      };
    });

    useMooStore.setState({
      project: JSON.parse(JSON.stringify(baseProject)),
      addToast: toastSpy
    });

    await useMooStore.getState().generateAudio();

    expect(toastSpy).toHaveBeenCalledWith('Project berganti, hasil audio dibuang.', 'warning');
    expect(useMooStore.getState().project.id).toBe('proj-switched-another');

    spy.mockRestore();
  });

  it('merges audio results and sets audioStale: true if scene text changed during generation', async () => {
    const mockAudioBlob = new Blob(['mock audio'], { type: 'audio/wav' });

    const spy = vi.spyOn(ttsModule, 'generateProjectAudioPerScene').mockImplementation(async () => {
      // User concurrently updates title and scene narration text
      const current = useMooStore.getState().project;
      useMooStore.setState({
        project: {
          ...current,
          title: 'Renamed While Generating',
          scenes: [
            {
              ...current.scenes[0],
              narrationText: 'Updated text while audio was rendering'
            }
          ]
        }
      });
      return {
        updatedProject: {
          ...baseProject,
          scenes: [
            {
              ...baseProject.scenes[0],
              durationInSeconds: 4.2,
              wordTimestamps: [{ word: 'Initial', start: 0, end: 1 }]
            }
          ],
          audioBlob: mockAudioBlob,
          audioDuration: 4.2
        },
        audioBlob: mockAudioBlob,
        totalDuration: 4.2,
        cacheHitCount: 0,
        apiCallCount: 1
      };
    });

    useMooStore.setState({
      project: JSON.parse(JSON.stringify(baseProject))
    });

    await useMooStore.getState().generateAudio();

    const state = useMooStore.getState();
    // 1. Concurrent edits (title and text) were NOT clobbered
    expect(state.project.title).toBe('Renamed While Generating');
    expect(state.project.scenes[0].narrationText).toBe('Updated text while audio was rendering');
    // 2. Scene duration from generated audio was merged in
    expect(state.project.scenes[0].durationInSeconds).toBe(4.2);
    // 3. Because narrationText changed during generation, audioStale MUST be true
    expect(state.audioStale).toBe(true);

    spy.mockRestore();
  });
});

describe('Whisper Alignment Mismatch Fallback (Phase 6d)', () => {
  it('returns empty array and falls back to deterministic alignment when word count mismatches', async () => {
    const mockAudioBlob = new Blob(['speech'], { type: 'audio/mp3' });
    const scriptText = 'This is a test of whisper alignment'; // 7 words

    // Mock global fetch returning 4 words from Whisper (e.g. abbreviation or missed words)
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        words: [
          { word: 'This', start: 0, end: 0.5 },
          { word: 'is', start: 0.5, end: 0.8 },
          { word: 'test', start: 0.8, end: 1.4 },
          { word: 'whisper', start: 1.4, end: 2.0 }
        ]
      })
    } as unknown as Response);

    const result = await alignOpenAIAudioWithWhisper({
      apiKey: 'sk-test',
      audioBlob: mockAudioBlob,
      sceneText: scriptText
    });

    // Because Whisper returned 4 words but script has 7 words, it must return empty []
    expect(result).toEqual([]);

    // And fallback deterministic alignment produces 7 words scaled to audio duration
    const fallback = computeDeterministicWordAlignment(scriptText, 2.0);
    expect(fallback.length).toBe(7);
    expect(fallback[0].word).toBe('This');
    expect(fallback[fallback.length - 1].word).toBe('alignment');

    mockFetch.mockRestore();
  });
});

describe('Worker Abort on First Failure (Phase 6c)', () => {
  it('aborts all workers immediately when one worker throws', async () => {
    const mockProject: MooProject = {
      id: 'proj-worker-abort',
      title: 'Worker Abort Test',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: {
        bg: '#000',
        textPrimary: '#fff',
        textHighlight: '#84cc16',
        fontFamily: 'Jakarta',
        captionStyle: 'boxed',
        captionPosition: 'center'
      },
      scenes: [
        {
          id: 'sc-1',
          layout: 'KINETIC_QUOTE',
          narrationText: 'Scene 1',
          durationInSeconds: 3,
          wordTimestamps: []
        },
        {
          id: 'sc-2',
          layout: 'KINETIC_QUOTE',
          narrationText: 'Scene 2',
          durationInSeconds: 3,
          wordTimestamps: []
        }
      ],
      audioDuration: 6
    };

    // Make OpenAI provider call fail
    const settings = {
      ...useMooStore.getState().settings,
      selectedTTSProvider: 'openai' as const,
      apiKeys: { ...useMooStore.getState().settings.apiKeys, openai: '' } // missing key
    };

    await expect(
      generateProjectAudioPerScene({
        project: mockProject,
        settings,
        concurrency: 2
      })
    ).rejects.toThrow();
  });
});
