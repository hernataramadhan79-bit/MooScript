/**
 * Mograph helper kit installed on every scene's `ctx` inside the stage iframe.
 *
 * Generated scenes call these instead of re-inventing web-style moves, so the model writes
 * in a motion-graphics vocabulary (camera moves, line draws, overshoot pops, kinetic type,
 * counters, hand-offs) and every helper keeps its moves inside [0, ctx.dur] on the shot track.
 *
 * The function is embedded into the runtime with Function.prototype.toString(), so it must
 * stay self-contained: no imports and no references to anything outside its own body.
 */
export function installMographKit(shot: any, root: any, ctx: any): void {
  const dur = Math.max(0.1, Number(ctx.dur) || 3);
  const doc = root.ownerDocument || document;
  const viewport = doc.getElementById('moo-viewport');
  ctx.stage = {
    w: (viewport && viewport.clientWidth) || root.clientWidth || 1080,
    h: (viewport && viewport.clientHeight) || root.clientHeight || 1920
  };

  const clampAt = (t: any, fallback: number): number => {
    const v = typeof t === 'number' && isFinite(t) ? t : fallback;
    return Math.max(0, Math.min(v, Math.max(0, dur - 0.05)));
  };

  const list = (targets: any): any[] => {
    if (!targets) return [];
    if (typeof targets === 'string') return Array.prototype.slice.call(root.querySelectorAll(targets));
    if (!targets.nodeType && typeof targets.length === 'number') {
      return Array.prototype.slice.call(targets).filter(Boolean);
    }
    return [targets];
  };

  // Start, length and cascade gap that keep the whole group inside the shot.
  const fit = (at: any, length: number, gap: number, count: number) => {
    const start = clampAt(at, 0);
    const room = Math.max(0.05, dur - start);
    let d = Math.max(0.05, Math.min(length, room));
    let s = Math.max(0, gap || 0);
    if (count > 1 && d + s * (count - 1) > room) {
      s = Math.max(0, (room - d) / (count - 1));
      if (d + s * (count - 1) > room) d = Math.max(0.05, room - s * (count - 1));
    }
    return { start, d, s };
  };

  // Tells the stage where the shot hits, so sound effects can land on it.
  const accent = (kind: string, at: number) => {
    if (typeof ctx.accent === 'function') ctx.accent(kind, at);
  };

  const safe = (name: string, fn: (...args: any[]) => any) =>
    function (...args: any[]) {
      try {
        return fn(...args);
      } catch (err) {
        console.warn('[MooScript] ctx.' + name + ' failed', err);
        return [];
      }
    };

  const cameraEl = () =>
    root.querySelector('.moo-camera') || root.querySelector('[data-moo-layer="camera"]') || root.firstElementChild || root;

  let handoffDone = false;

  /** Word time from the voice-over (scene-relative), or the fallback when the word is not found. */
  ctx.beat = (word: string, fallback?: number) => {
    const t = typeof ctx.at === 'function' ? Number(ctx.at(word)) || 0 : 0;
    return clampAt(t > 0 ? t : fallback, 0);
  };

  const HANDOFFS: Record<string, any> = {
    zoom: { scale: 2.6, opacity: 0, curve: 'sharp-in' },
    'whip-left': { shiftX: -70, opacity: 0, curve: 'strong-in' },
    'whip-right': { shiftX: 70, opacity: 0, curve: 'strong-in' },
    'whip-up': { shiftY: -70, opacity: 0, curve: 'strong-in' },
    drop: { shiftY: 45, spin: 6, opacity: 0, curve: 'strong-in' },
    spin: { spin: 120, scale: 0.2, opacity: 0, curve: 'strong-in' }
  };

  /** Exit move in the last 0.4s so the cut into the next shot feels continuous. */
  ctx.handoff = safe('handoff', (type?: string, opts?: any) => {
    if (handoffDone || type === 'none') return [];
    handoffDone = true;
    const o = opts || {};
    const cam = o.target ? list(o.target) : [cameraEl()];
    const len = Math.min(0.4, dur * 0.25);
    const vars = Object.assign({}, HANDOFFS[type || 'zoom'] || HANDOFFS.zoom, { dur: len });
    shot.go(cam, vars, dur - len);
    return cam;
  });

  const CAMERA_MOVES: Record<string, any[]> = {
    push: [{ scale: 1.18, spin: -2 }, { scale: 1, spin: 0 }],
    pull: [{ scale: 1 }, { scale: 1.15 }],
    'pan-left': [{ shiftX: 6, scale: 1.12 }, { shiftX: -6, scale: 1.12 }],
    'pan-right': [{ shiftX: -6, scale: 1.12 }, { shiftX: 6, scale: 1.12 }],
    'pan-up': [{ shiftY: 5, scale: 1.12 }, { shiftY: -5, scale: 1.12 }],
    'pan-down': [{ shiftY: -5, scale: 1.12 }, { shiftY: 5, scale: 1.12 }],
    roll: [{ spin: -6, scale: 1.15 }, { spin: 3, scale: 1.04 }]
  };

  /** Moves the whole world (.moo-camera) for the shot, then runs the hand-off (default 'zoom'). */
  ctx.camera = safe('camera', (opts?: any) => {
    const o = opts || {};
    const cam = cameraEl();
    const move = CAMERA_MOVES[o.move] || CAMERA_MOVES.push;
    const withHandoff = o.handoff !== false && o.handoff !== 'none';
    const end = withHandoff ? dur - Math.min(0.4, dur * 0.25) : dur;
    const from = Object.assign({ pivot: o.pivot || '50% 50%' }, move[0], o.from);
    const to = Object.assign({}, move[1], o.to, { dur: Math.max(0.1, end), curve: o.curve || 'gentle-inout' });
    shot.travel(cam, from, to, 0);
    if (withHandoff) ctx.handoff(typeof o.handoff === 'string' ? o.handoff : 'zoom');
    return [cam];
  });

  /** Draws SVG strokes (path, line, circle, polyline). `from` is how much is already drawn at t=0. */
  ctx.draw = safe('draw', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const f = fit(o.at, o.dur || 0.8, o.cascade ?? 0.1, els.length);
    const already = Math.max(0, Math.min(1, o.from || 0));
    els.forEach((el: any) => {
      let len = 0;
      try {
        len = el.getTotalLength ? el.getTotalLength() : 0;
      } catch {
        len = 0;
      }
      if (!len || !isFinite(len)) len = 1000;
      shot.pin(el, { strokeDasharray: len, strokeDashoffset: len * (1 - already) }, 0);
    });
    shot.go(els, { strokeDashoffset: 0, dur: f.d, cascade: f.s, curve: o.curve || 'smooth-inout' }, f.start);
    return els;
  });

  /** Scale pop with overshoot. Default starts from nothing — use for secondary details. */
  ctx.pop = safe('pop', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const f = fit(o.at, o.dur || 0.45, o.cascade ?? 0.08, els.length);
    accent('pop', f.start);
    shot.travel(
      els,
      { scale: o.from ?? 0, pivot: o.pivot || '50% 50%' },
      { scale: 1, dur: f.d, cascade: f.s, curve: o.curve || 'overshoot-out(2.2)' },
      f.start
    );
    return els;
  });

  /** Hero entrance: visible on frame 0 (the editor's still), grows with overshoot, then breathes. */
  ctx.hero = safe('hero', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const grow = Math.min(o.dur || 0.6, dur * 0.4);
    shot.travel(
      els,
      { scale: o.from ?? 0.55, pivot: o.pivot || '50% 50%' },
      { scale: 1, dur: grow, curve: o.curve || 'overshoot-out(2)' },
      0
    );
    if (dur - grow > 0.6 && o.breathe !== false) {
      shot.go(els, { scale: o.breatheScale || 1.06, dur: dur - grow, curve: 'gentle-inout' }, grow);
    }
    return els;
  });

  /** Splits an element's text into word (and optionally char) spans once; returns the animated parts. */
  ctx.split = safe('split', (target: any, by?: string) => {
    const el = list(target)[0];
    if (!el) return [];
    const mode = by === 'chars' ? 'chars' : 'words';
    if (el.__mooSplit && el.__mooSplit[mode]) return el.__mooSplit[mode];
    const existing = Array.prototype.slice.call(el.children || []).filter((c: any) => c.tagName === 'SPAN');
    let words: any[];
    if (existing.length > 0 && !el.__mooSplit) {
      words = existing;
    } else {
      const text = String(el.textContent || '').trim();
      el.textContent = '';
      words = [];
      text.split(/\s+/).filter(Boolean).forEach((word: string, i: number) => {
        if (i > 0) el.appendChild(doc.createTextNode(' '));
        const w = doc.createElement('span');
        w.style.display = 'inline-block';
        w.textContent = word;
        el.appendChild(w);
        words.push(w);
      });
    }
    const result: any = { words, chars: [] as any[] };
    words.forEach((w: any) => {
      const chars = String(w.textContent || '');
      w.textContent = '';
      for (const ch of Array.from(chars)) {
        const c = doc.createElement('span');
        c.style.display = 'inline-block';
        c.textContent = ch;
        w.appendChild(c);
        result.chars.push(c);
      }
      w.style.display = 'inline-block';
    });
    el.__mooSplit = result;
    return result[mode];
  });

  const KINETIC: Record<string, any> = {
    rise: { from: { shiftY: 110, spin: 8, opacity: 0 }, curve: 'rush-out', dur: 0.5 },
    slam: { from: { scale: 2.6, opacity: 0 }, curve: 'sharp-out', dur: 0.35 },
    flip: { from: { tiltX: -90, opacity: 0, pivot: '50% 100%' }, curve: 'overshoot-out(1.8)', dur: 0.5 },
    drop: { from: { shiftY: -140, opacity: 0 }, curve: 'bounce-out', dur: 0.6 },
    type: { from: { opacity: 0 }, curve: 'linear', dur: 0.02 }
  };

  /** Kinetic type: splits the text and animates words or chars in a named style. */
  ctx.kinetic = safe('kinetic', (target: any, opts?: any) => {
    const o = opts || {};
    const style = KINETIC[o.style] || KINETIC.rise;
    const parts = ctx.split(target, o.by || (o.style === 'type' ? 'chars' : 'words'));
    if (!parts || parts.length === 0) return [];
    const defaultGap = o.style === 'type' ? 0.04 : o.by === 'chars' ? 0.03 : 0.08;
    const f = fit(o.at, o.dur || style.dur, o.cascade ?? defaultGap, parts.length);
    shot.arrive(parts, Object.assign({}, style.from, { dur: f.d, cascade: f.s, curve: o.curve || style.curve }), f.start);
    return parts;
  });

  /** Number counter, e.g. ctx.count('.stat', { to: 87, suffix: '%', at: ctx.beat('persen', 0.8) }). */
  ctx.count = safe('count', (target: any, opts?: any) => {
    const o = opts || {};
    const el = list(target)[0];
    if (!el) return [];
    const decimals = Math.max(0, Math.min(4, o.decimals || 0));
    const fmt = (v: number) => {
      const fixed = v.toFixed(decimals);
      const parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, o.separator ?? '.');
      return (o.prefix || '') + parts.join(',') + (o.suffix || '');
    };
    const state = { v: Number(o.from) || 0 };
    const to = Number(o.to) || 0;
    el.textContent = fmt(state.v);
    const f = fit(o.at, o.dur || 1.2, 0, 1);
    shot.go(state, { v: to, dur: f.d, curve: o.curve || 'smooth-out', onFrame: () => { el.textContent = fmt(state.v); } }, f.start);
    return [el];
  });

  /** Quick scale punch on a focus word or object. */
  ctx.punch = safe('punch', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const f = fit(o.at, 0.24, 0, 1);
    accent('impact', f.start);
    shot.go(els, { scale: o.scale || 1.25, pivot: '50% 50%', dur: f.d / 2, pingpong: true, loop: 1, curve: 'smooth-out' }, f.start);
    return els;
  });

  /** Deterministic shake (uses ctx.rand, never Math.random). */
  ctx.shake = safe('shake', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const strength = o.strength || 14;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : () => 0.5;
    const steps: any[] = [];
    for (let i = 0; i < 6; i++) {
      steps.push({ x: (rand() - 0.5) * 2 * strength, spin: (rand() - 0.5) * strength * 0.2, dur: 0.04 });
    }
    steps.push({ x: 0, spin: 0, dur: 0.05 });
    const f = fit(o.at, 0.3, 0, 1);
    accent('impact', f.start);
    shot.go(els, { sequence: steps }, f.start);
    return els;
  });

  /** Full-frame color flash above the camera. */
  ctx.flash = safe('flash', (opts?: any) => {
    const o = opts || {};
    const layer = doc.createElement('div');
    layer.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:50;opacity:0;background:' + (o.color || 'var(--moo-accent, #ffffff)');
    root.appendChild(layer);
    const f = fit(o.at, 0.16, 0, 1);
    accent('impact', f.start);
    shot.travel(layer, { opacity: 0 }, { opacity: o.intensity || 0.7, dur: f.d / 2, pingpong: true, loop: 1, curve: 'soft-out' }, f.start);
    return [layer];
  });

  /** Slow continuous float for the whole shot so nothing ever holds still. */
  ctx.drift = safe('drift', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    const amount = o.amount || 40;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : () => 0.5;
    els.forEach((el: any) => {
      shot.go(el, {
        y: 'by(' + -Math.round(amount * (0.5 + rand())) + ')',
        x: 'by(' + Math.round((rand() - 0.5) * amount) + ')',
        spin: (rand() - 0.5) * (o.rotate ?? 8),
        dur: dur,
        curve: 'gentle-inout'
      }, 0);
    });
    return els;
  });

  /** Spins elements around a point for the whole shot. For SVG pass cx/cy in viewBox units. */
  ctx.orbit = safe('orbit', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const vars: any = { spin: 360 * (o.turns ?? 0.5), dur: dur, curve: 'linear' };
    if (typeof o.cx === 'number' && typeof o.cy === 'number') vars.pivotPoint = o.cx + ' ' + o.cy;
    else vars.pivot = o.pivot || '50% 50%';
    shot.go(els, vars, 0);
    return els;
  });

  const REVEALS: Record<string, string[]> = {
    left: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'],
    right: ['inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'],
    up: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'],
    down: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'],
    circle: ['circle(0% at 50% 50%)', 'circle(75% at 50% 50%)']
  };

  /** Clip-path wipe reveal (left | right | up | down | circle). */
  ctx.reveal = safe('reveal', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const r = REVEALS[o.dir] || REVEALS.left;
    const f = fit(o.at, o.dur || 0.6, o.cascade ?? 0.08, els.length);
    shot.travel(els, { clipPath: r[0] }, { clipPath: r[1], dur: f.d, cascade: f.s, curve: o.curve || 'rush-out' }, f.start);
    return els;
  });

  /** Ambient particles behind the scene content, visible from frame 0 and rising for the whole shot. */
  ctx.particles = safe('particles', (opts?: any) => {
    const o = opts || {};
    const count = Math.max(1, Math.min(80, o.count || 24));
    const rand = typeof ctx.rand === 'function' ? ctx.rand : () => 0.5;
    const host = o.parent ? list(o.parent)[0] : cameraEl();
    if (!host) return [];
    const box = doc.createElement('div');
    box.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;';
    host.insertBefore(box, host.firstChild);
    const minSize = (o.size && o.size[0]) || 4;
    const maxSize = (o.size && o.size[1]) || 10;
    const rise = o.rise ?? 260;
    const dots: any[] = [];
    for (let i = 0; i < count; i++) {
      const dot = doc.createElement('div');
      const size = minSize + rand() * (maxSize - minSize);
      dot.style.cssText =
        'position:absolute;border-radius:50%;left:' + (rand() * 100).toFixed(2) + '%;top:' + (rand() * 100).toFixed(2) +
        '%;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;opacity:' + (0.2 + rand() * 0.5).toFixed(2) +
        ';background:' + (o.color || 'var(--moo-accent, #ffffff)');
      box.appendChild(dot);
      dots.push(dot);
      shot.go(dot, { y: -rise * (0.5 + rand()), x: (rand() - 0.5) * 80, dur: dur, curve: 'linear' }, 0);
    }
    return dots;
  });
}
