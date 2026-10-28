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
    expect(toasts.some((t) => t.type === 'info' && t.message.includes('dibatalkan'))).toBe(true);
  });

  it('drops the storyboard when another project was opened while it was generating', async () => {
    const before = useMooStore.getState().project;
    vi.spyOn(llmModule, 'generateStoryboard').mockImplementation(async () => {
      useMooStore.setState({ project: { ...before, id: 'proj-opened-meanwhile', scenes: [] } });
      return { title: 'Late Storyboard', scenes: [{ narration: 'Late scene', visualIntent: 'late' }] } as any;
    });

    await useMooStore.getState().generateScript();

    const state = useMooStore.getState();
    expect(state.project.id).toBe('proj-opened-meanwhile');
    expect(state.project.scenes).toHaveLength(0);
    expect(state.previousScenesSnapshot).toBeNull();
    expect(state.isGeneratingScript).toBe(false);
  });

  it('restores the whole previous project, visuals and audio included, from "Urungkan"', async () => {
    const audio = new Blob(['voice'], { type: 'audio/wav' });
    const original = useMooStore.getState().project;
    useMooStore.setState({
      project: {
        ...original,
        title: 'Before AI',
        audioBlob: audio,
        composition: {
          id: 'comp-x',
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 3,
          scenes: [
            {
              id: 'original-scene',
              beatId: 'original-scene',
              duration: 3,
              html: '<div data-moo-layer="hero">Hero</div>',
              css: '',
              buildJs: '',
              status: 'ok',
              version: 2,
              userEdited: true
            }
          ],
          createdAt: 1
        }
      },
      rawVoiceBlob: audio
    });
    vi.spyOn(llmModule, 'generateStoryboard').mockResolvedValueOnce({
      title: 'After AI',
      scenes: [{ narration: 'Generated', visualIntent: 'gen' }]
    } as any);

    await useMooStore.getState().generateScript();
    expect(useMooStore.getState().project.title).toBe('After AI');
    expect(useMooStore.getState().project.audioBlob).toBeUndefined();

    await useMooStore.getState().undoGenerateScript();
    const restored = useMooStore.getState();
    expect(restored.project.title).toBe('Before AI');
    expect(restored.project.scenes[0].id).toBe('original-scene');
    expect(restored.project.composition?.scenes[0].html).toContain('Hero');
    expect(restored.project.audioBlob).toBe(audio);
    expect(restored.rawVoiceBlob).toBe(audio);
    expect(restored.previousScenesSnapshot).toBeNull();
  });
});
