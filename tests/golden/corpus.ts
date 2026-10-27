/**
 * Golden-frame corpus: every code path that writes timeline code today.
 *
 * - the reference shot shown to the model (motionLaws.ts)
 * - the director's fallback and auto-synthesized timelines (directorPipeline.ts)
 * - the 8 procedural archetypes (proceduralCompiler.ts)
 * - every ctx.* helper of the mograph kit
 * - the inter-shot transitions of the runtime
 * - the API surface the MooTween subset promises (positions, staggers, eases, properties, callbacks)
 * - real AI scenes exported from projects (tests/fixtures/scenes/*.json)
 *
 * Shots run one per composition unless a case is about transitions, so GSAP's document-wide selector
 * lookup can never leak between shots and pollute the reference.
 */
import type { GoldenCase } from './harness';
import type {
  GeneratedScene,
  LayerOverride,
  MooProject,
  Scene,
  ScenePalette,
  SceneTransition,
  StyleBrief,
  WordTimestamp
} from '../../src/types';
import { REFERENCE_SCENE_EXAMPLE } from '../../src/engine/ai/director/motionLaws';
import { parseCodeBlocks, synthesizeFallbackScene } from '../../src/engine/ai/director/directorPipeline';
import { compileProceduralScene, type ProceduralArchetype } from '../../src/engine/composition/proceduralCompiler';
import { DEMO_PROJECT } from '../fixtures/demoProject';

interface ShotSpec {
  id: string;
  html: string;
  css: string;
  buildJs: string;
  duration: number;
  transition?: SceneTransition;
  words?: WordTimestamp[];
  overrides?: Record<string, LayerOverride>;
  palette?: Partial<ScenePalette>;
}

interface ProjectSize {
  width: number;
  height: number;
}

const PORTRAIT: ProjectSize = { width: 1080, height: 1920 };
const LANDSCAPE: ProjectSize = { width: 1920, height: 1080 };

function makeProject(id: string, shots: ShotSpec[], size: ProjectSize = PORTRAIT): MooProject {
  const scenes: Scene[] = shots.map((s) => ({
    id: s.id,
    narrationText: '',
    durationInSeconds: s.duration,
    wordTimestamps: s.words || [],
    transition: s.transition
  }));
  const modules: GeneratedScene[] = shots.map((s) => ({
    id: s.id,
    beatId: s.id,
    duration: s.duration,
    html: s.html,
    css: s.css,
    buildJs: s.buildJs,
    status: 'ok',
    version: 1,
    userEdited: false,
    overrides: s.overrides,
    palette: s.palette
  }));
  const total = shots.reduce((sum, s) => sum + s.duration, 0);
  return {
    id,
    title: id,
    schemaVersion: 2,
    renderMode: 'composition',
    aspectRatio: size.width > size.height ? '16:9' : size.width === size.height ? '1:1' : '9:16',
    fps: 30,
    width: size.width,
    height: size.height,
    theme: {
      bg: '#0b1020',
      textPrimary: '#f8fafc',
      textHighlight: '#f59e0b',
      fontFamily: 'Jakarta',
      captionStyle: 'boxed',
      captionPosition: 'bottom',
      showSubtitles: false
    },
    scenes,
    audioDuration: total,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
    composition: {
      id: `comp-${id}`,
      width: size.width,
      height: size.height,
      fps: 30,
      duration: total,
      globalCss: '',
      scenes: modules,
      createdAt: 1700000000000
    }
  };
}

/** Evenly spaced word timings, enough for ctx.at / ctx.beat to resolve real words. */
function wordsFor(text: string, duration: number): WordTimestamp[] {
  const words = text.split(/\s+/).filter(Boolean);
  const step = duration / Math.max(1, words.length);
  return words.map((word, i) => ({ word, start: +(i * step).toFixed(3), end: +((i + 1) * step).toFixed(3) }));
}

/** Root + camera skeleton every generated shot uses. */
function shell(cls: string, inner: string, css: string): { html: string; css: string } {
  return {
    html: `<div class="${cls}">\n  <div class="moo-camera" data-moo-layer="camera">\n${inner}\n  </div>\n</div>`,
    css:
      `.${cls} { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--moo-bg, #0b1020); color: var(--moo-text, #f8fafc); font-family: var(--moo-font-display, 'Plus Jakarta Sans'); }\n` +
      `.${cls} .moo-camera { position: absolute; inset: 0; transform-origin: 50% 50%; }\n` +
      css
  };
}

function single(name: string, shot: Omit<ShotSpec, 'id'>, size?: ProjectSize, extra?: Partial<GoldenCase>): GoldenCase {
  return { name, project: makeProject(name, [{ id: `${name}-s1`, ...shot }], size), ...extra };
}

/* ------------------------------------------------------------------ *
 * 1. Reference shot and director fallbacks
 * ------------------------------------------------------------------ */
function referenceCases(): GoldenCase[] {
  const ref = parseCodeBlocks(REFERENCE_SCENE_EXAMPLE);
  const words: WordTimestamp[] = [
    { word: 'satu', start: 0.2, end: 0.6 },
    { word: 'ide', start: 1.25, end: 1.6 },
    { word: 'kecil', start: 1.6, end: 2.1 }
  ];
  return [
    single('ref-example', { ...ref, duration: 4, words }),
    single('ref-example-nowords', { ...ref, duration: 4 })
  ];
}

const STYLE_BRIEF: StyleBrief = {
  adjectives: ['bold', 'clean'],
  palette: { bg: '#090d16', primary: '#3b82f6', accent: '#06b6d4', text: '#f8fafc' },
  fontDisplay: 'Syne',
  fontBody: 'Plus Jakarta Sans',
  backgroundLanguage: 'deep gradient',
  motionSignature: 'snappy'
};

