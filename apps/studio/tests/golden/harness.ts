/**
 * Golden-frame harness: renders a composition in a real stage iframe, seeks a fixed list of times
 * (forward, then backward) and records the computed state of every element inside each scene.
 *
 * Snapshots were recorded with GSAP before the stage moved to MooTween (the transition cases were
 * re-recorded after the slide, zoom and wipe fix); the stage document now runs MooTween and is
 * compared with them using the tolerances in compare.ts.
 */
import { buildCompositionDocument, compileCompositionOverridesCss } from '../../src/engine/composition/buildDocument';
import type { MooProject } from '../../src/types';

/** A documented place where MooTween is meant to differ from the GSAP reference. */
export interface Divergence {
  /** Element id, data-moo-layer or class name; any element when omitted. */
  element?: string;
  prop?: string;
  /** Time window (seconds) the divergence covers, inclusive. */
  from?: number;
  to?: number;
  reason: string;
}

export interface GoldenCase {
  name: string;
  project: MooProject;
  /** Editor flow: overrides are pushed after load with !important instead of baked into the document. */
  liveOverrides?: boolean;
  /** MooTween is compared with this case's snapshot instead of its own. */
  mooTweenReference?: string;
  divergences?: Divergence[];
}

export interface GoldenElement {
  id: string;
  tag: string;
  cls?: string;
  layer?: string;
  /** Inside an <svg>: its effective transform is the recorded `ctm`. */
  svg?: boolean;
}

/** elementId -> property -> value, holding only what changed since the previous frame of the pass. */
export type FrameDelta = Record<string, Record<string, string>>;

export interface GoldenRecord {
  version: 1;
  case: string;
  env: { platform: string; browser: string };
  duration: number;
  times: number[];
  posters: { start: number; end: number }[];
  /** console.error / console.warn / uncaught errors raised inside the stage. */
  logs: string[];
  elements: GoldenElement[];
  /** One delta per entry of `times`, visited in ascending order. */
  forward: FrameDelta[];
  /** One delta per entry of `times`, visited in descending order (backward[0] is the last time). */
  backward: FrameDelta[];
}

export const STYLE_PROPS = [
  'transform',
  'transformOrigin',
  'translate',
  'scale',
  'rotate',
  'opacity',
  'visibility',
  'display',
  'zIndex',
  'color',
  'backgroundColor',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeDasharray',
  'strokeDashoffset',
  'clipPath',
  'filter',
  'boxShadow',
  'fontSize',
  'letterSpacing',
  'borderRadius',
  'left',
  'top',
  'width',
  'height'
] as const;

