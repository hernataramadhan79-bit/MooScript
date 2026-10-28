/**
 * MooTween feature tests, run in a real browser. Every test gets its own iframe so selectors,
 * computed styles and the window.gsap alias never leak between tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installMooTween } from '../../src/engine/composition/runtime/mooTween';

let frame: HTMLIFrameElement;
let win: any;
let doc: Document;
let mt: any;

beforeEach(() => {
  frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;border:0;opacity:0;';
  document.body.appendChild(frame);
  win = frame.contentWindow;
  doc = win.document;
  doc.body.style.margin = '0';
  mt = installMooTween(win);
});

afterEach(() => frame.remove());

function el(css = '', parent: Element = doc.body, tag = 'div'): HTMLElement {
  const node = doc.createElement(tag);
  node.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:50px;' + css;
  parent.appendChild(node);
  return node;
}

function svg(markup: string): SVGSVGElement {
  const host = doc.createElement('div');
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">${markup}</svg>`;
  doc.body.appendChild(host);
  return host.firstElementChild as SVGSVGElement;
}

const style = (node: Element) => win.getComputedStyle(node);
const matrixOf = (node: Element) => new win.DOMMatrix(style(node).transform === 'none' ? undefined : style(node).transform);
const translateX = (node: Element) => matrixOf(node).m41;

/** Reference values at p = 0, 0.25, 0.5, 0.75, 1 (recorded from the engine MooTween replaced). */
const EASES: Array<[string, number[]]> = [
  ['linear', [0, 0.25, 0.5, 0.75, 1]],
  ['soft-in', [0, 0.0625, 0.25, 0.5625, 1]],
  ['soft-out', [0, 0.4375, 0.75, 0.9375, 1]],
  ['soft-inout', [0, 0.125, 0.5, 0.875, 1]],
  ['smooth-in', [0, 0.015625, 0.125, 0.421875, 1]],
  ['smooth-out', [0, 0.578125, 0.875, 0.984375, 1]],
  ['smooth-inout', [0, 0.0625, 0.5, 0.9375, 1]],
  ['strong-inout', [0, 0.03125, 0.5, 0.96875, 1]],
  ['sharp-out', [0, 0.7626953125, 0.96875, 0.9990234375, 1]],
  ['soft-out', [0, 0.4375, 0.75, 0.9375, 1]],
  ['smooth-in', [0, 0.015625, 0.125, 0.421875, 1]],
  ['strong-inout', [0, 0.03125, 0.5, 0.96875, 1]],
  ['sharp-out', [0, 0.7626953125, 0.96875, 0.9990234375, 1]],
  ['gentle-in', [0, 0.0761204675, 0.2928932188, 0.6173165676, 1]],
  ['gentle-out', [0, 0.3826834324, 0.7071067812, 0.9238795325, 1]],
  ['gentle-inout', [0, 0.1464466094, 0.5, 0.8535533906, 1]],
  ['rush-in', [0, 0.0015641734, 0.0234375, 0.1770771504, 1]],
  ['rush-out', [0, 0.8229228496, 0.9765625, 0.9984358266, 1]],
  ['rush-inout', [0, 0.01171875, 0.5, 0.98828125, 1]],
  ['arc-in', [0, 0.0317541634, 0.1339745962, 0.3385621722, 1]],
  ['arc-out', [0, 0.6614378278, 0.8660254038, 0.9682458366, 1]],
  ['arc-inout', [0, 0.0669872981, 0.5, 0.9330127019, 1]],
  ['overshoot-in(1.7)', [0, -0.0640625, -0.0875, 0.1828125, 1]],
  ['overshoot-out(1.7)', [0, 0.8171875, 1.0875, 1.0640625, 1]],
  ['overshoot-inout(2)', [0, -0.0625, 0.5, 1.0625, 1]],
  ['overshoot-out', [0, 0.8174096875, 1.0876975, 1.0641365625, 1]],
  ['spring-out(1, 0.3)', [0, 0.9116116524, 1.015625, 1.0055242717, 1]],
  ['spring-in', [0, -0.0055242717, -0.015625, 0.0883883476, 1]],
  ['spring-inout(1.2, 0.5)', [0, 0.015625, 0.5, 0.984375, 1]],
  ['spring-out(0.5, 0.4)', [0, 1.0676495125, 1.0220970869, 0.9948962384, 1]],
  ['bounce-in', [0, 0.02734375, 0.234375, 0.52734375, 1]],
  ['bounce-out', [0, 0.47265625, 0.765625, 0.97265625, 1]],
  ['bounce-inout', [0, 0.1171875, 0.5, 0.8828125, 1]],
  ['steps(5)', [0, 0.2, 0.6, 0.8, 1]],
  ['smooth', [0, 0.578125, 0.875, 0.984375, 1]],
  ['strong-inout', [0, 0.03125, 0.5, 0.96875, 1]]
];

