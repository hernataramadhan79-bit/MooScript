/**
 * bgmMixer.ts — 100% client-side BGM + Voice mixing with ducking
 *
 * Architecture: Zero-server, Web Audio API OfflineAudioContext only.
 * Takes a voice AudioBuffer + a BGM generator, applies:
 *   1. Volume scaling (bgmLevel, voiceLevel)
 *   2. Ducking: ramp BGM gain down when voice starts, ramp back up in silence
 *   3. Loop BGM to match voice duration
 * Returns a single stereo 48 kHz WAV Blob.
 */

import { audioBufferToWavBlob } from '../ai/tts';

// ── Preset BGM generators (all procedural, no external files) ─────────────────

export type BgmPreset = 'none' | 'ambient' | 'hiphop' | 'cinematic' | 'lofi';

/**
 * Shape for a single kick/hit event used by rhythm-based presets.
 */
interface BeatEvent {
  time: number;
  freq: number;
  freqEnd: number;
  gain: number;
  decay: number;
}

// ── Shared oscillator layer helper ─────────────────────────────────────────────

function addOscLayer(
  ctx: OfflineAudioContext,
  freq: number,
  type: OscillatorType,
  gain: number,
  duration: number,
  fadePct = 0.15
): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, 0);
  const fadeTime = duration * fadePct;
  gainNode.gain.setValueAtTime(0.0001, 0);
  gainNode.gain.linearRampToValueAtTime(gain, fadeTime);
  gainNode.gain.setValueAtTime(gain, duration - fadeTime);
  gainNode.gain.linearRampToValueAtTime(0.0001, duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(0);
  osc.stop(duration);
}

function addBeatEvents(ctx: OfflineAudioContext, events: BeatEvent[]): void {
  for (const ev of events) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.frequency.setValueAtTime(ev.freq, ev.time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, ev.freqEnd), ev.time + ev.decay * 0.8);
    gainNode.gain.setValueAtTime(ev.gain, ev.time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ev.time + ev.decay);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(ev.time);
    osc.stop(ev.time + ev.decay + 0.01);
  }
}

// ── Preset generator functions ────────────────────────────────────────────────

/** Soft pad chords — ambient drone, evolving */
function generateAmbientBgm(ctx: OfflineAudioContext, duration: number): void {
  const freqs = [130.81, 164.81, 196.0, 220.0, 261.63, 329.63];
  freqs.forEach((f, i) => {
    addOscLayer(ctx, f, i % 2 === 0 ? 'sine' : 'triangle', 0.032, duration, 0.2);
    // Subtle LFO-like wobble via detuned second oscillator
    addOscLayer(ctx, f * 1.003, 'sine', 0.012, duration, 0.25);
  });
}

/** Hip-hop 4/4 beat — kick + snare + hi-hat pattern */
function generateHiphopBgm(ctx: OfflineAudioContext, duration: number): void {
  const bpm = 90;
  const stepSec = 60 / bpm / 4; // 16th note
  const events: BeatEvent[] = [];

  // Chord pad for groove
  addOscLayer(ctx, 110.0, 'sawtooth', 0.02, duration);
  addOscLayer(ctx, 146.83, 'triangle', 0.018, duration);
  addOscLayer(ctx, 220.0, 'sine', 0.015, duration);

  // Pattern: kick on 1,3; snare on 2,4; hi-hat on every 16th
  const barCount = Math.ceil(duration / (4 * 4 * stepSec));
  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * 4 * 4 * stepSec;
    // Kick — beats 1 & 3 of bar (step 0, 8)
    for (const beat of [0, 8]) {
      const t = barStart + beat * stepSec;
      if (t < duration)
        events.push({ time: t, freq: 120, freqEnd: 30, gain: 0.55, decay: 0.18 });
    }
    // Snare — beats 2 & 4 (step 4, 12)
    for (const beat of [4, 12]) {
      const t = barStart + beat * stepSec;
      if (t < duration)
        events.push({ time: t, freq: 220, freqEnd: 80, gain: 0.22, decay: 0.12 });
    }
    // Hi-hat — every 16th
    for (let step = 0; step < 16; step++) {
      const t = barStart + step * stepSec;
      if (t < duration)
        events.push({ time: t, freq: 8000, freqEnd: 6000, gain: 0.04, decay: 0.04 });
    }
  }
  addBeatEvents(ctx, events);
}

