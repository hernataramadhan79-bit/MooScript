/**
 * Procedural sound effects for motion graphics: whoosh, pop, tick, riser, impact.
 *
 * Every sound is synthesized sample by sample from a seeded random source, so the same cue
 * always sounds the same in the preview, the MP4 and on another device. No files, no network.
 */

import type { SfxCue, SfxKind } from '../../types';

export type { SfxCue, SfxKind };

export const SFX_KINDS: SfxKind[] = ['whoosh', 'pop', 'tick', 'riser', 'impact'];

export const SFX_LABEL: Record<SfxKind, string> = {
  whoosh: 'Whoosh',
  pop: 'Pop',
  tick: 'Klik',
  riser: 'Riser',
  impact: 'Hentakan'
};

/** Length in seconds and how long before the hit each sound starts. */
const SHAPE: Record<SfxKind, { length: number; lead: number }> = {
  whoosh: { length: 0.6, lead: 0.32 },
  pop: { length: 0.16, lead: 0 },
  tick: { length: 0.05, lead: 0 },
  riser: { length: 1.4, lead: 1.4 },
  impact: { length: 0.9, lead: 0.01 }
};

export function sfxLead(kind: SfxKind): number {
  return SHAPE[kind].lead;
}

/** mulberry32: small, fast, seeded. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One sound as stereo samples. */
export function synthesizeSfx(kind: SfxKind, sampleRate: number, seed = 1): { left: Float32Array; right: Float32Array } {
  const n = Math.max(1, Math.round(SHAPE[kind].length * sampleRate));
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const rand = prng(seed);
  const noise = () => rand() * 2 - 1;
  let phase = 0;
  let lp = 0;
  let lp2 = 0;

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const p = i / n;
    let l = 0;
    let r = 0;
    switch (kind) {
      case 'whoosh': {
        // Noise through a low-pass that opens and closes, swelling to the hit and panning across.
        const cutoff = 300 + 5200 * Math.sin(Math.PI * p) ** 2;
        const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
        lp += k * (noise() - lp);
        lp2 += k * (lp - lp2);
        const env = Math.sin(Math.PI * Math.min(1, p * 1.1)) ** 2 * 0.55;
        const pan = p;
        l = lp2 * env * Math.cos((pan * Math.PI) / 2) * 1.4;
        r = lp2 * env * Math.sin((pan * Math.PI) / 2) * 1.4;
        break;
      }
      case 'pop': {
        // A short sine that drops in pitch, like a bubble.
        const freq = 220 + 700 * Math.exp(-t / 0.025);
        phase += (2 * Math.PI * freq) / sampleRate;
        const env = Math.exp(-t / 0.035) * Math.min(1, t / 0.002);
        l = r = Math.sin(phase) * env * 0.6;
        break;
      }
      case 'tick': {
        phase += (2 * Math.PI * 2400) / sampleRate;
        const env = Math.exp(-t / 0.006);
        l = r = (Math.sin(phase) * 0.7 + noise() * 0.3) * env * 0.45;
        break;
      }
      case 'riser': {
        // Rising tone plus brightening noise that ends on the hit.
        const freq = 180 + 1400 * p * p;
        phase += (2 * Math.PI * freq) / sampleRate;
        const cutoff = 400 + 7000 * p;
        const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
        lp += k * (noise() - lp);
        const env = p ** 2.2 * (p > 0.97 ? (1 - p) / 0.03 : 1) * 0.5;
        const s = (Math.sin(phase) * 0.45 + lp * 0.8) * env;
        l = s * (1 - p * 0.3);
        r = s * (0.7 + p * 0.3);
        break;
      }
      case 'impact': {
        // Low thump that falls in pitch, with a short burst of filtered noise on top.
        const freq = 40 + 70 * Math.exp(-t / 0.08);
        phase += (2 * Math.PI * freq) / sampleRate;
        const k = 1 - Math.exp((-2 * Math.PI * 1800) / sampleRate);
        lp += k * (noise() - lp);
        const body = Math.sin(phase) * Math.exp(-t / 0.28) * 0.6;
        const crack = lp * Math.exp(-t / 0.04) * 0.45;
        l = r = (body + crack) * Math.min(1, t / 0.001);
        break;
      }
    }
    left[i] = l;
    right[i] = r;
  }
  return { left, right };
}

/**
 * Every cue mixed into one stereo track of `duration` seconds. Cues that fall partly outside the
 * film are cut at its edges.
 */
export function renderSfxTrack(
  cues: SfxCue[],
  duration: number,
  sampleRate: number,
  level = 1
): { left: Float32Array; right: Float32Array } {
  const n = Math.max(1, Math.ceil(duration * sampleRate));
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const cache = new Map<string, { left: Float32Array; right: Float32Array }>();
  for (const cue of cues) {
    if (!SHAPE[cue.kind] || !Number.isFinite(cue.time)) continue;
    const gain = Math.max(0, Math.min(1.5, cue.gain ?? 1)) * Math.max(0, level);
    if (gain === 0) continue;
    const key = `${cue.kind}:${seedOf(cue.id)}`;
    let sound = cache.get(key);
    if (!sound) {
      sound = synthesizeSfx(cue.kind, sampleRate, seedOf(cue.id));
      cache.set(key, sound);
    }
    const start = Math.round((cue.time - SHAPE[cue.kind].lead) * sampleRate);
    for (let i = Math.max(0, -start); i < sound.left.length; i++) {
      const j = start + i;
      if (j >= n) break;
      left[j] += sound.left[i] * gain;
      right[j] += sound.right[i] * gain;
    }
  }
  return { left, right };
}

interface AutoSfxInput {
  /** Cut times between shots with the transition into the next shot. */
  cuts: { time: number; transition: string }[];
  /** Moments the shots' own code hits (ctx.pop, ctx.punch, ...), on the film's clock. */
  accents: { time: number; kind: 'pop' | 'impact' }[];
  /** Entrances added in the editor (layer animation), on the film's clock. */
  entrances: number[];
  duration: number;
}

/** Shortest gap between two automatic cues, so the track never turns into a rattle. */
const MIN_GAP = 0.28;

/**
 * Cues for a film: a whoosh into every moving transition (a click for a hard cut), a pop or impact
 * on the shots' own hits and a pop on editor entrances. Cuts win over hits that land on them.
 */
export function autoSfxCues(input: AutoSfxInput): SfxCue[] {
  const candidates: { time: number; kind: SfxKind; priority: number }[] = [];
  for (const c of input.cuts) {
    if (c.time <= 0.05 || c.time >= input.duration) continue;
    candidates.push({ time: c.time, kind: c.transition === 'cut' ? 'tick' : 'whoosh', priority: 2 });
  }
  for (const a of input.accents) candidates.push({ time: a.time, kind: a.kind, priority: a.kind === 'impact' ? 1.5 : 1 });
  for (const t of input.entrances) candidates.push({ time: t, kind: 'pop', priority: 0.5 });

  const placed: { time: number; kind: SfxKind }[] = [];
  candidates
    .filter((c) => c.time >= 0 && c.time < input.duration)
    .sort((a, b) => b.priority - a.priority || a.time - b.time)
    .forEach((c) => {
      if (placed.some((p) => Math.abs(p.time - c.time) < MIN_GAP)) return;
      placed.push({ time: Math.round(c.time * 100) / 100, kind: c.kind });
    });
  return placed
    .sort((a, b) => a.time - b.time)
    .map((p, i) => ({ id: `sfx-auto-${i}-${Math.round(p.time * 100)}`, time: p.time, kind: p.kind, gain: 1, auto: true }));
}
