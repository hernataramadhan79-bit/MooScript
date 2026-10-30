import { beforeEach, describe, expect, it } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import { compileProceduralProject } from '../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../src/engine/composition/sync';
import { computeDeterministicWordAlignment } from '../src/engine/ai/tts';

const narration = 'Satu dua tiga empat lima enam';

beforeEach(() => {
  useMooStore.getState().setProject(
    compileProceduralProject(
      syncComposition({
        ...INITIAL_PROJECT,
        scenes: [
          { id: 'a', narrationText: narration, durationInSeconds: 3, wordTimestamps: computeDeterministicWordAlignment(narration, 3) },
          { id: 'b', narrationText: 'Penutup', durationInSeconds: 2, wordTimestamps: [] }
        ]
      }),
      'auto',
      true
    )
  );
});

const state = () => useMooStore.getState();

describe('splitSceneAt', () => {
  it('cuts the narration by word timing and plays the visual on from the cut', () => {
    const words = state().project.scenes[0].wordTimestamps;
    const cut = words[3].start;
    const id = state().splitSceneAt('a', cut)!;
    const [first, second, third] = state().project.scenes;
    expect(second.id).toBe(id);
    expect(third.id).toBe('b');
    expect(first.narrationText).toBe('Satu dua tiga');
    expect(second.narrationText).toBe('empat lima enam');
    expect(first.transition).toBe('cut');
    expect(second.wordTimestamps[0].start).toBeCloseTo(0, 2);

    const mods = state().project.composition!.scenes;
    expect(mods[0].sourceDuration).toBe(3);
    expect(mods[1].inPoint).toBeCloseTo(cut, 2);
    expect(mods[1].html).toBe(mods[0].html);
    expect(mods[1].seed).toBe(mods[0].seed);
  });

  it('refuses a cut at the very edge and undoes in one step', () => {
    expect(state().splitSceneAt('a', 0.1)).toBeNull();
    state().splitSceneAt('a', 1.5);
    expect(state().project.scenes).toHaveLength(3);
    state().undo();
    expect(state().project.scenes).toHaveLength(2);
  });
});

describe('setSceneBoundary', () => {
  it('moves the cut without changing the film length', () => {
    state().setSceneBoundary('b', 2);
    const [a, b] = state().project.scenes;
    expect(a.durationInSeconds).toBe(2);
    expect(b.durationInSeconds).toBe(3);
  });

  it('keeps both shots at least 0.3 s and shifts a split piece in-point', () => {
    state().splitSceneAt('a', 1.5);
    const pieceId = state().project.scenes[1].id;
    state().setSceneBoundary(pieceId, 2);
    expect(state().project.composition!.scenes[1].inPoint).toBeCloseTo(2, 2);
    state().setSceneBoundary(pieceId, 99);
    expect(state().project.scenes[1].durationInSeconds).toBeCloseTo(0.3, 2);
  });
});