/** Cinematic rising swell — epic low drones + pulsing tension */
function generateCinematicBgm(ctx: OfflineAudioContext, duration: number): void {
  // Low drone
  addOscLayer(ctx, 55.0, 'sine', 0.06, duration, 0.3);
  addOscLayer(ctx, 82.41, 'triangle', 0.04, duration, 0.3);
  addOscLayer(ctx, 110.0, 'sine', 0.03, duration, 0.3);

  // Mid rising sweep
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, 0);
  osc.frequency.linearRampToValueAtTime(220, duration);
  gainNode.gain.setValueAtTime(0.0001, 0);
  gainNode.gain.linearRampToValueAtTime(0.05, duration * 0.7);
  gainNode.gain.linearRampToValueAtTime(0.0001, duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(0);
  osc.stop(duration);

  // Rhythmic tension pulse every ~2.5s
  const pulseInterval = 2.5;
  const events: BeatEvent[] = [];
  for (let t = 0; t < duration; t += pulseInterval) {
    events.push({ time: t, freq: 80, freqEnd: 30, gain: 0.12, decay: 0.4 });
  }
  addBeatEvents(ctx, events);
}

/** Lo-fi — warm vinyl crackle aesthetic: slow swing beat + soft chords */
function generateLofiBgm(ctx: OfflineAudioContext, duration: number): void {
  const bpm = 75;
  const stepSec = 60 / bpm / 2; // swing 8th

  // Warm chords
  addOscLayer(ctx, 146.83, 'triangle', 0.03, duration, 0.2);
  addOscLayer(ctx, 174.61, 'sine', 0.025, duration, 0.2);
  addOscLayer(ctx, 220.0, 'triangle', 0.02, duration, 0.2);
  addOscLayer(ctx, 261.63, 'sine', 0.015, duration, 0.3);

  // Soft drumming
  const events: BeatEvent[] = [];
  const barCount = Math.ceil(duration / (4 * stepSec));
  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * 4 * stepSec;
    // Kick
    for (const beat of [0, 2]) {
      const t = barStart + beat * stepSec;
      if (t < duration)
        events.push({ time: t, freq: 100, freqEnd: 35, gain: 0.28, decay: 0.2 });
    }
    // Snare (subtle)
    for (const beat of [1, 3]) {
      const t = barStart + beat * stepSec;
      if (t < duration)
        events.push({ time: t, freq: 180, freqEnd: 60, gain: 0.12, decay: 0.15 });
    }
  }
  addBeatEvents(ctx, events);

  // Vinyl-style crackle (bandlimited noise via rapid high-freq oscillators)
  for (let i = 0; i < 3; i++) {
    addOscLayer(ctx, 12000 + i * 3000, 'sawtooth', 0.003, duration, 0.02);
  }
}

// ── BGM Buffer factory ────────────────────────────────────────────────────────

/**
 * Render a BGM preset into an AudioBuffer at the target sample rate.
 * If `preset === 'none'`, returns null.
 */
export async function renderBgmBuffer(
  preset: BgmPreset,
  durationSeconds: number,
  sampleRate = 48000
): Promise<AudioBuffer | null> {
  if (preset === 'none') return null;

  const length = Math.max(1, Math.ceil(durationSeconds * sampleRate));
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  switch (preset) {
    case 'ambient':
      generateAmbientBgm(ctx, durationSeconds);
      break;
    case 'hiphop':
      generateHiphopBgm(ctx, durationSeconds);
      break;
    case 'cinematic':
      generateCinematicBgm(ctx, durationSeconds);
      break;
    case 'lofi':
      generateLofiBgm(ctx, durationSeconds);
      break;
    default:
      generateAmbientBgm(ctx, durationSeconds);
  }

  return ctx.startRendering();
}

