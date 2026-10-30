import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

const INITIAL_TEST_PROJECT: MooProject = {
  id: 'proj-shortcuts',
  title: 'Shortcut Project',
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
      id: 'sc-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Scene 1',
      text: 'Scene 1',
      visualData: { title: 'Scene 1', focusWords: ['Scene'] },
      focusWords: ['Scene'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    },
    {
      id: 'sc-2',
      layout: 'TERMINAL_MOCKUP',
      narrationText: 'Scene 2',
      text: 'Scene 2',
      visualData: { title: 'Scene 2', focusWords: ['Scene'] },
      focusWords: ['Scene'],
      motionPreset: 'slide_up',
      durationInSeconds: 2.0,
      wordTimestamps: []
    }
  ],
  audioDuration: 4.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Workstation Keyboard Shortcuts Actions', () => {
  beforeEach(() => {
    const store = useMooStore.getState();
    store.setProject(INITIAL_TEST_PROJECT);
    store.setActiveSceneId('sc-1');
  });

  it('navigates next and previous scenes correctly', () => {
    const store = useMooStore.getState();
    const scenes = store.project.scenes;
    expect(scenes.length).toBe(2);

    // Arrow down moves to next
    const curIdx = scenes.findIndex((s) => s.id === store.activeSceneId);
    const nextIdx = curIdx + 1;
    store.setActiveSceneId(scenes[nextIdx].id);
    expect(useMooStore.getState().activeSceneId).toBe('sc-2');

    // Arrow up moves to previous
    store.setActiveSceneId(scenes[0].id);
    expect(useMooStore.getState().activeSceneId).toBe('sc-1');
  });

  it('duplicates active scene and increases scenes count', () => {
    const store = useMooStore.getState();
    store.duplicateScene('sc-1');
    const updated = useMooStore.getState().project.scenes;
    expect(updated.length).toBe(3);
    expect(updated[1].id).not.toBe('sc-1');
  });

  it('removes active scene if more than 1 scene exists', () => {
    const store = useMooStore.getState();
    store.removeScene('sc-2');
    const updated = useMooStore.getState().project.scenes;
    expect(updated.length).toBe(1);
    expect(updated[0].id).toBe('sc-1');
  });

  it('seeks frame forward and backward by fps delta', () => {
    const store = useMooStore.getState();
    store.seekFrame(30);
    expect(useMooStore.getState().currentFrame).toBe(30);

    // Shuttle backward 1 second (-30 frames)
    const fps = store.project.fps || 30;
    store.seekFrame(Math.max(0, 30 - fps));
    expect(useMooStore.getState().currentFrame).toBe(0);

    // Shuttle forward 1 second (+30 frames)
    store.seekFrame(Math.min(120, 0 + fps));
    expect(useMooStore.getState().currentFrame).toBe(30);
  });
});
