import { describe, expect, it } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { syncComposition } from '../src/engine/composition/sync';

describe('setSceneTransitionTiming', () => {
  const load = () =>
    useMooStore.getState().setProject(
      syncComposition({
        ...INITIAL_PROJECT,
        scenes: [
          { id: 'a', narrationText: 'Satu', durationInSeconds: 3, wordTimestamps: [] },
          { id: 'b', narrationText: 'Dua', durationInSeconds: 3, wordTimestamps: [] }
        ]
      })
    );
  const sceneA = () => useMooStore.getState().project.scenes[0];

  it('clamps the length, accepts known curves and clears with null', () => {
    load();
    useMooStore.getState().setSceneTransitionTiming('a', { duration: 9, curve: 'sharp' });
    expect(sceneA()).toMatchObject({ transitionDuration: 2, transitionCurve: 'sharp' });

    useMooStore.getState().setSceneTransitionTiming('a', { duration: 0.01 });
    expect(sceneA().transitionDuration).toBe(0.1);
    expect(sceneA().transitionCurve).toBe('sharp');

    useMooStore.getState().setSceneTransitionTiming('a', { curve: 'wobble' as any });
    expect(sceneA().transitionCurve).toBeUndefined();

    useMooStore.getState().setSceneTransitionTiming('a', { duration: null });
    expect(sceneA().transitionDuration).toBeUndefined();
  });

  it('passes the timing to the stage', () => {
    load();
    useMooStore.getState().setSceneTransitionTiming('a', { duration: 0.8, curve: 'rush' });
    const doc = buildCompositionDocument(useMooStore.getState().project);
    expect(doc).toContain('transitionDuration: 0.8');
    expect(doc).toContain('transitionCurve: "rush"');
  });
});