function directorCases(): GoldenCase[] {
  const beat = { id: 'b1', narration: 'Satu ide kecil menyebar ke banyak orang', visualIntent: 'Ide menyebar luas' };
  const portrait = synthesizeFallbackScene({ beat, index: 0, styleBrief: STYLE_BRIEF, durationSec: 4, aspectRatio: '9:16' });
  const landscape = synthesizeFallbackScene({ beat, index: 1, styleBrief: STYLE_BRIEF, durationSec: 3.5, aspectRatio: '16:9' });
  const autoSynth = parseCodeBlocks(
    '```html\n<div class="auto-shot"><div class="moo-camera" data-moo-layer="camera">' +
      '<div class="auto-a" data-moo-layer="a">IDE</div><div class="auto-b" data-moo-layer="b"></div>' +
      '<svg class="auto-c" viewBox="0 0 1080 1920"><circle cx="540" cy="1200" r="120" fill="#f59e0b"/></svg>' +
      '</div></div>\n```\n```css\n.auto-shot{position:relative;width:100%;height:100%;overflow:hidden;background:#111}' +
      '.auto-shot .moo-camera{position:absolute;inset:0}.auto-a{position:absolute;left:200px;top:400px;font:900 160px/1 sans-serif;color:#fff}' +
      '.auto-b{position:absolute;left:300px;top:800px;width:480px;height:120px;background:#38bdf8}' +
      '.auto-c{position:absolute;left:0;top:0;width:100%;height:100%}\n```'
  );
  return [
    single('director-fallback-916', { ...portrait, duration: 4 }),
    single('director-fallback-169', { ...landscape, duration: 3.5 }, LANDSCAPE),
    single('director-autosynth', { ...autoSynth, duration: 3.5 })
  ];
}

/* ------------------------------------------------------------------ *
 * 2. Procedural archetypes
 * ------------------------------------------------------------------ */
const ARCHETYPE_NARRATION: Record<Exclude<ProceduralArchetype, 'auto'>, string> = {
  'kinetic-impact': 'Satu ide kecil bisa mengubah segalanya',
  'glass-spotlight': 'Fokus pada tiga hal penting untuk tim kamu',
  'stat-counter': 'Penjualan naik 87% hanya dalam tiga bulan',
  'code-terminal': 'Jalankan satu fungsi API untuk deploy kode',
  'split-versus': 'Cara lama vs cara baru dalam bekerja',
  'bento-list': 'Pertama rencanakan, kedua eksekusi, ketiga evaluasi',
  'social-quote': '"Kesederhanaan adalah kecanggihan tertinggi" kata mereka',
  'chart-data': 'Grafik pertumbuhan pengguna naik tajam tahun ini'
};

function proceduralCases(): GoldenCase[] {
  const ids = Object.keys(ARCHETYPE_NARRATION) as Array<Exclude<ProceduralArchetype, 'auto'>>;
  return ids.map((archetype, i) => {
    const narration = ARCHETYPE_NARRATION[archetype];
    const scene: Scene = {
      id: `proc-${archetype}`,
      narrationText: narration,
      durationInSeconds: 3.5,
      wordTimestamps: wordsFor(narration, 3.5),
      visualIntent: narration
    };
    const mod = compileProceduralScene(scene, i, ids.length, undefined, archetype);
    const name = `procedural-${archetype}`;
    return single(name, { html: mod.html, css: mod.css, buildJs: mod.buildJs, duration: 3.5, words: scene.wordTimestamps });
  });
}

/* ------------------------------------------------------------------ *
 * 3. Mograph kit helpers
 * ------------------------------------------------------------------ */
const CAMERA_BODY = `    <div class="kc-bg" data-moo-layer="bg"></div>
    <div class="kc-box" data-moo-layer="box"></div>
    <svg class="kc-svg" data-moo-layer="ring" viewBox="0 0 1080 1920"><circle cx="540" cy="1300" r="160" fill="none" stroke="var(--moo-accent)" stroke-width="10"/></svg>`;
const CAMERA_CSS = (cls: string) => `.${cls} .kc-bg { position: absolute; left: 90px; top: 300px; width: 900px; height: 900px; border-radius: 50%; background: radial-gradient(circle, var(--moo-accent) 0%, transparent 65%); opacity: 0.3; }
.${cls} .kc-box { position: absolute; left: 340px; top: 620px; width: 400px; height: 400px; background: var(--moo-primary); }
.${cls} .kc-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }`;

function kitCameraCases(): GoldenCase[] {
  const combos: Array<[string, string, string]> = [
    ['push', 'zoom', ''],
    ['pull', 'whip-left', ''],
    ['pan-left', 'whip-right', ''],
    ['pan-right', 'whip-up', ''],
    ['pan-up', 'drop', ''],
    ['pan-down', 'spin', ''],
    ['roll', 'false', ", origin: '30% 70%', from: { rotation: -10 }, to: { scale: 1.3 }, ease: 'power2.inOut'"]
  ];
  return combos.map(([move, handoff, extra]) => {
    const cls = `kc-${move}`;
    const s = shell(cls, CAMERA_BODY, CAMERA_CSS(cls));
    const handoffArg = handoff === 'false' ? 'false' : `'${handoff}'`;
    return single(`kit-camera-${move}`, {
      ...s,
      duration: 3,
      buildJs: `ctx.camera({ move: '${move}', handoff: ${handoffArg}${extra} });\nctx.handoff('zoom');`
    });
  });
}

function kitDrawPopHero(): GoldenCase {
  const s = shell(
    'kd',
    `    <svg class="kd-svg" data-moo-layer="art" viewBox="0 0 1080 1920">
      <path class="kd-path" d="M100 400 C 300 200, 700 600, 980 400" fill="none" stroke="var(--moo-primary)" stroke-width="8"/>
      <line class="kd-line" x1="100" y1="700" x2="980" y2="700" stroke="var(--moo-accent)" stroke-width="6"/>
      <circle class="kd-ring" cx="540" cy="1100" r="200" fill="none" stroke="var(--moo-text)" stroke-width="6"/>
      <polyline class="kd-poly" points="100,1500 300,1400 500,1550 700,1380 980,1500" fill="none" stroke="var(--moo-primary)" stroke-width="6"/>
      <g class="kd-dots" fill="var(--moo-accent)"><circle cx="200" cy="1700" r="30"/><circle cx="380" cy="1700" r="30"/><circle cx="560" cy="1700" r="30"/><circle cx="740" cy="1700" r="30"/><circle cx="920" cy="1700" r="30"/></g>
      <rect class="kd-hero" x="440" y="1000" width="200" height="200" rx="24" fill="var(--moo-accent)"/>
    </svg>
    <div class="kd-badge" data-moo-layer="badge">HERO</div>`,
    `.kd .kd-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.kd .kd-badge { position: absolute; left: 340px; top: 180px; width: 400px; text-align: center; font: 800 96px/1 'Plus Jakarta Sans'; }`
  );
  return single('kit-draw-pop-hero', {
    ...s,
    duration: 3.5,
    buildJs: `ctx.draw('.kd-path', { at: 0.2, duration: 0.9 });
ctx.draw([root.querySelector('.kd-line'), root.querySelector('.kd-poly')], { at: 0.5, stagger: 0.2, from: 0.3 });
ctx.draw('.kd-ring', { at: 1.0, duration: 0.6, ease: 'power3.out' });
ctx.pop('.kd-dots circle', { at: 0.8, stagger: 0.1 });
ctx.pop(root.querySelectorAll('.kd-missing'), { at: 0.5 });
ctx.hero('.kd-hero');
ctx.hero('.kd-badge', { from: 0.7, breathe: false, origin: '50% 100%' });`
  });
}

