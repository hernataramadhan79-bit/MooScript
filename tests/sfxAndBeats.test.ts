import { beforeEach, describe, expect, it } from 'vitest';
import { autoSfxCues, renderSfxTrack, synthesizeSfx, SFX_KINDS } from '../src/engine/audio/sfx';
import { detectBeats, nearestBeat, presetBeats } from '../src/engine/audio/beats';
import { useMooStore } from '../src/store/useMooStore';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import { syncComposition } from '../src/engine/composition/sync';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { computeDeterministicWordAlignment } from '../src/engine/ai/tts';

const SR = 22050;
const peakIndex = (a: Float32Array) => a.reduce((best, v, i) => (Math.abs(v) > Math.abs(a[best]) ? i : best), 0);

describe('procedural sound effects', () => {
  it('synthesizes every kind as bounded, non-silent and repeatable audio', () => {
    for (const kind of SFX_KINDS) {
      const a = synthesizeSfx(kind, SR, 7);
      const b = synthesizeSfx(kind, SR, 7);
      expect(a.left).toEqual(b.left);
      const peak = Math.max(...Array.from(a.left, Math.abs), ...Array.from(a.right, Math.abs));
      expect(peak, kind).toBeGreaterThan(0.05);
      expect(peak, kind).toBeLessThanOrEqual(1.2);
    }
  });

  it('places a cue at its time and a riser so it ends there', () => {
    const impact = renderSfxTrack([{ id: 'a', time: 1, kind: 'impact' }], 2, SR);
    expect(Math.abs(peakIndex(impact.left) / SR - 1)).toBeLessThan(0.1);
    const riser = renderSfxTrack([{ id: 'b', time: 1.5, kind: 'riser' }], 2, SR);
    const lastSound = riser.left.reduce((last, v, i) => (Math.abs(v) > 0.01 ? i : last), 0) / SR;
    expect(lastSound).toBeLessThanOrEqual(1.51);
    expect(lastSound).toBeGreaterThan(1.3);
    // Level 0 or an empty list is silence.
    expect(renderSfxTrack([{ id: 'c', time: 0.5, kind: 'pop' }], 1, SR, 0).left.every((v) => v === 0)).toBe(true);
  });

  it('puts whooshes on moving cuts, clicks on hard cuts and keeps a gap between cues', () => {
    const cues = autoSfxCues({
      cuts: [
        { time: 3, transition: 'flow' },
        { time: 6, transition: 'cut' }
      ],
      accents: [
        { time: 3.1, kind: 'pop' },
        { time: 4, kind: 'impact' },
        { time: 4.1, kind: 'pop' }
      ],
      entrances: [0.2],
      duration: 9
    });
    expect(cues.map((c) => [c.time, c.kind])).toEqual([
      [0.2, 'pop'],
      [3, 'whoosh'],
      [4, 'impact'],
      [6, 'tick']
    ]);
    expect(cues.every((c) => c.auto)).toBe(true);
  });
});

describe('beats', () => {
  it('knows the beats of the built-in music', () => {
    const hiphop = presetBeats('hiphop', 4);
    expect(hiphop.bpm).toBe(90);
    expect(hiphop.times[1]).toBeCloseTo(60 / 90, 3);
    expect(presetBeats('ambient', 4).times).toEqual([]);
  });

  it('finds the tempo and phase of a click track', () => {
    const sr = 8000;
    const samples = new Float32Array(sr * 12);
    // 120 BPM clicks starting at 0.25 s, over quiet noise.
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1 * 0.01;
    for (let t = 0.25; t < 12; t += 0.5) {
      const start = Math.round(t * sr);
      for (let k = 0; k < 400; k++) samples[start + k] = Math.sin(k * 0.6) * Math.exp(-k / 80);
    }
    const grid = detectBeats(samples, sr);
    expect(grid.bpm).not.toBeNull();
    expect(Math.abs((grid.bpm as number) - 120)).toBeLessThan(4);
    // Every detected beat sits on a click.
    for (const t of grid.times.slice(1, -1)) {
      const offClick = Math.abs(t - 0.25 - Math.round((t - 0.25) / 0.5) * 0.5);
      expect(offClick).toBeLessThan(0.03);
    }
    expect(nearestBeat([1, 2, 3], 2.2)).toBe(2);
    expect(nearestBeat([1, 2, 3], 2.6, 0.2)).toBe(2.6);
  });
});

