import { describe, it, expect } from 'vitest';
import { spring, easeOutExpo, easeInOutQuad, easeOutBack, clamp, lerp } from '../src/engine/physics/spring';

describe('Spring Physics Engine', () => {
  it('returns 0 for t <= 0', () => {
    expect(spring(0)).toBe(0);
    expect(spring(-1)).toBe(0);
    expect(spring(-0.0001)).toBe(0);
  });

  it('converges to 1 as t increases', () => {
    const val3s = spring(3.0);
    const val5s = spring(5.0);
    expect(Math.abs(val3s - 1)).toBeLessThan(0.01);
    expect(Math.abs(val5s - 1)).toBeLessThan(0.0001);
  });

  it('exhibits underdamped oscillatory overshoot when zeta < 1', () => {
    // Underdamped default: k=180, c=12, m=1 => zeta = 12 / (2 * sqrt(180)) ~ 0.447 < 1
    // Peak overshoot should cross 1.0 before settling
    let hasOvershoot = false;
    for (let t = 0.05; t <= 1.5; t += 0.02) {
      if (spring(t) > 1.0) {
        hasOvershoot = true;
        break;
      }
    }
    expect(hasOvershoot).toBe(true);
  });

  it('evaluates critically damped spring smoothly (zeta = 1)', () => {
    // k = 100, m = 1, c = 2 * sqrt(100) = 20 => zeta = 1
    const val = spring(0.5, { stiffness: 100, damping: 20, mass: 1 });
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1.0001);

    const valLate = spring(2.0, { stiffness: 100, damping: 20, mass: 1 });
    expect(Math.abs(valLate - 1.0)).toBeLessThan(0.001);
  });

  it('evaluates overdamped spring monotonically without overshoot (zeta > 1)', () => {
    // k = 100, m = 1, c = 40 => zeta = 40 / 20 = 2.0 > 1
    const config = { stiffness: 100, damping: 40, mass: 1 };
    let prev = 0;
    for (let t = 0.05; t <= 2.0; t += 0.05) {
      const current = spring(t, config);
      expect(current).toBeGreaterThanOrEqual(prev);
      expect(current).toBeLessThanOrEqual(1.0);
      prev = current;
    }
  });

  it('computes easing functions deterministically', () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(0.5)).toBe(0.5);
    expect(easeInOutQuad(1)).toBe(1);
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
    expect(easeOutBack(1)).toBe(1);
  });

  it('clamps and lerps correctly', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});