function kitKinetic(): GoldenCase {
  const s = shell(
    'kk',
    `    <div class="kk-a" data-moo-layer="a">RISE WORDS HERE</div>
    <div class="kk-b" data-moo-layer="b">SLAM IT</div>
    <div class="kk-c" data-moo-layer="c">FLIP</div>
    <div class="kk-d" data-moo-layer="d">DROP DOWN</div>
    <div class="kk-e" data-moo-layer="e">TYPE ME</div>
    <div class="kk-f" data-moo-layer="f"><span>PRE</span> <span>SPLIT</span></div>`,
    `.kk .kk-a, .kk .kk-b, .kk .kk-c, .kk .kk-d, .kk .kk-e, .kk .kk-f { position: absolute; left: 60px; width: 960px; text-align: center; font: 900 120px/1 'Syne'; white-space: nowrap; }
.kk .kk-a { top: 160px; } .kk .kk-b { top: 420px; } .kk .kk-c { top: 680px; }
.kk .kk-d { top: 940px; } .kk .kk-e { top: 1200px; font-family: 'JetBrains Mono'; } .kk .kk-f { top: 1460px; }`
  );
  return single('kit-kinetic', {
    ...s,
    duration: 3.5,
    words: [
      { word: 'Rise', start: 0.3, end: 0.6 },
      { word: 'slam!', start: 0.9, end: 1.2 },
      { word: 'flipping', start: 1.3, end: 1.6 }
    ],
    buildJs: `ctx.kinetic('.kk-a', { style: 'rise', at: ctx.beat('rise', 0.1) });
ctx.kinetic('.kk-b', { style: 'slam', at: ctx.beat('slam', 0.6) });
ctx.kinetic('.kk-c', { style: 'flip', by: 'chars', at: ctx.beat('flip', 1.0) });
ctx.kinetic('.kk-d', { style: 'drop', at: ctx.beat('nothing', 1.4) });
ctx.kinetic('.kk-e', { style: 'type', at: 1.8 });
ctx.kinetic('.kk-f', { at: 2.2, stagger: 0.2, ease: 'back.out(1.7)' });
ctx.split('.kk-a', 'chars');`
  });
}

function kitAccents(): GoldenCase {
  const s = shell(
    'ka',
    `    <div class="ka-stat" data-moo-layer="stat">0</div>
    <div class="ka-money" data-moo-layer="money">0</div>
    <div class="ka-box" data-moo-layer="box"></div>
    <div class="ka-shake" data-moo-layer="shaker">!</div>`,
    `.ka .ka-stat, .ka .ka-money { position: absolute; left: 0; width: 100%; text-align: center; font: 900 180px/1 'Plus Jakarta Sans'; }
.ka .ka-stat { top: 200px; } .ka .ka-money { top: 480px; font-size: 110px; }
.ka .ka-box { position: absolute; left: 390px; top: 860px; width: 300px; height: 300px; background: var(--moo-accent); }
.ka .ka-shake { position: absolute; left: 440px; top: 1300px; width: 200px; text-align: center; font: 900 220px/1 'Syne'; }`
  );
  return single('kit-accents', {
    ...s,
    duration: 3.2,
    buildJs: `ctx.count('.ka-stat', { to: 87, suffix: '%', at: 0.2 });
ctx.count('.ka-money', { from: 1000, to: 2500000, prefix: 'Rp ', decimals: 2, at: 0.5, duration: 1.5 });
ctx.punch('.ka-box', { at: 1.0, scale: 1.4 });
ctx.shake('.ka-shake', { at: 1.5, strength: 20 });
ctx.flash({ at: 2.0, color: '#ffffff', intensity: 0.8 });
ctx.flash({ at: 2.6 });`
  });
}

function kitAmbient(): GoldenCase {
  const reveals = ['left', 'right', 'up', 'down', 'circle'];
  const s = shell(
    'kam',
    `    <div class="kam-glow" data-moo-layer="glow"></div>
    <svg class="kam-svg" data-moo-layer="orbit" viewBox="0 0 1080 1920">
      <circle class="kam-center" cx="540" cy="760" r="60" fill="var(--moo-accent)"/>
      <circle class="kam-sat" cx="840" cy="760" r="24" fill="var(--moo-text)"/>
      <rect class="kam-sq" x="160" y="300" width="120" height="120" fill="var(--moo-primary)"/>
    </svg>
    <div class="kam-spinner" data-moo-layer="spinner"></div>
${reveals.map((d, i) => `    <div class="kam-r kam-r-${d}" data-moo-layer="reveal-${d}" style="top:${1150 + i * 140}px">${d.toUpperCase()}</div>`).join('\n')}`,
    `.kam .kam-glow { position: absolute; left: 240px; top: 460px; width: 600px; height: 600px; border-radius: 50%; background: var(--moo-primary); opacity: 0.25; }
.kam .kam-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.kam .kam-spinner { position: absolute; left: 760px; top: 260px; width: 160px; height: 160px; background: var(--moo-accent); }
.kam .kam-r { position: absolute; left: 140px; width: 800px; height: 110px; background: var(--moo-primary); font: 800 80px/110px 'Plus Jakarta Sans'; text-align: center; }`
  );
  return single('kit-ambient', {
    ...s,
    duration: 3.5,
    buildJs: `ctx.drift('.kam-glow', { amount: 60, rotate: 12 });
ctx.orbit('.kam-sat', { turns: 1, cx: 540, cy: 760 });
ctx.orbit('.kam-sq', { turns: 0.75 });
ctx.orbit('.kam-spinner', { origin: '0% 0%' });
${reveals.map((d, i) => `ctx.reveal('.kam-r-${d}', { dir: '${d}', at: ${(0.2 + i * 0.3).toFixed(1)} });`).join('\n')}
ctx.particles({ count: 12, size: [4, 9], rise: 300 });
ctx.particles({ count: 5, parent: '.kam-glow', color: '#ffee00' });`
  });
}

