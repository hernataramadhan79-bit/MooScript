import type { BgmPreset } from './bgmMixer';

export interface BeatGrid {
  /** Beat times in seconds from the start of the music. */
  times: number[];
  bpm: number | null;
}

/**
 * Beats of the built-in music, straight from the patterns bgmMixer plays (hip-hop 90 BPM, lo-fi
 * kicks and snares every 0.4 s, cinematic pulses every 2.5 s). Ambient has no beat.
 */
export function presetBeats(preset: BgmPreset, duration: number): BeatGrid {
  const grid = (period: number, bpm: number): BeatGrid => {
    const times: number[] = [];
    for (let t = 0; t < duration - 1e-6; t += period) times.push(Math.round(t * 1000) / 1000);
    return { times, bpm };
  };
  switch (preset) {
    case 'hiphop':
      return grid(60 / 90, 90);
    case 'lofi':
      return grid(0.4, 150);
    case 'cinematic':
      return grid(2.5, 24);
    default:
      return { times: [], bpm: null };
  }
}

/**
 * Tempo and beat positions of a recording: an onset curve from rises in short-time energy, the
 * tempo between 60 and 180 BPM that best repeats it (autocorrelation), and the phase that lines
 * the beat grid up with the strongest onsets.
 */
export function detectBeats(samples: Float32Array, sampleRate: number): BeatGrid {
  const hop = Math.max(64, Math.round(sampleRate / 100)); // ~10 ms frames
  const frames = Math.floor(samples.length / hop);
  if (frames < 200) return { times: [], bpm: null };

  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const base = f * hop;
    for (let i = 0; i < hop; i++) {
      const s = samples[base + i];
      sum += s * s;
    }
    energy[f] = Math.log(1e-9 + sum / hop);
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  // Remove the local mean so steady loud passages do not count as onsets.
  const smoothed = new Float32Array(frames);
  const win = 8;
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += onset[f];
    if (f >= win) acc -= onset[f - win];
    smoothed[f] = Math.max(0, onset[f] - acc / Math.min(f + 1, win));
  }

  const framesPerSec = sampleRate / hop;
  const minLag = Math.round((60 / 180) * framesPerSec);
  const maxLag = Math.round((60 / 60) * framesPerSec);
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let f = lag; f < frames; f++) score += smoothed[f] * smoothed[f - lag];
    // A slight preference for tempos near 120 BPM keeps half/double tempo from winning by noise.
    const bpm = (60 * framesPerSec) / lag;
    score *= 1 - Math.min(0.25, Math.abs(Math.log2(bpm / 120)) * 0.15);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag || bestScore <= 0) return { times: [], bpm: null };

  let bestPhase = 0;
  let bestPhaseScore = -1;
  for (let phase = 0; phase < bestLag; phase++) {
    let score = 0;
    for (let f = phase; f < frames; f += bestLag) score += smoothed[f];
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhase = phase;
    }
  }

  const times: number[] = [];
  for (let f = bestPhase; f < frames; f += bestLag) times.push(Math.round((f / framesPerSec) * 1000) / 1000);
  return { times, bpm: Math.round(((60 * framesPerSec) / bestLag) * 10) / 10 };
}

/** The beat nearest to `t`, or `t` itself when none lies within `maxDistance`. */
export function nearestBeat(beats: number[], t: number, maxDistance = Infinity): number {
  let best = t;
  let bestDist = maxDistance;
  for (const b of beats) {
    const d = Math.abs(b - t);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