// ── Ducking engine ────────────────────────────────────────────────────────────

export interface DuckingOptions {
  /** BGM volume reduction when voice is active (0 = silence BGM, 1 = no change). Default: 0.15 */
  duckRatio: number;
  /** Attack time: how fast BGM ducks when voice starts (seconds). Default: 0.1 */
  attackSec: number;
  /** Release time: how fast BGM recovers when voice ends (seconds). Default: 0.4 */
  releaseSec: number;
}

/**
 * Build a ducking gain automation curve from word timestamps.
 * Returns an array of [time, gainValue] pairs for AudioParam.setValueAtTime / linearRampToValueAtTime.
 */
export interface GainPoint {
  time: number;
  value: number;
  ramp: 'set' | 'linear';
}

export function buildDuckingCurve(
  voiceDuration: number,
  wordTimestamps: Array<{ start: number; end: number }>,
  opts: DuckingOptions
): GainPoint[] {
  const { duckRatio, attackSec, releaseSec } = opts;
  const fullGain = 1.0;
  const duckedGain = Math.max(0.001, duckRatio);

  const points: GainPoint[] = [{ time: 0, value: fullGain, ramp: 'set' }];

  if (wordTimestamps.length === 0) {
    // No words — flat full-gain, just mark start and end
    points.push({ time: voiceDuration, value: fullGain, ramp: 'set' });
    return points;
  }

  // Merge overlapping/adjacent word ranges. Regions store the pure voice span;
  // the release tail is only used as merge tolerance and applied ONCE later.
  const regions: Array<{ start: number; end: number }> = [];
  let current: { start: number; end: number } | null = null;

  for (const w of wordTimestamps) {
    const wStart = Math.max(0, w.start - attackSec);
    const wEnd = Math.max(wStart, w.end);
    if (!current) {
      current = { start: wStart, end: wEnd };
    } else if (wStart <= current.end + releaseSec) {
      // Extend current region (gap is bridged by the release tail)
      current.end = Math.max(current.end, wEnd);
    } else {
      regions.push(current);
      current = { start: wStart, end: wEnd };
    }
  }
  if (current) regions.push(current);

  // Build gain points. current.end above is the VOICE end (no release baked in),
  // so the release ramp below is applied exactly once per region.
  const rawPoints: GainPoint[] = [{ time: 0, value: fullGain, ramp: 'set' }];

  for (const r of regions) {
    const duckStart = Math.max(0, Math.min(r.start, voiceDuration));
    const duckEnd = Math.max(0, Math.min(r.end, voiceDuration));
    if (duckEnd <= duckStart && duckStart !== 0) continue;

    if (duckStart > 0) {
      // Ramp down from full gain into the ducked region
      rawPoints.push({ time: duckStart, value: duckedGain, ramp: 'linear' });
    } else {
      // Region starts at t=0: a linearRamp at time 0 is invalid/duplicated,
      // so the curve simply STARTS ducked instead.
      rawPoints[0] = { time: 0, value: duckedGain, ramp: 'set' };
    }
    // Hold ducked level through voice
    rawPoints.push({ time: duckEnd, value: duckedGain, ramp: 'set' });
    // Single release ramp back to full gain
    const releaseEnd = Math.min(voiceDuration, duckEnd + releaseSec);
    if (releaseEnd > duckEnd) {
      rawPoints.push({ time: releaseEnd, value: fullGain, ramp: 'linear' });
    }
  }

  // Ensure we end at full gain
  rawPoints.push({ time: voiceDuration, value: fullGain, ramp: 'set' });

  // Enforce strictly-ascending, deduplicated timestamps (keep last per time)
  // so AudioParam automation never receives duplicate or unordered events.
  const byTime = new Map<number, GainPoint>();
  for (const p of rawPoints) {
    const t = Math.max(0, Math.min(voiceDuration, p.time));
    byTime.set(t, { ...p, time: t });
  }
  const deduped: GainPoint[] = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  return deduped;
}

// ── Master mix function ───────────────────────────────────────────────────────