/* ------------------------------------------------------------------ *
 * 4. Inter-shot transitions
 * ------------------------------------------------------------------ */
function transitionCases(): GoldenCase[] {
  const types: SceneTransition[] = ['flow', 'cut', 'fade', 'slide', 'zoom', 'wipe'];
  return types.map((type) => {
    const a = shell(
      `ta-${type}`,
      `    <div class="ta-box" data-moo-layer="box"></div>\n    <div class="ta-word" data-moo-layer="word">SATU</div>`,
      `.ta-${type} .ta-box { position: absolute; left: 290px; top: 710px; width: 500px; height: 500px; background: var(--moo-accent); }
.ta-${type} .ta-word { position: absolute; left: 0; top: 300px; width: 100%; text-align: center; font: 900 160px/1 'Syne'; }`
    );
    const b = shell(
      `tb-${type}`,
      `    <svg class="tb-svg" data-moo-layer="dots" viewBox="0 0 1080 1920"><circle class="tb-dot" cx="300" cy="960" r="90" fill="var(--moo-primary)"/><circle class="tb-dot" cx="780" cy="960" r="90" fill="var(--moo-text)"/></svg>`,
      `.tb-${type} { background: #1e293b; }\n.tb-${type} .tb-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }`
    );
    const project = makeProject(`transition-${type}`, [
      { id: `tr-${type}-a`, ...a, duration: 2.5, transition: type, buildJs: `ctx.camera({ move: 'push' });\ntl.to(root.querySelector('.ta-box'), { rotation: 90, duration: 2 }, 0);` },
      { id: `tr-${type}-b`, ...b, duration: 2.5, transition: type, buildJs: `ctx.camera({ move: 'pull', handoff: false });\nctx.pop('.tb-dot', { at: 0.2, stagger: 0.15 });` }
    ]);
    return { name: `transition-${type}`, project };
  });
}

/* ------------------------------------------------------------------ *
 * 5. Timeline API surface (the MooTween subset)
 * ------------------------------------------------------------------ */
function boxes(prefix: string, count: number, cssExtra = ''): { inner: string; css: string } {
  const inner = Array.from({ length: count }, (_, i) => `    <div class="${prefix} ${prefix}${i + 1}" data-moo-layer="${prefix}${i + 1}"></div>`).join('\n');
  const css =
    `.${prefix} { position: absolute; left: 80px; width: 80px; height: 80px; background: var(--moo-accent); }\n` +
    Array.from({ length: count }, (_, i) => `.${prefix}${i + 1} { top: ${100 + i * 140}px; }`).join('\n') +
    (cssExtra ? '\n' + cssExtra : '');
  return { inner, css };
}

function apiPositions(): GoldenCase {
  const b = boxes('ap-b', 12);
  const s = shell('ap', b.inner, b.css);
  return single('api-positions', {
    ...s,
    duration: 4,
    buildJs: `const b = (n) => root.querySelector('.ap-b' + n);
tl.addLabel('intro', 0.3);
tl.to(b(1), { x: 300, duration: 0.6 })
  .to(b(2), { x: 300, duration: 0.6 }, '-=0.3')
  .to(b(3), { x: 300, duration: 0.5 }, '+=0.2')
  .to(b(4), { x: 300, duration: 0.4 }, '<')
  .to(b(5), { x: 300, duration: 0.4 }, '>')
  .to(b(6), { x: 300, duration: 0.4 }, '<0.2')
  .to(b(7), { x: 300, duration: 0.4 }, '>-0.1')
  .to(b(8), { x: 300, duration: 0.5 }, 'intro')
  .to(b(9), { x: 300, duration: 0.5 }, 'intro+=0.4')
  .to(b(10), { x: 300, duration: 0.5, delay: 0.3 }, 1.0)
  .to(b(11), { x: 300 });
tl.to(b(12), { x: 300, duration: 0.3 }, 3.2);`
  });
}

function apiStagger(): GoldenCase {
  const rows = Array.from({ length: 6 }, (_, r) =>
    `    <div class="as-row as-row${r + 1}" data-moo-layer="row${r + 1}">${Array.from({ length: 7 }, () => '<i></i>').join('')}</div>`
  ).join('\n');
  const s = shell(
    'ast',
    rows,
    `.ast .as-row { position: absolute; left: 90px; width: 900px; height: 100px; }
${Array.from({ length: 6 }, (_, r) => `.ast .as-row${r + 1} { top: ${200 + r * 260}px; }`).join('\n')}
.ast .as-row i { display: inline-block; width: 100px; height: 100px; margin-right: 28px; background: var(--moo-primary); }`
  );
  return single('api-stagger', {
    ...s,
    duration: 3,
    buildJs: `tl.from(root.querySelectorAll('.as-row1 i'), { y: 100, opacity: 0, duration: 0.4, stagger: 0.1 }, 0.1);
tl.from('.as-row2 i', { scale: 0, duration: 0.5, stagger: { each: 0.08, from: 'center' } }, 0.3);
tl.to('.as-row3 i', { rotation: 180, duration: 0.6, stagger: { amount: 0.5, from: 'end' } }, 0.5);
tl.to('.as-row4 i', { y: -80, duration: 0.4, stagger: { each: 0.1, from: 'edges' } }, 0.8);
tl.to('.as-row5 i', { x: 60, duration: 0.4, stagger: { each: 0.1, from: 3 } }, 1.1);
tl.fromTo('.as-row6 i', { opacity: 0.2 }, { opacity: 1, duration: 0.3, stagger: { amount: 0.6 } }, 1.4);`
  });
}