const SVG_ATTRS = ['cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'd', 'points', 'x1', 'y1', 'x2', 'y2', 'transform'];

/** Values a property takes when a delta does not mention it. Keeps the snapshots small. */
export const DEFAULTS: Record<string, string> = {
  __present: '1',
  transform: 'none',
  translate: 'none',
  scale: 'none',
  rotate: 'none',
  opacity: '1',
  visibility: 'visible',
  display: 'block',
  zIndex: 'auto',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  fill: 'rgb(0, 0, 0)',
  stroke: 'none',
  strokeWidth: '1px',
  strokeDasharray: 'none',
  strokeDashoffset: '0px',
  clipPath: 'none',
  filter: 'none',
  boxShadow: 'none',
  letterSpacing: 'normal',
  borderRadius: '0px',
  left: 'auto',
  top: 'auto'
};

export function defaultOf(key: string): string {
  return DEFAULTS[key] ?? '';
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  const v = Math.round(n * f) / f;
  return Object.is(v, -0) ? 0 : v;
};

/** 20 evenly spaced times over the whole film, plus a dense window around every shot boundary. */
export function sampleTimes(total: number, boundaries: number[]): number[] {
  const set = new Set<number>();
  for (let k = 0; k < 20; k++) set.add(round((total * k) / 19, 4));
  for (const b of boundaries) {
    for (const off of [-0.3, -0.2, -0.1, 0, 0.05]) {
      const t = round(b + off, 4);
      if (t > 0 && t < total) set.add(t);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function detectEnv(): GoldenRecord['env'] {
  const ua = navigator.userAgent;
  const m = ua.match(/(?:HeadlessChrome|Chrome)\/(\d+)/);
  return { platform: navigator.platform || 'unknown', browser: m ? `chromium-${m[1]}` : ua };
}

// Runs before any stage script so build-time warnings and errors land in the record.
const LOG_CAPTURE = `<script>
(function(){
  var logs = window.__GOLDEN_LOGS__ = [];
  function fmt(args){ return Array.prototype.map.call(args, function(a){ return a && a.message ? a.message : String(a); }).join(' '); }
  var oe = console.error, ow = console.warn;
  console.error = function(){ logs.push('error: ' + fmt(arguments)); return oe.apply(console, arguments); };
  console.warn = function(){ logs.push('warn: ' + fmt(arguments)); return ow.apply(console, arguments); };
  window.addEventListener('error', function(e){ logs.push('uncaught: ' + (e.message || e)); });
})();
</script>`;

function readElement(el: Element, win: Window, stageRect: DOMRect): Record<string, string> {
  const cs = win.getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const p of STYLE_PROPS) out[p] = (cs as any)[p] ?? '';
  // Screen boxes only for layers and shot wrappers: transforms already pin down everything else.
  if (el.classList.contains('moo-scene-wrapper') || el.hasAttribute('data-moo-layer')) {
    const r = el.getBoundingClientRect();
    out.r = [r.left - stageRect.left, r.top - stageRect.top, r.width, r.height].map((n) => round(n, 3)).join(',');
  }

  let text = '';
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3) text += c.nodeValue || '';
  }
  text = text.trim();
  if (text) out.text = text;

  if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
    for (const a of SVG_ATTRS) {
      const v = el.getAttribute(a);
      if (v !== null) out['attr:' + a] = v;
    }
    const g = el as unknown as SVGGraphicsElement;
    if (typeof g.getCTM === 'function') {
      const m = g.getCTM();
      if (m) out.ctm = [m.a, m.b, m.c, m.d, m.e, m.f].map((n) => round(n, 5)).join(',');
    }
  }
  return out;
}

function captureFrame(win: Window, elements: Map<string, GoldenElement>): Map<string, Record<string, string>> {
  const doc = win.document;
  const stage = doc.getElementById('moo-stage');
  const frame = new Map<string, Record<string, string>>();
  if (!stage) return frame;
  const stageRect = stage.getBoundingClientRect();
  const wrappers = Array.from(stage.children).filter((c) => c.classList.contains('moo-scene-wrapper'));

  const walk = (el: Element, id: string) => {
    if (!elements.has(id)) {
      const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
      const info: GoldenElement = { id, tag: el.tagName.toLowerCase() };
      if (cls.trim()) info.cls = cls.trim();
      const layer = el.getAttribute('data-moo-layer');
      if (layer) info.layer = layer;
      if ((el as SVGElement).ownerSVGElement) info.svg = true;
      elements.set(id, info);
    }
    frame.set(id, readElement(el, win, stageRect));
    Array.from(el.children).forEach((child, i) => walk(child, `${id}.${i}`));
  };
  wrappers.forEach((w, i) => walk(w, String(i)));
  return frame;
}

/** Delta-encodes a pass: each frame keeps only the properties that changed since the previous one. */
export function encodePass(frames: Map<string, Record<string, string>>[], ids: string[]): FrameDelta[] {
  let prev = new Map<string, Record<string, string>>();
  return frames.map((frame) => {
    const delta: FrameDelta = {};
    const next = new Map<string, Record<string, string>>();
    for (const id of ids) {
      const state = frame.get(id) ?? { __present: '0' };
      const before = prev.get(id) ?? {};
      const changed: Record<string, string> = {};
      const keys = new Set([...Object.keys(state), ...Object.keys(before)]);
      for (const key of keys) {
        const now = state[key] ?? defaultOf(key);
        const was = before[key] ?? defaultOf(key);
        if (now !== was) changed[key] = now;
      }
      if (Object.keys(changed).length) delta[id] = changed;
      next.set(id, state);
    }
    prev = next;
    return delta;
  });
}

