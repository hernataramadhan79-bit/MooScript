/**
 * MooTween: MooScript's own animation engine, running inside the stage iframe.
 *
 * A seek-only engine. Scene code drives a track (the `shot`) with go / arrive / travel / pin, places
 * moves with `at` (seconds, 'end', 'with', 'after', marks), and shapes them with dur, wait, curve,
 * cascade, loop, pingpong and sequence. Properties cover transforms (x, y, spin, tilt, shift, scale,
 * skew, pivot), opacity and fade, CSS numbers, colors, complex strings, SVG and attrs. Nothing ticks
 * in real time; every frame is produced by seek(t). The full vocabulary is in mooApiGuide.ts.
 *
 * Rendering order: moving forward, children render in start order; moving backward, in reverse; a
 * child whose clamped time did not change is skipped, so a finished move releases its properties.
 *
 * The function is embedded into the runtime with Function.prototype.toString(), so it must stay
 * self-contained: no imports and no references to anything outside its own body.
 */
export function installMooTween(win: any): any {
  const doc: any = win.document;
  const DEG = 180 / Math.PI;
  const RAD = Math.PI / 180;
  // Seconds covered by loop: true when no shot duration is known.
  const LOOP_SPAN = 3600;

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  const warned: Record<string, boolean> = {};
  const warnOnce = (key: string, message: string) => {
    if (warned[key]) return;
    warned[key] = true;
    if (win.console) win.console.warn('[MooTween] ' + message);
  };
  const round = (v: number) => {
    const r = Math.round(v * 10000) / 10000;
    return r === 0 ? 0 : r;
  };
  const round5 = (v: number) => {
    const r = Math.round(v * 100000) / 100000;
    return r === 0 ? 0 : r;
  };
  // Track positions are kept at 1e-7 s so 3.2 + 3.6 lands exactly on 6.8.
  const roundTime = (v: number) => Math.round(v * 1e7) / 1e7 || 0;
  const clamp = (min: number, max: number, v: number) => (v < min ? min : v > max ? max : v);
  const isFn = (v: any) => typeof v === 'function';
  /** The animation and its ancestors, innermost first. */
  const lineage = (a: any): any[] => {
    const out: any[] = [];
    for (let t = a; t; t = t.parent) out.push(t);
    return out;
  };
  const isElement = (t: any) => !!t && t.nodeType === 1;
  const isSvgChild = (el: any) => !!el.ownerSVGElement && typeof el.getBBox === 'function';
  const camel = (p: string) => (p.indexOf('--') === 0 ? p : p.replace(/-([a-z])/g, (_m: string, c: string) => c.toUpperCase()));
  const computed = (el: any) => win.getComputedStyle(el);
  const NUM_SRC = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?';
  const PLAIN_NUM = new RegExp('^' + NUM_SRC + '$', 'i');
  const NUM_UNIT = new RegExp('^(' + NUM_SRC + ')([a-z%]*)$', 'i');

  /** 'by(-10px)' -> { rel: 1, n: -10, u: 'px' }; '50%' -> { rel: 0, n: 50, u: '%' }; 3 -> { rel: 0, n: 3, u: '' }. */
  function parseNumber(v: any): { rel: number; n: number; u: string } | null {
    if (typeof v === 'number') return isFinite(v) ? { rel: 0, n: v, u: '' } : null;
    if (typeof v !== 'string') return null;
    let s = v.trim();
    let rel = 0;
    const by = s.match(/^by\(\s*([^)]*?)\s*\)$/i);
    if (by) {
      rel = 1;
      s = by[1];
    }
    const m = s.match(NUM_UNIT);
    return m ? { rel, n: parseFloat(m[1]), u: m[2] } : null;
  }

  /* ------------------------------------------------------------------ *
   * Curves: '<family>-<in|out|inout>(<params>)', e.g. 'rush-out', 'overshoot-out(1.7)'
   * ------------------------------------------------------------------ */
  type Ease = (p: number) => number;
  const easeMap: Record<string, Ease> = {};
  const outOf = (easeIn: Ease): Ease => (p) => 1 - easeIn(1 - p);
  const inOutOf = (easeIn: Ease): Ease => (p) => (p < 0.5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2);
  const registerEase = (name: string, easeIn: Ease, easeOut?: Ease) => {
    const o = easeOut || outOf(easeIn);
    easeMap[name + '-in'] = easeIn;
    easeMap[name + '-out'] = o;
    easeMap[name + '-inout'] = inOutOf(easeIn);
  };
  const linear: Ease = (p) => p;
  registerEase('linear', linear, linear);
  registerEase('soft', (p) => p * p);
  registerEase('smooth', (p) => p * p * p);
  registerEase('strong', (p) => p * p * p * p);
  registerEase('sharp', (p) => p * p * p * p * p);
  registerEase('gentle', (p) => (p === 1 ? 1 : 1 - Math.cos(p * Math.PI * 0.5)));
  // Blended so the curve lands exactly on 1; plain 2^(10(p-1)) stops short. Matches the reference scenes.
  registerEase('rush', (p) => Math.pow(2, 10 * (p - 1)) * p + p * p * p * p * p * p * (1 - p));
  registerEase('arc', (p) => 1 - Math.sqrt(Math.max(0, 1 - p * p)));
  const bounceOut: Ease = (p) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (p < 1 / d1) return n1 * p * p;
    if (p < 2 / d1) return n1 * (p - 1.5 / d1) * (p - 1.5 / d1) + 0.75;
    if (p < 2.5 / d1) return n1 * (p - 2.25 / d1) * (p - 2.25 / d1) + 0.9375;
    return n1 * (p - 2.625 / d1) * (p - 2.625 / d1) + 0.984375;
  };
  registerEase('bounce', outOf(bounceOut), bounceOut);

  const pick = (dir: string, easeIn: Ease): Ease => (dir === 'in' ? easeIn : dir === 'inout' ? inOutOf(easeIn) : outOf(easeIn));
  const backEase = (dir: string, overshoot?: number): Ease => {
    const s = typeof overshoot === 'number' && isFinite(overshoot) ? overshoot : 1.70158;
    return pick(dir, (p) => (p ? p * p * ((s + 1) * p - s) : 0));
  };
  const elasticEase = (dir: string, amplitude?: number, period?: number): Ease => {
    const amp = typeof amplitude === 'number' && amplitude > 0 ? amplitude : 1;
    const a = amp >= 1 ? amp : 1;
    const per = (typeof period === 'number' && period > 0 ? period : dir === 'inout' ? 0.45 : 0.3) / (amp < 1 ? amp : 1);
    const shift = (per / (2 * Math.PI)) * (Math.asin(1 / a) || 0);
    const out: Ease = (p) => (p === 1 ? 1 : a * Math.pow(2, -10 * p) * Math.sin(((p - shift) * 2 * Math.PI) / per) + 1);
    return pick(dir, outOf(out));
  };
  const stepsEase = (steps?: number): Ease => {
    const n = Math.max(1, Math.round(steps || 1));
    return (p) => Math.floor((n + 1) * clamp(0, 1 - 1e-8, p)) / n;
  };

  const DEFAULT_CURVE = 'soft-out';
  const easeCache: Record<string, Ease> = {};
  function parseCurve(ease: any, fallback?: Ease): Ease {
    if (isFn(ease)) return ease;
    const dflt = fallback || easeMap[DEFAULT_CURVE];
    if (typeof ease !== 'string' || !ease.trim()) return dflt;
    const key = ease.trim();
    if (easeCache[key]) return easeCache[key];
    const m = key.toLowerCase().match(/^([a-z]+)(?:-(inout|in|out))?(?:\(([^)]*)\))?$/);
    let result: Ease | undefined;
    if (m) {
      const base = m[1];
      const dir = m[2] || 'out';
      const args = (m[3] || '').split(',').map((s) => parseFloat(s)).filter((n) => isFinite(n));
      if (base === 'overshoot') result = backEase(dir, args[0]);
      else if (base === 'spring') result = elasticEase(dir, args[0], args[1]);
      else if (base === 'steps') result = stepsEase(args[0]);
      else result = easeMap[base + '-' + dir];
    }
    if (!result) {
      warnOnce('curve:' + key, 'Unknown curve "' + key + '", using ' + DEFAULT_CURVE + '.');
      result = dflt;
    }
    easeCache[key] = result;
    return result;
  }

  /* ------------------------------------------------------------------ *
   * Colors and complex strings
   * ------------------------------------------------------------------ */
  let probe: any = null;
  function probeElement(): any {
    if (!probe) {
      probe = doc.createElement('i');
      probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;';
    }
    if (!probe.parentNode && doc.body) doc.body.appendChild(probe);
    return probe;
  }

  function resolveVar(value: string, el: any): string {
    let s = value;
    for (let guard = 0; guard < 8 && s.indexOf('var(') >= 0; guard++) {
      s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_m: string, name: string, fallback?: string) => {
        const v = el ? computed(el).getPropertyValue(name).trim() : '';
        return v || (fallback || '').trim();
      });
    }
    return s;
  }

  function hslToRgb(h: number, s: number, l: number): number[] {
    h = (((h % 360) + 360) % 360) / 360;
    s = clamp(0, 1, s);
    l = clamp(0, 1, l);
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
  }

  /** [r, g, b, a] for any CSS color the browser understands, or null. */
  function parseColor(value: any, el?: any): number[] | null {
    if (typeof value !== 'string') return null;
    let s = value.trim();
    if (!s) return null;
    if (s.indexOf('var(') >= 0) s = resolveVar(s, el);
    const lower = s.toLowerCase();
    if (lower === 'transparent') return [0, 0, 0, 0];
    if (lower[0] === '#') {
      let hex = lower.slice(1);
      if (!/^[0-9a-f]+$/.test(hex) || [3, 4, 6, 8].indexOf(hex.length) < 0) return null;
      if (hex.length < 6) hex = hex.split('').map((c) => c + c).join('');
      const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1];
    }
    const fn = lower.match(/^(rgba?|hsla?|color)\(([^)]*)\)$/);
    if (fn) {
      const parts = fn[2].replace(/^srgb\s+/, '').split(/[\s,/]+/).filter(Boolean);
      const num = (p: string, scale: number) => (p.slice(-1) === '%' ? (parseFloat(p) / 100) * scale : parseFloat(p));
      const alpha = parts[3] !== undefined ? num(parts[3], 1) : 1;
      if (fn[1] === 'color') return [num(parts[0], 1) * 255, num(parts[1], 1) * 255, num(parts[2], 1) * 255, alpha];
      if (fn[1][0] === 'r') return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
      const rgb = hslToRgb(parseFloat(parts[0]), num(parts[1], 1), num(parts[2], 1));
      return [rgb[0], rgb[1], rgb[2], alpha];
    }
    if (!/^[a-z]+$/.test(lower) && !/^[a-z-]+\(/.test(lower)) return null;
    if (win.CSS && win.CSS.supports && !win.CSS.supports('color', s)) return null;
    const p = probeElement();
    p.style.color = '';
    p.style.color = s;
    const resolved = computed(p).color;
    return resolved && resolved !== s ? parseColor(resolved) : null;
  }

  const colorString = (c: number[]) => 'rgba(' + round(c[0]) + ', ' + round(c[1]) + ', ' + round(c[2]) + ', ' + round(c[3]) + ')';

  /** [h, s%, l%, a] with h, s and l rounded to whole numbers. */
  function rgbToHsl(c: number[]): number[] {
    const r = c[0] / 255;
    const g = c[1] / 255;
    const b = c[2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100), c[3]];
  }

  /** Color channel; an hsl() value on either side makes it travel through HSL instead of RGB. */
  function colorWriter(startStr: string, endStr: string, startC: number[], endC: number[], write: (v: string) => void) {
    if (/hsla?\(/i.test(startStr + ' ' + endStr)) {
      // A side written as hsl() keeps its exact numbers; an rgb side is converted.
      const hslOf = (str: string, rgb: number[]) => {
        const hsl = rgbToHsl(rgb);
        if (!/^\s*hsla?\(/i.test(str)) return hsl;
        const n = (str.match(new RegExp(NUM_SRC, 'gi')) || []).map((v) => parseFloat(v));
        return n.length >= 3 ? [n[0], n[1], n[2], hsl[3]] : hsl;
      };
      const a = hslOf(startStr, startC);
      const b = hslOf(endStr, endC);
      // Hue, saturation and lightness step in whole units, as the reference scenes did.
      return (ratio: number) => {
        const v = [0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * ratio);
        write('hsla(' + Math.round(v[0]) + ', ' + Math.round(v[1]) + '%, ' + Math.round(v[2]) + '%, ' + round(v[3]) + ')');
      };
    }
    return (ratio: number) => write(colorString([0, 1, 2, 3].map((i) => startC[i] + (endC[i] - startC[i]) * ratio)));
  }

  /** Rewrites every color inside a CSS string as rgba(), so start and end strings line up. */
  function normalizeColors(s: string, el?: any): string {
    let out = s.indexOf('var(') >= 0 ? resolveVar(s, el) : s;
    out = out.replace(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/gi, (m: string) => {
      const c = parseColor(m);
      return c ? colorString(c) : m;
    });
    return out.replace(/(^|[\s,(])([a-z]{3,})(?=$|[\s,)])/gi, (m: string, pre: string, word: string) => {
      if (/^(none|inset|at|round|closest|farthest|side|corner|circle|ellipse|from|to|in|url|auto|normal|initial|inherit|unset)$/i.test(word)) return m;
      if (!(win.CSS && win.CSS.supports && win.CSS.supports('color', word))) return m;
      const c = parseColor(word);
      return c ? pre + colorString(c) : m;
    });
  }

  const CSS_NUM = new RegExp('(^|[^a-z\\d.#_-])(' + NUM_SRC + ')([a-z%]*)', 'gi');
  const PATH_NUM = new RegExp('(' + NUM_SRC + ')', 'gi');

  interface Tokens {
    nums: number[];
    template: string;
    key: string;
  }

  /** Splits a CSS value into its numbers and a template; `key` ignores units and separators. */
  function tokenize(s: string, path?: boolean): Tokens {
    const nums: number[] = [];
    let template: string;
    let key: string;
    if (path) {
      template = s.replace(PATH_NUM, (_m: string, n: string) => {
        nums.push(parseFloat(n));
        return '\uE000';
      });
      key = template.replace(/[\s,]+/g, '').replace(/[a-z]/g, (c: string) => c.toUpperCase());
    } else {
      const units: string[] = [];
      template = s.replace(CSS_NUM, (_m: string, pre: string, n: string, u: string) => {
        nums.push(parseFloat(n));
        units.push(u);
        return pre + '\uE000' + u;
      });
      key = template.replace(/\uE000[a-z%]*/gi, '#').replace(/[\s,]+/g, ' ').trim();
    }
    return { nums, template, key };
  }

  function fillTemplate(t: Tokens, nums: number[]): string {
    let i = 0;
    return t.template.replace(/\uE000/g, () => String(round(nums[i++])));
  }

  /** Splits on commas that are not inside parentheses. */
  function splitTop(s: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        out.push(s.slice(start, i).trim());
        start = i + 1;
      }
    }
    out.push(s.slice(start).trim());
    return out.filter(Boolean);
  }

  function canonicalShadows(s: string, el: any, withSpread: boolean): string[] {
    if (!s || s === 'none') return [];
    return splitTop(s).map((shadow) => {
      let color = '';
      const rest = shadow.replace(/rgba\([^)]*\)/i, (m: string) => {
        color = m;
        return ' ';
      });
      const inset = /\binset\b/i.test(rest);
      const lengths = (rest.match(new RegExp(NUM_SRC + '[a-z%]*', 'gi')) || []).map((v) => parseFloat(v));
      while (lengths.length < (withSpread ? 4 : 3)) lengths.push(0);
      if (!color) color = colorString(parseColor(computed(el).color) || [0, 0, 0, 1]);
      const ls = lengths.slice(0, withSpread ? 4 : 3).map((n) => n + 'px').join(' ');
      return (inset ? 'inset ' : '') + color + ' ' + ls;
    });
  }

  const FILTER_IDENTITY: Record<string, string> = {
    blur: 'blur(0px)',
    brightness: 'brightness(1)',
    contrast: 'contrast(1)',
    grayscale: 'grayscale(0)',
    'hue-rotate': 'hue-rotate(0deg)',
    invert: 'invert(0)',
    opacity: 'opacity(1)',
    saturate: 'saturate(1)',
    sepia: 'sepia(0)',
    'drop-shadow': 'drop-shadow(rgba(0, 0, 0, 0) 0px 0px 0px)'
  };

  function expandInset(s: string): string {
    return s.replace(/inset\(([^)]*)\)/i, (_m: string, body: string) => {
      const parts = body.split(/\s+round\s+/i);
      const v = parts[0].trim().split(/\s+/);
      const t = v[0];
      const r = v[1] ?? t;
      const b = v[2] ?? t;
      const l = v[3] ?? r;
      return 'inset(' + [t, r, b, l].join(' ') + (parts[1] ? ' round ' + parts[1] : '') + ')';
    });
  }

  /** Brings start and end into the same shape where CSS allows several spellings of one value. */
  function canonicalPair(prop: string, start: string, end: string, el: any): [string, string] {
    let s = normalizeColors(start, el);
    let e = normalizeColors(end, el);
    if (prop === 'clipPath' || prop === 'shapeOutside') {
      s = expandInset(s);
      e = expandInset(e);
      const at = (v: string) => v.replace(/^(circle|ellipse)\(([^)]*)\)$/i, (m: string, f: string, body: string) => (/\bat\b/.test(body) ? m : f + '(' + body.trim() + ' at 50% 50%)'));
      s = at(s);
      e = at(e);
    } else if (prop === 'boxShadow' || prop === 'textShadow') {
      const spread = prop === 'boxShadow';
      const a = canonicalShadows(s, el, spread);
      const b = canonicalShadows(e, el, spread);
      const blank = (shadow: string) => shadow.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/i, 'rgba($1,$2,$3, 0)').replace(new RegExp('(' + NUM_SRC + ')px', 'gi'), '0px');
      while (a.length < b.length) a.push(blank(b[a.length]));
      while (b.length < a.length) b.push(blank(a[b.length]));
      s = a.join(', ') || 'none';
      e = b.join(', ') || 'none';
    } else if (prop === 'filter' || prop === 'backdropFilter') {
      const identity = (v: string) =>
        (v.match(/[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)/gi) || []).map((f) => FILTER_IDENTITY[f.slice(0, f.indexOf('(')).toLowerCase()] || f).join(' ');
      if (s === 'none' && e !== 'none') s = normalizeColors(identity(e), el);
      if (e === 'none' && s !== 'none') e = normalizeColors(identity(s), el);
    }
    return [s, e];
  }

  /* ------------------------------------------------------------------ *
   * Targets
   * ------------------------------------------------------------------ */
  const isArrayLike = (v: any) =>
    v && typeof v === 'object' && !v.nodeType && v !== win && typeof v.length === 'number' && (v.length === 0 || typeof v[0] === 'object');

  function toArray(targets: any, scope?: any): any[] {
    const out: any[] = [];
    const walk = (t: any) => {
      if (t === null || t === undefined || t === false) return;
      if (typeof t === 'string') {
        const root = scope && scope.querySelectorAll ? scope : doc;
        let found: any = [];
        try {
          found = root.querySelectorAll(t);
        } catch (err) {
          warnOnce('selector:' + t, 'Invalid selector "' + t + '".');
        }
        for (let i = 0; i < found.length; i++) if (out.indexOf(found[i]) < 0) out.push(found[i]);
      } else if (Array.isArray(t) || isArrayLike(t)) {
        for (let i = 0; i < t.length; i++) walk(t[i]);
      } else if (out.indexOf(t) < 0) {
        out.push(t);
      }
    };
    walk(targets);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Transforms
   * ------------------------------------------------------------------ */
  function parseMatrix(raw: any): number[] | null {
    if (!raw || raw === 'none') return null;
    const m = String(raw).match(/^matrix(3d)?\(([^)]*)\)$/);
    if (!m) return null;
    const v = m[2].split(',').map((n) => parseFloat(n));
    return v.length === 6 || v.length === 16 ? v : null;
  }

  function bboxOf(el: any): { x: number; y: number; width: number; height: number } {
    try {
      const b = el.getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    } catch (err) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  /** Linear part of rotate(spin) skew(skewX, skewY) scale(scaleX, scaleY). */
  function linearOf(c: any): { a: number; b: number; c: number; d: number } {
    const r = c.spin * RAD;
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    const tx = Math.tan(c.skewX * RAD);
    const ty = Math.tan(c.skewY * RAD);
    return {
      a: c.scaleX * (cr - sr * ty),
      b: c.scaleX * (sr + cr * ty),
      c: c.scaleY * (cr * tx - sr),
      d: c.scaleY * (sr * tx + cr)
    };
  }

  function decompose(m: number[], c: any) {
    if (m.length === 16) {
      const sx = Math.hypot(m[0], m[1], m[2]);
      const sy = Math.hypot(m[4], m[5], m[6]);
      const sz = Math.hypot(m[8], m[9], m[10]);
      c.x = m[12];
      c.y = m[13];
      c.z = m[14];
      c.scaleX = sx;
      c.scaleY = sy;
      c.tiltY = sx ? Math.asin(clamp(-1, 1, -m[2] / sx)) * DEG : 0;
      c.tiltX = sy && sz ? Math.atan2(m[6] / sy, m[10] / sz) * DEG : 0;
      c.spin = sx ? Math.atan2(m[1] / sx, m[0] / sx) * DEG : 0;
      if (m[11]) c.perspective = round(-1 / m[11]);
      return;
    }
    const [a, b, cc, d, e, f] = m;
    c.x = e;
    c.y = f;
    const sx = Math.hypot(a, b);
    const rot = sx ? Math.atan2(b, a) : 0;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const sy = cr * d - sr * cc;
    c.scaleX = sx;
    c.scaleY = sy;
    c.spin = rot * DEG;
    c.skewX = sy ? Math.atan((cr * cc + sr * d) / sy) * DEG : 0;
  }

  /** Per-element transform state, read once from the computed matrix and then owned by MooTween. */
  function transformCache(el: any): any {
    if (el.__mooTransform) return el.__mooTransform;
    const c: any = {
      x: 0, y: 0, z: 0, xu: 'px', yu: 'px', shiftX: 0, shiftY: 0,
      spin: 0, tiltX: 0, tiltY: 0, skewX: 0, skewY: 0, scaleX: 1, scaleY: 1, perspective: 0,
      svg: isSvgChild(el), ox: 0, oy: 0, xOff: 0, yOff: 0
    };
    const style = computed(el);
    const m = parseMatrix(style.transform);
    if (c.svg) {
      const bb = bboxOf(el);
      const o = String(style.transformOrigin || '0px 0px').split(' ');
      c.ox = bb.x + (parseFloat(o[0]) || 0);
      c.oy = bb.y + (parseFloat(o[1]) || 0);
      if (m) decompose(m.length === 16 ? [m[0], m[1], m[4], m[5], m[12], m[13]] : m, c);
      // The origin is baked into the matrix we write; keep the current picture with a compensating offset.
      const L = linearOf(c);
      c.xOff = L.a * c.ox + L.c * c.oy - c.ox;
      c.yOff = L.b * c.ox + L.d * c.oy - c.oy;
      el.style.transformOrigin = '0px 0px';
    } else if (m) {
      decompose(m, c);
    }
    el.__mooTransform = c;
    return c;
  }

  function writeTransform(el: any, c: any) {
    if (c.svg) {
      // Entries are rounded before the origin offset is derived from them, as the reference scenes were.
      const raw = linearOf(c);
      const L = { a: round5(raw.a), b: round5(raw.b), c: round5(raw.c), d: round5(raw.d) };
      let px = c.x;
      let py = c.y;
      if (c.shiftX || c.shiftY || c.xu === '%' || c.yu === '%') {
        const bb = bboxOf(el);
        px = (c.xu === '%' ? (c.x / 100) * bb.width : c.x) + (c.shiftX / 100) * bb.width;
        py = (c.yu === '%' ? (c.y / 100) * bb.height : c.y) + (c.shiftY / 100) * bb.height;
      }
      const tx = px + c.ox - (L.a * c.ox + L.c * c.oy) + c.xOff;
      const ty = py + c.oy - (L.b * c.ox + L.d * c.oy) + c.yOff;
      el.setAttribute('transform', 'matrix(' + [L.a, L.b, L.c, L.d, tx, ty].map(round5).join(',') + ')');
      return;
    }
    let s = '';
    if (c.perspective) s += 'perspective(' + round(c.perspective) + 'px) ';
    if (c.shiftX || c.shiftY) s += 'translate(' + round(c.shiftX) + '%, ' + round(c.shiftY) + '%) ';
    if (c.z) s += 'translate3d(' + round(c.x) + c.xu + ', ' + round(c.y) + c.yu + ', ' + round(c.z) + 'px) ';
    else if (c.x || c.y) s += 'translate(' + round(c.x) + c.xu + ', ' + round(c.y) + c.yu + ') ';
    if (c.spin) s += 'rotate(' + round(c.spin) + 'deg) ';
    if (c.tiltY) s += 'rotateY(' + round(c.tiltY) + 'deg) ';
    if (c.tiltX) s += 'rotateX(' + round(c.tiltX) + 'deg) ';
    if (c.skewX || c.skewY) s += 'skew(' + round(c.skewX) + 'deg, ' + round(c.skewY) + 'deg) ';
    if (c.scaleX !== 1 || c.scaleY !== 1) s += 'scale(' + round(c.scaleX) + ', ' + round(c.scaleY) + ') ';
    el.style.transform = s || 'translate(0px, 0px)';
  }

  // Transform properties a scene can animate, mapped to the transform cache.
  const TRANSFORM_ALIASES: Record<string, string> = {
    x: 'x', y: 'y', z: 'z', shiftX: 'shiftX', shiftY: 'shiftY', spin: 'spin', tiltX: 'tiltX', tiltY: 'tiltY',
    skewX: 'skewX', skewY: 'skewY', scaleX: 'scaleX', scaleY: 'scaleY', depth: 'perspective'
  };
  const ANGLE_COMPONENTS: Record<string, boolean> = { spin: true, tiltX: true, tiltY: true, skewX: true, skewY: true };

  /** Origin "a b" for an SVG element: percentages, keywords and px are relative to its bounding box. */
  function pivotPointOf(el: any, value: string, absolute: boolean): [number, number] {
    const words: Record<string, string> = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
    const parts = String(value).trim().split(/\s+/).map((w) => words[w] || w);
    if (parts.length === 1) parts.push(parts[0] === '0%' || parts[0] === '100%' ? '50%' : parts[0]);
    if (/^(top|bottom)$/.test(String(value).trim().split(/\s+/)[0] || '')) parts.reverse();
    if (absolute) return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0];
    const bb = bboxOf(el);
    const resolve = (p: string, start: number, size: number) => start + (p.slice(-1) === '%' ? (parseFloat(p) / 100) * size : parseFloat(p) || 0);
    return [resolve(parts[0], bb.x, bb.width), resolve(parts[1], bb.y, bb.height)];
  }

  /* ------------------------------------------------------------------ *
   * Channels
   * ------------------------------------------------------------------ */
  // A channel renders one property of one target: r(ratio, progress) writes the eased value,
  // revert() writes what was there before the move touched it.
  interface Channel {
    r: (ratio: number, progress: number) => void;
    revert: () => void;
    tf?: any;
    el?: any;
    /** Rendered only while the playhead moves backward (see buildChannels). */
    backwardOnly?: boolean;
  }

  const UNITLESS: Record<string, boolean> = {
    opacity: true, zIndex: true, fontWeight: true, lineHeight: true, flexGrow: true, flexShrink: true, order: true,
    zoom: true, fillOpacity: true, strokeOpacity: true, stopOpacity: true, floodOpacity: true, strokeMiterlimit: true
  };

  function pxPerUnit(el: any, prop: string, unit: string): number {
    if (!unit || unit === 'px') return 1;
    if (unit === '%' && /radius/i.test(prop)) return (el.offsetWidth || 0) / 100;
    if (unit === 'vw') return (win.innerWidth || 0) / 100;
    if (unit === 'vh') return (win.innerHeight || 0) / 100;
    if (unit === 'rem') return parseFloat(computed(doc.documentElement).fontSize) || 16;
    if (unit === 'em' && prop !== 'fontSize') return parseFloat(computed(el).fontSize) || 16;
    if (!el.style || !(prop in el.style)) return 0;
    const prev = el.style[prop];
    el.style[prop] = '100' + unit;
    const out = String(computed(el)[prop] || '');
    el.style[prop] = prev;
    return /px$/.test(out) ? parseFloat(out) / 100 : 0;
  }

  /** Converts a computed px value into `unit` for this property. */
  function convert(el: any, prop: string, value: number, from: string, to: string): number {
    if (from === to || !value) return value;
    const px = from === 'px' || !from ? value : value * pxPerUnit(el, prop, from);
    if (to === 'px' || !to) return px;
    const per = pxPerUnit(el, prop, to);
    return per ? px / per : 0;
  }

  function resolveSpec(spec: any, index: number, target: any, targets: any[]): any {
    if (isFn(spec)) return spec(index, target, targets);
    if (typeof spec === 'string' && spec.indexOf('random(') === 0) {
      const body = spec.slice(7, spec.lastIndexOf(')'));
      if (body.trim()[0] === '[') {
        const list = body.replace(/[[\]]/g, '').split(',').map((s) => s.trim());
        return list[Math.floor(Math.random() * list.length)];
      }
      const [lo, hi, snap] = body.split(',').map((s) => parseFloat(s));
      let v = lo + Math.random() * (hi - lo);
      if (snap) v = Math.round(v / snap) * snap;
      return v;
    }
    return spec;
  }

  function numericEnd(spec: any, start: number): number {
    const p = parseNumber(spec);
    if (!p) return start;
    return p.rel ? start + p.rel * p.n : p.n;
  }

  function snapper(snap: any, prop: string): ((v: number) => number) | null {
    if (snap === undefined || snap === null || snap === false) return null;
    let inc: any = null;
    if (typeof snap === 'number') inc = snap;
    else if (typeof snap === 'string') inc = snap.split(',').map((s) => s.trim()).indexOf(prop) >= 0 ? 1 : null;
    else if (typeof snap === 'object') inc = snap[prop] ?? null;
    if (inc === null || inc === undefined) return null;
    if (Array.isArray(inc)) {
      const list = inc.map(Number);
      return (v) => list.reduce((best, n) => (Math.abs(n - v) < Math.abs(best - v) ? n : best), list[0]);
    }
    const n = Number(inc) || 1;
    return (v) => Math.round(v / n) * n;
  }

  function discreteChannel(write: (v: any) => void, before: any, start: any, end: any, atStart: boolean): Channel {
    return {
      r: (_ratio, progress) => write(atStart ? (progress > 0 ? end : start) : progress >= 1 ? end : start),
      revert: () => write(before)
    };
  }

  /** Channel for a CSS string value: colors, numbers with units, or complex strings. */
  function cssChannel(el: any, prop: string, fromSpec: any, toSpec: any, mode: string, snap: any, roundPx: any): Channel | null {
    const custom = prop.indexOf('--') === 0;
    const read = () => (custom ? computed(el).getPropertyValue(prop).trim() : String(computed(el)[prop] ?? ''));
    const write = custom ? (v: string) => el.style.setProperty(prop, v) : (v: string) => (el.style[prop] = v);
    const before = read();
    let startStr = fromSpec === undefined ? before : String(fromSpec);
    let endStr = toSpec === undefined ? (mode === 'travel' ? startStr : before) : String(toSpec);
    if (mode === 'arrive' && toSpec === undefined) endStr = before;

    // Numbers with units
    const startN = parseNumber(startStr);
    const endN = parseNumber(endStr);
    const beforeN = parseNumber(before);
    const numericCss = (startN || /^(auto|normal)$/.test(startStr)) && endN;
    if (numericCss && (fromSpec === undefined || startN)) {
      const defaultUnit = UNITLESS[prop] || custom ? '' : 'px';
      const unit = endN!.u || (endN!.rel ? (beforeN && beforeN.u) || defaultUnit : startN && startN.u && fromSpec !== undefined ? startN.u : defaultUnit);
      let base = beforeN ? beforeN.n : 0;
      let baseUnit = beforeN ? beforeN.u : 'px';
      if (!beforeN && (prop === 'width' || prop === 'height')) {
        base = prop === 'width' ? el.offsetWidth || 0 : el.offsetHeight || 0;
        baseUnit = 'px';
      }
      const current = convert(el, prop, base, baseUnit || defaultUnit, unit);
      let start: number;
      if (fromSpec === undefined) start = current;
      else if (startN!.rel) start = current + startN!.rel * convert(el, prop, startN!.n, startN!.u || unit, unit);
      else start = convert(el, prop, startN!.n, startN!.u || unit, unit);
      let end: number;
      if (toSpec === undefined) end = mode === 'travel' ? start : current;
      else if (endN!.rel) end = start + endN!.rel * convert(el, prop, endN!.n, endN!.u || unit, unit);
      else end = convert(el, prop, endN!.n, endN!.u || unit, unit);
      const snapFn = snapper(snap, prop);
      // Pixel values (and z-index) land on whole numbers unless roundPx: false.
      const integer = prop === 'zIndex' || (unit === 'px' && roundPx !== false);
      const out = (v: number) => {
        let n = snapFn ? snapFn(v) : v;
        if (integer) n = n < 0 ? -Math.round(-n) : Math.round(n);
        write(round(n) + unit);
      };
      return { r: (ratio) => out(start + (end - start) * ratio), revert: () => write(before) };
    }

    // Colors
    const startC = parseColor(startStr, el);
    const endC = parseColor(endStr, el);
    if (startC && endC) {
      return { r: colorWriter(startStr, endStr, startC, endC, write), revert: () => write(before) };
    }

    // Complex strings: same shape -> number by number; otherwise switch at the end.
    if (startStr !== endStr) {
      const pair = canonicalPair(prop, startStr, endStr, el);
      startStr = pair[0];
      endStr = pair[1];
      const a = tokenize(startStr);
      const b = tokenize(endStr);
      if (a.nums.length && a.key === b.key && a.nums.length === b.nums.length) {
        return {
          r: (ratio) => write(fillTemplate(b, b.nums.map((n, i) => a.nums[i] + (n - a.nums[i]) * ratio))),
          revert: () => write(before)
        };
      }
    }
    return discreteChannel(write, before, startStr, endStr, false);
  }

  function attrChannel(el: any, name: string, fromSpec: any, toSpec: any, mode: string): Channel {
    const before = el.getAttribute(name);
    const write = (v: any) => (v === null ? el.removeAttribute(name) : el.setAttribute(name, String(v)));
    const startStr = fromSpec === undefined ? before : String(fromSpec);
    const endStr = toSpec === undefined ? (mode === 'travel' ? startStr : before) : String(toSpec);
    const s = parseNumber(startStr === null ? '0' : startStr);
    const e = parseNumber(endStr);
    if (s && e) {
      const start = fromSpec === undefined ? s.n : numericEnd(fromSpec, parseFloat(before || '0') || 0);
      const end = toSpec === undefined ? (mode === 'travel' ? start : parseFloat(before || '0') || 0) : numericEnd(toSpec, start);
      const unit = e.u || s.u;
      return { r: (ratio) => write(round(start + (end - start) * ratio) + unit), revert: () => write(before) };
    }
    const sc = parseColor(startStr || '', el);
    const ec = parseColor(endStr || '', el);
    if (sc && ec) {
      return { r: (ratio) => write(colorString([0, 1, 2, 3].map((i) => sc[i] + (ec[i] - sc[i]) * ratio))), revert: () => write(before) };
    }
    if (startStr !== null && endStr !== null) {
      const path = name === 'd' || name === 'points' || name === 'viewBox';
      const a = tokenize(startStr, path);
      const b = tokenize(endStr, path);
      if (a.nums.length && a.key === b.key && a.nums.length === b.nums.length) {
        return { r: (ratio) => write(fillTemplate(b, b.nums.map((n, i) => a.nums[i] + (n - a.nums[i]) * ratio))), revert: () => write(before) };
      }
    }
    return discreteChannel(write, before, startStr, endStr, false);
  }

  /** Plain object property (counters) or a non-CSS element property such as textContent. */
  function objectChannel(target: any, prop: string, fromSpec: any, toSpec: any, mode: string, snap: any): Channel {
    const getterSetter = isFn(target[prop]);
    const read = () => (getterSetter ? target[prop]() : target[prop]);
    const write = (v: any) => (getterSetter ? target[prop](v) : (target[prop] = v));
    const before = read();
    const text = typeof before === 'string';
    const beforeNum = typeof before === 'number' ? before : parseFloat(String(before ?? '').replace(/[^\d.eE+-]/g, '')) || 0;
    const startProbe = fromSpec === undefined ? before : fromSpec;
    const endProbe = toSpec === undefined ? (mode === 'travel' ? startProbe : before) : toSpec;
    const specIsNumber = (s: any) => s === undefined || !!parseNumber(s);
    const textIsNumber = !text || /^\s*[-+]?[\d.]*\s*$/.test(before) || fromSpec !== undefined || toSpec !== undefined;
    if (specIsNumber(fromSpec) && specIsNumber(toSpec) && textIsNumber && (fromSpec !== undefined || toSpec !== undefined || typeof before === 'number')) {
      const start = fromSpec === undefined ? beforeNum : numericEnd(fromSpec, beforeNum);
      const end = toSpec === undefined ? (mode === 'travel' ? start : beforeNum) : numericEnd(toSpec, start);
      const snapFn = snapper(snap, prop);
      const out = (v: number) => {
        const n = snapFn ? snapFn(v) : round(v);
        write(text ? String(n) : n);
      };
      return { r: (ratio) => out(start + (end - start) * ratio), revert: () => write(before) };
    }
    if (typeof startProbe === 'string' && typeof endProbe === 'string') {
      const a = tokenize(startProbe);
      const b = tokenize(endProbe);
      if (a.nums.length && a.key === b.key && a.nums.length === b.nums.length) {
        return { r: (ratio) => write(fillTemplate(b, b.nums.map((n, i) => a.nums[i] + (n - a.nums[i]) * ratio))), revert: () => write(before) };
      }
    }
    return discreteChannel(write, before, startProbe, endProbe, false);
  }

  function transformChannels(el: any, key: string, fromSpec: any, toSpec: any, mode: string, out: Channel[]) {
    const tf = transformCache(el);
    const comps = key === 'scale' ? ['scaleX', 'scaleY'] : [TRANSFORM_ALIASES[key]];
    for (const comp of comps) {
      if (tf.svg && (comp === 'tiltX' || comp === 'tiltY' || comp === 'z' || comp === 'perspective')) {
        warnOnce('svg3d', '3D transforms are not supported on SVG elements.');
        continue;
      }
      const before = tf[comp];
      const unitKey = comp === 'x' ? 'xu' : comp === 'y' ? 'yu' : '';
      const beforeUnit = unitKey ? tf[unitKey] : '';
      const toAngle = (spec: any, base: number) => {
        if (typeof spec === 'string') {
          const p = parseNumber(spec);
          if (!p) return base;
          const deg = p.u === 'rad' ? p.n * DEG : p.u === 'turn' ? p.n * 360 : p.u === 'grad' ? p.n * 0.9 : p.n;
          return p.rel ? base + p.rel * deg : deg;
        }
        return numericEnd(spec, base);
      };
      let unit = beforeUnit;
      const specUnit = (spec: any) => {
        const p = parseNumber(spec);
        return p && p.u ? p.u : '';
      };
      if (unitKey) {
        const u = specUnit(toSpec) || specUnit(fromSpec);
        if (u === '%') unit = '%';
        else if (u) unit = 'px';
      }
      // x / y percentages are of the element's own box (its bbox for SVG).
      const size = () => (tf.svg ? bboxOf(el)[comp === 'x' ? 'width' : 'height'] : comp === 'x' ? el.offsetWidth : el.offsetHeight) || 0;
      const inUnit = (n: number, u: string) => {
        if (u === unit) return n;
        const px = u === '%' ? (n / 100) * size() : u === 'px' ? n : convert(el, 'width', n, u, 'px');
        return unit === '%' ? (size() ? (px / size()) * 100 : 0) : px;
      };
      const lengthOf = (spec: any, base: number) => {
        const p = parseNumber(spec);
        if (!p) return base;
        const n = inUnit(p.n, p.u || 'px');
        return p.rel ? base + p.rel * n : n;
      };
      const current = unitKey ? inUnit(before, beforeUnit) : before;
      const endOf = ANGLE_COMPONENTS[comp] ? toAngle : unitKey ? lengthOf : numericEnd;
      const start = fromSpec === undefined ? current : endOf(fromSpec, current);
      const end = toSpec === undefined ? (mode === 'travel' ? start : current) : endOf(toSpec, start);
      out.push({
        tf,
        el,
        r: (ratio) => {
          tf[comp] = round(start + (end - start) * ratio);
          if (unitKey) tf[unitKey] = unit;
        },
        revert: () => {
          tf[comp] = before;
          if (unitKey) tf[unitKey] = beforeUnit;
        }
      });
    }
  }

  function pivotChannel(el: any, key: string, fromSpec: any, toSpec: any, mode: string): Channel {
    const tf = transformCache(el);
    if (!tf.svg) {
      const before = computed(el).transformOrigin;
      const write = (v: string) => (el.style.transformOrigin = v);
      const start = fromSpec === undefined ? before : String(fromSpec);
      const end = toSpec === undefined ? (mode === 'travel' ? start : before) : String(toSpec);
      // An arrive() holds its pivot until it finishes; go() and travel() switch as soon as they start.
      return discreteChannel(write, before, start, end, mode !== 'arrive');
    }
    // SVG: the origin is baked into the matrix; an offset keeps the current picture when it moves.
    const state = (spec: any, base: any) => {
      if (spec === undefined) return base;
      const [ox, oy] = pivotPointOf(el, String(spec), key === 'pivotPoint');
      const L = linearOf(tf);
      const dx = base.ox - ox;
      const dy = base.oy - oy;
      return { ox, oy, xOff: base.xOff + dx - (L.a * dx + L.c * dy), yOff: base.yOff + dy - (L.b * dx + L.d * dy) };
    };
    const before = { ox: tf.ox, oy: tf.oy, xOff: tf.xOff, yOff: tf.yOff };
    const start = state(fromSpec, before);
    const end = toSpec === undefined ? (mode === 'travel' ? start : before) : state(toSpec, start);
    const apply = (s: any) => {
      tf.ox = s.ox;
      tf.oy = s.oy;
      tf.xOff = s.xOff;
      tf.yOff = s.yOff;
    };
    const switched = (progress: number) => (mode === 'arrive' ? progress >= 1 : progress > 0);
    return { tf, el, r: (_ratio, progress) => apply(switched(progress) ? end : start), revert: () => apply(before) };
  }

  function fadeChannel(el: any, fromSpec: any, toSpec: any, mode: string): Channel {
    const beforeOpacity = computed(el).opacity;
    const beforeVisibility = el.style.visibility;
    const parsed = parseFloat(beforeOpacity);
    const current = isFinite(parsed) ? parsed : 1;
    const start = fromSpec === undefined ? current : numericEnd(fromSpec, current);
    const end = toSpec === undefined ? (mode === 'travel' ? start : current) : numericEnd(toSpec, start);
    return {
      r: (ratio) => {
        const v = round(start + (end - start) * ratio);
        el.style.opacity = String(v);
        el.style.visibility = v === 0 ? 'hidden' : 'inherit';
      },
      revert: () => {
        el.style.opacity = beforeOpacity;
        el.style.visibility = beforeVisibility;
      }
    };
  }

  // Options that shape a move rather than name a property.
  const RESERVED: Record<string, boolean> = {};
  'dur,wait,curve,cascade,loop,pingpong,loopGap,sequence,stepCurve,showStart,onBegin,onFrame,onEnd,onLoop,onRewind,round,roundPx,defaults,scope,loopSpan,paused'
    .split(',')
    .forEach((k) => (RESERVED[k] = true));

  function buildChannels(tw: any): Channel[] {
    const pts: Channel[] = [];
    const mode = tw._mode;
    const fromVars = tw._fromVars || {};
    const toVars = tw._toVars || {};
    const keys: string[] = [];
    const addKeys = (vars: any) => {
      for (const k in vars) if (!RESERVED[k] && keys.indexOf(k) < 0) keys.push(k);
    };
    if (mode === 'arrive') addKeys(fromVars);
    else {
      addKeys(toVars);
      if (mode === 'travel') addKeys(fromVars);
    }
    const targets = tw._targets;
    const snap = (mode === 'arrive' ? fromVars : toVars).round;
    // A travel() with showStart: false applies values only its start props name when the playhead
    // moves backward into it, never when it plays forward from before its start.
    const fromOnlyBackward = mode === 'travel' && tw._revertBefore;
    const roundPx = (mode === 'arrive' ? fromVars : toVars).roundPx;

    const buildKey = (key: string, i: number, t: any) => {
      const el = isElement(t);
      const fromSpec = mode === 'go' ? undefined : resolveSpec(fromVars[key], i, t, targets);
      const toSpec = mode === 'arrive' ? undefined : resolveSpec(toVars[key], i, t, targets);
      if (key === 'attrs') {
        if (!el) return;
        const names: string[] = [];
        for (const n in fromSpec || {}) names.push(n);
        for (const n in toSpec || {}) if (names.indexOf(n) < 0) names.push(n);
        names.forEach((n) =>
          pts.push(attrChannel(t, n, fromSpec ? resolveSpec(fromSpec[n], i, t, targets) : undefined, toSpec ? resolveSpec(toSpec[n], i, t, targets) : undefined, mode))
        );
        return;
      }
      if (!el) {
        pts.push(objectChannel(t, key, fromSpec, toSpec, mode, snap));
        return;
      }
      if (key === 'fade') {
        pts.push(fadeChannel(t, fromSpec, toSpec, mode));
      } else if (key === 'scale' || TRANSFORM_ALIASES[key]) {
        transformChannels(t, key, fromSpec, toSpec, mode, pts);
      } else if (key === 'pivot' || key === 'pivotPoint') {
        pts.push(pivotChannel(t, key, fromSpec, toSpec, mode));
      } else if (key === 'transform') {
        const parsed = (spec: any) => {
          if (spec === undefined) return undefined;
          const p = probeElement();
          p.style.transform = String(spec);
          const c: any = { x: 0, y: 0, z: 0, spin: 0, tiltX: 0, tiltY: 0, skewX: 0, skewY: 0, scaleX: 1, scaleY: 1 };
          const m = parseMatrix(computed(p).transform);
          p.style.transform = '';
          if (m) decompose(m, c);
          return c;
        };
        const f = parsed(fromSpec);
        const e = parsed(toSpec);
        ['x', 'y', 'spin', 'skewX', 'scaleX', 'scaleY'].forEach((comp) =>
          transformChannels(t, comp, f ? f[comp] : undefined, e ? e[comp] : undefined, mode, pts)
        );
      } else if (['textContent', 'innerText', 'innerHTML', 'value', 'scrollTop', 'scrollLeft'].indexOf(key) >= 0) {
        pts.push(objectChannel(t, key, fromSpec, toSpec, mode, snap));
      } else {
        const prop = camel(key);
        if (prop.indexOf('--') === 0 || prop in t.style) {
          const pt = cssChannel(t, prop, fromSpec, toSpec, mode, snap, roundPx);
          if (pt) pts.push(pt);
        } else if (key in t) {
          pts.push(objectChannel(t, key, fromSpec, toSpec, mode, snap));
        } else {
          warnOnce('prop:' + key, 'Unknown property "' + key + '"; set at the end of the move.');
          const before = t[key];
          const write = (v: any) => (t[key] = v);
          pts.push(discreteChannel(write, before, fromSpec === undefined ? before : fromSpec, toSpec === undefined ? before : toSpec, false));
        }
      }
    };

    for (let i = 0; i < targets.length; i++) {
      for (const key of keys) {
        const first = pts.length;
        buildKey(key, i, targets[i]);
        if (fromOnlyBackward && !(key in toVars)) {
          for (let p = first; p < pts.length; p++) pts[p].backwardOnly = true;
        }
      }
    }
    return pts;
  }

  /* ------------------------------------------------------------------ *
   * Animations
   * ------------------------------------------------------------------ */
  const DEFAULTS: any = { dur: 0.5, curve: DEFAULT_CURVE };

  /** Calls onBegin / onFrame / onEnd / onLoop / onRewind with the move's progress (this = the move). */
  function fire(anim: any, type: string) {
    const fn = anim.vars && anim.vars[type];
    if (!isFn(fn)) return;
    try {
      fn.call(anim, anim.progress());
    } catch (err) {
      if (win.console) win.console.error('[MooTween] ' + type + ' failed', err);
    }
  }

  function loopCount(anim: any): number {
    const raw = anim._loop;
    if (raw !== true) return Math.max(0, Math.floor(Number(raw) || 0));
    // loop: true covers the shot it belongs to (or LOOP_SPAN when no shot duration is known).
    const owner = lineage(anim).find((a) => a._loopSpan);
    const span = owner ? owner._loopSpan : 0;
    const cycle = anim._dur + anim._loopGap;
    return cycle > 0 ? Math.max(0, Math.ceil((span || LOOP_SPAN) / cycle) - 1) : 0;
  }

  const Anim: any = {
    /** Length of one pass, in seconds. */
    duration(this: any) {
      return this._getDur();
    },
    /** Length including every loop. */
    totalDuration(this: any) {
      const dur = this._getDur();
      const r = loopCount(this);
      return dur * (r + 1) + this._loopGap * r;
    },
    _getDur(this: any) {
      return this._dur;
    },
    startsAt(this: any) {
      return this._start;
    },
    endsAt(this: any) {
      return this._start + this.totalDuration();
    },
    time(this: any) {
      return this._time < 0 ? 0 : this._time;
    },
    progress(this: any, value?: number, silent?: boolean) {
      const dur = this.totalDuration();
      if (value === undefined) return dur ? clamp(0, 1, this._tTime / dur) : this._tTime > 0 || this._ratio === 1 ? 1 : 0;
      return this.seek(clamp(0, 1, Number(value) || 0) * dur, silent);
    },
    /** Renders the move at `time` seconds (a mark name works on tracks). silent skips callbacks. */
    seek(this: any, time: any, silent?: boolean) {
      const t = typeof time === 'string' && this.marks && time in this.marks ? this.marks[time] : Number(time) || 0;
      this.render(t, !!silent, false);
      return this;
    }
  };

  function initAnim(a: any, vars: any) {
    a.vars = vars || {};
    a.parent = null;
    a._start = 0;
    a._wait = Number(a.vars.wait) || 0;
    a._dur = 0;
    a._loop = a.vars.loop === true ? true : Number(a.vars.loop) || 0;
    a._loopGap = Number(a.vars.loopGap) || 0;
    a._pingpong = !!a.vars.pingpong;
    a._tTime = 0;
    a._time = 0;
    a._neg = false;
    a._iteration = 0;
    a._initted = false;
    a._paused = !!a.vars.paused;
  }

  /** Pass-local time for totalTime t (loop, loopGap and pingpong applied). */
  function iterate(a: any, tTime: number, tDur: number, dur: number): [number, number] {
    const r = loopCount(a);
    if (!r) return [Math.min(tTime, dur), 0];
    const cycle = dur + a._loopGap;
    let iteration: number;
    let time: number;
    if (tTime >= tDur) {
      iteration = r;
      time = dur;
    } else {
      iteration = cycle ? Math.floor(tTime / cycle) : 0;
      time = tTime - iteration * cycle;
      // An exact cycle boundary is the end of the previous iteration.
      if (iteration && time === 0) {
        iteration--;
        time = dur;
      }
      if (time > dur) time = dur;
    }
    if (a._pingpong && iteration & 1) time = dur - time;
    return [time, iteration];
  }

  /* ---------------------------- Move ------------------------------ */
  const MoveProto: any = Object.create(Anim);

  MoveProto.targets = function (this: any) {
    return this._targets.slice();
  };

  MoveProto._init = function (this: any) {
    this._initted = true;
    this._pts = buildChannels(this);
  };

  MoveProto._apply = function (this: any, ratio: number, progress: number, backward?: boolean) {
    const pts = this._pts;
    let dirty: any[] | null = null;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      if (pt.backwardOnly && !backward) continue;
      pt.r(ratio, progress);
      if (pt.tf) {
        if (!dirty) dirty = [];
        if (dirty.indexOf(pt) < 0 && !dirty.some((d: any) => d.el === pt.el)) dirty.push(pt);
      }
    }
    if (dirty) dirty.forEach((pt: any) => writeTransform(pt.el, pt.tf));
  };

  MoveProto._revert = function (this: any) {
    const pts = this._pts;
    const els: any[] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      pts[i].revert();
      if (pts[i].tf && els.indexOf(pts[i].el) < 0) els.push(pts[i].el);
    }
    els.forEach((el) => writeTransform(el, el.__mooTransform));
  };

  MoveProto.render = function (this: any, totalTime: number, silent: boolean, force: boolean) {
    const dur = this._dur;
    const neg = totalTime < 0;
    if (!dur) {
      const ratio = neg ? 0 : 1;
      if (!this._initted) {
        this._init();
        this._ratio = -1;
      }
      if (ratio === this._ratio && !force) return this;
      const prevRatio = this._ratio;
      if (ratio) this._apply(1, 1);
      else this._revert();
      this._ratio = ratio;
      this._neg = neg;
      if (!silent) {
        if (ratio) {
          fire(this, 'onBegin');
          fire(this, 'onFrame');
          fire(this, 'onEnd');
        } else if (prevRatio === 1) {
          fire(this, 'onFrame');
          fire(this, 'onRewind');
        }
      }
      return this;
    }
    const tDur = this.totalDuration();
    const tTime = neg ? 0 : totalTime > tDur ? tDur : totalTime;
    const prevTTime = this._tTime;
    if (this._initted && tTime === prevTTime && neg === this._neg && !force) return this;
    if (!this._initted) this._init();
    const [time, iteration] = iterate(this, tTime, tDur, dur);
    const prevIteration = this._iteration;
    if (neg && this._revertBefore) {
      this._revert();
    } else {
      const progress = time / dur;
      this._apply(this._ease(progress), progress, tTime < prevTTime);
    }
    const wasStarted = prevTTime > 0;
    this._tTime = tTime;
    this._time = time;
    this._iteration = iteration;
    this._neg = neg;
    if (!silent) {
      if (!wasStarted && tTime > 0) fire(this, 'onBegin');
      fire(this, 'onFrame');
      if (iteration !== prevIteration) fire(this, 'onLoop');
      if (tTime === tDur && prevTTime !== tDur) fire(this, 'onEnd');
      else if (tTime === 0 && wasStarted) fire(this, 'onRewind');
    }
    return this;
  };

  function createMove(mode: string, targets: any[], fromVars: any, toVars: any): any {
    const tw = Object.create(MoveProto);
    const vars = mode === 'arrive' ? fromVars : toVars;
    initAnim(tw, vars);
    tw._mode = mode;
    tw._targets = targets;
    tw._fromVars = fromVars;
    tw._toVars = toVars;
    tw._dur = Math.max(0, Number(vars.dur) || 0);
    tw._ease = parseCurve(vars.curve);
    tw._ratio = -1;
    tw._revertBefore = mode !== 'go' && vars.showStart === false;
    return tw;
  }

  /* ---------------------------- Track ----------------------------- */
  const TrackProto: any = Object.create(Anim);

  TrackProto._getDur = function (this: any) {
    if (this._dirty) {
      let max = 0;
      for (let i = 0; i < this._children.length; i++) {
        const end = this._children[i].endsAt();
        if (end > max) max = end;
      }
      this._durCache = max;
      this._dirty = false;
    }
    return this._durCache;
  };

  TrackProto._invalidate = function (this: any) {
    lineage(this).forEach((t) => (t._dirty = true));
  };

  TrackProto.children = function (this: any) {
    return this._children.slice();
  };

  TrackProto.recent = function (this: any) {
    return this._recent;
  };

  TrackProto.remove = function (this: any, child: any) {
    const i = this._children.indexOf(child);
    if (i >= 0) {
      this._children.splice(i, 1);
      child.parent = null;
      if (this._recent === child) this._recent = null;
      this._invalidate();
    }
    return this;
  };

  TrackProto.clear = function (this: any) {
    this._children.slice().forEach((c: any) => this.remove(c));
    this.marks = {};
    return this;
  };

  /**
   * Resolves `at`: seconds; 'end' (default), 'with' (start of the previous move), 'after' (its end),
   * or a mark name, each optionally followed by +n / -n seconds ('end-0.3', 'with+0.2', 'hit+0.1').
   */
  TrackProto._position = function (this: any, at: any): number {
    const end = this.duration();
    if (at === undefined || at === null || at === '') return end;
    if (typeof at === 'number') return isFinite(at) ? at : end;
    const s = String(at).trim();
    if (PLAIN_NUM.test(s)) return parseFloat(s);
    const m = s.match(/^(.*?)\s*(?:([-+])\s*(\d+\.?\d*|\.\d+))?$/);
    const name = m ? m[1] : s;
    const shift = m && m[2] ? (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) : 0;
    const recent = this._recent;
    let base: number;
    if (name === 'end') base = end;
    else if (name === 'with') base = recent ? recent._start : 0;
    else if (name === 'after') base = recent ? recent.endsAt() : end;
    else {
      if (!(name in this.marks)) {
        warnOnce('mark:' + name, 'No mark "' + name + '" yet; placing it at the end of the track.');
        this.marks[name] = end;
      }
      base = this.marks[name];
    }
    return base + shift;
  };

  TrackProto._insert = function (this: any, child: any, position: any) {
    if (child.parent) child.parent.remove(child);
    const at = this._position(position);
    child._start = roundTime(at + (child._wait || 0));
    child.parent = this;
    const kids = this._children;
    let i = kids.length;
    while (i > 0 && kids[i - 1]._start > child._start) i--;
    kids.splice(i, 0, child);
    this._recent = child;
    this._invalidate();
    return child;
  };

  TrackProto._scopeEl = function (this: any) {
    const scoped = lineage(this).find((t) => t._scope);
    if (scoped) return scoped._scope;
    const active = api.activeTrack;
    return active && lineage(this).indexOf(active) < 0 ? active._scopeEl() : null;
  };

  TrackProto._defaultsChain = function (this: any) {
    const chain = lineage(this)
      .filter((t) => t.vars.defaults)
      .map((t) => t.vars.defaults)
      .reverse();
    return Object.assign({}, DEFAULTS, ...chain);
  };

  TrackProto._hasPausedAncestor = function (this: any) {
    return lineage(this).some((t) => t._paused);
  };

  /** Builds the move for go/arrive/travel/pin: one move, or a group for cascades and sequences. */
  TrackProto._make = function (this: any, mode: string, rawTargets: any, fromVars: any, toVars: any): any {
    const raw = (mode === 'arrive' ? fromVars : toVars) || {};
    const main = Object.assign({}, this._defaultsChain(), raw);
    if (mode === 'arrive') fromVars = main;
    else toVars = main;
    const targets = toArray(rawTargets, this._scopeEl());
    if (!targets.length) return null;

    if (main.sequence && typeof main.sequence === 'object') return makeSequence(targets, main, raw);

    const cascade = main.cascade;
    if (cascade !== undefined && cascade !== null && cascade !== 0 && targets.length > 1) {
      const group = createTrack({
        onBegin: main.onBegin, onFrame: main.onFrame, onEnd: main.onEnd, onLoop: main.onLoop, onRewind: main.onRewind,
        loop: main.loop, pingpong: main.pingpong, loopGap: main.loopGap, wait: main.wait
      });
      group._group = true;
      const offsets = cascadeOffsets(cascade, targets);
      // (each target's own move is built from `main` without the cascade and group options)
      const sub: any = {};
      for (const k in main) {
        if (k === 'cascade' || k === 'wait' || k === 'loop' || k === 'pingpong' || k === 'loopGap' || /^on[A-Z]/.test(k)) continue;
        sub[k] = main[k];
      }
      if (cascade && typeof cascade === 'object') {
        if (cascade.loop !== undefined) sub.loop = cascade.loop;
        if (cascade.pingpong !== undefined) sub.pingpong = cascade.pingpong;
        if (cascade.loopGap !== undefined) sub.loopGap = cascade.loopGap;
      }
      targets.forEach((t, i) => {
        const tw = mode === 'arrive'
          ? createMove('arrive', [t], sub, null)
          : mode === 'travel'
            ? createMove('travel', [t], Object.assign({}, fromVars), Object.assign({}, sub))
            : createMove(mode, [t], null, Object.assign({}, sub));
        group._insert(tw, offsets[i]);
      });
      group._scope = null;
      return group;
    }
    return mode === 'arrive' ? createMove('arrive', targets, main, null) : createMove(mode, targets, fromVars, main);
  };

  /**
   * Inserts a move or group and renders it now when its start state shows at once: arrive() and
   * travel() unless showStart: false, a pin() placed at the track's current time, or showStart: true.
   */
  TrackProto._add = function (this: any, mode: string, targets: any, fromVars: any, toVars: any, position: any) {
    const vars = (mode === 'arrive' ? fromVars : toVars) || {};
    const anim = this._make(mode, targets, fromVars || {}, toVars || {});
    if (!anim) return this;
    this._insert(anim, position);
    const immediate = vars.showStart;
    const moves = anim._group ? anim._children : [anim];
    for (const tw of moves) {
      if (tw._children) continue;
      if (tw._mode !== 'go' && immediate !== false) {
        tw.render(0, true, true);
      } else if (!tw._dur && immediate !== false && !anim._children && anim._start === this._time && !this._hasPausedAncestor()) {
        tw.render(0, true, false);
      } else if (immediate === true) {
        tw.render(this._time - anim._start - (anim._group ? tw._start : 0), true, true);
      }
    }
    return this;
  };

  /** Moves targets from where they are to `props`. */
  TrackProto.go = function (this: any, targets: any, props: any, at?: any) {
    return this._add('go', targets, null, props, at);
  };
  /** Moves targets from `props` to where they are now; the start state shows at once. */
  TrackProto.arrive = function (this: any, targets: any, props: any, at?: any) {
    return this._add('arrive', targets, props, null, at);
  };
  /** Moves targets from `start` to `end`; the start state shows at once. */
  TrackProto.travel = function (this: any, targets: any, start: any, end: any, at?: any) {
    return this._add('travel', targets, start, end, at);
  };
  /** Sets props instantly at `at`, and undoes them when the playhead goes back before it. */
  TrackProto.pin = function (this: any, targets: any, props: any, at?: any) {
    return this._add('go', targets, null, Object.assign({}, props, { dur: 0 }), at);
  };
  /** Names a moment so later moves can use it as `at` ('hit', 'hit+0.2'). */
  TrackProto.mark = function (this: any, name: string, at?: any) {
    this.marks[name] = this._position(at);
    return this;
  };
  /** Runs fn(progress) when the playhead passes `at`, in either direction. */
  TrackProto.cue = function (this: any, fn: any, at?: any) {
    this._insert(createMove('go', [], null, { dur: 0, onEnd: fn, onRewind: fn }), at);
    return this;
  };
  /** Places a sub-track (MooTween.track()) inside this one. */
  TrackProto.nest = function (this: any, child: any, at?: any) {
    if (child && child._children) this._insert(child, at);
    return this;
  };

  TrackProto.render = function (this: any, totalTime: number, silent: boolean, force: boolean) {
    const tDur = this.totalDuration();
    const dur = this.duration();
    const neg = totalTime < 0;
    const tTime = neg ? 0 : totalTime > tDur ? tDur : totalTime;
    if (tTime === this._tTime && neg === this._neg && !force && this._initted) return this;
    this._initted = true;
    const it = iterate(this, tTime, tDur, dur);
    const time = neg ? totalTime : it[0];
    const iteration = it[1];
    let prevTime = this._time;
    const prevTTime = this._tTime;
    const prevIteration = this._iteration;
    if (iteration !== prevIteration && loopCount(this)) {
      // Finish the iteration we leave, then enter the new one from its boundary.
      const forward = tTime > prevTTime;
      const oldBack = this._pingpong && prevIteration & 1;
      this._renderChildren(forward !== !!oldBack ? dur : 0, prevTime, silent, force);
      const newBack = this._pingpong && iteration & 1;
      const entry = forward !== !!newBack ? 0 : dur;
      if (!this._pingpong) this._renderChildren(entry, forward !== !!oldBack ? dur : 0, true, force);
      prevTime = entry;
    }
    const local = this._ease ? (dur ? this._ease(clamp(0, 1, time / dur)) * dur : time) : time;
    const localPrev = this._ease && prevTime >= 0 ? (dur ? this._ease(clamp(0, 1, prevTime / dur)) * dur : prevTime) : prevTime;
    this._renderChildren(neg ? totalTime : local, localPrev, silent, force);
    const wasStarted = prevTTime > 0;
    this._tTime = tTime;
    this._time = neg ? totalTime : time;
    this._iteration = iteration;
    this._neg = neg;
    if (!silent) {
      if (!wasStarted && tTime > 0) fire(this, 'onBegin');
      fire(this, 'onFrame');
      if (iteration !== prevIteration) fire(this, 'onLoop');
      if (tTime === tDur && prevTTime !== tDur && tDur > 0) fire(this, 'onEnd');
      else if (tTime === 0 && wasStarted) fire(this, 'onRewind');
    }
    return this;
  };

  TrackProto._renderChildren = function (this: any, time: number, prevTime: number, silent: boolean, force: boolean) {
    const kids = this._children;
    if (time >= prevTime) {
      for (let i = 0; i < kids.length; i++) {
        const c = kids[i];
        if (c._start > time) break;
        c.render(roundTime(time - c._start), silent, force);
      }
    } else {
      for (let i = kids.length - 1; i >= 0; i--) {
        const c = kids[i];
        if (c._start <= prevTime) c.render(roundTime(time - c._start), silent, force);
      }
    }
  };

  function createTrack(vars?: any): any {
    const track = Object.create(TrackProto);
    initAnim(track, vars || {});
    track._children = [];
    track.marks = {};
    track._recent = null;
    track._dirty = true;
    track._durCache = 0;
    track._scope = track.vars.scope || null;
    track._loopSpan = Number(track.vars.loopSpan) || 0;
    track._ease = null;
    return track;
  }

  /**
   * sequence: [{...}, {...}] runs one step after another (each step linear unless it names a curve;
   * stepCurve sets the default). The object forms { '0%': {...}, '50%': {...} } and { x: [0, 80, 40] }
   * spread the steps over `dur`.
   */
  function makeSequence(targets: any[], vars: any, raw: any): any {
    const group = createTrack({
      onBegin: vars.onBegin, onFrame: vars.onFrame, onEnd: vars.onEnd, onLoop: vars.onLoop,
      loop: vars.loop, pingpong: vars.pingpong, loopGap: vars.loopGap, wait: vars.wait
    });
    group._group = true;
    const total = Number(raw.dur);
    const stepCurve = vars.stepCurve || 'linear';
    let steps: any[] = [];
    const seq = vars.sequence;
    if (Array.isArray(seq)) {
      const each = total > 0 ? total / seq.length : undefined;
      steps = seq.map((f: any) => Object.assign({ dur: f.dur ?? each ?? DEFAULTS.dur, curve: f.curve || stepCurve }, f));
    } else {
      const dur = total > 0 ? total : DEFAULTS.dur;
      const pctKeys = Object.keys(seq).filter((k) => /%$/.test(k)).sort((a, b) => parseFloat(a) - parseFloat(b));
      if (pctKeys.length) {
        let last = 0;
        pctKeys.forEach((k) => {
          const pct = parseFloat(k) / 100;
          steps.push(Object.assign({ curve: stepCurve }, seq[k], { dur: Math.max(0, (pct - last) * dur) }));
          last = pct;
        });
      } else {
        const props = Object.keys(seq).filter((k) => Array.isArray(seq[k]));
        const n = Math.max(0, ...props.map((p) => seq[p].length));
        for (let i = 0; i < n; i++) {
          const f: any = { dur: i === 0 ? 0 : dur / Math.max(1, n - 1), curve: stepCurve };
          props.forEach((p) => {
            if (i < seq[p].length) f[p] = seq[p][i];
          });
          steps.push(f);
        }
      }
    }
    for (const f of steps) {
      const sub = Object.assign({}, f);
      const wait = Number(sub.wait) || 0;
      delete sub.wait;
      group._insert(createMove('go', targets, null, sub), group.duration() + wait);
    }
    if (raw.curve) group._ease = parseCurve(raw.curve);
    return group;
  }

  /**
   * Start offset of each target for cascade: a number (gap between targets), a function
   * (i, target, targets) => seconds, or { gap | total, from: 'first' | 'middle' | 'last' | 'ends' |
   * index | 'shuffle', curve }.
   */
  function cascadeOffsets(cascade: any, targets: any[]): number[] {
    const n = targets.length;
    if (isFn(cascade)) return targets.map((t, i) => Number(cascade(i, t, targets)) || 0);
    if (typeof cascade === 'number') return targets.map((_t, i) => i * cascade);
    const cfg = cascade || {};
    const from = cfg.from ?? 0;
    const ends = from === 'ends';
    let origin: number;
    if (typeof from === 'number') origin = clamp(0, n - 1, from);
    else {
      const ratio = from === 'middle' || ends ? 0.5 : from === 'last' ? 1 : 0;
      origin = n * ratio - 0.5;
    }
    let dist = targets.map((_t, i) => Math.abs(i - origin));
    if (from === 'shuffle') {
      // Deterministic shuffle seeded by the target count.
      let seed = n * 9301 + 49297;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      dist = targets.map((_t, i) => i);
      for (let i = dist.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = dist[i];
        dist[i] = dist[j];
        dist[j] = tmp;
      }
    }
    const min = Math.min(...dist);
    const max = Math.max(...dist);
    const range = max - min;
    let span = cfg.total !== undefined ? Number(cfg.total) || 0 : (Number(cfg.gap) || 0) * (n - 1);
    if (ends) span = -span;
    const base = span < 0 ? -span : 0;
    const ease = cfg.curve ? parseCurve(cfg.curve) : null;
    return dist.map((d) => {
      let norm = range ? (d - min) / range : 0;
      if (ease) norm = span < 0 ? 1 - ease(1 - norm) : ease(norm);
      return Math.round((base + norm * span) * 1e7) / 1e7;
    });
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  /** Number helpers for scene code: MooTween.math.clamp / mix / remap / normalize / cycle / snap. */
  const math: any = {
    clamp(min: number, max: number, value?: number): any {
      return value === undefined ? (v: number) => clamp(min, max, v) : clamp(min, max, value);
    },
    /** mix(a, b, t): a value t of the way from a to b (numbers or colors). mix([a, b, c], t) walks a list. */
    mix(start: any, end: any, t?: number): any {
      const lerp = (p: number) => {
        if (Array.isArray(start)) {
          const seg = clamp(0, start.length - 1, p * (start.length - 1));
          const i = Math.min(start.length - 2, Math.floor(seg));
          return start.length < 2 ? start[0] : start[i] + (start[i + 1] - start[i]) * (seg - i);
        }
        if (typeof start === 'number' && typeof end === 'number') return start + (end - start) * p;
        const sc = parseColor(start);
        const ec = parseColor(end);
        if (sc && ec) return colorString([0, 1, 2, 3].map((i) => sc[i] + (ec[i] - sc[i]) * p));
        return p < 1 ? start : end;
      };
      if (Array.isArray(start)) return end === undefined ? lerp : lerp(end);
      return t === undefined ? lerp : lerp(t);
    },
    /** remap(inMin, inMax, outMin, outMax, v): v moved from one range into another. */
    remap(inMin: number, inMax: number, outMin: number, outMax: number, value?: number): any {
      const map = (v: number) => (inMax === inMin ? outMin : outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin));
      return value === undefined ? map : map(value);
    },
    normalize(min: number, max: number, value?: number): any {
      return math.remap(min, max, 0, 1, value);
    },
    /** cycle(min, max, v) keeps v inside [min, max); cycle(list, i) picks list[i] round-robin. */
    cycle(min: any, max?: any, value?: any): any {
      if (Array.isArray(min)) {
        const list = min;
        const pickAt = (i: number) => list[((Math.floor(i) % list.length) + list.length) % list.length];
        return max === undefined ? pickAt : pickAt(max);
      }
      const range = max - min;
      const w = (v: number) => (range ? ((((v - min) % range) + range) % range) + min : min);
      return value === undefined ? w : w(value);
    },
    /** snap(step, v) rounds to a multiple of step; snap([a, b, c], v) picks the closest value. */
    snap(step: any, value?: number): any {
      const s = snapper({ _: step }, '_') || ((v: number) => v);
      return value === undefined ? s : s(value);
    }
  };

  const api: any = {
    version: '2.0.0',
    /** The shot being built: sub-tracks created meanwhile resolve selectors inside it. */
    activeTrack: null,
    math,
    /** A new track: { scope, loopSpan, defaults, paused }. Nest it into the shot with shot.nest(). */
    track(options?: any): any {
      return createTrack(options);
    },
    /** Elements for a selector (inside the active shot), element, list or array. */
    select(targets: any, scope?: any): any[] {
      const host = api.activeTrack;
      return toArray(targets, scope || (host ? host._scopeEl() : null));
    },
    /** The easing function for a curve name, e.g. MooTween.curve('overshoot-out(1.7)')(0.5). */
    curve(name: any): Ease {
      return parseCurve(name);
    }
  };

  win.MooTween = api;
  return api;
}