function apiRepeat(): GoldenCase {
  const b = boxes('ar', 4);
  const s = shell('arp', b.inner, b.css);
  return single('api-repeat-yoyo', {
    ...s,
    duration: 3,
    buildJs: `tl.to('.ar1', { x: 400, duration: 0.5, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0);
tl.to('.ar2', { rotation: 360, duration: 0.7, repeat: 2, repeatDelay: 0.2, ease: 'none' }, 0.2);
tl.to('.ar3', { scale: 1.5, duration: 0.4, repeat: -1, yoyo: true }, 0);
tl.to('.ar4', { y: 200, duration: 0.3, repeat: 1, yoyo: true, repeatDelay: 0.3, ease: 'back.out(2)' }, 1.0);`
  });
}

function apiKeyframes(): GoldenCase {
  const b = boxes('ak', 2);
  const s = shell('akf', b.inner, b.css);
  return single('api-keyframes', {
    ...s,
    duration: 3,
    buildJs: `tl.to('.ak1', { keyframes: [
  { x: 200, duration: 0.4 },
  { y: 300, duration: 0.5, ease: 'back.out(1.7)' },
  { x: 0, rotation: 90, duration: 0.6 },
  { scale: 0.5, opacity: 0.4, duration: 0.3, ease: 'none' }
] }, 0.1);
tl.to('.ak2', { keyframes: [{ x: -150, duration: 0.3 }, { x: 150, duration: 0.3 }, { x: 0, duration: 0.3 }], ease: 'none' }, 1.0);`
  });
}

function apiTransforms(): GoldenCase {
  const b = boxes(
    'at',
    8,
    `.at8 { transform: rotate(15deg) translateX(20px); }
.at-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }`
  );
  const s = shell(
    'atr',
    `${b.inner}
    <svg class="at-svg" data-moo-layer="svg" viewBox="0 0 1080 1920">
      <rect class="at-svg-rect" x="500" y="300" width="200" height="120" fill="var(--moo-primary)"/>
      <circle class="at-svg-circle" cx="740" cy="1400" r="50" fill="var(--moo-accent)"/>
      <g class="at-svg-g"><rect x="500" y="800" width="120" height="120" fill="#e11d48"/></g>
      <rect class="at-svg-pre" x="0" y="0" width="100" height="100" transform="translate(600 1600) rotate(10)" fill="#22c55e"/>
    </svg>`,
    b.css
  );
  return single('api-transforms', {
    ...s,
    duration: 3,
    buildJs: `tl.to('.at1', { x: 200, y: -100, rotation: 45, duration: 1 }, 0);
tl.to('.at2', { xPercent: -50, yPercent: 100, scaleX: 1.5, scaleY: 0.5, duration: 1 }, 0.2);
tl.to('.at3', { x: '50%', y: '20px', skewX: 20, skewY: -10, duration: 1 }, 0.4);
tl.fromTo('.at4', { rotationY: -80, transformPerspective: 800 }, { rotationY: 0, duration: 1.2, ease: 'power2.out' }, 0.6);
tl.to('.at5', { rotationX: 60, scale: 0.8, transformOrigin: '50% 100%', duration: 1 }, 0.8);
tl.to('.at6', { rotation: -90, transformOrigin: 'left top', duration: 1 }, 1.0);
tl.set('.at7', { scale: 1.3, rotation: 10, x: 40 }, 1.5);
tl.to('.at8', { scale: 0, duration: 0.5 }, 2.0);
tl.to('.at-svg-rect', { rotation: 90, transformOrigin: '50% 50%', duration: 1.5 }, 0);
tl.to('.at-svg-circle', { rotation: 180, svgOrigin: '540 1400', duration: 1.5 }, 0.3);
tl.to('.at-svg-g', { x: 100, y: 50, scale: 1.2, duration: 1 }, 0.5);
tl.from('.at-svg-pre', { scale: 0, transformOrigin: '50% 50%', duration: 0.8 }, 1.0);`
  });
}

