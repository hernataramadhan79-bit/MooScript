import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GeneratedScene, MooProject, Scene } from '../src/types';

vi.mock('../src/engine/ai/director/directorPipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/ai/director/directorPipeline')>();
  return {
    ...actual,
    generateCustomScene: vi.fn(async ({ beat }: { beat: { id: string } }) => ({
      id: beat.id,
      beatId: beat.id,
      duration: 3,
      html: `<div data-layer-id="hero-${beat.id}">${beat.id}</div>`,
      css: '',
      buildJs: '',
      status: 'ok',
      version: 1,
      userEdited: false,
      generatorVersion: 'generative-mograph-v2'
    }))
  };
});

import { useMooStore } from '../src/store/useMooStore';
import { generateCustomScene } from '../src/engine/ai/director/directorPipeline';

const scene = (id: string): Scene =>
  ({
    id,
    narrationText: `Narasi ${id}`,
    text: `Narasi ${id}`,
    focusWords: [],
    motionPreset: 'punch_zoom',
    durationInSeconds: 3,
    wordTimestamps: []
  }) as unknown as Scene;

const BASE_PROJECT = {
  id: 'proj-editor-features',
  title: 'Editor Features',
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
  scenes: [scene('a'), scene('b'), scene('c')],
  audioDuration: 9,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
} as unknown as MooProject;

const compScene = (id: string): GeneratedScene | undefined =>
  useMooStore.getState().project.composition?.scenes.find((m) => m.beatId === id);

describe('reordering scenes', () => {
  beforeEach(() => useMooStore.getState().setProject(BASE_PROJECT));

  it('moves a scene and can be undone', () => {
    useMooStore.getState().reorderScenes(0, 2);
    expect(useMooStore.getState().project.scenes.map((s) => s.id)).toEqual(['b', 'c', 'a']);

    useMooStore.getState().undo();
    expect(useMooStore.getState().project.scenes.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores moves that change nothing or point outside the list', () => {
    useMooStore.getState().reorderScenes(1, 1);
    useMooStore.getState().reorderScenes(0, 5);
    expect(useMooStore.getState().project.scenes.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(useMooStore.getState().canUndo).toBe(false);
  });
});

describe('export settings', () => {
  beforeEach(() => useMooStore.getState().setProject(BASE_PROJECT));

  it('are remembered on the project and merged field by field', () => {
    useMooStore.getState().updateExportSettings({ fps: 60 });
    useMooStore.getState().updateExportSettings({ format: 'webm' });
    expect(useMooStore.getState().project.exportSettings).toEqual({ fps: 60, format: 'webm' });
  });
});

describe('AI scene generation in the store', () => {
  beforeEach(() => {
    vi.mocked(generateCustomScene).mockClear();
    useMooStore.getState().setProject(BASE_PROJECT);
    useMooStore.setState((s) => ({
      settings: { ...s.settings, selectedLLMProvider: 'gemini', apiKeys: { ...s.settings.apiKeys, gemini: 'test-key' } },
      isCompilingMograph: false,
      revisingSceneId: null
    }));
  });

  it('generates every scene, clears its progress and is one undo step', async () => {
    await useMooStore.getState().generateAllScenesAi();

    expect(generateCustomScene).toHaveBeenCalledTimes(3);
    for (const id of ['a', 'b', 'c']) expect(compScene(id)?.status).toBe('ok');
    expect(useMooStore.getState().isCompilingMograph).toBe(false);
    expect(useMooStore.getState().mographStats).toBeNull();

    useMooStore.getState().undo();
    expect(compScene('a')?.generatorVersion).not.toBe('generative-mograph-v2');
    expect(useMooStore.getState().canUndo).toBe(false);
  });

  it('regenerates one scene without touching the others', async () => {
    await useMooStore.getState().regenerateSceneAi('b', 'lebih dramatis');

    expect(generateCustomScene).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateCustomScene).mock.calls[0][0];
    expect(call.beat.visualIntent).toContain('Instruksi perubahan: lebih dramatis');
    expect(compScene('b')?.userEdited).toBe(true);
    expect(compScene('a')?.generatorVersion).not.toBe('generative-mograph-v2');
    expect(useMooStore.getState().revisingSceneId).toBeNull();
    // The instruction steers one generation only.
    expect(useMooStore.getState().project.scenes[1].visualIntent).toBeUndefined();
  });

  it('does nothing without an API key', async () => {
    useMooStore.setState((s) => ({ settings: { ...s.settings, apiKeys: {} } }));
    await useMooStore.getState().generateAllScenesAi();
    await useMooStore.getState().regenerateSceneAi('a');
    expect(generateCustomScene).not.toHaveBeenCalled();
  });

  const failedModule = (id: string): GeneratedScene => ({
    id,
    beatId: id,
    duration: 3,
    html: '',
    css: '',
    buildJs: '',
    status: 'error',
    errors: ['429 rate limit'],
    version: 1,
    userEdited: false
  });

  it('keeps the visual a scene already had when regenerating it fails', async () => {
    await useMooStore.getState().regenerateSceneAi('b');
    const before = compScene('b');
    expect(before?.status).toBe('ok');

    vi.mocked(generateCustomScene).mockResolvedValueOnce(failedModule('b'));
    await useMooStore.getState().regenerateSceneAi('b', 'lebih ramai');

    expect(compScene('b')).toEqual(before);
    expect(useMooStore.getState().toasts.some((t) => t.message.includes('visual sebelumnya dipertahankan'))).toBe(true);
  });

  it('shows the failure when the scene had no visual of its own yet', async () => {
    vi.mocked(generateCustomScene).mockResolvedValueOnce(failedModule('c'));
    await useMooStore.getState().regenerateSceneAi('c');
    expect(compScene('c')?.status).toBe('error');
  });

  it('does not bring back a scene deleted while its visual was being made', async () => {
    vi.mocked(generateCustomScene).mockImplementationOnce(async ({ beat }) => {
      useMooStore.getState().removeScene('b');
      return { ...failedModule(beat.id), status: 'ok', html: '<div>late</div>' };
    });
    await useMooStore.getState().regenerateSceneAi('b');

    const state = useMooStore.getState();
    expect(state.project.scenes.map((s) => s.id)).toEqual(['a', 'c']);
    expect(state.project.composition?.scenes.map((m) => m.beatId)).toEqual(['a', 'c']);
  });
});
