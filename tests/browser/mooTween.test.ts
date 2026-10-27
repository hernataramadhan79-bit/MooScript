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

/** Reference values recorded from GSAP 3.15 at p = 0, 0.25, 0.5, 0.75, 1. */
const EASES: Array<[string, number[]]> = [
  ['none', [0, 0.25, 0.5, 0.75, 1]],
  ['power1.in', [0, 0.0625, 0.25, 0.5625, 1]],
  ['power1.out', [0, 0.4375, 0.75, 0.9375, 1]],
  ['power1.inOut', [0, 0.125, 0.5, 0.875, 1]],
  ['power2.in', [0, 0.015625, 0.125, 0.421875, 1]],
  ['power2.out', [0, 0.578125, 0.875, 0.984375, 1]],
  ['power2.inOut', [0, 0.0625, 0.5, 0.9375, 1]],
  ['power3.inOut', [0, 0.03125, 0.5, 0.96875, 1]],
  ['power4.out', [0, 0.7626953125, 0.96875, 0.9990234375, 1]],
  ['quad.out', [0, 0.4375, 0.75, 0.9375, 1]],
  ['cubic.in', [0, 0.015625, 0.125, 0.421875, 1]],
  ['quart.inOut', [0, 0.03125, 0.5, 0.96875, 1]],
  ['quint.out', [0, 0.7626953125, 0.96875, 0.9990234375, 1]],
  ['sine.in', [0, 0.0761204675, 0.2928932188, 0.6173165676, 1]],
  ['sine.out', [0, 0.3826834324, 0.7071067812, 0.9238795325, 1]],
  ['sine.inOut', [0, 0.1464466094, 0.5, 0.8535533906, 1]],
  ['expo.in', [0, 0.0015641734, 0.0234375, 0.1770771504, 1]],
  ['expo.out', [0, 0.8229228496, 0.9765625, 0.9984358266, 1]],
  ['expo.inOut', [0, 0.01171875, 0.5, 0.98828125, 1]],
  ['circ.in', [0, 0.0317541634, 0.1339745962, 0.3385621722, 1]],
  ['circ.out', [0, 0.6614378278, 0.8660254038, 0.9682458366, 1]],
  ['circ.inOut', [0, 0.0669872981, 0.5, 0.9330127019, 1]],
  ['back.in(1.7)', [0, -0.0640625, -0.0875, 0.1828125, 1]],
  ['back.out(1.7)', [0, 0.8171875, 1.0875, 1.0640625, 1]],
  ['back.inOut(2)', [0, -0.0625, 0.5, 1.0625, 1]],
  ['back.out', [0, 0.8174096875, 1.0876975, 1.0641365625, 1]],
  ['elastic.out(1, 0.3)', [0, 0.9116116524, 1.015625, 1.0055242717, 1]],
  ['elastic.in', [0, -0.0055242717, -0.015625, 0.0883883476, 1]],
  ['elastic.inOut(1.2, 0.5)', [0, 0.015625, 0.5, 0.984375, 1]],
  ['elastic.out(0.5, 0.4)', [0, 1.0676495125, 1.0220970869, 0.9948962384, 1]],
  ['bounce.in', [0, 0.02734375, 0.234375, 0.52734375, 1]],
  ['bounce.out', [0, 0.47265625, 0.765625, 0.97265625, 1]],
  ['bounce.inOut', [0, 0.1171875, 0.5, 0.8828125, 1]],
  ['steps(5)', [0, 0.2, 0.6, 0.8, 1]],
  ['power2', [0, 0.578125, 0.875, 0.984375, 1]],
  ['Power3.easeInOut', [0, 0.03125, 0.5, 0.96875, 1]]
];

describe('MooTween eases', () => {
  for (const [name, values] of EASES) {
    it(name, () => {
      const ease = mt.parseEase(name);
      [0, 0.25, 0.5, 0.75, 1].forEach((p, i) => expect(ease(p)).toBeCloseTo(values[i], 6));
    });
  }

  it('falls back to power1.out for an unknown ease and warns once', () => {
    const warnings: string[] = [];
    win.console.warn = (msg: string) => warnings.push(msg);
    const ease = mt.parseEase('wobble.out');
    mt.parseEase('wobble.out');
    expect(ease(0.5)).toBe(0.75);
    expect(warnings).toHaveLength(1);
  });
});

