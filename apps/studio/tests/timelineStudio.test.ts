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

  it('calculates cumulative start seconds and synchronizes seek accurately', () => {
    const store = useMooStore.getState();
    const scenes = store.project.scenes;
    const fps = store.project.fps || 30;

    // Scene 0 starts at 0s
    const start0 = scenes.slice(0, 0).reduce((acc, s) => acc + (s.durationInSeconds || 3), 0);
    expect(start0).toBe(0);

    // Scene 1 starts at scene 0's duration (3.0s)
    const start1 = scenes.slice(0, 1).reduce((acc, s) => acc + (s.durationInSeconds || 3), 0);
    expect(start1).toBe(3.0);
    store.seekFrame(Math.round(start1 * fps));
    store.setActiveSceneId(scenes[1].id);

    expect(useMooStore.getState().currentFrame).toBe(90);
    expect(useMooStore.getState().activeSceneId).toBe('scene-2');
  });

  it('determines active scene boundary across timeline scrub positions', () => {
    const store = useMooStore.getState();
    const scenes = store.project.scenes;

    let accumulated = 0;
    const boundaries = scenes.map((s, idx) => {
      const start = accumulated;
      const dur = s.durationInSeconds || 3;
      const end = accumulated + dur;
      accumulated = end;
      return { ...s, shotNumber: idx + 1, startSec: start, endSec: end };
    });

    const getActiveSceneAtSec = (sec: number) => {
      const idx = boundaries.findIndex((s) => sec >= s.startSec && sec < s.endSec);
      if (idx >= 0) return boundaries[idx];
      if (sec >= accumulated && boundaries.length > 0) return boundaries[boundaries.length - 1];
      return boundaries[0];
    };

    expect(getActiveSceneAtSec(0).id).toBe('scene-1');
    expect(getActiveSceneAtSec(1.5).id).toBe('scene-1');
    expect(getActiveSceneAtSec(2.99).id).toBe('scene-1');
    expect(getActiveSceneAtSec(3.0).id).toBe('scene-2');
    expect(getActiveSceneAtSec(5.5).id).toBe('scene-2');
    expect(getActiveSceneAtSec(10.0).id).toBe('scene-2');
  });

  it('handles undefined durationInSeconds with unified 3.0s fallback without desync', () => {
    const fps = 30;
    const scenes = [
      { id: 'sc-1', durationInSeconds: undefined },
      { id: 'sc-2', durationInSeconds: 4.0 }
    ];

    let accumulated = 0;
    const boundaries = scenes.map((s, idx) => {
      const start = accumulated;
      const dur = s.durationInSeconds || 3;
      const end = accumulated + dur;
      accumulated = end;
      return {
        id: s.id,
        shotNumber: idx + 1,
        startSec: start,
        endSec: end,
        startFrame: Math.round(start * fps),
        endFrame: Math.round(end * fps)
      };
    });

    expect(boundaries[0].startSec).toBe(0);
    expect(boundaries[0].endSec).toBe(3);
    expect(boundaries[0].startFrame).toBe(0);
    expect(boundaries[0].endFrame).toBe(90);

    expect(boundaries[1].startSec).toBe(3);
    expect(boundaries[1].endSec).toBe(7);
    expect(boundaries[1].startFrame).toBe(90);
    expect(boundaries[1].endFrame).toBe(210);

    // Clicking sc-1 seeks to frame 0
    const frameSc1 = Math.round(boundaries[0].startSec * fps);
    const matchedSc1 = boundaries.find((b) => frameSc1 >= b.startFrame && frameSc1 < b.endFrame);
    expect(matchedSc1?.id).toBe('sc-1');

    // Clicking sc-2 seeks to frame 90
    const frameSc2 = Math.round(boundaries[1].startSec * fps);
    const matchedSc2 = boundaries.find((b) => frameSc2 >= b.startFrame && frameSc2 < b.endFrame);
    expect(matchedSc2?.id).toBe('sc-2');
  });

  it('prevents downward Math.round frame rounding desync at 24fps and 30fps', () => {
    // 1. Initial project scenes at 24fps clicking Scene 3 (startSec 6.8s)
    const fps24 = 24;
    const scenes24 = [
      { id: 'sc-1', durationInSeconds: 3.2 },
      { id: 'sc-2', durationInSeconds: 3.6 },
      { id: 'sc-3', durationInSeconds: 3.2 }
    ];

    let acc24 = 0;
    const boundaries24 = scenes24.map((s, idx) => {
      const start = acc24;
      const dur = s.durationInSeconds || 3;
      const end = acc24 + dur;
      acc24 = end;
      return {
        id: s.id,
        shotNumber: idx + 1,
        startSec: start,
        endSec: end,
        startFrame: Math.round(start * fps24),
        endFrame: Math.round(end * fps24)
      };
    });

    // Scene 3 starts at 6.8s -> Math.round(6.8 * 24) = 163 frames
    const target24StartSec = scenes24.slice(0, 2).reduce((sum, s) => sum + (s.durationInSeconds || 3), 0);
    expect(target24StartSec).toBeCloseTo(6.8);
    const currentFrame24 = Math.round(target24StartSec * fps24);
    expect(currentFrame24).toBe(163);

    // Discrete frame comparison matches sc-3, not sc-2
    const matched24 = boundaries24.find(
      (b) => currentFrame24 >= b.startFrame && currentFrame24 < b.endFrame
    );
    expect(matched24?.id).toBe('sc-3');

    // 2. Realistic TTS scene at 30fps clicking Scene 2 (startSec 2.34s)
    const fps30 = 30;
    const scenes30 = [
      { id: 'sc-1', durationInSeconds: 2.34 },
      { id: 'sc-2', durationInSeconds: 3.12 }
    ];

    let acc30 = 0;
    const boundaries30 = scenes30.map((s, idx) => {
      const start = acc30;
      const dur = s.durationInSeconds || 3;
      const end = acc30 + dur;
      acc30 = end;
      return {
        id: s.id,
        shotNumber: idx + 1,
        startSec: start,
        endSec: end,
        startFrame: Math.round(start * fps30),
        endFrame: Math.round(end * fps30)
      };
    });

    // Scene 2 starts at 2.34s -> Math.round(2.34 * 30) = 70 frames
    const target30StartSec = scenes30.slice(0, 1).reduce((sum, s) => sum + (s.durationInSeconds || 3), 0);
    expect(target30StartSec).toBe(2.34);
    const currentFrame30 = Math.round(target30StartSec * fps30);
    expect(currentFrame30).toBe(70);

    const matched30 = boundaries30.find(
      (b) => currentFrame30 >= b.startFrame && currentFrame30 < b.endFrame
    );
    expect(matched30?.id).toBe('sc-2');
  });
});
