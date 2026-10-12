import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

const BASE_PROJECT: MooProject = {
  id: 'proj-undo-test',
  title: 'Undo Test Project',
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
      id: 'sc-undo-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Initial narration',
      text: 'Initial narration',
      visualData: { title: 'Initial', focusWords: ['Initial'] },
      focusWords: ['Initial'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    }
  ],
  audioDuration: 2.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Global Undo / Redo Store Functionality', () => {
  beforeEach(() => {
    const store = useMooStore.getState();
    store.setProject(BASE_PROJECT);
  });

  it('initializes with canUndo and canRedo set to false', () => {
    const store = useMooStore.getState();
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });

  it('records snapshot on scene addition and supports undo/redo', () => {
    const store = useMooStore.getState();
    expect(store.project.scenes.length).toBe(1);

    store.addScene();
    expect(useMooStore.getState().project.scenes.length).toBe(2);
    expect(useMooStore.getState().canUndo).toBe(true);
    expect(useMooStore.getState().canRedo).toBe(false);

    // Undo scene addition
    store.undo();
    expect(useMooStore.getState().project.scenes.length).toBe(1);
    expect(useMooStore.getState().canUndo).toBe(false);
    expect(useMooStore.getState().canRedo).toBe(true);

    // Redo scene addition
    store.redo();
    expect(useMooStore.getState().project.scenes.length).toBe(2);
    expect(useMooStore.getState().canUndo).toBe(true);
    expect(useMooStore.getState().canRedo).toBe(false);
  });

  it('records snapshot on text mutation and restores previous text on undo', () => {
    const store = useMooStore.getState();
    store.updateSceneText('sc-undo-1', 'Updated text');
    expect(useMooStore.getState().project.scenes[0].text).toBe('Updated text');
    expect(useMooStore.getState().canUndo).toBe(true);

    store.undo();
    expect(useMooStore.getState().project.scenes[0].text).toBe('Initial narration');
    expect(useMooStore.getState().canRedo).toBe(true);

    store.redo();
    expect(useMooStore.getState().project.scenes[0].text).toBe('Updated text');
  });

  it('records snapshot on theme changes and restores them on undo', () => {
    const store = useMooStore.getState();
    store.updateThemeFont('Mono');
    expect(useMooStore.getState().project.theme.fontFamily).toBe('Mono');
    expect(useMooStore.getState().canUndo).toBe(true);

    store.undo();
    expect(useMooStore.getState().project.theme.fontFamily).toBe('Jakarta');
  });

  it('resets undo/redo history when setProject is called', () => {
    const store = useMooStore.getState();
    store.addScene();
    expect(useMooStore.getState().canUndo).toBe(true);

    store.setProject({ ...BASE_PROJECT, id: 'proj-other' });
    expect(useMooStore.getState().canUndo).toBe(false);
    expect(useMooStore.getState().canRedo).toBe(false);
  });
});
