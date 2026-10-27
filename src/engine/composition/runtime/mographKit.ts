/**
 * Mograph helper kit installed on every scene's `ctx` inside the stage iframe.
 *
 * Generated scenes call these instead of re-inventing web-style tweens, so the model writes
 * in a motion-graphics vocabulary (camera moves, line draws, overshoot pops, kinetic type,
 * counters, hand-offs) and every helper keeps its tweens inside [0, ctx.dur].
 *
 * The function is embedded into the runtime with Function.prototype.toString(), so it must
 * stay self-contained: no imports and no references to anything outside its own body.
 */
export function installMographKit(tl: any, root: any, ctx: any): void {
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

  // Start, duration and stagger that keep the whole group inside the shot.
  const fit = (at: any, duration: number, stagger: number, count: number) => {
    const start = clampAt(at, 0);
    const room = Math.max(0.05, dur - start);
    let d = Math.max(0.05, Math.min(duration, room));
    let s = Math.max(0, stagger || 0);
    if (count > 1 && d + s * (count - 1) > room) {
      s = Math.max(0, (room - d) / (count - 1));
      if (d + s * (count - 1) > room) d = Math.max(0.05, room - s * (count - 1));
    }
    return { start, d, s };
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
    zoom: { scale: 2.6, opacity: 0, ease: 'power4.in' },
    'whip-left': { xPercent: -70, opacity: 0, ease: 'power3.in' },
    'whip-right': { xPercent: 70, opacity: 0, ease: 'power3.in' },
    'whip-up': { yPercent: -70, opacity: 0, ease: 'power3.in' },
    drop: { yPercent: 45, rotation: 6, opacity: 0, ease: 'power3.in' },
    spin: { rotation: 120, scale: 0.2, opacity: 0, ease: 'power3.in' }
  };

  /** Exit move in the last 0.4s so the cut into the next shot feels continuous. */
  ctx.handoff = safe('handoff', (type?: string, opts?: any) => {
    if (handoffDone || type === 'none') return [];
    handoffDone = true;
    const o = opts || {};
    const cam = o.target ? list(o.target) : [cameraEl()];
    const len = Math.min(0.4, dur * 0.25);
    const vars = Object.assign({}, HANDOFFS[type || 'zoom'] || HANDOFFS.zoom, { duration: len });
    tl.to(cam, vars, dur - len);
    return cam;
  });

  const CAMERA_MOVES: Record<string, any[]> = {
    push: [{ scale: 1.18, rotation: -2 }, { scale: 1, rotation: 0 }],
    pull: [{ scale: 1 }, { scale: 1.15 }],
    'pan-left': [{ xPercent: 6, scale: 1.12 }, { xPercent: -6, scale: 1.12 }],
    'pan-right': [{ xPercent: -6, scale: 1.12 }, { xPercent: 6, scale: 1.12 }],
    'pan-up': [{ yPercent: 5, scale: 1.12 }, { yPercent: -5, scale: 1.12 }],
    'pan-down': [{ yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12 }],
    roll: [{ rotation: -6, scale: 1.15 }, { rotation: 3, scale: 1.04 }]
  };

  /** Moves the whole world (.moo-camera) for the shot, then runs the hand-off (default 'zoom'). */
  ctx.camera = safe('camera', (opts?: any) => {
    const o = opts || {};
    const cam = cameraEl();
    const move = CAMERA_MOVES[o.move] || CAMERA_MOVES.push;
    const withHandoff = o.handoff !== false && o.handoff !== 'none';
    const end = withHandoff ? dur - Math.min(0.4, dur * 0.25) : dur;
    const from = Object.assign({ transformOrigin: o.origin || '50% 50%' }, move[0], o.from);
    const to = Object.assign({}, move[1], o.to, { duration: Math.max(0.1, end), ease: o.ease || 'sine.inOut' });
    tl.fromTo(cam, from, to, 0);
    if (withHandoff) ctx.handoff(typeof o.handoff === 'string' ? o.handoff : 'zoom');
    return [cam];
  });

  /** Draws SVG strokes (path, line, circle, polyline). `from` is how much is already drawn at t=0. */
  ctx.draw = safe('draw', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const f = fit(o.at, o.duration || 0.8, o.stagger ?? 0.1, els.length);
    const already = Math.max(0, Math.min(1, o.from || 0));
    els.forEach((el: any) => {
      let len = 0;
      try {
        len = el.getTotalLength ? el.getTotalLength() : 0;
      } catch {
        len = 0;
      }
      if (!len || !isFinite(len)) len = 1000;
      tl.set(el, { strokeDasharray: len, strokeDashoffset: len * (1 - already) }, 0);
    });
    tl.to(els, { strokeDashoffset: 0, duration: f.d, stagger: f.s, ease: o.ease || 'power2.inOut' }, f.start);
    return els;
  });

  /** Scale pop with overshoot. Default starts from nothing — use for secondary details. */
  ctx.pop = safe('pop', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const f = fit(o.at, o.duration || 0.45, o.stagger ?? 0.08, els.length);
    tl.fromTo(
      els,
      { scale: o.from ?? 0, transformOrigin: o.origin || '50% 50%' },
      { scale: 1, duration: f.d, stagger: f.s, ease: o.ease || 'back.out(2.2)' },
      f.start
    );
    return els;
  });

  /** Hero entrance: visible on frame 0 (the editor's still), grows with overshoot, then breathes. */
  ctx.hero = safe('hero', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const grow = Math.min(o.duration || 0.6, dur * 0.4);
    tl.fromTo(
      els,
      { scale: o.from ?? 0.55, transformOrigin: o.origin || '50% 50%' },
      { scale: 1, duration: grow, ease: o.ease || 'back.out(2)' },
      0
    );
    if (dur - grow > 0.6 && o.breathe !== false) {
      tl.to(els, { scale: o.breatheScale || 1.06, duration: dur - grow, ease: 'sine.inOut' }, grow);
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
    rise: { from: { yPercent: 110, rotation: 8, opacity: 0 }, ease: 'expo.out', duration: 0.5 },
    slam: { from: { scale: 2.6, opacity: 0 }, ease: 'power4.out', duration: 0.35 },
    flip: { from: { rotationX: -90, opacity: 0, transformOrigin: '50% 100%' }, ease: 'back.out(1.8)', duration: 0.5 },
    drop: { from: { yPercent: -140, opacity: 0 }, ease: 'bounce.out', duration: 0.6 },
    type: { from: { opacity: 0 }, ease: 'none', duration: 0.02 }
  };

  /** Kinetic type: splits the text and animates words or chars in a named style. */
  ctx.kinetic = safe('kinetic', (target: any, opts?: any) => {
    const o = opts || {};
    const style = KINETIC[o.style] || KINETIC.rise;
    const parts = ctx.split(target, o.by || (o.style === 'type' ? 'chars' : 'words'));
    if (!parts || parts.length === 0) return [];
    const defaultStagger = o.style === 'type' ? 0.04 : o.by === 'chars' ? 0.03 : 0.08;
    const f = fit(o.at, o.duration || style.duration, o.stagger ?? defaultStagger, parts.length);
    tl.from(parts, Object.assign({}, style.from, { duration: f.d, stagger: f.s, ease: o.ease || style.ease }), f.start);
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
    const f = fit(o.at, o.duration || 1.2, 0, 1);
    tl.to(state, { v: to, duration: f.d, ease: o.ease || 'power2.out', onUpdate: () => { el.textContent = fmt(state.v); } }, f.start);
    return [el];
  });

  /** Quick scale punch on a focus word or object. */
  ctx.punch = safe('punch', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const f = fit(o.at, 0.24, 0, 1);
    tl.to(els, { scale: o.scale || 1.25, transformOrigin: '50% 50%', duration: f.d / 2, yoyo: true, repeat: 1, ease: 'power2.out' }, f.start);
    return els;
  });

  /** Deterministic shake (uses ctx.rand, never Math.random). */
  ctx.shake = safe('shake', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const strength = o.strength || 14;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : () => 0.5;
    const keyframes: any[] = [];
    for (let i = 0; i < 6; i++) {
      keyframes.push({ x: (rand() - 0.5) * 2 * strength, rotation: (rand() - 0.5) * strength * 0.2, duration: 0.04 });
    }
    keyframes.push({ x: 0, rotation: 0, duration: 0.05 });
    const f = fit(o.at, 0.3, 0, 1);
    tl.to(els, { keyframes }, f.start);
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
    tl.fromTo(layer, { opacity: 0 }, { opacity: o.intensity || 0.7, duration: f.d / 2, yoyo: true, repeat: 1, ease: 'power1.out' }, f.start);
    return [layer];
  });

  /** Slow continuous float for the whole shot so nothing ever holds still. */
  ctx.drift = safe('drift', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    const amount = o.amount || 40;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : () => 0.5;
    els.forEach((el: any) => {
      tl.to(el, {
        y: '-=' + Math.round(amount * (0.5 + rand())),
        x: '+=' + Math.round((rand() - 0.5) * amount),
        rotation: (rand() - 0.5) * (o.rotate ?? 8),
        duration: dur,
        ease: 'sine.inOut'
      }, 0);
    });
    return els;
  });

  /** Spins elements around a point for the whole shot. For SVG pass cx/cy in viewBox units. */
  ctx.orbit = safe('orbit', (targets: any, opts?: any) => {
    const o = opts || {};
    const els = list(targets);
    if (els.length === 0) return els;
    const vars: any = { rotation: 360 * (o.turns ?? 0.5), duration: dur, ease: 'none' };
    if (typeof o.cx === 'number' && typeof o.cy === 'number') vars.svgOrigin = o.cx + ' ' + o.cy;
    else vars.transformOrigin = o.origin || '50% 50%';
    tl.to(els, vars, 0);
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
    const f = fit(o.at, o.duration || 0.6, o.stagger ?? 0.08, els.length);
    tl.fromTo(els, { clipPath: r[0] }, { clipPath: r[1], duration: f.d, stagger: f.s, ease: o.ease || 'expo.out' }, f.start);
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
      tl.to(dot, { y: -rise * (0.5 + rand()), x: (rand() - 0.5) * 80, duration: dur, ease: 'none' }, 0);
    }
    return dots;
  });
}
