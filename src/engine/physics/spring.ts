export interface SpringConfig {
  stiffness?: number; // k
  damping?: number;   // c
  mass?: number;      // m
}

/**
 * Analytical Underdamped Spring Formula:
 * Computes exact spring displacement at time t (in seconds) transitioning from 0 to 1.
 * Guaranteed 100% deterministic: f(t) without numerical drift.
 */
export function spring(t: number, config: SpringConfig = {}): number {
  if (t <= 0) return 0;
  const k = config.stiffness ?? 180;
  const c = config.damping ?? 12;
  const m = config.mass ?? 1;

  const omega0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));

  if (zeta < 1) {
    // Underdamped (bouncy)
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega0 * t);
    const envelope = Math.cos(omegaD * t) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * t);
    return 1 - decay * envelope;
  } else if (Math.abs(zeta - 1) < 0.0001) {
    // Critically damped
    return 1 - (1 + omega0 * t) * Math.exp(-omega0 * t);
  } else {
    // Overdamped
    const s1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const s2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
  }
}

/**
 * Rapid exponential ease-out for swift kinetic entrances
 */
export function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * Smooth quadratic ease-in-out
 */
export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * Overshoot back-out easing
 */
export function easeOutBack(x: number, s: number = 1.70158): number {
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Standard clamp utility
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
