import { describe, it, expect } from 'vitest';
import { installMographKit } from '../src/engine/composition/runtime/mographKit';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { lintMographQuality } from '../src/engine/composition/mographLint';

interface Call {
  method: 'go' | 'arrive' | 'travel' | 'pin';
  targets: any;
  vars: any;
  fromVars?: any;
  position: number;
}

class FakeEl {
  tagName: string;
  style: Record<string, string> = {};
  children: FakeEl[] = [];
  childNodes: any[] = [];
  textContentValue = '';
  __mooSplit?: any;
  nodeType = 1;
  constructor(tag = 'DIV', text = '') {
    this.tagName = tag.toUpperCase();
    this.textContentValue = text;
  }
  get textContent(): string {
    if (this.childNodes.length === 0) return this.textContentValue;
    return this.childNodes.map((n) => (typeof n === 'string' ? n : n.textContent)).join('');
  }
  set textContent(v: string) {
    this.textContentValue = v;
    this.children = [];
    this.childNodes = [];
  }
  appendChild(node: any) {
    this.childNodes.push(node);
    if (node instanceof FakeEl) this.children.push(node);
    return node;
  }
  insertBefore(node: any) {
    return this.appendChild(node);
  }
  getTotalLength() {
    return 500;
  }
}

function setup(dur = 4, words: Array<{ word: string; start: number }> = []) {
  const calls: Call[] = [];
  const shot = {
    go: (targets: any, vars: any, position: number) => calls.push({ method: 'go', targets, vars, position }),
    arrive: (targets: any, vars: any, position: number) => calls.push({ method: 'arrive', targets, vars, position }),
    pin: (targets: any, vars: any, position: number) => calls.push({ method: 'pin', targets, vars, position }),
    travel: (targets: any, fromVars: any, vars: any, position: number) =>
      calls.push({ method: 'travel', targets, fromVars, vars, position })
  };
  const camera = new FakeEl();
  const title = new FakeEl('div', 'Satu ide besar');
  const stat = new FakeEl();
  const paths = [new FakeEl('path'), new FakeEl('path'), new FakeEl('path')];
  const dots = Array.from({ length: 10 }, () => new FakeEl('circle'));
  const doc = {
    getElementById: (id: string) => (id === 'moo-viewport' ? { clientWidth: 1080, clientHeight: 1920 } : null),
    createElement: (tag: string) => new FakeEl(tag),
    createTextNode: (text: string) => text
  };
  const bySelector: Record<string, FakeEl[]> = {
    '.moo-camera': [camera],
    '.title': [title],
    '.stat': [stat],
    'path': paths,
    '.dot': dots
  };
  const root = {
    ownerDocument: doc,
    firstElementChild: camera,
    clientWidth: 1080,
    clientHeight: 1920,
    querySelector: (sel: string) => (bySelector[sel] || [])[0] || null,
    querySelectorAll: (sel: string) => bySelector[sel] || [],
    appendChild: (n: any) => n
  };
  let seed = 7;
  const ctx: any = {
    dur,
    at: (w: string) => words.find((x) => x.word === w)?.start || 0,
    rand: () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
  };
  installMographKit(shot, root, ctx);
  return { calls, ctx, camera, title, stat, paths, dots };
}

const endOf = (c: Call, count: number) => {
  const d = c.vars.dur || 0;
  const s = c.vars.cascade || 0;
  const reps = c.vars.loop ? c.vars.loop + 1 : 1;
  return c.position + d * reps + s * (count - 1);
};

