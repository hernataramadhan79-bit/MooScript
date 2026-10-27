import { describe, it, expect } from 'vitest';
import { installMographKit } from '../src/engine/composition/runtime/mographKit';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { lintMographQuality } from '../src/engine/composition/mographLint';

interface Call {
  method: 'to' | 'from' | 'fromTo' | 'set';
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
  const tl = {
    to: (targets: any, vars: any, position: number) => calls.push({ method: 'to', targets, vars, position }),
    from: (targets: any, vars: any, position: number) => calls.push({ method: 'from', targets, vars, position }),
    set: (targets: any, vars: any, position: number) => calls.push({ method: 'set', targets, vars, position }),
    fromTo: (targets: any, fromVars: any, vars: any, position: number) =>
      calls.push({ method: 'fromTo', targets, fromVars, vars, position })
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
  installMographKit(tl, root, ctx);
  return { calls, ctx, camera, title, stat, paths, dots };
}

const endOf = (c: Call, count: number) => {
  const d = c.vars.duration || 0;
  const s = c.vars.stagger || 0;
  const reps = c.vars.repeat ? c.vars.repeat + 1 : 1;
  return c.position + d * reps + s * (count - 1);
};

describe('Mograph kit (ctx helpers)', () => {
  it('ctx.camera moves the camera for the shot and hands off in the last 0.4s, once', () => {
    const { calls, ctx, camera } = setup(4);
    ctx.camera({ move: 'push' });
    ctx.handoff('whip-left');

    const move = calls.find((c) => c.method === 'fromTo')!;
    expect(move.targets).toBe(camera);
    expect(move.position).toBe(0);
    expect(move.vars.duration).toBeCloseTo(3.6);
    expect(move.fromVars.scale).toBeGreaterThan(1);

    const exits = calls.filter((c) => c.method === 'to');
    expect(exits).toHaveLength(1);
    expect(exits[0].position).toBeCloseTo(3.6);
    expect(exits[0].vars.opacity).toBe(0);
    expect(exits[0].vars.scale).toBe(2.6);
  });

  it('ctx.hero keeps the main subject visible on frame 0', () => {
    const { calls, ctx } = setup(4);
    ctx.hero('.title');
    const grow = calls[0];
    expect(grow.method).toBe('fromTo');
    expect(grow.position).toBe(0);
    expect(grow.fromVars.scale).toBeGreaterThan(0.3);
    expect(grow.fromVars.opacity).toBeUndefined();
  });

  it('squeezes stagger so late, crowded groups still finish inside the shot', () => {
    const { calls, ctx, dots } = setup(4);
    ctx.pop('.dot', { at: 3.5, stagger: 0.5 });
    const pop = calls[0];
    expect(pop.position).toBe(3.5);
    expect(endOf(pop, dots.length)).toBeLessThanOrEqual(4 + 1e-9);
  });

  it('ctx.draw hides strokes by their length, then draws them in', () => {
    const { calls, ctx } = setup(4);
    ctx.draw('path', { at: 0.4, from: 0.25 });
    const sets = calls.filter((c) => c.method === 'set');
    expect(sets).toHaveLength(3);
    expect(sets[0].vars.strokeDasharray).toBe(500);
    expect(sets[0].vars.strokeDashoffset).toBeCloseTo(375);
    const draw = calls.find((c) => c.method === 'to')!;
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
    expect(kin.method).toBe('from');
    expect(kin.vars.scale).toBe(2.6);
    expect(kin.position).toBe(1);
  });

  it('ctx.count renders formatted numbers on update', () => {
    const { calls, ctx, stat } = setup(4);
    ctx.count('.stat', { from: 0, to: 1234.5, decimals: 1, suffix: '%' });
    expect(stat.textContent).toBe('0,0%');
    const tween = calls[0];
    tween.targets.v = 1234.5;
    tween.vars.onUpdate();
    expect(stat.textContent).toBe('1.234,5%');
  });

  it('ctx.shake is deterministic for the same seed', () => {
    const a = setup(4);
    const b = setup(4);
    a.ctx.shake('.title', { at: 1 });
    b.ctx.shake('.title', { at: 1 });
    expect(a.calls[0].vars.keyframes).toEqual(b.calls[0].vars.keyframes);
    expect(a.calls[0].vars.keyframes.at(-1)).toMatchObject({ x: 0, rotation: 0 });
  });

  it('a failing helper never breaks the rest of the scene', () => {
    const { ctx } = setup(4);
    expect(() => ctx.draw({ nodeType: 1, get getTotalLength() { throw new Error('boom'); } })).not.toThrow();
  });
});

describe('Runtime embedding', () => {
  it('embeds the kit into the stage runtime as valid JavaScript', () => {
    const script = getRuntimeScript();
    expect(script).toContain('installMographKit(safeSceneTl, sceneWrapper, ctx)');
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
tl.from('.title span', { opacity: 0, y: 20, duration: 0.4 }, ctx.beat('satu', 1));`
    };
    expect(lintMographQuality(code, { hasWordTimestamps: true }).issues).toEqual([]);
  });
});
