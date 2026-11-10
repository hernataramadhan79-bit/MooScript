import { describe, expect, it } from 'vitest';
import { limitPeaks } from '../src/engine/audio/limiter';
import { MOTION_BLUR_SAMPLES, motionBlurTimes } from '../src/engine/export/exportOptions';

const RATE = 48000;
const peakOf = (data: Float32Array) => data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('mix limiter', () => {
  it('leaves a mix below the ceiling exactly as it is', () => {
    const data = Float32Array.from({ length: 4800 }, (_, i) => 0.6 * Math.sin(i / 20));
    const before = Array.from(data);
    expect(limitPeaks([data], RATE)).toBe(1);
    expect(Array.from(data)).toEqual(before);
  });

  it('holds a clipping hit at the ceiling and leaves the quiet part alone', () => {
    const data = new Float32Array(RATE);
    for (let i = 0; i < data.length; i++) data[i] = 0.3 * Math.sin(i / 15);
    // A hit in the middle that sums to well over full scale.
    for (let i = 24000; i < 24480; i++) data[i] = 1.8 * Math.sin((i - 24000) / 4);
    const reduction = limitPeaks([data], RATE, { ceiling: 0.97 });

    expect(reduction).toBeLessThan(0.6);
    expect(peakOf(data)).toBeLessThanOrEqual(0.97 + 1e-6);
    // Far from the hit the signal is untouched.
    expect(data[1000]).toBeCloseTo(0.3 * Math.sin(1000 / 15), 6);
    expect(data[47000]).toBeCloseTo(0.3 * Math.sin(47000 / 15), 6);
  });

  it('moves the gain gradually instead of jumping at the peak', () => {
    const data = new Float32Array(RATE).fill(0.5);
    data[20000] = 2;
    const before = 0.5;
    limitPeaks([data], RATE);
    // The sample just ahead of the peak is already turned down, but not as far as the peak itself.
    const ahead = data[19990] / before;
    expect(ahead).toBeLessThan(1);
    expect(ahead).toBeGreaterThan(data[20000] / 2);
    // And the one after it is still recovering.
    expect(data[20100] / before).toBeLessThan(1);
  });

  it('turns both channels down together so the stereo image holds', () => {
    const left = new Float32Array(2000).fill(0.4);
    const right = new Float32Array(2000).fill(0.4);
    left[1000] = 1.6;
    limitPeaks([left, right], RATE);
    expect(right[1000]).toBeLessThan(0.4);
    expect(right[1000] / 0.4).toBeCloseTo(left[1000] / 1.6, 5);
  });
});

describe('motion blur sampling', () => {
  it('uses the frame time alone without blur', () => {
    expect(motionBlurTimes(30, 30, 1)).toEqual([1]);
  });

  it('spreads the samples over half the frame, starting on the frame', () => {
    const times = motionBlurTimes(30, 30);
    expect(times).toHaveLength(MOTION_BLUR_SAMPLES);
    expect(times[0]).toBe(1);
    const frameLength = 1 / 30;
    expect(times[times.length - 1]).toBeLessThan(1 + frameLength * 0.5);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });
});