describe('MooTween curves', () => {
  for (const [name, values] of EASES) {
    it(name, () => {
      const ease = mt.curve(name);
      [0, 0.25, 0.5, 0.75, 1].forEach((p, i) => expect(ease(p)).toBeCloseTo(values[i], 6));
    });
  }

  it('falls back to soft-out for an unknown curve and warns once', () => {
    const warnings: string[] = [];
    win.console.warn = (msg: string) => warnings.push(msg);
    const ease = mt.curve('wobble-out');
    mt.curve('wobble-out');
    expect(ease(0.5)).toBe(0.75);
    expect(warnings).toHaveLength(1);
  });
});

describe('MooTween positions (at)', () => {
  it('resolves seconds, end, with, after and marks', () => {
    const shot = mt.track();
    const o = () => ({ v: 0 });
    shot.mark('intro', 0.3);
    shot.go(o(), { v: 1, dur: 0.6 })
      .go(o(), { v: 1, dur: 0.6 }, 'end-0.3')
      .go(o(), { v: 1, dur: 0.5 }, 'end+0.2')
      .go(o(), { v: 1, dur: 0.4 }, 'with')
      .go(o(), { v: 1, dur: 0.4 }, 'after')
      .go(o(), { v: 1, dur: 0.4 }, 'with+0.2')
      .go(o(), { v: 1, dur: 0.4 }, 'after-0.1')
      .go(o(), { v: 1, dur: 0.5 }, 'intro')
      .go(o(), { v: 1, dur: 0.5 }, 'intro+0.4')
      .go(o(), { v: 1, dur: 0.5, wait: 0.3 }, 1.0)
      .go(o(), { v: 1 });
    // In insertion order: 0, 0.3, 1.1, 1.1, 1.5, 1.7, 2, 0.3 (label), 0.7, 1.3 (delay), 2.4 (end).
    const starts = shot.children().map((c: any) => c.startsAt());
    expect(starts).toEqual([0, 0.3, 0.3, 0.7, 1.1, 1.1, 1.3, 1.5, 1.7, 2, 2.4]);
    expect(shot.duration()).toBeCloseTo(2.9, 6);
  });

  it('keeps sums like 3.2 + 3.6 on the exact frame', () => {
    const shot = mt.track();
    const target = el();
    shot.pin(target, { opacity: 0.5 }, 3.2 + 3.6);
    shot.progress(1, true);
    shot.seek(0);
    shot.seek(6.8);
    expect(style(target).opacity).toBe('0.5');
  });

  it('renders a nested track in its own local time', () => {
    const shot = mt.track();
    const child = mt.track();
    const target = el();
    child.go(target, { x: 100, dur: 1, curve: 'linear' });
    shot.nest(child, 2);
    shot.seek(2.5);
    expect(translateX(target)).toBeCloseTo(50, 3);
  });
});