/** Expands a delta-encoded pass back into full per-frame states. */
export function decodePass(deltas: FrameDelta[]): Map<string, Record<string, string>>[] {
  let prev = new Map<string, Record<string, string>>();
  return deltas.map((delta) => {
    const next = new Map<string, Record<string, string>>();
    for (const [id, state] of prev) next.set(id, { ...state });
    for (const [id, changed] of Object.entries(delta)) {
      next.set(id, { ...(next.get(id) ?? {}), ...changed });
    }
    prev = next;
    return next;
  });
}

function waitForMessage(win: Window, match: (data: any) => boolean, timeoutMs: number, label: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);
    function onMessage(ev: MessageEvent) {
      if (ev.source !== win || !ev.data || !match(ev.data)) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(ev.data);
    }
    window.addEventListener('message', onMessage);
  });
}

export interface RecordOptions {
  /** Rewrites the stage document before it loads, e.g. to swap the animation engine. */
  prepareDocument?: (html: string) => string;
}

export async function recordCase(c: GoldenCase, options: RecordOptions = {}): Promise<GoldenRecord> {
  const project = c.project;
  const width = project.composition?.width || project.width || 1080;
  const height = project.composition?.height || project.height || 1920;

  let html = buildCompositionDocument(project, { omitOverrides: c.liveOverrides === true });
  html = html.replace('<head>', `<head>${LOG_CAPTURE}`);
  if (options.prepareDocument) html = options.prepareDocument(html);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);
  const win = iframe.contentWindow as Window & Record<string, any>;

  try {
    const ready = waitForMessage(win, (d) => d.type === 'ready', 20000, `ready (${c.name})`);
    iframe.srcdoc = html;
    const readyMsg = await ready;

    if (c.liveOverrides) {
      const css = compileCompositionOverridesCss(project.composition, { important: true });
      win.postMessage({ type: 'set_override_css', css }, '*');
      // Messages are handled in order, so a seek round-trip proves the overrides are applied.
      const seeked = waitForMessage(win, (d) => d.type === 'seeked' && d.id === 'golden-sync', 5000, 'override sync');
      win.postMessage({ type: 'seek', id: 'golden-sync', time: 0 }, '*');
      await seeked;
    }

    const sceneDurations: number[] = win.__MOO_SCENE_DURATIONS__ || [];
    const boundaries: number[] = [];
    let acc = 0;
    for (let i = 0; i < sceneDurations.length - 1; i++) {
      acc += sceneDurations[i];
      boundaries.push(acc);
    }
    const duration = Number(readyMsg.duration) || sceneDurations.reduce((s, d) => s + d, 0);
    const times = sampleTimes(duration, boundaries);

    const elements = new Map<string, GoldenElement>();
    const seek = win.__MOO_SEEK__ as (t: number) => void;
    const forward = times.map((t) => {
      seek(t);
      return captureFrame(win, elements);
    });
    const backward = [...times].reverse().map((t) => {
      seek(t);
      return captureFrame(win, elements);
    });

    const ids = [...elements.keys()];
    return {
      version: 1,
      case: c.name,
      env: detectEnv(),
      duration: round(duration, 4),
      times,
      posters: (win.__MOO_POSTERS__ || []).map((p: any) => ({ start: round(p.start, 4), end: round(p.end, 4) })),
      logs: [...(win.__GOLDEN_LOGS__ || [])],
      elements: ids.map((id) => elements.get(id)!),
      forward: encodePass(forward, ids),
      backward: encodePass(backward, ids)
    };
  } finally {
    iframe.remove();
  }
}

/** Stable, diff-friendly JSON: one element or frame per line. */
export function serializeRecord(r: GoldenRecord): string {
  const head: string[] = [];
  for (const key of ['version', 'case', 'env', 'duration', 'times', 'posters', 'logs'] as const) {
    head.push(`  ${JSON.stringify(key)}: ${JSON.stringify(r[key])}`);
  }
  const list = (key: 'elements' | 'forward' | 'backward') =>
    `  ${JSON.stringify(key)}: [\n${(r[key] as unknown[]).map((v) => '    ' + JSON.stringify(v)).join(',\n')}\n  ]`;
  return `{\n${[...head, list('elements'), list('forward'), list('backward')].join(',\n')}\n}\n`;
}
