/**
 * Tolerance comparison between two golden records (see docs: matrix ±1e-3, opacity ±1e-3,
 * colors equal after rounding, other strings equal once their numbers agree to ~3 decimals).
 *
 * Records taken on another platform can differ in text layout (font rasterization), so for those
 * the layout-dependent values are skipped and only the linear part of transforms is compared.
 */
import { decodePass, defaultOf, type GoldenRecord } from './harness';

export interface Mismatch {
  pass: 'forward' | 'backward';
  time: number;
  element: string;
  prop: string;
  expected: string;
  actual: string;
}

export interface CompareResult {
  crossPlatform: boolean;
  mismatches: Mismatch[];
  /** Differences outside the recorded frames: timing list, posters, logs, element set. */
  structural: string[];
}

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const COLOR_PROPS = new Set(['color', 'backgroundColor', 'fill', 'stroke']);
const LAYOUT_PROPS = new Set(['r', 'width', 'height', 'transformOrigin', 'ctm', 'attr:transform']);

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-6 * Math.max(Math.abs(a), Math.abs(b));

function splitNumbers(s: string): { text: string; nums: number[] } {
  const nums: number[] = [];
  const text = s.replace(NUM, (m) => {
    nums.push(Number(m));
    return '#';
  });
  return { text, nums };
}

function sameNumbers(a: string, b: string, tol: number, skip?: (i: number, count: number) => boolean): boolean {
  const x = splitNumbers(a);
  const y = splitNumbers(b);
  if (x.text !== y.text || x.nums.length !== y.nums.length) return false;
  return x.nums.every((n, i) => (skip && skip(i, x.nums.length)) || close(n, y.nums[i], tol));
}

function sameColor(a: string, b: string): boolean {
  const x = splitNumbers(a);
  const y = splitNumbers(b);
  if (x.text !== y.text || x.nums.length !== y.nums.length) return false;
  // rgb channels must match once rounded; the alpha channel (4th number) within 1e-3.
  return x.nums.every((n, i) => (i < 3 ? Math.round(n) === Math.round(y.nums[i]) : close(n, y.nums[i], 1e-3)));
}

// matrix(a, b, c, d, e, f) -> translation is e, f; matrix3d(...16) -> translation is 12, 13, 14.
const isTranslation = (i: number, count: number) => (count === 6 ? i >= 4 : count === 16 ? i >= 12 && i <= 14 : false);

export function sameValue(prop: string, expected: string, actual: string, crossPlatform = false): boolean {
  if (expected === actual) return true;
  if (COLOR_PROPS.has(prop)) return sameColor(expected, actual);
  if (prop === 'r') return sameNumbers(expected, actual, 1);
  if (prop === 'transform' && crossPlatform) return sameNumbers(expected, actual, 1e-3, isTranslation);
  return sameNumbers(expected, actual, 1e-3);
}

// Different engines can spell the same geometry differently (GSAP folds CSS translate/scale/rotate
// into `transform`, and writes SVG transforms as an attribute), so these are judged by their result.
const GEOMETRY_PROPS = new Set(['transform', 'translate', 'scale', 'rotate', 'transformOrigin', 'attr:transform']);

function lengths(s: string): number[] | null {
  if (s.includes('%')) return null;
  return (s.match(NUM) || []).map(Number);
}