function apiCss(): GoldenCase {
  const s = shell(
    'acs',
    [
      'ac-op', 'ac-aa', 'ac-aa2', 'ac-size', 'ac-pos', 'ac-type', 'ac-color', 'ac-color2', 'ac-color3',
      'ac-clip', 'ac-clip2', 'ac-clip3', 'ac-filter', 'ac-shadow', 'ac-mismatch'
    ]
      .map((c) => `    <div class="ac ${c}" data-moo-layer="${c}">${c === 'ac-type' ? 'Aa' : ''}</div>`)
      .join('\n'),
    `.acs .ac { position: absolute; width: 200px; height: 100px; background: var(--moo-primary); color: #ffffff; }
.acs .ac-op { left: 60px; top: 100px; } .acs .ac-aa { left: 60px; top: 240px; } .acs .ac-aa2 { left: 60px; top: 380px; }
.acs .ac-size { left: 60px; top: 520px; } .acs .ac-pos { left: 60px; top: 700px; }
.acs .ac-type { left: 60px; top: 840px; font-size: 40px; font-family: 'Plus Jakarta Sans'; background: none; }
.acs .ac-color { left: 600px; top: 100px; } .acs .ac-color2 { left: 600px; top: 240px; color: rgb(10, 20, 30); }
.acs .ac-color3 { left: 600px; top: 380px; background: #444444; }
.acs .ac-clip { left: 600px; top: 520px; } .acs .ac-clip2 { left: 600px; top: 660px; clip-path: circle(70% at 50% 50%); }
.acs .ac-clip3 { left: 600px; top: 800px; }
.acs .ac-filter { left: 600px; top: 940px; filter: blur(0px) brightness(1); }
.acs .ac-shadow { left: 600px; top: 1080px; } .acs .ac-mismatch { left: 600px; top: 1220px; clip-path: inset(10% 10% 10% 10%); }`
  );
  const divergences = [
    {
      element: 'ac-mismatch',
      prop: 'clipPath',
      reason: 'inset() -> circle() cannot be interpolated; MooTween switches at the end (spec 4.5), GSAP morphs number by number'
    },
    {
      element: 'ac-type',
      prop: 'letterSpacing',
      reason: "GSAP leaves letter-spacing at 'normal'; MooTween animates it from 0px as the scene asks (spec 4.5)"
    }
  ];
  return single('api-css', {
    ...s,
    duration: 3,
    buildJs: `tl.to('.ac-op', { opacity: 0.2, duration: 1 }, 0);
tl.fromTo('.ac-aa', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0.3);
tl.to('.ac-aa2', { autoAlpha: 0, duration: 0.5 }, 1.0);
tl.to('.ac-size', { width: 600, height: '8%', borderRadius: '50%', duration: 1 }, 0.2);
tl.to('.ac-pos', { left: 500, top: '45%', duration: 1 }, 0.4);
tl.to('.ac-type', { fontSize: 120, letterSpacing: 24, duration: 1 }, 0.3);
tl.to('.ac-color', { color: '#ff0055', backgroundColor: 'hsl(200, 80%, 50%)', duration: 1 }, 0.5);
tl.to('.ac-color2', { backgroundColor: 'rgba(255, 200, 0, 0.5)', color: 'teal', duration: 1 }, 0.8);
tl.to('.ac-color3', { backgroundColor: 'var(--moo-accent)', duration: 0.8 }, 1.2);
tl.fromTo('.ac-clip', { clipPath: 'inset(0% 50% 0% 50%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1 }, 0.3);
tl.to('.ac-clip2', { clipPath: 'circle(10% at 50% 50%)', duration: 1 }, 0.6);
tl.fromTo('.ac-clip3', { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 1 }, 1.0);
tl.to('.ac-filter', { filter: 'blur(12px) brightness(1.5)', duration: 1 }, 0.4);
tl.fromTo('.ac-shadow', { boxShadow: '0px 0px 0px rgba(0,0,0,0)' }, { boxShadow: '0px 20px 40px rgba(132,204,22,0.8)', duration: 1 }, 0.6);
tl.to('.ac-mismatch', { clipPath: 'circle(30% at 50% 50%)', duration: 0.8 }, 1.4);`
  }, undefined, { divergences });
}

function apiSvg(): GoldenCase {
  const s = shell(
    'asv',
    `    <svg class="as-svg" data-moo-layer="svg" viewBox="0 0 1080 1920">
      <path class="as-path" d="M100 300 L 980 300 L 980 600" fill="none" stroke="var(--moo-accent)" stroke-width="10"/>
      <line class="as-dash" x1="100" y1="760" x2="980" y2="760" stroke="#ffffff" stroke-width="8" stroke-dasharray="10 30"/>
      <circle class="as-c" cx="300" cy="1000" r="80" fill="#f59e0b" stroke="#ffffff" stroke-width="6"/>
      <circle class="as-c2" cx="700" cy="1000" r="60" fill="#22c55e"/>
      <path class="as-morph" d="M100 1200 L 540 1500 L 980 1200" fill="none" stroke="#38bdf8" stroke-width="8"/>
      <rect class="as-rect" x="100" y="1600" width="100" height="100" fill="#e11d48"/>
      <circle class="as-stroke-w" cx="540" cy="1800" r="60" fill="none" stroke="#ffffff" stroke-width="2"/>
    </svg>`,
    `.asv .as-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }`
  );
  return single('api-svg', {
    ...s,
    duration: 3,
    buildJs: `tl.fromTo('.as-path', { strokeDasharray: 1200, strokeDashoffset: 1200 }, { strokeDashoffset: 0, duration: 1.2 }, 0);
tl.to('.as-dash', { strokeDasharray: '40 10', duration: 1 }, 0.3);
tl.to('.as-c', { fill: '#38bdf8', stroke: 'rgb(255, 0, 100)', duration: 1 }, 0.2);
tl.to('.as-c2', { attr: { cx: 800, cy: 400, r: 120 }, duration: 1 }, 0.5);
tl.to('.as-morph', { attr: { d: 'M100 1200 L 540 900 L 980 1200' }, duration: 1 }, 0.8);
tl.to('.as-rect', { attr: { width: 400, height: 50 }, duration: 0.8 }, 1.2);
tl.to('.as-stroke-w', { strokeWidth: 20, duration: 1 }, 0.4);`
  });
}

function apiRelative(): GoldenCase {
  const b = boxes('ar2', 4);
  const s = shell('arl', b.inner, b.css);
  return single('api-relative-overlap', {
    ...s,
    duration: 3,
    buildJs: `const a = root.querySelector('.ar21');
tl.to(a, { x: 200, duration: 0.5 }, 0)
  .to(a, { x: '+=150', rotation: '+=45', duration: 0.5 })
  .to(a, { x: '-=100', y: '-=80', duration: 0.5 })
  .to(a, { rotation: '-=90', scale: 1.5, duration: 0.5 });
const b = root.querySelector('.ar22');
tl.to(b, { x: 300, duration: 1.0 }, 0.2);
tl.to(b, { x: -100, duration: 0.6 }, 0.6);
tl.to(b, { opacity: 0.3, duration: 0.4 }, 0.8);
const c = root.querySelector('.ar23');
tl.to(c, { y: 400, duration: 0.6 }, 1.2);
tl.to(c, { y: 0, x: 100, duration: 0.6 }, 0.4);
tl.to(root.querySelector('.ar24'), { opacity: '-=0.5', duration: 0.5 }, 1.5);`
  });
}

// Left out on purpose: tl.to(el, { x }) followed by a later tl.from(el, { x }). GSAP's result depends on
// whether its ticker fired while the runtime waited for fonts, so it cannot serve as a reference.
function apiFromImmediate(): GoldenCase {
  const b = boxes('af', 6);
  const s = shell('afi', b.inner, b.css);
  return single('api-from-immediate', {
    ...s,
    duration: 3,
    buildJs: `tl.from('.af1', { x: -300, opacity: 0, duration: 0.6 }, 1.0);
tl.to('.af1', { y: 200, duration: 0.5 }, 2.0);
tl.fromTo('.af2', { scale: 0 }, { scale: 1, duration: 0.5, immediateRender: false }, 1.2);
tl.fromTo('.af3', { rotation: -90 }, { rotation: 0, duration: 0.5 }, 1.4);
tl.from('.af4', { y: 100, duration: 0.4, immediateRender: false }, 0.8);
tl.set('.af5', { opacity: 0.25 }, 0.5).set('.af5', { opacity: 1, x: 120 }, 1.5).set('.af5', { backgroundColor: '#ff0000' }, 2.2);
tl.set('.af6', { x: 100 }, 0);
tl.set('.af6', { y: 100 });`
  });
}