describe('Mograph kit (ctx helpers)', () => {
  it('ctx.camera moves the camera for the shot and hands off in the last 0.4s, once', () => {
    const { calls, ctx, camera } = setup(4);
    ctx.camera({ move: 'push' });
    ctx.handoff('whip-left');

    const move = calls.find((c) => c.method === 'travel')!;
    expect(move.targets).toBe(camera);
    expect(move.position).toBe(0);
    expect(move.vars.dur).toBeCloseTo(3.6);
    // push moves in on the subject: the world ends larger than it starts.
    expect(move.vars.scale).toBeGreaterThan(move.fromVars.scale);

    const exits = calls.filter((c) => c.method === 'go');
    expect(exits).toHaveLength(1);
    expect(exits[0].position).toBeCloseTo(3.6);
    expect(exits[0].vars.opacity).toBe(0);
    expect(exits[0].vars.scale).toBe(2.6);
  });

  it('names the camera moves the way a camera operator would', () => {
    const push = setup(4);
    push.ctx.camera({ move: 'push', handoff: false });
    const pull = setup(4);
    pull.ctx.camera({ move: 'pull', handoff: false });
    const scales = (c: Call) => [c.fromVars.scale, c.vars.scale];
    const [pushFrom, pushTo] = scales(push.calls[0]);
    const [pullFrom, pullTo] = scales(pull.calls[0]);
    expect(pushTo).toBeGreaterThan(pushFrom);
    expect(pullTo).toBeLessThan(pullFrom);
  });

  it('moves layers with data-moo-depth less (far) or more (near) than the camera', () => {
    const { calls, ctx, camera } = setup(4);
    const far = new FakeEl();
    const near = new FakeEl();
    const depth = new Map<any, string>([[far, '0.3'], [near, '1.4']]);
    for (const [layer, value] of depth) (layer as any).getAttribute = () => value;
    (camera as any).querySelectorAll = () => [far, near];
    ctx.camera({ move: 'pan-left', handoff: false });

    const cam = calls.find((c) => c.targets === camera)!;
    const farMove = calls.find((c) => c.targets === far)!;
    const nearMove = calls.find((c) => c.targets === near)!;
    // The camera pans from +6% to -6%: a far layer takes most of that back, a near one adds to it.
    const travel = (c: Call) => c.vars.shiftX - c.fromVars.shiftX;
    expect(Math.sign(travel(farMove))).toBe(-Math.sign(travel(cam)));
    expect(Math.abs(travel(farMove))).toBeLessThan(Math.abs(travel(cam)));
    expect(Math.sign(travel(nearMove))).toBe(Math.sign(travel(cam)));
    expect(farMove.vars.dur).toBe(cam.vars.dur);
  });

  it('takes turns on the hand-off and tells the next shot how it left', () => {
    const exits = [0, 1, 2].map((index) => {
      const s = setup(4);
      s.ctx.index = index;
      s.ctx.camera({ move: 'push' });
      return s.ctx.outgoing;
    });
    expect(exits[0]).toBe('zoom');
    expect(new Set(exits).size).toBeGreaterThan(1);

    const named = setup(4);
    named.ctx.camera({ move: 'push', handoff: 'whip-left' });
    expect(named.ctx.outgoing).toBe('whip-left');
  });

  it('opens on the entrance that matches the previous hand-off, without hiding the first frame', () => {
    const { calls, ctx, camera } = setup(4);
    const sceneRoot = new FakeEl();
    (camera as any).parentElement = sceneRoot;
    ctx.incoming = 'whip-left';
    ctx.camera({ move: 'push', handoff: false });

    const entry = calls.find((c) => c.method === 'arrive' && c.targets === sceneRoot)!;
    expect(entry.position).toBe(0);
    // The last world left to the left, so this one arrives from the right.
    expect(entry.vars.shiftX).toBeGreaterThan(0);
    expect(entry.vars.opacity).toBeUndefined();
    expect(entry.vars.dur).toBeLessThanOrEqual(0.35);

    const off = setup(4);
    (off.camera as any).parentElement = new FakeEl();
    off.ctx.incoming = 'whip-left';
    off.ctx.camera({ move: 'push', handoff: false, entry: false });
    expect(off.calls.some((c) => c.method === 'arrive')).toBe(false);
  });

  it('ctx.squash flattens, rebounds and settles back to scale 1', () => {
    const { calls, ctx } = setup(4);
    ctx.squash('.stat', { at: 1 });
    const steps = calls[0].vars.sequence;
    expect(steps[0].scaleX).toBeGreaterThan(1);
    expect(steps[0].scaleY).toBeLessThan(1);
    expect(steps[1].scaleY).toBeGreaterThan(1);
    expect(steps[steps.length - 1]).toMatchObject({ scaleX: 1, scaleY: 1 });
    expect(calls[0].position + steps.reduce((sum: number, s: any) => sum + s.dur, 0)).toBeLessThanOrEqual(4);
  });

  it('ctx.follow rides the centre of an element along a path inside the shot', () => {
    const { calls, ctx, stat } = setup(4);
    const path = { getTotalLength: () => 200, getPointAtLength: (d: number) => ({ x: d, y: 100 }) };
    Object.assign(stat, { offsetLeft: 0, offsetTop: 0, offsetWidth: 40, offsetHeight: 20 });
    ctx.follow('.stat', path, { at: 0.5, dur: 1, curve: 'linear' });

    const start = calls.find((c) => c.method === 'pin')!;
    expect(start.vars).toMatchObject({ x: -20, y: 90 });
    const ride = calls.find((c) => c.method === 'go')!;
    const steps = ride.vars.sequence;
    expect(steps[steps.length - 1]).toMatchObject({ x: 180, y: 90 });
    expect(steps.reduce((sum: number, s: any) => sum + s.dur, 0)).toBeCloseTo(1);
    expect(ride.position).toBe(0.5);
  });

  it('ctx.count writes numbers in the project\'s format', () => {
    const id = setup(4);
    id.ctx.count('.stat', { from: 1234.5, to: 1234.5, decimals: 1 });
    expect(id.stat.textContent).toBe('1.234,5');

    const en = setup(4);
    en.ctx.locale = 'en';
    en.ctx.count('.stat', { from: 1234.5, to: 1234.5, decimals: 1 });
    expect(en.stat.textContent).toBe('1,234.5');
  });

  it('ctx.hero keeps the main subject visible on frame 0', () => {
    const { calls, ctx } = setup(4);
    ctx.hero('.title');
    const grow = calls[0];
    expect(grow.method).toBe('travel');
    expect(grow.position).toBe(0);
    expect(grow.fromVars.scale).toBeGreaterThan(0.3);
    expect(grow.fromVars.opacity).toBeUndefined();
  });

  it('squeezes the cascade so late, crowded groups still finish inside the shot', () => {
    const { calls, ctx, dots } = setup(4);
    ctx.pop('.dot', { at: 3.5, cascade: 0.5 });
    const pop = calls[0];
    expect(pop.position).toBe(3.5);
    expect(endOf(pop, dots.length)).toBeLessThanOrEqual(4 + 1e-9);
  });

  it('ctx.draw hides strokes by their length, then draws them in', () => {
    const { calls, ctx } = setup(4);
    ctx.draw('path', { at: 0.4, from: 0.25 });
    const sets = calls.filter((c) => c.method === 'pin');
    expect(sets).toHaveLength(3);
    expect(sets[0].vars.strokeDasharray).toBe(500);
    expect(sets[0].vars.strokeDashoffset).toBeCloseTo(375);
    const draw = calls.find((c) => c.method === 'go')!;
    expect(draw.vars.strokeDashoffset).toBe(0);
    expect(draw.position).toBe(0.4);
  });

  it('ctx.beat uses the spoken word time, falls back when unknown, and clamps to the shot', () => {
    const { ctx } = setup(4, [{ word: 'ide', start: 1.3 }, { word: 'akhir', start: 9 }]);
    expect(ctx.beat('ide', 2)).toBe(1.3);
    expect(ctx.beat('tidak-ada', 2)).toBe(2);
    expect(ctx.beat('akhir', 1)).toBeLessThan(4);
  });

  it('ctx.kinetic splits text into word spans and animates them', () => {
    const { calls, ctx, title } = setup(4);
    const parts = ctx.kinetic('.title', { style: 'slam', at: 1 });
    expect(parts).toHaveLength(3);
    expect(title.textContent).toBe('Satu ide besar');
    const kin = calls[0];
    expect(kin.method).toBe('arrive');
    expect(kin.vars.scale).toBe(2.6);
    expect(kin.position).toBe(1);
  });

  it('ctx.count renders formatted numbers on update', () => {
    const { calls, ctx, stat } = setup(4);
    ctx.count('.stat', { from: 0, to: 1234.5, decimals: 1, suffix: '%' });
    expect(stat.textContent).toBe('0,0%');
    const tween = calls[0];
    tween.targets.v = 1234.5;
    tween.vars.onFrame();
    expect(stat.textContent).toBe('1.234,5%');
  });

  it('ctx.shake is deterministic for the same seed', () => {
    const a = setup(4);
    const b = setup(4);
    a.ctx.shake('.title', { at: 1 });
    b.ctx.shake('.title', { at: 1 });
    expect(a.calls[0].vars.sequence).toEqual(b.calls[0].vars.sequence);
    expect(a.calls[0].vars.sequence.at(-1)).toMatchObject({ x: 0, spin: 0 });
  });

  it('a failing helper never breaks the rest of the scene', () => {
    const { ctx } = setup(4);
    expect(() => ctx.draw({ nodeType: 1, get getTotalLength() { throw new Error('boom'); } })).not.toThrow();
  });
});

