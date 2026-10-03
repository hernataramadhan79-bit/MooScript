import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import * as llmModule from '../src/engine/ai/llm';

describe('scriptSlice (Phase 1c & 1f)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useMooStore.setState({
      previousScenesSnapshot: null,
      isGeneratingScript: false,
      settings: {
        ...useMooStore.getState().settings,
        apiKeys: {
          ...useMooStore.getState().settings.apiKeys,
          gemini: 'fake-api-key'
        },
        selectedLLMProvider: 'gemini'
      },
      project: {
        ...useMooStore.getState().project,
        scenes: [
          {
            id: 'original-scene',
            layout: 'KINETIC_QUOTE',
            text: 'Original Scene',
            narrationText: 'Original Scene',
            visualData: {},
            focusWords: [],
            motionPreset: 'punch_zoom',
            durationInSeconds: 3,
            wordTimestamps: []
          }
        ]
      },
      toasts: []
    });
  });

  it('does NOT set previousScenesSnapshot if storyboard generation fails', async () => {
    vi.spyOn(llmModule, 'generateStoryboard').mockRejectedValueOnce(
      new Error('API quota exceeded')
    );

    await useMooStore.getState().generateScript();

    expect(useMooStore.getState().previousScenesSnapshot).toBeNull();
    const toasts = useMooStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'error' && t.message.includes('API quota exceeded'))).toBe(true);
  });

  it('sets previousScenesSnapshot only AFTER successful storyboard generation', async () => {
    vi.spyOn(llmModule, 'generateStoryboard').mockResolvedValueOnce({
      title: 'New Storyboard',
      scenes: [
        {
          layout: 'KINETIC_QUOTE',
          text: 'Generated Scene',
          camera: 'steady_drift',
          visualData: {},
          focusWords: ['Generated'],
          motionPreset: 'punch_zoom',
          icon: 'sparkles'
        }
      ]
    });

    await useMooStore.getState().generateScript();

    const snapshot = useMooStore.getState().previousScenesSnapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot![0].id).toBe('original-scene');
    expect(useMooStore.getState().project.scenes[0].text).toBe('Generated Scene');
  });

  it('handles cancellation and displays cancelled info toast without setting previousScenesSnapshot', async () => {
    vi.spyOn(llmModule, 'generateStoryboard').mockImplementation(async (opts) => {
      return new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('User cancelled script generation', 'AbortError'));
        });
      });
    });

    const promise = useMooStore.getState().generateScript();
    useMooStore.getState().cancelGenerateScript();
    await promise;

    expect(useMooStore.getState().previousScenesSnapshot).toBeNull();
    const toasts = useMooStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'info' && t.message.includes('cancelled'))).toBe(true);
  });
});