describe('MooTween timeline positions', () => {
  it('resolves numbers, relative offsets, < and >, and labels', () => {
    const tl = mt.timeline();
    const o = () => ({ v: 0 });
    tl.addLabel('intro', 0.3);
    tl.to(o(), { v: 1, duration: 0.6 })
      .to(o(), { v: 1, duration: 0.6 }, '-=0.3')
      .to(o(), { v: 1, duration: 0.5 }, '+=0.2')
      .to(o(), { v: 1, duration: 0.4 }, '<')
      .to(o(), { v: 1, duration: 0.4 }, '>')
      .to(o(), { v: 1, duration: 0.4 }, '<0.2')
      .to(o(), { v: 1, duration: 0.4 }, '>-0.1')
      .to(o(), { v: 1, duration: 0.5 }, 'intro')
      .to(o(), { v: 1, duration: 0.5 }, 'intro+=0.4')
      .to(o(), { v: 1, duration: 0.5, delay: 0.3 }, 1.0)
      .to(o(), { v: 1 });
    // In insertion order: 0, 0.3, 1.1, 1.1, 1.5, 1.7, 2, 0.3 (label), 0.7, 1.3 (delay), 2.4 (end).
    const starts = tl.getChildren().map((c: any) => c.startTime());
    expect(starts).toEqual([0, 0.3, 0.3, 0.7, 1.1, 1.1, 1.3, 1.5, 1.7, 2, 2.4]);
    expect(tl.duration()).toBeCloseTo(2.9, 6);
  });

  it('keeps sums like 3.2 + 3.6 on the exact frame', () => {
    const tl = mt.timeline();
    const target = el();
    tl.set(target, { opacity: 0.5 }, 3.2 + 3.6);
    tl.progress(1, true);
    tl.seek(0);
    tl.seek(6.8);
    expect(style(target).opacity).toBe('0.5');
  });

  it('renders a child timeline in its own local time', () => {
    const tl = mt.timeline();
    const child = mt.timeline();
    const target = el();
    child.to(target, { x: 100, duration: 1, ease: 'none' });
    tl.add(child, 2);
    tl.seek(2.5);
    expect(translateX(target)).toBeCloseTo(50, 3);
  });
});