describe('Runtime embedding', () => {
  it('embeds the kit into the stage runtime as valid JavaScript', () => {
    const script = getRuntimeScript();
    expect(script).toContain('installMographKit(shotTrack, sceneWrapper, ctx)');
    expect(script).toContain('ctx.camera =');
    expect(() => new Function(script)).not.toThrow();
  });
});

describe('Linter understands the kit', () => {
  it('treats kit calls as camera motion, hand-off, voice sync and mograph vocabulary', () => {
    const code = {
      html: `<div class="scene-s1"><div class="moo-camera" data-moo-layer="camera">
        <div data-moo-layer="bg" data-moo-depth="0.3"></div><svg data-moo-layer="net" viewBox="0 0 1080 1920"><path d="M0 0L9 9"/></svg>
        <div class="title" data-moo-layer="headline"><span>SATU</span></div></div></div>`,
      css: '.scene-s1 { position: relative; width: 100%; height: 100%; }',
      buildJs: `ctx.camera({ move: 'push' });
ctx.hero('.title');
ctx.draw('path', { at: 0.3 });
shot.arrive('.title span', { opacity: 0, y: 20, dur: 0.4 }, ctx.beat('satu', 1));`
    };
    expect(lintMographQuality(code, { hasWordTimestamps: true }).issues).toEqual([]);
  });
});