describe('editor audio actions', () => {
  beforeEach(() => {
    const scenes = ['a', 'b', 'c'].map((id) => ({
      id,
      narrationText: 'Satu dua tiga empat',
      durationInSeconds: 3.1,
      wordTimestamps: computeDeterministicWordAlignment('Satu dua tiga empat', 3.1)
    }));
    useMooStore.getState().setProject(
      syncComposition({ ...INITIAL_PROJECT, scenes, bgm: { preset: 'hiphop', level: 0.2, duckRatio: 0.15 } })
    );
    useMooStore.setState({ stageAccents: [{ time: 1, kind: 'impact' }] });
  });
  const state = () => useMooStore.getState();

  it('places automatic cues and keeps hand-placed ones', () => {
    const manual = state().addSfxCue(3.1, 'riser');
    const n = state().autoPlaceSfx();
    const cues = state().project.sfxCues!;
    expect(n).toBeGreaterThan(0);
    expect(cues.find((c) => c.id === manual)?.kind).toBe('riser');
    // The cut at 3.1 already has the hand-placed riser, so no automatic whoosh lands on it.
    expect(cues.filter((c) => Math.abs(c.time - 3.1) < 0.2)).toHaveLength(1);
    expect(cues.some((c) => c.kind === 'impact' && c.time === 1)).toBe(true);
    // Placing again replaces the automatic ones instead of piling up.
    state().autoPlaceSfx();
    expect(state().project.sfxCues).toHaveLength(cues.length);
  });

  it('moves cuts onto the music beats without changing the film length', async () => {
    expect(await state().analyzeMusicBeats()).toBeGreaterThan(0);
    const moved = state().snapCutsToBeats();
    expect(moved).toBe(2);
    const beats = state().project.musicBeats!.times;
    const durs = state().project.scenes.map((s) => s.durationInSeconds);
    expect(durs.reduce((a, b) => a + b, 0)).toBeCloseTo(9.3, 2);
    for (const cut of [durs[0], durs[0] + durs[1]]) {
      expect(beats.some((b) => Math.abs(b - cut) < 0.011)).toBe(true);
    }
  });

  it('shifts captions with a trimmed voice-over', () => {
    state().updateVoiceEdit({ trimStart: 0.5 });
    expect(state().project.voiceEdit).toEqual({ trimStart: 0.5 });
    const doc = buildCompositionDocument({ ...state().project, theme: { ...state().project.theme, showSubtitles: true } });
    const firstStart = state().project.scenes[0].wordTimestamps[1].start;
    const words = state().project.scenes[0].wordTimestamps;
    expect(doc).toContain(JSON.stringify({ ...words[1], start: Math.max(0, firstStart - 0.5), end: Math.max(0, words[1].end - 0.5) }));
    state().updateVoiceEdit({ trimStart: undefined });
    expect(state().project.voiceEdit).toEqual({});
  });
});

describe('automatic cues and moved cuts', () => {
  it('moves automatic whooshes with the cuts when they snap to beats', async () => {
    const scenes = ['a', 'b', 'c'].map((id) => ({ id, narrationText: '', durationInSeconds: 3.1, wordTimestamps: [] }));
    useMooStore.getState().setProject(
      syncComposition({ ...INITIAL_PROJECT, scenes, bgm: { preset: 'hiphop', level: 0.2, duckRatio: 0.15 } })
    );
    useMooStore.setState({ stageAccents: [] });
    useMooStore.getState().autoPlaceSfx();
    await useMooStore.getState().analyzeMusicBeats();
    useMooStore.getState().snapCutsToBeats();
    const project = useMooStore.getState().project;
    const firstCut = project.scenes[0].durationInSeconds;
    expect(project.sfxCues!.some((c) => c.kind === 'whoosh' && Math.abs(c.time - firstCut) < 0.011)).toBe(true);
  });
});