function apiCallbacks(): GoldenCase {
  const s = shell(
    'acb',
    `    <div class="cb-out" data-moo-layer="out">P0</div>
    <div class="cb-log" data-moo-layer="log">-</div>
    <div class="cb-box" data-moo-layer="box"></div>
    <div class="cb-bar" data-moo-layer="bar"></div>`,
    `.acb .cb-out, .acb .cb-log { position: absolute; left: 100px; font: 800 90px/1 'JetBrains Mono'; }
.acb .cb-out { top: 200px; } .acb .cb-log { top: 400px; }
.acb .cb-box { position: absolute; left: 100px; top: 700px; width: 150px; height: 150px; background: var(--moo-accent); }
.acb .cb-bar { position: absolute; left: 100px; top: 1000px; width: 0px; height: 60px; background: var(--moo-primary); }`
  );
  return single('api-callbacks', {
    ...s,
    duration: 3,
    buildJs: `const out = root.querySelector('.cb-out');
const log = root.querySelector('.cb-log');
const state = { p: 0 };
let starts = 0;
let completes = 0;
tl.to(state, { p: 100, duration: 1.5, ease: 'none', onUpdate: function() { out.textContent = 'P' + Math.round(state.p); } }, 0.3);
tl.to(root.querySelector('.cb-box'), {
  x: 300,
  duration: 0.5,
  onStart: function() { starts++; log.textContent = 'S' + starts + ' C' + completes; },
  onComplete: function() { completes++; log.textContent = 'S' + starts + ' C' + completes; }
}, 1.0);
tl.to({ v: 0 }, { v: 1, duration: 0.4, onUpdate: function() { root.querySelector('.cb-bar').style.width = Math.round(this.progress() * 500) + 'px'; } }, 2.0);`
  });
}

function apiUtilsNested(): GoldenCase {
  const dots = Array.from({ length: 6 }, (_, i) => `    <div class="au-dot" data-moo-layer="dot${i + 1}" style="top:${300 + i * 120}px"></div>`).join('\n');
  const s = shell(
    'aun',
    `${dots}
    <div class="au-pre" data-moo-layer="pre"></div>
    <div class="an-a" data-moo-layer="na"></div><div class="an-b" data-moo-layer="nb"></div>
    <div class="an-c" data-moo-layer="nc"></div><div class="an-d" data-moo-layer="nd"></div>`,
    `.aun .au-dot { position: absolute; left: 490px; width: 100px; height: 100px; border-radius: 50%; background: var(--moo-accent); }
.aun .au-pre, .aun .an-a, .aun .an-b, .aun .an-c, .aun .an-d { position: absolute; left: 100px; width: 120px; height: 120px; background: var(--moo-primary); }
.aun .au-pre { top: 1100px; } .aun .an-a { top: 1260px; } .aun .an-b { top: 1420px; left: 400px; }
.aun .an-c { top: 1580px; } .aun .an-d { top: 1740px; }`
  );
  return single('api-utils-nested', {
    ...s,
    duration: 3.5,
    buildJs: `const u = gsap.utils;
const dots = u.toArray(root.querySelectorAll('.au-dot'));
dots.forEach((d, i) => {
  tl.to(d, {
    x: u.mapRange(0, dots.length - 1, -300, 300, i),
    y: u.wrap([-100, 0, 100], i),
    rotation: u.clamp(0, 90, i * 30),
    opacity: u.interpolate(0.2, 1, i / (dots.length - 1)),
    duration: 0.8
  }, 0.2 + i * 0.1);
});
gsap.set(root.querySelector('.au-pre'), { x: 50, rotation: 5 });
tl.to(root.querySelector('.au-pre'), { x: 250, duration: 1 }, 1.0);
const child = gsap.timeline();
child.to(root.querySelector('.an-a'), { x: 300, duration: 0.6 }).to(root.querySelector('.an-b'), { y: -100, duration: 0.6 }, '-=0.2');
tl.add(child, 0.5);
const child2 = gsap.timeline();
child2.fromTo(root.querySelector('.an-c'), { scale: 0.5 }, { scale: 1.2, duration: 0.8 });
tl.add(child2, '+=0.3');
tl.to(root.querySelector('.an-d'), { rotation: 90, duration: 0.5 }, '<');`
  });
}

function apiEmptyTargets(): GoldenCase {
  const s = shell(
    'aet',
    `    <div class="ae-real" data-moo-layer="real"></div>`,
    `.aet .ae-real { position: absolute; left: 100px; top: 900px; width: 200px; height: 200px; background: var(--moo-accent); }`
  );
  return single('api-empty-targets', {
    ...s,
    duration: 2.5,
    buildJs: `tl.to('.does-not-exist', { x: 100, duration: 0.5 }, 0);
tl.to([], { x: 100 }, 0.2);
tl.from(root.querySelectorAll('.nope'), { opacity: 0 }, 0.3);
tl.to(null, { x: 1 }, 0.4);
tl.to(root.querySelector('.ae-real'), { x: 600, duration: 1 }, 0.5);`
  });
}

const EASES = [
  'none', 'linear', 'power0.out', 'power1.in', 'power1.out', 'power1.inOut', 'power2.in', 'power2.out', 'power2.inOut',
  'power3.in', 'power3.out', 'power3.inOut', 'power4.in', 'power4.out', 'power4.inOut', 'quad.out', 'cubic.inOut',
  'quart.in', 'quint.out', 'sine.in', 'sine.out', 'sine.inOut', 'expo.in', 'expo.out', 'expo.inOut', 'circ.in',
  'circ.out', 'circ.inOut', 'back.in(1.7)', 'back.out(1.7)', 'back.inOut(2)', 'back.out', 'elastic.out(1, 0.3)',
  'elastic.in', 'elastic.inOut(1.2, 0.5)', 'bounce.out', 'bounce.in', 'bounce.inOut', 'steps(5)', 'power2', 'expo',
  'unknownEase.out'
];