const AXES: Record<string, [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/** Local matrix the browser applies: origin · translate · rotate · scale · transform · origin⁻¹. */
export function effectiveMatrix(state: Record<string, string>): DOMMatrix | null {
  const get = (k: string) => state[k] ?? defaultOf(k);
  const origin = lengths(get('transformOrigin'));
  if (!origin) return null;
  const [ox = 0, oy = 0, oz = 0] = origin;
  const m = new DOMMatrix().translateSelf(ox, oy, oz);

  const translate = get('translate');
  if (translate !== 'none') {
    const v = lengths(translate);
    if (!v) return null;
    m.translateSelf(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
  }
  const rotate = get('rotate');
  if (rotate !== 'none') {
    if (/turn|rad/.test(rotate)) return null;
    const v = (rotate.match(NUM) || []).map(Number);
    const axis = AXES[rotate.trim()[0]];
    if (axis) m.rotateAxisAngleSelf(axis[0], axis[1], axis[2], v[0]);
    else if (v.length === 4) m.rotateAxisAngleSelf(v[0], v[1], v[2], v[3]);
    else m.rotateAxisAngleSelf(0, 0, 1, v[0] ?? 0);
  }
  const scale = get('scale');
  if (scale !== 'none') {
    const v = (scale.match(NUM) || []).map(Number);
    m.scaleSelf(v[0] ?? 1, v[1] ?? v[0] ?? 1, v[2] ?? 1);
  }
  const transform = get('transform');
  if (transform !== 'none') m.multiplySelf(new DOMMatrix(transform));
  return m.translateSelf(-ox, -oy, -oz);
}

function sameGeometry(svg: boolean | undefined, e: Record<string, string>, a: Record<string, string>): boolean {
  if (svg) return sameValue('ctm', e.ctm ?? '', a.ctm ?? '');
  const me = effectiveMatrix(e);
  const ma = effectiveMatrix(a);
  if (!me || !ma) return false;
  const x = me.toFloat64Array();
  const y = ma.toFloat64Array();
  return x.every((n, i) => close(n, y[i], 1e-3));
}

export function compareRecords(expected: GoldenRecord, actual: GoldenRecord): CompareResult {
  const crossPlatform = expected.env.platform !== actual.env.platform;
  const structural: string[] = [];
  const mismatches: Mismatch[] = [];

  if (expected.times.join(',') !== actual.times.join(',')) {
    structural.push(`times differ: expected ${expected.times.length}, got ${actual.times.length}`);
    return { crossPlatform, mismatches, structural };
  }
  const posters = (r: GoldenRecord) => JSON.stringify(r.posters);
  if (posters(expected) !== posters(actual)) {
    structural.push(`posters differ: expected ${posters(expected)}, got ${posters(actual)}`);
  }
  const expIds = expected.elements.map((e) => e.id).join(' ');
  const actIds = actual.elements.map((e) => e.id).join(' ');
  if (expIds !== actIds) structural.push('element tree differs');

  for (const pass of ['forward', 'backward'] as const) {
    const exp = decodePass(expected[pass]);
    const act = decodePass(actual[pass]);
    const times = pass === 'forward' ? expected.times : [...expected.times].reverse();
    exp.forEach((frame, fi) => {
      const other = act[fi] ?? new Map();
      for (const el of expected.elements) {
        const e = frame.get(el.id) ?? {};
        const a = other.get(el.id) ?? {};
        const found: Mismatch[] = [];
        for (const prop of new Set([...Object.keys(e), ...Object.keys(a)])) {
          if (crossPlatform && LAYOUT_PROPS.has(prop)) continue;
          const ev = e[prop] ?? defaultOf(prop);
          const av = a[prop] ?? defaultOf(prop);
          if (!sameValue(prop, ev, av, crossPlatform)) {
            found.push({ pass, time: times[fi], element: el.id, prop, expected: ev, actual: av });
          }
        }
        const geometryOnly = found.length > 0 && found.every((m) => GEOMETRY_PROPS.has(m.prop));
        if (geometryOnly && !crossPlatform && sameGeometry(el.svg, e, a)) continue;
        mismatches.push(...found);
      }
    });
  }
  return { crossPlatform, mismatches, structural };
}

/** Readable lines for a test failure, grouped so one broken tween does not flood the output. */
export function formatMismatches(record: GoldenRecord, mismatches: Mismatch[], limit = 25): string[] {
  const label = new Map(record.elements.map((e) => [e.id, `${e.tag}${e.cls ? '.' + e.cls.split(/\s+/).join('.') : ''}${e.layer ? `[${e.layer}]` : ''}`]));
  const lines = mismatches
    .slice(0, limit)
    .map((m) => `${m.pass} t=${m.time} ${m.element} ${label.get(m.element) || ''} ${m.prop}: expected ${m.expected} | got ${m.actual}`);
  if (mismatches.length > limit) lines.push(`… ${mismatches.length - limit} more`);
  return lines;
}