export interface MixOptions {
  bgmPreset: BgmPreset;
  /** 0–1 master BGM level. Default: 0.18 */
  bgmLevel: number;
  /** 0–1 master voice level. Default: 1.0 */
  voiceLevel: number;
  /** How much to reduce BGM when voice is active. 0=silence, 1=no duck. Default: 0.15 */
  duckRatio: number;
  /** attack in seconds for ducking ramp-down. Default: 0.08 */
  duckAttackSec: number;
  /** release in seconds for ducking ramp-up. Default: 0.35 */
  duckReleaseSec: number;
  /** Combined word timestamps for ALL scenes (absolute times). */
  wordTimestamps: Array<{ start: number; end: number }>;
}

/**
 * Mix voice + BGM into a single stereo WAV Blob.
 *
 * Steps:
 *  1. Loop/trim BGM to match voiceBuffer.duration
 *  2. Apply bgmLevel + ducking gain automation
 *  3. Apply voiceLevel
 *  4. Sum both into a single OfflineAudioContext output
 *  5. Return as WAV Blob
 *
 * If bgmPreset === 'none', returns the voice buffer re-encoded as WAV.
 */
export async function mixVoiceAndBgm(
  voiceBuffer: AudioBuffer,
  opts: MixOptions
): Promise<Blob> {
  const sampleRate = voiceBuffer.sampleRate;
  const duration = voiceBuffer.duration;

  if (opts.bgmPreset === 'none') {
    // No BGM — just re-export voice with voiceLevel applied
    if (opts.voiceLevel === 1.0) return audioBufferToWavBlob(voiceBuffer);
    const length = voiceBuffer.length;
    const ctx = new OfflineAudioContext(2, length, sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = voiceBuffer;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(opts.voiceLevel, 0);
    src.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(0);
    const mixed = await ctx.startRendering();
    return audioBufferToWavBlob(mixed);
  }

  // 1. Render BGM for the full duration
  const bgmBuffer = await renderBgmBuffer(opts.bgmPreset, duration, sampleRate);
  if (!bgmBuffer) return audioBufferToWavBlob(voiceBuffer);

  // 2. Build ducking gain curve from word timestamps
  const duckingCurve = buildDuckingCurve(duration, opts.wordTimestamps, {
    duckRatio: opts.duckRatio,
    attackSec: opts.duckAttackSec,
    releaseSec: opts.duckReleaseSec
  });

  // 3. Create mix context
  const totalSamples = Math.max(1, Math.ceil(duration * sampleRate));
  const mixCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // ── Voice channel ──
  const voiceSrc = mixCtx.createBufferSource();
  voiceSrc.buffer = voiceBuffer;
  const voiceGain = mixCtx.createGain();
  voiceGain.gain.setValueAtTime(Math.max(0.001, opts.voiceLevel), 0);
  voiceSrc.connect(voiceGain);
  voiceGain.connect(mixCtx.destination);
  voiceSrc.start(0);

  // ── BGM channel ──
  const bgmSrc = mixCtx.createBufferSource();
  bgmSrc.buffer = bgmBuffer;
  bgmSrc.loop = false; // BGM is already rendered at full duration

  const bgmMasterGain = mixCtx.createGain();
  bgmMasterGain.gain.setValueAtTime(Math.max(0.001, opts.bgmLevel), 0);

  // Apply ducking gain automation
  const bgmDuckGain = mixCtx.createGain();
  const duckParam = bgmDuckGain.gain;

  for (const pt of duckingCurve) {
    if (pt.ramp === 'set') {
      duckParam.setValueAtTime(pt.value, pt.time);
    } else {
      duckParam.linearRampToValueAtTime(pt.value, pt.time);
    }
  }

  bgmSrc.connect(bgmMasterGain);
  bgmMasterGain.connect(bgmDuckGain);
  bgmDuckGain.connect(mixCtx.destination);
  bgmSrc.start(0);

  // 4. Render
  const mixed = await mixCtx.startRendering();
  return audioBufferToWavBlob(mixed);
}