function apiEases(): GoldenCase {
  const s = shell(
    'aeg',
    EASES.map((e, i) => `    <div class="eg eg${i}" data-moo-layer="ease-${i}" style="top:${40 + i * 44}px"></div>`).join('\n'),
    `.aeg .eg { position: absolute; left: 60px; width: 36px; height: 36px; background: var(--moo-accent); }`
  );
  return single('api-eases', {
    ...s,
    duration: 2.6,
    buildJs: EASES.map((e, i) => `tl.to(root.querySelector('.eg${i}'), { x: 800, duration: 2, ease: '${e}' }, 0.2);`).join('\n')
  });
}

function apiOverrides(): GoldenCase[] {
  const s = shell(
    'aov',
    `    <div class="ao-title" data-moo-layer="title">TITLE</div>
    <div class="ao-box" data-moo-layer="box"></div>
    <svg class="ao-icon" data-moo-layer="icon" viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="#38bdf8"/></svg>
    <div class="ao-static" data-moo-layer="static"></div>`,
    `.aov .ao-title { position: absolute; left: 140px; top: 300px; width: 800px; text-align: center; font: 900 140px/1 'Syne'; }
.aov .ao-box { position: absolute; left: 390px; top: 800px; width: 300px; height: 300px; background: var(--moo-accent); }
.aov .ao-icon { position: absolute; left: 440px; top: 1300px; width: 200px; height: 200px; }
.aov .ao-static { position: absolute; left: 100px; top: 1600px; width: 200px; height: 120px; background: #e11d48; }`
  );
  const overrides: Record<string, LayerOverride> = {
    title: { x: 40, y: -60, scale: 1.2, rotation: 8 },
    box: { x: -100, opacity: 0.5, flipX: true },
    icon: { scale: 0.8, color: '#ff0066' },
    static: { x: 300, y: 50, rotation: -15 }
  };
  const shot: Omit<ShotSpec, 'id'> = {
    ...s,
    duration: 3,
    overrides,
    buildJs: `tl.from(root.querySelector('.ao-title'), { y: 120, opacity: 0, duration: 0.6, ease: 'expo.out' }, 0.2);
tl.to(root.querySelector('.ao-box'), { rotation: 45, scale: 1.3, duration: 1.2 }, 0.4);
tl.fromTo(root.querySelector('.ao-icon'), { scale: 0.5 }, { scale: 1, x: 120, duration: 1, ease: 'back.out(1.7)' }, 0.6);`
  };
  // GSAP folds overrides baked into the document into its own transform and then loses them; MooTween
  // leaves CSS translate/scale/rotate alone, so the export must look exactly like the editor preview.
  return [
    single('api-overrides-export', shot, undefined, { mooTweenReference: 'api-overrides-live' }),
    single('api-overrides-live', shot, undefined, { liveOverrides: true })
  ];
}

/* ------------------------------------------------------------------ *
 * 6. Real projects
 * ------------------------------------------------------------------ */
function demoProjectCase(): GoldenCase {
  return { name: 'demo-project', project: DEMO_PROJECT };
}

/**
 * tests/fixtures/scenes/*.json — either a project backup (Project Manager → export, format
 * "mooscript-project") or { name?, width, height, scenes: [{ html, css, buildJs, duration, ... }] }.
 * Every shot runs as its own composition.
 */
const SCENE_FIXTURES = import.meta.glob('../fixtures/scenes/*.json', { eager: true, import: 'default' }) as Record<string, any>;

function fixtureCases(): GoldenCase[] {
  const cases: GoldenCase[] = [];
  for (const [path, data] of Object.entries(SCENE_FIXTURES).sort(([a], [b]) => a.localeCompare(b))) {
    const file = path.split('/').pop()!.replace(/\.json$/, '');
    const project = data && data.format === 'mooscript-project' ? data.project : null;
    const size: ProjectSize = {
      width: project?.composition?.width || project?.width || data?.width || 1080,
      height: project?.composition?.height || project?.height || data?.height || 1920
    };
    const shots: Omit<ShotSpec, 'id'>[] = project
      ? (project.composition?.scenes || [])
          .filter((m: GeneratedScene) => m.status === 'ok' && (m.buildJs || '').trim() && (m.html || '').trim())
          .map((m: GeneratedScene) => {
            const ts = (project.scenes || []).find((sc: Scene) => sc.id === m.beatId);
            return {
              html: m.html,
              css: m.css,
              buildJs: m.buildJs,
              duration: ts?.durationInSeconds || m.duration || 3,
              words: ts?.wordTimestamps || [],
              overrides: m.overrides,
              palette: m.palette
            };
          })
      : (data?.scenes || []).map((sc: any) => ({
          html: sc.html,
          css: sc.css || '',
          buildJs: sc.buildJs || '',
          duration: sc.duration || 3,
          words: sc.wordTimestamps || sc.words || [],
          overrides: sc.overrides,
          palette: sc.palette
        }));
    shots.forEach((shot, i) => cases.push(single(`ai-${file}-${String(i + 1).padStart(2, '0')}`, shot, size)));
  }
  return cases;
}

export function buildCorpus(): GoldenCase[] {
  return [
    ...referenceCases(),
    ...directorCases(),
    ...proceduralCases(),
    ...kitCameraCases(),
    kitDrawPopHero(),
    kitKinetic(),
    kitAccents(),
    kitAmbient(),
    ...transitionCases(),
    apiPositions(),
    apiStagger(),
    apiRepeat(),
    apiKeyframes(),
    apiTransforms(),
    apiCss(),
    apiSvg(),
    apiRelative(),
    apiFromImmediate(),
    apiCallbacks(),
    apiUtilsNested(),
    apiEmptyTargets(),
    apiEases(),
    ...apiOverrides(),
    demoProjectCase(),
    ...fixtureCases()
  ];
}