describe('MooTween cascades', () => {
  const offsets = (cascade: any, n = 7) => {
    const shot = mt.track();
    const targets = Array.from({ length: n }, () => ({ v: 0 }));
    shot.go(targets, { v: 1, dur: 0.5, cascade }, 0);
    // Children are kept in start order; report the offsets in target order.
    const kids = shot.children()[0].children();
    return targets.map((t) => Math.round(kids.find((c: any) => c.targets()[0] === t).startsAt() * 1000) / 1000);
  };

  it('spaces by a number', () => expect(offsets(0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  it('starts from the center', () => expect(offsets({ gap: 0.08, from: 'middle' })).toEqual([0.48, 0.32, 0.16, 0, 0.16, 0.32, 0.48]));
  it('spreads an amount from the end', () => expect(offsets({ total: 0.5, from: 'last' })).toEqual([0.5, 0.417, 0.333, 0.25, 0.167, 0.083, 0]));
  it('starts from the ends', () => expect(offsets({ gap: 0.1, from: 'ends' })).toEqual([0, 0.2, 0.4, 0.6, 0.4, 0.2, 0]));
  it('starts from an index', () => expect(offsets({ gap: 0.1, from: 3 })).toEqual([0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6]));
  it('shuffles deterministically', () => {
    const a = offsets({ gap: 0.1, from: 'shuffle' });
    const b = offsets({ gap: 0.1, from: 'shuffle' });
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  });
});

describe('MooTween loop, pingpong and sequence', () => {
  it('loops with pingpong and loopGap', () => {
    const shot = mt.track();
    const target = el();
    shot.go(target, { x: 100, dur: 1, loop: 2, pingpong: true, curve: 'linear' }, 0);
    const at = (t: number) => {
      shot.seek(t);
      return Math.round(translateX(target));
    };
    expect([at(0.25), at(1.25), at(2.25), at(3)]).toEqual([25, 75, 25, 100]);

    const tl2 = mt.track();
    const b = el();
    tl2.go(b, { x: 100, dur: 1, loop: 1, loopGap: 0.5, curve: 'linear' }, 0);
    tl2.seek(1.25);
    expect(Math.round(translateX(b))).toBe(100);
    tl2.seek(2);
    expect(Math.round(translateX(b))).toBe(50);
  });

  it('clamps loop: true to the shot it belongs to', () => {
    const shot = mt.track({ loopSpan: 3 });
    shot.go({ v: 0 }, { v: 1, dur: 0.4, loop: true }, 0);
    expect(shot.duration()).toBeCloseTo(3.2, 6);
  });

  it('plays a sequence step by step, linear unless curved', () => {
    const shot = mt.track();
    const target = el();
    shot.go(target, { sequence: [{ x: 200, dur: 0.4 }, { y: 100, dur: 0.5 }, { x: 0, dur: 0.5, curve: 'smooth-in' }] }, 0);
    shot.seek(0.2);
    expect(translateX(target)).toBeCloseTo(100, 3);
    shot.seek(0.65);
    expect(matrixOf(target).m42).toBeCloseTo(50, 3);
    shot.seek(1.4);
    expect(translateX(target)).toBeCloseTo(0, 3);
  });
});

describe('MooTween properties', () => {
  it('composes transforms in a fixed order and leaves CSS translate/scale/rotate alone', () => {
    const target = el('translate: 10px 20px; rotate: 30deg;');
    const shot = mt.track();
    shot.go(target, { x: 50, shiftX: -50, spin: 45, skewX: 10, scaleX: 2, scaleY: 0.5, dur: 1, curve: 'linear' }, 0);
    shot.seek(1);
    // shiftX -50 of a 100px box is -50px.
    const expected = new win.DOMMatrix('translate(-50px, 0px) translate(50px, 0px) rotate(45deg) skew(10deg, 0deg) scale(2, 0.5)');
    const actual = matrixOf(target);
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((k) => expect(actual[k]).toBeCloseTo(expected[k], 3));
    expect(style(target).translate).toBe('10px 20px');
    expect(style(target).rotate).toBe('30deg');
  });

  it('reads the starting transform from the computed matrix once', () => {
    const target = el('transform: rotate(15deg) translateX(20px);');
    const shot = mt.track();
    shot.go(target, { scale: 0, dur: 1 }, 0);
    shot.seek(0);
    const m = matrixOf(target);
    const ref = new win.DOMMatrix('rotate(15deg) translateX(20px)');
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((k) => expect(m[k]).toBeCloseTo(ref[k], 3));
  });

  it('spins SVG around pivotPoint and pivot', () => {
    const root = svg('<rect class="a" x="50" y="50" width="100" height="40"/><rect class="b" x="200" y="200" width="100" height="40"/>');
    const a = root.querySelector('.a') as any;
    const b = root.querySelector('.b') as any;
    const shot = mt.track();
    shot.go(a, { spin: 90, pivotPoint: '100 100', dur: 1 }, 0);
    shot.go(b, { spin: 90, pivot: '50% 50%', dur: 1 }, 0);
    shot.seek(1);
    const fixed = (node: any, x: number, y: number) => {
      const p = new win.DOMPoint(x, y).matrixTransform(node.getCTM());
      expect(p.x).toBeCloseTo(x, 2);
      expect(p.y).toBeCloseTo(y, 2);
    };
    fixed(a, 100, 100);
    fixed(b, 250, 220);
  });

  it('interpolates hex, named, var() and hsl colors', () => {
    doc.documentElement.style.setProperty('--accent', '#0000ff');
    const a = el('background-color: #000000;');
    const b = el('color: red;');
    const c = el('background-color: white;');
    const d = el('background-color: rgb(255, 255, 255);');
    const shot = mt.track();
    shot.go(a, { backgroundColor: '#ffffff', dur: 1, curve: 'linear' }, 0);
    shot.go(b, { color: 'blue', dur: 1, curve: 'linear' }, 0);
    shot.go(c, { backgroundColor: 'var(--accent)', dur: 1, curve: 'linear' }, 0);
    shot.go(d, { backgroundColor: 'hsl(0, 100%, 50%)', dur: 1, curve: 'linear' }, 0);
    shot.seek(0.5);
    expect(style(a).backgroundColor).toBe('rgb(128, 128, 128)');
    expect(style(b).color).toBe('rgb(128, 0, 128)');
    expect(style(c).backgroundColor).toBe('rgb(128, 128, 255)');
    // HSL path: white is hsl(0, 0%, 100%) -> red hsl(0, 100%, 50%) passes through hsl(0, 50%, 75%).
    expect(style(d).backgroundColor).toBe('rgb(223, 159, 159)');
  });

  it('interpolates matching complex strings and switches mismatched ones at the end', () => {
    const a = el('clip-path: inset(0% 50% 0% 50%);');
    const b = el();
    const c = el('clip-path: inset(10%);');
    const d = el();
    const shot = mt.track();
    shot.go(a, { clipPath: 'inset(0% 0% 0% 0%)', dur: 1, curve: 'linear' }, 0);
    shot.go(b, { filter: 'blur(10px) brightness(1.5)', dur: 1, curve: 'linear' }, 0);
    shot.go(c, { clipPath: 'circle(30% at 50% 50%)', dur: 1, curve: 'linear' }, 0);
    shot.go(d, { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)', dur: 1, curve: 'linear' }, 0);
    shot.seek(0.5);
    expect(style(a).clipPath).toBe('inset(0% 25%)');
    expect(style(b).filter).toBe('blur(5px) brightness(1.25)');
    expect(style(c).clipPath).toBe('inset(10%)');
    expect(style(d).boxShadow).toBe('rgba(0, 0, 0, 0.25) 0px 5px 10px 0px');
    shot.seek(1);
    expect(style(c).clipPath).toBe('circle(30% at 50% 50%)');
  });

  it('animates SVG strokes and attributes, including same-shape paths', () => {
    const root = svg('<path class="p" d="M0 0 L 100 100" stroke="black"/><circle class="c" cx="10" cy="10" r="5"/><path class="m" d="M0 0 L 10 10"/>');
    const p = root.querySelector('.p') as any;
    const c = root.querySelector('.c') as any;
    const m = root.querySelector('.m') as any;
    const shot = mt.track();
    shot.travel(p, { strokeDasharray: 200, strokeDashoffset: 200 }, { strokeDashoffset: 0, dur: 1, curve: 'linear' }, 0);
    shot.go(c, { attrs: { cx: 110, r: 25 }, dur: 1, curve: 'linear' }, 0);
    shot.go(p, { attrs: { d: 'M0 0 L 200 50' }, dur: 1, curve: 'linear' }, 0);
    shot.go(m, { attrs: { d: 'M0 0 L 20 20 L 30 30' }, dur: 1, curve: 'linear' }, 0);
    shot.seek(0.5);
    expect(style(p).strokeDashoffset).toBe('100px');
    expect(c.getAttribute('cx')).toBe('60');
    expect(c.getAttribute('r')).toBe('15');
    expect(p.getAttribute('d')).toBe('M0 0 L 150 75');
    expect(m.getAttribute('d')).toBe('M0 0 L 10 10');
    shot.seek(1);
    expect(m.getAttribute('d')).toBe('M0 0 L 20 20 L 30 30');
  });

  it('applies relative values from the value at the tween start', () => {
    const target = el('opacity: 0.8;');
    const shot = mt.track();
    shot.go(target, { x: 100, dur: 0.5 }, 0).go(target, { x: 'by(50)', spin: 'by(90)', opacity: 'by(-0.5)', dur: 0.5 });
    shot.seek(1);
    expect(translateX(target)).toBeCloseTo(150, 3);
    expect(Number(style(target).opacity)).toBeCloseTo(0.3, 3);
  });

  it('sets fade visibility and rounds px CSS values', () => {
    const target = el();
    const shot = mt.track();
    shot.go(target, { fade: 0, left: 101, dur: 1, curve: 'linear' }, 0);
    shot.seek(0.5);
    expect(style(target).visibility).toBe('visible');
    expect(style(target).left).toBe('51px');
    shot.seek(1);
    expect(style(target).visibility).toBe('hidden');
  });

  it('tweens plain objects for counters', () => {
    const counter = { v: 0 };
    const shot = mt.track();
    shot.go(counter, { v: 80, dur: 1, curve: 'linear' }, 0);
    shot.seek(0.25);
    expect(counter.v).toBe(20);
  });

  it('sets unknown properties at the end of the tween and warns once', () => {
    const warnings: string[] = [];
    win.console.warn = (msg: string) => warnings.push(msg);
    const target: any = el();
    const shot = mt.track();
    shot.go(target, { fooBar: 'baz', dur: 1 }, 0);
    shot.go(target, { fooBar: 'qux', dur: 1 }, 1);
    shot.seek(0.5);
    expect(target.fooBar).toBeUndefined();
    shot.seek(1);
    expect(target.fooBar).toBe('baz');
    shot.seek(2);
    expect(target.fooBar).toBe('qux');
    expect(warnings).toHaveLength(1);
  });
});

describe('MooTween seek semantics', () => {
  it('initializes with progress(1) then seek(0) and restores starts going backward', () => {
    const a = el();
    const b = el();
    const shot = mt.track();
    shot.go(a, { x: 100, dur: 1 }, 0).go(a, { x: 300, dur: 1 }, 1);
    shot.arrive(b, { opacity: 0, dur: 1 }, 1);
    shot.pin(b, { x: 40 }, 1.5);
    shot.progress(1, true);
    shot.seek(0);
    expect(translateX(a)).toBe(0);
    expect(style(b).opacity).toBe('0');
    expect(translateX(b)).toBe(0);
    shot.seek(2);
    expect(translateX(a)).toBe(300);
    expect(translateX(b)).toBe(40);
    shot.seek(1.2);
    expect(translateX(b)).toBe(0);
  });

  it('applies arrive() at creation, but travel(showStart: false) only once it starts', () => {
    const a = el();
    const b = el();
    const shot = mt.track();
    shot.arrive(a, { opacity: 0, dur: 1 }, 2);
    shot.travel(b, { opacity: 0 }, { opacity: 1, dur: 1, showStart: false }, 2);
    expect(style(a).opacity).toBe('0');
    expect(style(b).opacity).toBe('1');
    shot.progress(1, true);
    shot.seek(1);
    expect(style(a).opacity).toBe('0');
    expect(style(b).opacity).toBe('1');
  });

  it('gives an earlier go() followed by a later arrive() one deterministic result', () => {
    const results = [0, 1, 2].map(() => {
      const target = el();
      const shot = mt.track();
      shot.go(target, { x: 200, dur: 0.5 }, 0.3);
      shot.arrive(target, { x: -200, dur: 0.5 }, 1);
      shot.progress(1, true);
      shot.seek(0);
      shot.seek(3);
      return translateX(target);
    });
    expect(results).toEqual([0, 0, 0]);
  });

  it('renders the same DOM when the same time is seeked twice', () => {
    const target = el();
    const shot = mt.track();
    shot.go(target, { x: 100, spin: 30, opacity: 0.4, dur: 1 }, 0).go(target, { scale: 2, dur: 1 }, 0.5);
    shot.progress(1, true);
    shot.seek(0);
    shot.seek(0.75);
    const first = target.style.cssText;
    shot.seek(0.75);
    expect(target.style.cssText).toBe(first);
    shot.seek(1.5);
    shot.seek(0.75);
    expect(target.style.cssText).toBe(first);
  });
});

describe('MooTween callbacks', () => {
  it('fires onStart, onUpdate and onComplete while seeking, never with suppressEvents', () => {
    const calls: string[] = [];
    let progress = -1;
    const shot = mt.track();
    shot.go({ v: 0 }, {
      v: 1,
      dur: 1,
      onBegin: () => calls.push('start'),
      onFrame: function (this: any) {
        progress = this.progress();
      },
      onEnd: () => calls.push('complete')
    }, 1);
    shot.seek(3, true);
    expect(calls).toEqual([]);
    shot.seek(0);
    shot.seek(1.5);
    expect(calls).toEqual(['start']);
    expect(progress).toBeCloseTo(0.5, 6);
    shot.seek(2.5);
    expect(calls).toEqual(['start', 'complete']);
  });
});

describe('MooTween targets and scope', () => {
  it('resolves selectors inside the scene root only', () => {
    const rootA = el('', doc.body);
    const rootB = el('', doc.body);
    const ringA = el('', rootA);
    const ringB = el('', rootB);
    ringA.className = ringB.className = 'ring';
    const shot = mt.track({ scope: rootA });
    shot.go('.ring', { x: 50, dur: 1 }, 0);
    shot.seek(1);
    expect(translateX(ringA)).toBe(50);
    expect(style(ringB).transform).toBe('none');
  });

  it('scopes sub-tracks built while a shot is active', () => {
    const root = el();
    const inner = el('', root);
    inner.className = 'dot';
    const outside = el();
    outside.className = 'dot';
    const shot = mt.track({ scope: root });
    mt.activeTrack = shot;
    const sub = mt.track();
    sub.go('.dot', { x: 10, dur: 1 });
    shot.nest(sub, 0);
    shot.pin(inner, { opacity: 0.5 }, 0);
    mt.activeTrack = null;
    shot.progress(1, true);
    shot.seek(0);
    expect(style(inner).opacity).toBe('0.5');
    shot.seek(1);
    expect(translateX(inner)).toBe(10);
    expect(style(outside).transform).toBe('none');
  });

  it('treats empty or missing targets as a no-op', () => {
    const shot = mt.track();
    expect(shot.go('.missing', { x: 1 })).toBe(shot);
    expect(shot.go([], { x: 1 })).toBe(shot);
    expect(shot.go(null, { x: 1 })).toBe(shot);
    expect(shot.children()).toHaveLength(0);
  });
});

describe('MooTween API surface', () => {
  it('exposes only the MooScript API', () => {
    expect(win.MooTween).toBe(mt);
    expect(win.gsap).toBeUndefined();
    const shot = mt.track();
    for (const name of ['go', 'arrive', 'travel', 'pin', 'mark', 'cue', 'nest', 'seek', 'progress', 'duration']) {
      expect(typeof shot[name]).toBe('function');
    }
    for (const old of ['to', 'from', 'fromTo', 'set', 'add', 'addLabel', 'call']) expect(shot[old]).toBeUndefined();
    expect(mt.timeline).toBeUndefined();
    const m = mt.math;
    expect(m.clamp(0, 10, 12)).toBe(10);
    expect(m.remap(0, 10, 0, 100, 5)).toBe(50);
    expect(m.mix(0, 10, 0.25)).toBe(2.5);
    expect(m.cycle(0, 10, 12)).toBe(2);
    expect(m.cycle(['a', 'b', 'c'], 4)).toBe('b');
    expect(m.snap(5, 12)).toBe(10);
    expect(mt.select([el(), el()])).toHaveLength(2);
  });

  it('ignores old option names instead of guessing', () => {
    win.console.warn = () => undefined;
    const target = el();
    const shot = mt.track();
    shot.go(target, { x: 100, duration: 2, ease: 'none' } as any, 0);
    shot.seek(0.25);
    // dur falls back to 0.5 and curve to soft-out: 'duration' and 'ease' are not MooScript options.
    expect(translateX(target)).toBeCloseTo(75, 3);
  });

  it('runs from its own source text, the way the stage embeds it', () => {
    const fresh = document.createElement('iframe');
    document.body.appendChild(fresh);
    const w: any = fresh.contentWindow;
    const script = w.document.createElement('script');
    script.textContent = `(${installMooTween.toString()})(window);`;
    w.document.head.appendChild(script);
    expect(typeof w.MooTween.track).toBe('function');
    const counter = { v: 0 };
    w.MooTween.track().go(counter, { v: 10, dur: 1, curve: 'linear' }, 0).seek(0.5);
    expect(counter.v).toBe(5);
    fresh.remove();
  });
});
