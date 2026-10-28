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
    expect(move.fromVars.scale).toBeGreaterThan(1);

    const exits = calls.filter((c) => c.method === 'go');
    expect(exits).toHaveLength(1);
    expect(exits[0].position).toBeCloseTo(3.6);
    expect(exits[0].vars.opacity).toBe(0);
    expect(exits[0].vars.scale).toBe(2.6);
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
        <div data-moo-layer="bg"></div><svg data-moo-layer="net" viewBox="0 0 1080 1920"><path d="M0 0L9 9"/></svg>
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
