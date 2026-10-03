/**
 * tests/bgmMixer.test.ts
 * Unit tests for the BGM Mixer engine (bgmMixer.ts)
 *
 * Covers:
 *  1. buildDuckingCurve — flat full-gain when no words
 *  2. buildDuckingCurve — inserts ducked regions around voice words
 *  3. buildDuckingCurve — merges overlapping word regions
 *  4. buildDuckingCurve — two separate regions for well-separated words
 *  5. buildDuckingCurve — clamps start time to >= 0
 *  6. renderBgmBuffer — returns null for 'none' preset
 *  7–10. renderBgmBuffer — returns AudioBuffer for ambient/hiphop/cinematic/lofi
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDuckingCurve, renderBgmBuffer } from '../src/engine/audio/bgmMixer';

// ── Shared Audio mocks (same pattern as localTts.test.ts) ──────────────────

class MockAudioBuffer {
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  length: number;
  private data: Float32Array;

  constructor(numberOfChannels = 2, length = 48000, sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.duration = length / sampleRate;
    this.data = new Float32Array(length);
  }

  getChannelData() {
    return this.data;
  }

  copyFromChannel(dest: Float32Array) {
    dest.fill(0);
  }
}

/** Minimal AudioParam — supports the automations used by bgmMixer */
class MockAudioParam {
  value = 1;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
}

class MockOscillatorNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  loop = false;
  connect = vi.fn();
  start = vi.fn();
}

class MockOfflineAudioContext {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  destination = {};

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createBuffer(channels: number, len: number, sr: number) {
    return new MockAudioBuffer(channels, len, sr);
  }

  createBufferSource() {
    return new MockBufferSourceNode();
  }

  createOscillator() {
    return new MockOscillatorNode();
  }

  createGain() {
    return new MockGainNode();
  }

  startRendering() {
    return Promise.resolve(new MockAudioBuffer(this.numberOfChannels, this.length, this.sampleRate));
  }
}

class MockAudioContext {
  decodeAudioData() {
    return Promise.resolve(new MockAudioBuffer(2, 48000 * 2, 48000));
  }
  close() {
    return Promise.resolve();
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as any).AudioBuffer = MockAudioBuffer;
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).OfflineAudioContext = MockOfflineAudioContext;
});

// ── buildDuckingCurve ─────────────────────────────────────────────────────────

describe('buildDuckingCurve', () => {
  const defaultOpts = { duckRatio: 0.15, attackSec: 0.08, releaseSec: 0.35 };

  it('returns flat full-gain curve when no word timestamps provided', () => {
    const curve = buildDuckingCurve(5.0, [], defaultOpts);
    expect(curve[0]).toMatchObject({ time: 0, value: 1.0, ramp: 'set' });
    const last = curve[curve.length - 1];
    expect(last.value).toBe(1.0);
    expect(last.time).toBe(5.0);
  });

  it('inserts a ducked gain region around a single word timestamp', () => {
    const words = [{ start: 1.0, end: 2.0 }];
    const curve = buildDuckingCurve(5.0, words, defaultOpts);
    // At least one point must carry the ducked gain value
    const duckedPoints = curve.filter((p) => p.value <= defaultOpts.duckRatio);
    expect(duckedPoints.length).toBeGreaterThan(0);
    // All times must be within the valid range
    for (const p of curve) {
      expect(p.time).toBeGreaterThanOrEqual(0);
      expect(p.time).toBeLessThanOrEqual(5.0);
    }
  });

  it('merges two overlapping word regions into a single duck envelope', () => {
    const words = [
      { start: 1.0, end: 1.5 },
      { start: 1.4, end: 2.2 } // overlaps with first
    ];
    const curve = buildDuckingCurve(5.0, words, defaultOpts);
    // Count transitions from fullGain → duckedGain (only 1 merge region expected)
    let duckTransitions = 0;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i - 1].value === 1.0 && curve[i].value < 0.5) duckTransitions++;
    }
    expect(duckTransitions).toBe(1);
  });

  it('produces two separate duck envelopes for words far apart', () => {
    const words = [
      { start: 0.5, end: 1.0 },
      { start: 4.0, end: 4.5 }
    ];
    const curve = buildDuckingCurve(6.0, words, defaultOpts);
    let duckTransitions = 0;
    for (let i = 1; i < curve.length; i++) {
      if (curve[i - 1].value === 1.0 && curve[i].value <= defaultOpts.duckRatio) {
        duckTransitions++;
      }
    }
    expect(duckTransitions).toBe(2);
  });

  it('clamps duck start time to >= 0 even when first word starts at t=0', () => {
    const words = [{ start: 0.0, end: 0.5 }];
    const curve = buildDuckingCurve(2.0, words, defaultOpts);
    for (const p of curve) {
      expect(p.time).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── renderBgmBuffer ───────────────────────────────────────────────────────────

describe('renderBgmBuffer', () => {
  it('returns null for preset "none"', async () => {
    const result = await renderBgmBuffer('none', 3.0);
    expect(result).toBeNull();
  });

  it('returns a valid stereo 48 kHz AudioBuffer for "ambient" preset', async () => {
    const buf = await renderBgmBuffer('ambient', 2.0);
    expect(buf).not.toBeNull();
    expect(buf!.numberOfChannels).toBe(2);
    expect(buf!.sampleRate).toBe(48000);
    expect(buf!.duration).toBeCloseTo(2.0, 1);
  });

  it('returns a valid AudioBuffer for "hiphop" preset', async () => {
    const buf = await renderBgmBuffer('hiphop', 2.0);
    expect(buf).not.toBeNull();
    expect(buf!.numberOfChannels).toBe(2);
  });

  it('returns a valid AudioBuffer for "cinematic" preset', async () => {
    const buf = await renderBgmBuffer('cinematic', 2.0);
    expect(buf).not.toBeNull();
    expect(buf!.numberOfChannels).toBe(2);
  });

  it('returns a valid AudioBuffer for "lofi" preset', async () => {
    const buf = await renderBgmBuffer('lofi', 2.0);
    expect(buf).not.toBeNull();
    expect(buf!.numberOfChannels).toBe(2);
  });
});