describe('MooTween staggers', () => {
  const offsets = (stagger: any, n = 7) => {
    const tl = mt.timeline();
    const targets = Array.from({ length: n }, () => ({ v: 0 }));
    tl.to(targets, { v: 1, duration: 0.5, stagger }, 0);
    // Children are kept in start order; report the offsets in target order.
    const kids = tl.getChildren()[0].getChildren();
    return targets.map((t) => Math.round(kids.find((c: any) => c.targets()[0] === t).startTime() * 1000) / 1000);
  };

  it('spaces by a number', () => expect(offsets(0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  it('starts from the center', () => expect(offsets({ each: 0.08, from: 'center' })).toEqual([0.48, 0.32, 0.16, 0, 0.16, 0.32, 0.48]));
  it('spreads an amount from the end', () => expect(offsets({ amount: 0.5, from: 'end' })).toEqual([0.5, 0.417, 0.333, 0.25, 0.167, 0.083, 0]));
  it('starts from the edges', () => expect(offsets({ each: 0.1, from: 'edges' })).toEqual([0, 0.2, 0.4, 0.6, 0.4, 0.2, 0]));
  it('starts from an index', () => expect(offsets({ each: 0.1, from: 3 })).toEqual([0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6]));
  it('shuffles random deterministically', () => {
    const a = offsets({ each: 0.1, from: 'random' });
    const b = offsets({ each: 0.1, from: 'random' });
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  });
});

describe('MooTween repeat, yoyo and keyframes', () => {
  it('repeats with yoyo and repeatDelay', () => {
    const tl = mt.timeline();
    const target = el();
    tl.to(target, { x: 100, duration: 1, repeat: 2, yoyo: true, ease: 'none' }, 0);
    const at = (t: number) => {
      tl.seek(t);
      return Math.round(translateX(target));
    };
    expect([at(0.25), at(1.25), at(2.25), at(3)]).toEqual([25, 75, 25, 100]);

    const tl2 = mt.timeline();
    const b = el();
    tl2.to(b, { x: 100, duration: 1, repeat: 1, repeatDelay: 0.5, ease: 'none' }, 0);
    tl2.seek(1.25);
    expect(Math.round(translateX(b))).toBe(100);
    tl2.seek(2);
    expect(Math.round(translateX(b))).toBe(50);
  });

  it('clamps repeat: -1 to the shot it belongs to', () => {
    const shot = mt.timeline({ repeatSpan: 3 });
    shot.to({ v: 0 }, { v: 1, duration: 0.4, repeat: -1 }, 0);
    expect(shot.duration()).toBeCloseTo(3.2, 6);
  });

  it('plays keyframes in sequence, linear unless eased', () => {
    const tl = mt.timeline();
    const target = el();
    tl.to(target, { keyframes: [{ x: 200, duration: 0.4 }, { y: 100, duration: 0.5 }, { x: 0, duration: 0.5, ease: 'power2.in' }] }, 0);
    tl.seek(0.2);
    expect(translateX(target)).toBeCloseTo(100, 3);
    tl.seek(0.65);
    expect(matrixOf(target).m42).toBeCloseTo(50, 3);
    tl.seek(1.4);
    expect(translateX(target)).toBeCloseTo(0, 3);
  });
});

describe('MooTween properties', () => {
  it('composes transforms in a fixed order and leaves CSS translate/scale/rotate alone', () => {
    const target = el('translate: 10px 20px; rotate: 30deg;');
    const tl = mt.timeline();
    tl.to(target, { x: 50, xPercent: -50, rotation: 45, skewX: 10, scaleX: 2, scaleY: 0.5, duration: 1, ease: 'none' }, 0);
    tl.seek(1);
    // xPercent -50 of a 100px box is -50px.
    const expected = new win.DOMMatrix('translate(-50px, 0px) translate(50px, 0px) rotate(45deg) skew(10deg, 0deg) scale(2, 0.5)');
    const actual = matrixOf(target);
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((k) => expect(actual[k]).toBeCloseTo(expected[k], 3));
    expect(style(target).translate).toBe('10px 20px');
    expect(style(target).rotate).toBe('30deg');
  });

  it('reads the starting transform from the computed matrix once', () => {
    const target = el('transform: rotate(15deg) translateX(20px);');
    const tl = mt.timeline();
    tl.to(target, { scale: 0, duration: 1 }, 0);
    tl.seek(0);
    const m = matrixOf(target);
    const ref = new win.DOMMatrix('rotate(15deg) translateX(20px)');
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((k) => expect(m[k]).toBeCloseTo(ref[k], 3));
  });

  it('rotates SVG around svgOrigin and transformOrigin', () => {
    const root = svg('<rect class="a" x="50" y="50" width="100" height="40"/><rect class="b" x="200" y="200" width="100" height="40"/>');
    const a = root.querySelector('.a') as any;
    const b = root.querySelector('.b') as any;
    const tl = mt.timeline();
    tl.to(a, { rotation: 90, svgOrigin: '100 100', duration: 1 }, 0);
    tl.to(b, { rotation: 90, transformOrigin: '50% 50%', duration: 1 }, 0);
    tl.seek(1);
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
    const tl = mt.timeline();
    tl.to(a, { backgroundColor: '#ffffff', duration: 1, ease: 'none' }, 0);
    tl.to(b, { color: 'blue', duration: 1, ease: 'none' }, 0);
    tl.to(c, { backgroundColor: 'var(--accent)', duration: 1, ease: 'none' }, 0);
    tl.to(d, { backgroundColor: 'hsl(0, 100%, 50%)', duration: 1, ease: 'none' }, 0);
    tl.seek(0.5);
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
    const tl = mt.timeline();
    tl.to(a, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'none' }, 0);
    tl.to(b, { filter: 'blur(10px) brightness(1.5)', duration: 1, ease: 'none' }, 0);
    tl.to(c, { clipPath: 'circle(30% at 50% 50%)', duration: 1, ease: 'none' }, 0);
    tl.to(d, { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)', duration: 1, ease: 'none' }, 0);
    tl.seek(0.5);
    expect(style(a).clipPath).toBe('inset(0% 25%)');
    expect(style(b).filter).toBe('blur(5px) brightness(1.25)');
    expect(style(c).clipPath).toBe('inset(10%)');
    expect(style(d).boxShadow).toBe('rgba(0, 0, 0, 0.25) 0px 5px 10px 0px');
    tl.seek(1);
    expect(style(c).clipPath).toBe('circle(30% at 50% 50%)');
  });

  it('animates SVG strokes and attributes, including same-shape paths', () => {
    const root = svg('<path class="p" d="M0 0 L 100 100" stroke="black"/><circle class="c" cx="10" cy="10" r="5"/><path class="m" d="M0 0 L 10 10"/>');
    const p = root.querySelector('.p') as any;
    const c = root.querySelector('.c') as any;
    const m = root.querySelector('.m') as any;
    const tl = mt.timeline();
    tl.fromTo(p, { strokeDasharray: 200, strokeDashoffset: 200 }, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0);
    tl.to(c, { attr: { cx: 110, r: 25 }, duration: 1, ease: 'none' }, 0);
    tl.to(p, { attr: { d: 'M0 0 L 200 50' }, duration: 1, ease: 'none' }, 0);
    tl.to(m, { attr: { d: 'M0 0 L 20 20 L 30 30' }, duration: 1, ease: 'none' }, 0);
    tl.seek(0.5);
    expect(style(p).strokeDashoffset).toBe('100px');
    expect(c.getAttribute('cx')).toBe('60');
    expect(c.getAttribute('r')).toBe('15');
    expect(p.getAttribute('d')).toBe('M0 0 L 150 75');
    expect(m.getAttribute('d')).toBe('M0 0 L 10 10');
    tl.seek(1);
    expect(m.getAttribute('d')).toBe('M0 0 L 20 20 L 30 30');
  });

  it('applies relative values from the value at the tween start', () => {
    const target = el('opacity: 0.8;');
    const tl = mt.timeline();
    tl.to(target, { x: 100, duration: 0.5 }, 0).to(target, { x: '+=50', rotation: '+=90', opacity: '-=0.5', duration: 0.5 });
    tl.seek(1);
    expect(translateX(target)).toBeCloseTo(150, 3);
    expect(Number(style(target).opacity)).toBeCloseTo(0.3, 3);
  });

  it('sets autoAlpha visibility and rounds px CSS values', () => {
    const target = el();
    const tl = mt.timeline();
    tl.to(target, { autoAlpha: 0, left: 101, duration: 1, ease: 'none' }, 0);
    tl.seek(0.5);
    expect(style(target).visibility).toBe('visible');
    expect(style(target).left).toBe('51px');
    tl.seek(1);
    expect(style(target).visibility).toBe('hidden');
  });

  it('tweens plain objects for counters', () => {
    const counter = { v: 0 };
    const tl = mt.timeline();
    tl.to(counter, { v: 80, duration: 1, ease: 'none' }, 0);
    tl.seek(0.25);
    expect(counter.v).toBe(20);
  });

  it('sets unknown properties at the end of the tween and warns once', () => {
    const warnings: string[] = [];
    win.console.warn = (msg: string) => warnings.push(msg);
    const target: any = el();
    const tl = mt.timeline();
    tl.to(target, { fooBar: 'baz', duration: 1 }, 0);
    tl.to(target, { fooBar: 'qux', duration: 1 }, 1);
    tl.seek(0.5);
    expect(target.fooBar).toBeUndefined();
    tl.seek(1);
    expect(target.fooBar).toBe('baz');
    tl.seek(2);
    expect(target.fooBar).toBe('qux');
    expect(warnings).toHaveLength(1);
  });
});

describe('MooTween seek semantics', () => {
  it('initializes with progress(1) then seek(0) and restores starts going backward', () => {
    const a = el();
    const b = el();
    const tl = mt.timeline();
    tl.to(a, { x: 100, duration: 1 }, 0).to(a, { x: 300, duration: 1 }, 1);
    tl.from(b, { opacity: 0, duration: 1 }, 1);
    tl.set(b, { x: 40 }, 1.5);
    tl.progress(1, true);
    tl.seek(0);
    expect(translateX(a)).toBe(0);
    expect(style(b).opacity).toBe('0');
    expect(translateX(b)).toBe(0);
    tl.seek(2);
    expect(translateX(a)).toBe(300);
    expect(translateX(b)).toBe(40);
    tl.seek(1.2);
    expect(translateX(b)).toBe(0);
  });

  it('applies from() at creation, but fromTo(immediateRender: false) only once it starts', () => {
    const a = el();
    const b = el();
    const tl = mt.timeline();
    tl.from(a, { opacity: 0, duration: 1 }, 2);
    tl.fromTo(b, { opacity: 0 }, { opacity: 1, duration: 1, immediateRender: false }, 2);
    expect(style(a).opacity).toBe('0');
    expect(style(b).opacity).toBe('1');
    tl.progress(1, true);
    tl.seek(1);
    expect(style(a).opacity).toBe('0');
    expect(style(b).opacity).toBe('1');
  });

  it('gives an earlier to() followed by a later from() one deterministic result', () => {
    const results = [0, 1, 2].map(() => {
      const target = el();
      const tl = mt.timeline();
      tl.to(target, { x: 200, duration: 0.5 }, 0.3);
      tl.from(target, { x: -200, duration: 0.5 }, 1);
      tl.progress(1, true);
      tl.seek(0);
      tl.seek(3);
      return translateX(target);
    });
    expect(results).toEqual([0, 0, 0]);
  });

  it('renders the same DOM when the same time is seeked twice', () => {
    const target = el();
    const tl = mt.timeline();
    tl.to(target, { x: 100, rotation: 30, opacity: 0.4, duration: 1 }, 0).to(target, { scale: 2, duration: 1 }, 0.5);
    tl.progress(1, true);
    tl.seek(0);
    tl.seek(0.75);
    const first = target.style.cssText;
    tl.seek(0.75);
    expect(target.style.cssText).toBe(first);
    tl.seek(1.5);
    tl.seek(0.75);
    expect(target.style.cssText).toBe(first);
  });
});

describe('MooTween callbacks', () => {
  it('fires onStart, onUpdate and onComplete while seeking, never with suppressEvents', () => {
    const calls: string[] = [];
    let progress = -1;
    const tl = mt.timeline();
    tl.to({ v: 0 }, {
      v: 1,
      duration: 1,
      onStart: () => calls.push('start'),
      onUpdate: function (this: any) {
        progress = this.progress();
      },
      onComplete: () => calls.push('complete')
    }, 1);
    tl.seek(3, true);
    expect(calls).toEqual([]);
    tl.seek(0);
    tl.seek(1.5);
    expect(calls).toEqual(['start']);
    expect(progress).toBeCloseTo(0.5, 6);
    tl.seek(2.5);
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
    const tl = mt.timeline({ scope: rootA });
    tl.to('.ring', { x: 50, duration: 1 }, 0);
    tl.seek(1);
    expect(translateX(ringA)).toBe(50);
    expect(style(ringB).transform).toBe('none');
  });

  it('scopes timelines built while a shot is active and attaches standalone tweens to it', () => {
    const root = el();
    const inner = el('', root);
    inner.className = 'dot';
    const outside = el();
    outside.className = 'dot';
    const shot = mt.timeline({ scope: root });
    mt.activeTimeline = shot;
    const child = mt.timeline();
    child.to('.dot', { x: 10, duration: 1 });
    shot.add(child, 0);
    mt.to(inner, { y: 30, duration: 1 });
    mt.set(inner, { opacity: 0.5 });
    mt.activeTimeline = null;
    shot.progress(1, true);
    shot.seek(0);
    expect(style(inner).opacity).toBe('0.5');
    shot.seek(1);
    expect(translateX(inner)).toBe(10);
    expect(matrixOf(inner).m42).toBe(30);
    expect(style(outside).transform).toBe('none');
  });

  it('treats empty or missing targets as a no-op', () => {
    const tl = mt.timeline();
    expect(tl.to('.missing', { x: 1 })).toBe(tl);
    expect(tl.to([], { x: 1 })).toBe(tl);
    expect(tl.to(null, { x: 1 })).toBe(tl);
    expect(tl.getChildren()).toHaveLength(0);
  });
});

describe('MooTween API surface', () => {
  it('exposes the GSAP-style alias and the utils subset', () => {
    expect(win.gsap).toBe(mt);
    expect(win.MooTween).toBe(mt);
    const u = mt.utils;
    expect(u.clamp(0, 10, 12)).toBe(10);
    expect(u.mapRange(0, 10, 0, 100, 5)).toBe(50);
    expect(u.interpolate(0, 10, 0.25)).toBe(2.5);
    expect(u.wrap(0, 10, 12)).toBe(2);
    expect(u.wrap(['a', 'b', 'c'], 4)).toBe('b');
    expect(u.toArray([el(), el()])).toHaveLength(2);
    expect(() => mt.ticker.lagSmoothing(0)).not.toThrow();
    expect(() => mt.config({ nullTargetWarn: false })).not.toThrow();
  });

  it('runs from its own source text, the way the stage embeds it', () => {
    const fresh = document.createElement('iframe');
    document.body.appendChild(fresh);
    const w: any = fresh.contentWindow;
    const script = w.document.createElement('script');
    script.textContent = `(${installMooTween.toString()})(window);`;
    w.document.head.appendChild(script);
    expect(typeof w.MooTween.timeline).toBe('function');
    const counter = { v: 0 };
    w.MooTween.timeline().to(counter, { v: 10, duration: 1, ease: 'none' }, 0).seek(0.5);
    expect(counter.v).toBe(5);
    fresh.remove();
  });
});
