import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';

describe('Timeline Studio Suite (Playback & Transport)', () => {
  beforeEach(() => {
    useMooStore.setState({
      currentFrame: 0,
      isPlaying: false,
      isLooping: false,
      activeSceneId: null,
      project: {
        id: 'timeline-test-proj',
        title: 'Timeline Test',
        scenes: [
          {
            id: 'scene-1',
            text: 'Intro shot',
            visualIntent: 'Introduction sequence',
            narrationText: 'Welcome to the studio',
            durationInSeconds: 3.0,
            layout: 'hero',
            order: 0,
            status: 'ready',
            userEdited: false
          },
          {
            id: 'scene-2',
            text: 'Middle shot',
            visualIntent: 'Feature demonstration',
            narrationText: 'Here are the key features',
            durationInSeconds: 5.0,
            layout: 'grid',
            order: 1,
            status: 'ready',
            userEdited: false
          }
        ],
        audioDuration: 8.0,
        fps: 30,
        aspectRatio: '16:9',
        theme: 'midnight-violet',
        bgm: { preset: 'none', level: 0.2, duckRatio: 0.15 },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
  });

  it('toggles loop mode cleanly in PlaybackSlice', () => {
    const store = useMooStore.getState();
    expect(store.isLooping).toBe(false);

    store.toggleLoop();
    expect(useMooStore.getState().isLooping).toBe(true);

    store.toggleLoop();
    expect(useMooStore.getState().isLooping).toBe(false);
  });

  it('steps frames forward and backward with frame-accurate clamping', () => {
    const store = useMooStore.getState();
    const fps = store.project.fps || 30;
    const totalDuration = store.project.audioDuration || 8;
    const maxFrames = Math.round(totalDuration * fps); // 240

    // Step forward 1 frame
    store.seekFrame(1);
    expect(useMooStore.getState().currentFrame).toBe(1);

    // Step back 1 frame
    store.seekFrame(0);
    expect(useMooStore.getState().currentFrame).toBe(0);

    // Cannot step below 0
    store.seekFrame(-1);
    expect(useMooStore.getState().currentFrame).toBe(0);

    // Cannot step beyond maxFrames
    store.seekFrame(maxFrames + 50);
    expect(useMooStore.getState().currentFrame).toBe(maxFrames);
  });

  it('formats studio timecode to precision mm:ss.t', () => {
    const formatTimecode = (sec: number) => {
      const safeSec = Math.max(0, isNaN(sec) ? 0 : sec);
      const mins = Math.floor(safeSec / 60);
      const s = Math.floor(safeSec % 60);
      const tenths = Math.floor((safeSec % 1) * 10);
      return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
    };

    expect(formatTimecode(2.1)).toBe('00:02.1');
    expect(formatTimecode(15.0)).toBe('00:15.0');
    expect(formatTimecode(0)).toBe('00:00.0');
    expect(formatTimecode(65.4)).toBe('01:05.4');
  });

  it('supports selecting scenes and setting activeSceneId on shot jump', () => {
    const store = useMooStore.getState();
    const fps = store.project.fps || 30;
    const targetScene = store.project.scenes[1]; // starts at 3.0s = 90 frames

    store.seekFrame(Math.round(3.0 * fps));
    store.setActiveSceneId(targetScene.id);

    expect(useMooStore.getState().currentFrame).toBe(90);
    expect(useMooStore.getState().activeSceneId).toBe('scene-2');
  });
});
