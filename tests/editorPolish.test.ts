import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import { getProjectDuration, getSceneStartSeconds } from '../src/utils/projectDuration';
import type { MooProject, Scene } from '../src/types';

const scene = (id: string, durationInSeconds: number, text = `Narasi ${id}`): Scene =>
  ({
    id,
    narrationText: text,
    text,
    focusWords: [],
    motionPreset: 'punch_zoom',
    durationInSeconds,
    wordTimestamps: []
  }) as unknown as Scene;

const BASE_PROJECT = {
  id: 'proj-editor-polish',
  title: 'Editor Polish',
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
  scenes: [scene('a', 2), scene('b', 3), scene('c', 4)],
  audioDuration: 9,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
} as unknown as MooProject;

describe('project duration', () => {
  it('follows the scenes, and the voice-over only when there are no scenes', () => {
    expect(getProjectDuration({ ...BASE_PROJECT, audioDuration: 20 })).toBe(9);
    expect(getProjectDuration({ ...BASE_PROJECT, scenes: [], audioDuration: 12 })).toBe(12);
    expect(getProjectDuration({ ...BASE_PROJECT, scenes: [], audioDuration: 0 })).toBe(0);
  });

  it('finds the start of each scene', () => {
    expect(getSceneStartSeconds(BASE_PROJECT.scenes, 'a')).toBe(0);
    expect(getSceneStartSeconds(BASE_PROJECT.scenes, 'c')).toBe(5);
    expect(getSceneStartSeconds(BASE_PROJECT.scenes, 'missing')).toBeNull();
  });

  it('lets playback seek to the end of the scenes even when stale audio is shorter', () => {
    useMooStore.getState().setProject({ ...BASE_PROJECT, audioDuration: 4 });
    useMooStore.getState().seekFrame(10_000);
    expect(useMooStore.getState().currentFrame).toBe(9 * 30);
  });
});

describe('focusScene', () => {
  beforeEach(() => {
    useMooStore.getState().setProject(BASE_PROJECT);
    useMooStore.setState({ currentFrame: 0, activeSceneId: null });
  });

  it('moves the playhead into the chosen scene so the timeline keeps it selected', () => {
    useMooStore.getState().focusScene('c');
    expect(useMooStore.getState().activeSceneId).toBe('c');
    expect(useMooStore.getState().currentFrame).toBe(5 * 30);
  });

  it('keeps the playhead where it is when it is already inside the scene', () => {
    useMooStore.getState().seekFrame(3 * 30);
    useMooStore.getState().focusScene('b');
    expect(useMooStore.getState().currentFrame).toBe(3 * 30);
    expect(useMooStore.getState().activeSceneId).toBe('b');
  });

  it('ignores unknown scenes', () => {
    useMooStore.getState().focusScene('missing');
    expect(useMooStore.getState().activeSceneId).toBeNull();
  });
});

describe('undo history for burst edits', () => {
  beforeEach(() => {
    useMooStore.getState().setProject(BASE_PROJECT);
  });

  it('turns a burst of typing in one scene into a single undo step', () => {
    const store = useMooStore.getState();
    for (const text of ['H', 'Ha', 'Hal', 'Halo']) {
      store.updateSceneText('a', text);
    }
    expect(useMooStore.getState().project.scenes[0].narrationText).toBe('Halo');

    store.undo();
    expect(useMooStore.getState().project.scenes[0].narrationText).toBe('Narasi a');
    expect(useMooStore.getState().canUndo).toBe(false);
  });

  it('keeps edits to different fields as separate steps', () => {
    const store = useMooStore.getState();
    store.updateSceneText('a', 'Satu');
    store.updateSceneText('b', 'Dua');

    store.undo();
    expect(useMooStore.getState().project.scenes[1].narrationText).toBe('Narasi b');
    expect(useMooStore.getState().project.scenes[0].narrationText).toBe('Satu');
  });

  it('does not merge across an unrelated action', () => {
    const store = useMooStore.getState();
    store.updateSceneText('a', 'Satu');
    store.addScene();
    store.updateSceneText('a', 'Satu lagi');

    store.undo();
    expect(useMooStore.getState().project.scenes[0].narrationText).toBe('Satu');
    expect(useMooStore.getState().project.scenes).toHaveLength(4);
  });
});
