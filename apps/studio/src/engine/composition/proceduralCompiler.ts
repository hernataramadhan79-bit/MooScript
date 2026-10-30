import type { GeneratedScene, MooProject, Scene, ScenePalette } from '../../types';
import { extractLayersFromHtml } from './layers';

export type ProceduralArchetype =
  | 'auto'
  | 'kinetic-impact'
  | 'glass-spotlight'
  | 'stat-counter'
  | 'code-terminal'
  | 'split-versus'
  | 'bento-list'
  | 'social-quote'
  | 'chart-data';

export interface ProceduralArchetypeInfo {
  id: ProceduralArchetype;
  label: string;
  description: string;
  badge: string;
  icon: string;
}

export const PROCEDURAL_ARCHETYPES: ProceduralArchetypeInfo[] = [
  {
    id: 'auto',
    label: 'Cerdas Otomatis (Auto)',
    description: 'Deteksi otomatis tata letak terbaik dari isi kalimat, angka, atau daftar pada naskah.',
    badge: 'AI-Rule',
    icon: 'auto_awesome'
  },
  {
    id: 'kinetic-impact',
    label: 'Kinetic Impact Slam',
    description: 'Tipografi kinetik besar dengan aksen kata menyala dan partikel geometris.',
    badge: 'Hook',
    icon: 'bolt'
  },
  {
    id: 'glass-spotlight',
    label: 'Glass Card Spotlight',
    description: 'Kartu kaca modern (glassmorphism) dengan lencana fokus dan poin sorotan.',
    badge: 'Explainer',
    icon: 'dashboard'
  },
  {
    id: 'stat-counter',
    label: 'Big Stat & Counter',
    description: 'Sorotan angka/persentase raksasa dengan grafik progres radial & bar.',
    badge: 'Data',
    icon: 'monitoring'
  },
  {
    id: 'code-terminal',
    label: 'Code & Terminal Window',
    description: 'Jendela kode bergaya macOS gelap dengan efek pengetikan baris demi baris.',
    badge: 'Tech',
    icon: 'terminal'
  },
  {
    id: 'split-versus',
    label: 'Split VS Comparison',
    description: 'Perbandingan dua sisi (Cara Lama vs Cara Baru / Pro vs Kontra) secara kontras.',
    badge: 'Compare',
    icon: 'compare_arrows'
  },
  {
    id: 'bento-list',
    label: 'Staggered Bento List',
    description: 'Susunan kartu poin bernomor yang muncul berurutan secara dinamis.',
    badge: 'List',
    icon: 'format_list_bulleted'
  },
  {
    id: 'social-quote',
    label: 'Editorial Quote Card',
    description: 'Kartu kutipan sinematik dengan tanda kutip besar dan indikator gelombang.',
    badge: 'Story',
    icon: 'format_quote'
  },
  {
    id: 'chart-data',
    label: 'Animated Growth Chart',
    description: 'Grafik batang & kurva pertumbuhan SVG yang tumbuh mengikuti timeline.',
    badge: 'Chart',
    icon: 'bar_chart'
  }
];

function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Layers that carry each archetype's frame 0: they start visible so the editor's still is never empty.
const POSTER_LAYERS: Record<Exclude<ProceduralArchetype, 'auto'>, string[]> = {
  'stat-counter': ['card'],
  'code-terminal': ['term'],
  'split-versus': ['title', 'leftCard', 'rightCard'],
  'bento-list': ['title'],
  'chart-data': ['title', 'card'],
  'social-quote': ['card'],
  'glass-spotlight': ['card'],
  'kinetic-impact': ['title']
};

const CAMERA_MOVES = ['push', 'pan-left', 'roll', 'pull', 'pan-up'];

/** Puts everything inside the stage into a .moo-camera layer that ctx.camera can move. */
function wrapInCamera(html: string, sid: string): string {
  const open = `<div class="${sid}-stage">`;
  const close = html.lastIndexOf('</div>');
  if (!html.startsWith(open) || close < open.length) return html;
  return `${open}\n  <div class="moo-camera" data-moo-layer="camera">${html.slice(open.length, close)}  </div>\n</div>`;
}

/** Starts the poster layers visible (opacity 1) instead of fading them in from nothing. */
function keepPosterLayersVisible(buildJs: string, layers: string[]): string {
  return layers.reduce(
    (js, name) => js.replace(new RegExp(`(\\.travel\\(${name}, \\{[^}]*?)opacity: 0(?=[ ,}])`), '$1opacity: 1'),
    buildJs
  );
}

const STOP_WORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'adalah',
  'dalam', 'tidak', 'bisa', 'akan', 'atau', 'juga', 'karena', 'oleh', 'saat', 'lebih',
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'what', 'all', 'when', 'can', 'there', 'into'
]);

type ConcreteArchetype = Exclude<ProceduralArchetype, 'auto'>;

interface KeyPhrases {
  headline: string;
  accentWord: string;
  subtext: string;
  /** Up to 22 words of the narration, for layouts that show the whole line. */
  fullText: string;
  /** Clauses of the narration; empty when it has fewer than two. Never invented. */
  chips: string[];
  /** The two things a comparison compares; empty when the narration does not name two. */
  sides: string[];
  detectedNumber: string | null;
  /** Every number written in the narration, in order. */
  numbers: string[];
}

const NUMBER_RE = /\+?\d+(?:[.,]\d+)?(?:\s*%|\s*x|\s*X|\s*kali|\s*jt|\s*M|\s*K|\+)?/g;
const FALLING_RE = /(turun|menurun|anjlok|merosot|berkurang|menyusut|\bdrop|declin|fall|decreas)/i;
const TREND_RE = /(grafik|chart|tren|pertumbuhan|tumbuh|statistik|kurva|naik|lonjakan|turun|menurun|anjlok|merosot|growth|trend)/i;

function extractKeyPhrases(text: string): KeyPhrases {
  const clean = (text || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);

  // Numbers / percentages / multipliers exactly as the narration writes them
  const numbers = Array.from(clean.matchAll(NUMBER_RE), (m) => m[0].trim());
  const detectedNumber = numbers[0] ?? null;

  // Pick strongest accent word
  const candidates = words
    .map((w) => w.replace(/[^a-zA-Z0-9%+]/g, ''))
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
  const accentWord = candidates[0] || words[0] || '';

  // Split headline (first 6 words) and subtext (remaining). A short line is all headline,
  // so the same words never show twice.
  const headline = words.slice(0, 6).join(' ');
  const subtext = words.length > 6 ? words.slice(6, 22).join(' ') : '';
  const fullText = words.slice(0, 22).join(' ');

  // Up to 3 short chips from the narration's own clauses
  const clauses = clean
    .split(/[,.;:!?—-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  const chips = clauses.length >= 2 ? clauses.slice(0, 3).map((c) => c.split(/\s+/).slice(0, 5).join(' ')) : [];

  // The two sides of a comparison: "A vs B" / "A dibanding B", else the first two clauses.
  const versusParts = clean
    .split(/\s+(?:vs\.?|versus|dibanding(?:kan)?|lawan)\s+/i)
    .map((s) => s.replace(/[.,;:!?]+$/, '').trim())
    .filter(Boolean);
  const sides = (versusParts.length === 2 ? versusParts : chips.slice(0, 2)).map((s) =>
    s.split(/\s+/).slice(0, 5).join(' ')
  );

  return { headline, accentWord, subtext, fullText, chips, sides, detectedNumber, numbers };
}

/**
 * What each layout needs from the narration before it may be used. A layout without its data
 * would have to show numbers, trends or list items the script never said.
 */
function archetypeHasData(archetype: ConcreteArchetype, phrases: KeyPhrases, narration: string): boolean {
  switch (archetype) {
    case 'stat-counter':
      return phrases.detectedNumber !== null;
    case 'chart-data':
      return phrases.numbers.length >= 2 || TREND_RE.test(narration);
    case 'split-versus':
      return phrases.sides.length === 2;
    case 'bento-list':
      return phrases.chips.length >= 2;
    default:
      return Boolean(phrases.headline);
  }
}

/** Layouts that work with any line of narration, used when nothing more specific fits. */
const ROTATION: ConcreteArchetype[] = ['kinetic-impact', 'glass-spotlight', 'social-quote'];

/** Layouts in order of fit for this scene: content matches first, then the rotation. */
function rankArchetypes(scene: Scene, index: number): ConcreteArchetype[] {
  const combined = `${scene.narrationText || ''} ${scene.text || ''} ${scene.visualIntent || ''} ${scene.visualConcept || ''}`.toLowerCase();
  const ranked: ConcreteArchetype[] = [];

  if (/(\bvs\b|versus|banding|lama\s+vs|baru\s+vs|sebelum|sesudah|kontras)/i.test(combined)) {
    ranked.push('split-versus');
  }
  if (/(kode|code|terminal|script|function|const\s|api|algoritma|developer|program)/i.test(combined)) {
    ranked.push('code-terminal');
  }
  if (TREND_RE.test(combined)) {
    ranked.push('chart-data');
  }
  if (/(\d+\s*%|\d+x\b|\$\d+|\bRp\s*\d+|\bangka\b|\bmetrik\b|\bpersen\b|\bkecepatan\b)/i.test(combined)) {
    ranked.push('stat-counter');
  }
  if (/(1\.|2\.|\bpertama\b|\bkedua\b|\bketiga\b|\blangkah\b|\bdaftar\b|\bpoin\b|\btips\b|\bcara\b)/i.test(combined)) {
    ranked.push('bento-list');
  }
  if (/("|“|kutipan|quote|kata\s+mereka|filosofi|cerita|kisah|ingatlah)/i.test(combined)) {
    ranked.push('social-quote');
  }
  for (let i = 0; i < ROTATION.length; i++) {
    ranked.push(ROTATION[(index + i) % ROTATION.length]);
  }
  return Array.from(new Set(ranked));
}

/**
 * Picks the layout for a scene. 'auto' takes the best fit that has its data and differs from the
 * previous shot's layout; an explicit choice is kept unless the narration lacks its data.
 */
export function resolveProceduralArchetype(
  scene: Scene,
  index: number,
  archetype: ProceduralArchetype = 'auto',
  previous?: ConcreteArchetype
): ConcreteArchetype {
  const narration = scene.narrationText || scene.text || '';
  const phrases = extractKeyPhrases(narration);
  const usable = (a: ConcreteArchetype) => archetypeHasData(a, phrases, narration);

  if (archetype !== 'auto' && usable(archetype)) return archetype;

  const ranked = rankArchetypes(scene, index).filter(usable);
  return ranked.find((a) => a !== previous) || ranked[0] || 'kinetic-impact';
}

export function detectBestArchetype(scene: Scene, index: number, previous?: ConcreteArchetype): ConcreteArchetype {
  return resolveProceduralArchetype(scene, index, 'auto', previous);
}

/** Bar heights for the chart: the narration's own numbers, or an unlabeled rise/fall when it only names a trend. */
function chartBars(phrases: KeyPhrases, narration: string): { height: number; label: string }[] {
  const values = phrases.numbers
    .map((n) => ({ label: n, value: Math.abs(parseFloat(n.replace(/^\+/, '').replace(',', '.'))) }))
    .filter((v) => Number.isFinite(v.value))
    .slice(0, 4);
  if (values.length >= 2) {
    const max = Math.max(...values.map((v) => v.value)) || 1;
    return values.map((v) => ({ height: Math.max(12, Math.round((v.value / max) * 200)), label: v.label }));
  }
  const rising = [100, 140, 185, 235];
  return (FALLING_RE.test(narration) ? [...rising].reverse() : rising).map((height) => ({ height, label: '' }));
}

export function compileProceduralScene(
  scene: Scene,
  index: number,
  total: number,
  palette?: Partial<ScenePalette>,
  archetype: ProceduralArchetype = 'auto',
  previous?: ConcreteArchetype
): GeneratedScene {
  const chosen = resolveProceduralArchetype(scene, index, archetype, previous);
  const narration = scene.narrationText || scene.text || `Adegan ${index + 1}`;
  const intent = scene.visualIntent || scene.visualConcept || `Shot ${index + 1} / ${total}`;
  const duration = Math.max(1.5, scene.durationInSeconds || 3.5);
  const phrases = extractKeyPhrases(narration);
  const { headline, accentWord, subtext, fullText, chips, detectedNumber } = phrases;

  const safeIntent = escapeHtml(intent.slice(0, 48).toUpperCase());
  const safeHeadline = escapeHtml(headline);
  const safeAccent = escapeHtml(accentWord.toUpperCase());
  const safeSubtext = escapeHtml(subtext);
  const stepLabel = `${String(index + 1).padStart(2, '0')} / ${String(Math.max(1, total)).padStart(2, '0')}`;

  const sid = `p_${scene.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  let html = '';
  let css = '';
  let buildJs = '';

  const baseCss = `
.${sid}-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(circle at 20% 15%, color-mix(in srgb, var(--moo-accent, #84cc16) 14%, transparent), transparent 50%),
              radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--moo-primary, #38bdf8) 12%, transparent), transparent 55%),
              var(--moo-bg, #09090b);
  color: var(--moo-text, #f4f4f5);
  font-family: var(--moo-font-display, 'Plus Jakarta Sans', sans-serif);
}
.${sid}-stage > .moo-camera {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 7% 8%;
}
.${sid}-grid-bg {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 64px 64px;
  pointer-events: none;
}
.${sid}-orb {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--moo-accent, #84cc16) 0%, transparent 70%);
  opacity: 0.16;
  top: -80px;
  right: -80px;
  pointer-events: none;
}
.${sid}-badge {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--moo-accent, #84cc16);
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 28px;
  z-index: 2;
}
.${sid}-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--moo-accent, #84cc16);
  box-shadow: 0 0 12px var(--moo-accent, #84cc16);
}
`;

  if (chosen === 'stat-counter') {
    const statValue = escapeHtml(detectedNumber || '');
    // The bar only shows a share when the narration gives one; any other number gets no bar.
    const pct = /%$/.test(detectedNumber || '') ? parseFloat((detectedNumber || '').replace(',', '.')) : NaN;
    const barPct = Number.isFinite(pct) && pct > 0 && pct <= 100 ? Math.round(pct) : null;
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>METRIK UTAMA • ${stepLabel}</span>
  </div>
  <div data-moo-layer="Main Card" class="${sid}-stat-card">
    <div data-moo-layer="Stat Number" class="${sid}-stat-num accent">${statValue}</div>
    <h1 data-moo-layer="Headline" class="${sid}-stat-title">${safeHeadline}</h1>
    <p data-moo-layer="Subtext" class="${sid}-stat-desc">${safeSubtext}</p>${
      barPct !== null
        ? `
    <div data-moo-layer="Progress Track" class="${sid}-bar-wrap">
      <div class="${sid}-bar-fill"></div>
    </div>`
        : ''
    }
  </div>
</div>`.trim();

    css = `${baseCss}
.${sid}-stat-card {
  position: relative;
  width: 100%;
  max-width: 900px;
  padding: 56px 48px;
  border-radius: 36px;
  background: rgba(24, 24, 27, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
  text-align: center;
  z-index: 2;
}
.${sid}-stat-num {
  font-size: 128px;
  font-weight: 800;
  line-height: 1;
  color: var(--moo-accent, #84cc16);
  letter-spacing: -0.04em;
  margin-bottom: 20px;
}
.${sid}-stat-title {
  font-size: 46px;
  font-weight: 800;
  line-height: 1.18;
  color: var(--moo-primary, #ffffff);
  margin-bottom: 16px;
}
.${sid}-stat-desc {
  font-size: 28px;
  line-height: 1.45;
  color: var(--moo-text, #d4d4d8);
  opacity: 0.88;
  margin-bottom: 36px;
}
.${sid}-bar-wrap {
  width: 100%;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.${sid}-bar-fill {
  width: ${barPct ?? 0}%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--moo-accent, #84cc16), #38bdf8);
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const card = root.querySelector('[data-moo-layer="Main Card"]');
const statNum = root.querySelector('[data-moo-layer="Stat Number"]');
const headline = root.querySelector('[data-moo-layer="Headline"]');
const subtext = root.querySelector('[data-moo-layer="Subtext"]');
const barFill = root.querySelector('.${sid}-bar-fill');
const orb = root.querySelector('[data-moo-layer="Ambient Glow"]');

shot.travel(badge, { y: -30, opacity: 0 }, { y: 0, opacity: 1, dur: 0.45, curve: 'overshoot-out(1.7)' }, 0)
  .travel(card, { y: 60, scale: 0.92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, dur: 0.6, curve: 'strong-out' }, 0.1)
  .travel(statNum, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, dur: 0.65, curve: 'overshoot-out(2)' }, 0.22)
  .travel(headline, { y: 24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.45, curve: 'smooth-out' }, 0.35)
  .travel(subtext, { y: 20, opacity: 0 }, { y: 0, opacity: 0.9, dur: 0.45, curve: 'smooth-out' }, 0.45)${
    barPct !== null
      ? `
  .travel(barFill, { scaleX: 0, pivot: 'left center' }, { scaleX: 1, dur: 0.9, curve: 'strong-out' }, 0.35)`
      : ''
  }
  .go(orb, { x: -40, y: 40, scale: 1.15, dur: ${Math.max(1.5, duration - 0.2).toFixed(2)}, curve: 'gentle-inout' }, 0);
`.trim();
  } else if (chosen === 'code-terminal') {
    // The window only shows the narration's own words, as steps or as one comment line.
    const codeLines = chips.length
      ? chips.map((c, i) => `const step_${i + 1} = "${escapeHtml(c)}";`).join('\n')
      : `// ${escapeHtml(fullText)}`;
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>TERMINAL • ${stepLabel}</span>
  </div>
  <h1 data-moo-layer="Headline" class="${sid}-term-heading">${safeHeadline}</h1>
  <div data-moo-layer="Terminal Window" class="${sid}-terminal">
    <div class="${sid}-term-bar">
      <span class="${sid}-tl-dot" style="background:#ef4444"></span>
      <span class="${sid}-tl-dot" style="background:#eab308"></span>
      <span class="${sid}-tl-dot" style="background:#22c55e"></span>
      <span class="${sid}-term-title">mooscript-engine.ts</span>
    </div>
    <pre data-moo-layer="Code Block" class="${sid}-code"><code>${codeLines}${chips.length ? `\n// ${safeAccent}` : ''}</code></pre>
  </div>
  <p data-moo-layer="Subtext" class="${sid}-term-sub">${safeSubtext}</p>
</div>`.trim();

    css = `${baseCss}
.${sid}-term-heading {
  font-size: 52px;
  font-weight: 800;
  text-align: center;
  color: var(--moo-primary, #ffffff);
  margin-bottom: 32px;
  line-height: 1.15;
  z-index: 2;
}
.${sid}-terminal {
  width: 100%;
  max-width: 920px;
  border-radius: 28px;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  z-index: 2;
  margin-bottom: 28px;
}
.${sid}-term-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 24px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.${sid}-tl-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
.${sid}-term-title {
  margin-left: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 18px;
  color: #9ca3af;
}
.${sid}-code {
  padding: 36px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 26px;
  line-height: 1.65;
  color: var(--moo-accent, #84cc16);
  white-space: pre-wrap;
}
.${sid}-term-sub {
  font-size: 28px;
  text-align: center;
  color: var(--moo-text, #d4d4d8);
  max-width: 860px;
  line-height: 1.45;
  z-index: 2;
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const heading = root.querySelector('[data-moo-layer="Headline"]');
const term = root.querySelector('[data-moo-layer="Terminal Window"]');
const code = root.querySelector('[data-moo-layer="Code Block"]');
const sub = root.querySelector('[data-moo-layer="Subtext"]');

shot.travel(badge, { y: -25, opacity: 0 }, { y: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0)
  .travel(heading, { y: 30, opacity: 0 }, { y: 0, opacity: 1, dur: 0.5, curve: 'strong-out' }, 0.1)
  .travel(term, { y: 50, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, dur: 0.55, curve: 'overshoot-out(1.4)' }, 0.2)
  .travel(code, { opacity: 0, x: -20 }, { opacity: 1, x: 0, dur: 0.5, curve: 'smooth-out' }, 0.38)
  .travel(sub, { y: 20, opacity: 0 }, { y: 0, opacity: 0.9, dur: 0.45, curve: 'smooth-out' }, 0.5);
`.trim();
  } else if (chosen === 'split-versus') {
    const leftText = escapeHtml(phrases.sides[0] || '');
    const rightText = escapeHtml(phrases.sides[1] || '');
    // Side labels only claim "before/after" or "old/new" when the narration says so.
    const [leftTag, rightTag] = /(sebelum|sesudah|before|after)/i.test(narration)
      ? ['SEBELUM', 'SESUDAH']
      : /(lama|baru|\bold\b|\bnew\b)/i.test(narration)
        ? ['LAMA', 'BARU']
        : ['A', 'B'];
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>PERBANDINGAN • ${stepLabel}</span>
  </div>
  <h1 data-moo-layer="Headline" class="${sid}-vs-title">${safeHeadline}</h1>
  <div class="${sid}-vs-grid">
    <div data-moo-layer="Left Card" class="${sid}-vs-card ${sid}-vs-left">
      <div class="${sid}-vs-tag">${leftTag}</div>
      <div class="${sid}-vs-val">${leftText}</div>
    </div>
    <div data-moo-layer="VS Badge" class="${sid}-vs-pill">VS</div>
    <div data-moo-layer="Right Card" class="${sid}-vs-card ${sid}-vs-right">
      <div class="${sid}-vs-tag accent">${rightTag}</div>
      <div class="${sid}-vs-val">${rightText}</div>
    </div>
  </div>
  <p data-moo-layer="Subtext" class="${sid}-vs-sub">${safeSubtext}</p>
</div>`.trim();

    css = `${baseCss}
.${sid}-vs-title {
  font-size: 50px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 36px;
  color: var(--moo-primary, #ffffff);
  z-index: 2;
}
.${sid}-vs-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  width: 100%;
  max-width: 880px;
  z-index: 2;
  margin-bottom: 32px;
}
.${sid}-vs-card {
  width: 100%;
  padding: 36px 40px;
  border-radius: 28px;
  background: rgba(24, 24, 27, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.12);
  text-align: center;
}
.${sid}-vs-right {
  border-color: var(--moo-accent, #84cc16);
  box-shadow: 0 0 40px color-mix(in srgb, var(--moo-accent, #84cc16) 18%, transparent);
}
.${sid}-vs-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  opacity: 0.75;
  margin-bottom: 12px;
}
.${sid}-vs-val {
  font-size: 38px;
  font-weight: 800;
  color: var(--moo-primary, #ffffff);
}
.${sid}-vs-pill {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--moo-accent, #84cc16);
  color: #09090b;
  font-weight: 900;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.${sid}-vs-sub {
  font-size: 26px;
  text-align: center;
  opacity: 0.88;
  max-width: 840px;
  z-index: 2;
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const title = root.querySelector('[data-moo-layer="Headline"]');
const leftCard = root.querySelector('[data-moo-layer="Left Card"]');
const vsBadge = root.querySelector('[data-moo-layer="VS Badge"]');
const rightCard = root.querySelector('[data-moo-layer="Right Card"]');
const sub = root.querySelector('[data-moo-layer="Subtext"]');

shot.travel(badge, { y: -20, opacity: 0 }, { y: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0)
  .travel(title, { y: 25, opacity: 0 }, { y: 0, opacity: 1, dur: 0.45, curve: 'strong-out' }, 0.1)
  .travel(leftCard, { x: -80, opacity: 0 }, { x: 0, opacity: 1, dur: 0.5, curve: 'strong-out' }, 0.2)
  .travel(vsBadge, { scale: 0, spin: -45 }, { scale: 1, spin: 0, dur: 0.45, curve: 'overshoot-out(2)' }, 0.35)
  .travel(rightCard, { x: 80, opacity: 0 }, { x: 0, opacity: 1, dur: 0.5, curve: 'strong-out' }, 0.42)
  .travel(sub, { y: 20, opacity: 0 }, { y: 0, opacity: 0.9, dur: 0.4, curve: 'smooth-out' }, 0.58);
`.trim();
  } else if (chosen === 'bento-list') {
    const itemsHtml = chips
      .map(
        (chip, idx) => `
    <div data-moo-layer="List Item ${idx + 1}" class="${sid}-bento-item">
      <span class="${sid}-bento-num accent">0${idx + 1}</span>
      <span class="${sid}-bento-text">${escapeHtml(chip)}</span>
    </div>`
      )
      .join('');

    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>POIN KUNCI • ${stepLabel}</span>
  </div>
  <h1 data-moo-layer="Headline" class="${sid}-bento-title">${safeHeadline}</h1>
  <div class="${sid}-bento-list">${itemsHtml}
  </div>
  <p data-moo-layer="Subtext" class="${sid}-bento-sub">${safeSubtext}</p>
</div>`.trim();

    css = `${baseCss}
.${sid}-bento-title {
  font-size: 50px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 36px;
  color: var(--moo-primary, #ffffff);
  z-index: 2;
}
.${sid}-bento-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 880px;
  margin-bottom: 32px;
  z-index: 2;
}
.${sid}-bento-item {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 28px 34px;
  border-radius: 26px;
  background: rgba(24, 24, 27, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.${sid}-bento-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 800;
  color: var(--moo-accent, #84cc16);
}
.${sid}-bento-text {
  font-size: 32px;
  font-weight: 700;
  color: var(--moo-primary, #ffffff);
}
.${sid}-bento-sub {
  font-size: 26px;
  text-align: center;
  opacity: 0.86;
  max-width: 840px;
  z-index: 2;
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const title = root.querySelector('[data-moo-layer="Headline"]');
const items = root.querySelectorAll('.${sid}-bento-item');
const sub = root.querySelector('[data-moo-layer="Subtext"]');

shot.travel(badge, { y: -20, opacity: 0 }, { y: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0)
  .travel(title, { y: 24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.45, curve: 'strong-out' }, 0.1)
  .travel(items, { x: -50, opacity: 0 }, { x: 0, opacity: 1, dur: 0.45, cascade: 0.14, curve: 'overshoot-out(1.4)' }, 0.22)
  .travel(sub, { y: 18, opacity: 0 }, { y: 0, opacity: 0.9, dur: 0.4, curve: 'smooth-out' }, 0.55);
`.trim();
  } else if (chosen === 'chart-data') {
    const bars = chartBars(phrases, narration);
    const slot = 600 / bars.length;
    const barWidth = Math.min(110, Math.round(slot * 0.6));
    const barsSvg = bars
      .map((bar, i) => {
        const x = Math.round(slot * i + (slot - barWidth) / 2);
        const y = 260 - bar.height;
        const fill = i === bars.length - 1 ? 'var(--moo-accent, #84cc16)' : `rgba(255,255,255,${(0.18 + i * 0.1).toFixed(2)})`;
        const label = bar.label
          ? `\n      <text x="${x + barWidth / 2}" y="${Math.max(18, y - 10)}" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor">${escapeHtml(bar.label)}</text>`
          : '';
        return `      <rect class="${sid}-bar" x="${x}" y="${y}" width="${barWidth}" height="${bar.height}" rx="12" fill="${fill}" />${label}`;
      })
      .join('\n');
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>ANALISIS DATA • ${stepLabel}</span>
  </div>
  <h1 data-moo-layer="Headline" class="${sid}-chart-title">${safeHeadline}</h1>
  <div data-moo-layer="Main Card" class="${sid}-chart-card">
    <svg data-moo-layer="Chart Graphic" viewBox="0 0 600 280" class="${sid}-chart-svg">
${barsSvg}
    </svg>
    <div data-moo-layer="Accent Tag" class="${sid}-chart-caption accent">${safeAccent}</div>
  </div>
  <p data-moo-layer="Subtext" class="${sid}-chart-sub">${safeSubtext}</p>
</div>`.trim();

    css = `${baseCss}
.${sid}-chart-title {
  font-size: 50px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 32px;
  color: var(--moo-primary, #ffffff);
  z-index: 2;
}
.${sid}-chart-card {
  width: 100%;
  max-width: 880px;
  padding: 44px;
  border-radius: 32px;
  background: rgba(24, 24, 27, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.14);
  text-align: center;
  margin-bottom: 28px;
  z-index: 2;
}
.${sid}-chart-svg {
  width: 100%;
  height: auto;
  max-height: 320px;
  overflow: visible;
}
.${sid}-chart-caption {
  margin-top: 18px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 800;
  color: var(--moo-accent, #84cc16);
}
.${sid}-chart-sub {
  font-size: 27px;
  text-align: center;
  opacity: 0.88;
  max-width: 840px;
  z-index: 2;
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const title = root.querySelector('[data-moo-layer="Headline"]');
const card = root.querySelector('[data-moo-layer="Main Card"]');
const bars = root.querySelectorAll('.${sid}-bar');
const sub = root.querySelector('[data-moo-layer="Subtext"]');

shot.travel(badge, { y: -20, opacity: 0 }, { y: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0)
  .travel(title, { y: 24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.45, curve: 'strong-out' }, 0.1)
  .travel(card, { y: 40, opacity: 0 }, { y: 0, opacity: 1, dur: 0.5, curve: 'strong-out' }, 0.18)
  .travel(bars, { scaleY: 0, pivot: 'bottom center' }, { scaleY: 1, dur: 0.55, cascade: 0.12, curve: 'overshoot-out(1.6)' }, 0.28)
  .travel(sub, { y: 18, opacity: 0 }, { y: 0, opacity: 0.9, dur: 0.4, curve: 'smooth-out' }, 0.55);
`.trim();
  } else if (chosen === 'social-quote') {
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Main Card" class="${sid}-quote-card">
    <div data-moo-layer="Quote Mark" class="${sid}-quote-mark accent">“</div>
    <h1 data-moo-layer="Headline" class="${sid}-quote-text">${escapeHtml(fullText)}</h1>
    <div data-moo-layer="Badge" class="${sid}-quote-footer">
      <span class="${sid}-dot"></span>
      <span>${safeIntent}</span>
    </div>
  </div>
</div>`.trim();

    css = `${baseCss}
.${sid}-quote-card {
  width: 100%;
  max-width: 900px;
  padding: 64px 52px;
  border-radius: 36px;
  background: rgba(24, 24, 27, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
  z-index: 2;
}
.${sid}-quote-mark {
  font-size: 120px;
  line-height: 0.7;
  font-weight: 900;
  color: var(--moo-accent, #84cc16);
  margin-bottom: 24px;
}
.${sid}-quote-text {
  font-size: 46px;
  font-weight: 800;
  line-height: 1.3;
  color: var(--moo-primary, #ffffff);
  margin-bottom: 36px;
}
.${sid}-quote-footer {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--moo-accent, #84cc16);
}
`;
    buildJs = `
const card = root.querySelector('[data-moo-layer="Main Card"]');
const mark = root.querySelector('[data-moo-layer="Quote Mark"]');
const text = root.querySelector('[data-moo-layer="Headline"]');
const footer = root.querySelector('[data-moo-layer="Badge"]');

shot.travel(card, { y: 50, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, dur: 0.55, curve: 'strong-out' }, 0)
  .travel(mark, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, dur: 0.45, curve: 'overshoot-out(2)' }, 0.15)
  .travel(text, { y: 24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.5, curve: 'smooth-out' }, 0.25)
  .travel(footer, { x: -20, opacity: 0 }, { x: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0.42);
`.trim();
  } else if (chosen === 'glass-spotlight') {
    const chipsHtml = chips
      .map((c) => `<span class="${sid}-chip">${escapeHtml(c)}</span>`)
      .join('');
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>${safeIntent}</span>
  </div>
  <div data-moo-layer="Main Card" class="${sid}-glass-card">
    <div data-moo-layer="Accent Kicker" class="${sid}-kicker accent">SOROTAN ${stepLabel}</div>
    <h1 data-moo-layer="Headline" class="${sid}-glass-title">${safeHeadline}</h1>
    <p data-moo-layer="Subtext" class="${sid}-glass-body">${safeSubtext}</p>
    <div data-moo-layer="Tags Row" class="${sid}-chips">${chipsHtml}</div>
  </div>
</div>`.trim();

    css = `${baseCss}
.${sid}-glass-card {
  width: 100%;
  max-width: 900px;
  padding: 56px 48px;
  border-radius: 36px;
  background: rgba(24, 24, 27, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
  z-index: 2;
}
.${sid}-kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 800;
  color: var(--moo-accent, #84cc16);
  letter-spacing: 0.1em;
  margin-bottom: 16px;
}
.${sid}-glass-title {
  font-size: 54px;
  font-weight: 800;
  line-height: 1.15;
  color: var(--moo-primary, #ffffff);
  margin-bottom: 22px;
}
.${sid}-glass-body {
  font-size: 30px;
  line-height: 1.48;
  color: var(--moo-text, #d4d4d8);
  margin-bottom: 32px;
}
.${sid}-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.${sid}-chip {
  padding: 10px 20px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--moo-accent, #84cc16) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--moo-accent, #84cc16) 35%, transparent);
  color: var(--moo-accent, #84cc16);
  font-size: 20px;
  font-weight: 700;
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const card = root.querySelector('[data-moo-layer="Main Card"]');
const title = root.querySelector('[data-moo-layer="Headline"]');
const body = root.querySelector('[data-moo-layer="Subtext"]');
const chips = root.querySelectorAll('.${sid}-chip');

shot.travel(badge, { y: -24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0)
  .travel(card, { y: 50, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, dur: 0.55, curve: 'strong-out' }, 0.1)
  .travel(title, { y: 24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.45, curve: 'smooth-out' }, 0.24)
  .travel(body, { y: 20, opacity: 0 }, { y: 0, opacity: 0.92, dur: 0.45, curve: 'smooth-out' }, 0.34)
  .travel(chips, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, dur: 0.35, cascade: 0.1, curve: 'overshoot-out(1.7)' }, 0.44);
`.trim();
  } else {
    // Default: 'kinetic-impact'
    html = `
<div class="${sid}-stage">
  <div class="${sid}-grid-bg"></div>
  <div data-moo-layer="Ambient Glow" class="${sid}-orb"></div>
  <div data-moo-layer="Badge" class="${sid}-badge">
    <span class="${sid}-dot"></span>
    <span>${safeIntent}</span>
  </div>
  <div data-moo-layer="Accent Pill" class="${sid}-slam-pill accent">${safeAccent}</div>
  <h1 data-moo-layer="Headline" class="${sid}-slam-title">${safeHeadline}</h1>
  <p data-moo-layer="Subtext" class="${sid}-slam-sub">${safeSubtext}</p>
</div>`.trim();

    css = `${baseCss}
.${sid}-slam-pill {
  padding: 12px 28px;
  border-radius: 18px;
  background: var(--moo-accent, #84cc16);
  color: #09090b;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0.06em;
  margin-bottom: 24px;
  z-index: 2;
}
.${sid}-slam-title {
  font-size: 68px;
  font-weight: 900;
  line-height: 1.08;
  text-align: center;
  letter-spacing: -0.03em;
  color: var(--moo-primary, #ffffff);
  max-width: 920px;
  margin-bottom: 28px;
  z-index: 2;
}
.${sid}-slam-sub {
  font-size: 32px;
  line-height: 1.42;
  text-align: center;
  color: var(--moo-text, #d4d4d8);
  max-width: 860px;
  opacity: 0.9;
  z-index: 2;
}
`;
    buildJs = `
const badge = root.querySelector('[data-moo-layer="Badge"]');
const pill = root.querySelector('[data-moo-layer="Accent Pill"]');
const title = root.querySelector('[data-moo-layer="Headline"]');
const sub = root.querySelector('[data-moo-layer="Subtext"]');
const orb = root.querySelector('[data-moo-layer="Ambient Glow"]');

shot.travel(badge, { y: -24, opacity: 0 }, { y: 0, opacity: 1, dur: 0.4, curve: 'smooth-out' }, 0)
  .travel(pill, { scale: 0.4, spin: -6, opacity: 0 }, { scale: 1, spin: 0, opacity: 1, dur: 0.48, curve: 'overshoot-out(2)' }, 0.12)
  .travel(title, { y: 45, scale: 0.92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, dur: 0.55, curve: 'strong-out' }, 0.22)
  .travel(sub, { y: 24, opacity: 0 }, { y: 0, opacity: 0.9, dur: 0.45, curve: 'smooth-out' }, 0.38)
  .go(orb, { scale: 1.2, x: -30, y: 30, dur: ${Math.max(1.5, duration - 0.2).toFixed(2)}, curve: 'gentle-inout' }, 0);
`.trim();
  }

  // Instant visuals still move like a shot: camera life, ambient particles, a hand-off, and a
  // composed frame 0 instead of a slide that fades in from black.
  html = wrapInCamera(html, sid);
  buildJs = `if (ctx.camera) {
  ctx.camera({ move: '${CAMERA_MOVES[index % CAMERA_MOVES.length]}', handoff: 'zoom' });
  ctx.particles({ count: 14, size: [3, 6] });
}
${keepPosterLayersVisible(buildJs, POSTER_LAYERS[chosen] || [])}`;

  const editableLayers = extractLayersFromHtml(html);

  return {
    id: scene.id,
    beatId: scene.id,
    duration,
    html,
    css,
    buildJs,
    palette,
    editableLayers,
    status: 'ok',
    version: 1,
    userEdited: false
  };
}

export function compileProceduralProject(
  project: MooProject,
  archetype: ProceduralArchetype = 'auto',
  overwriteExisting = false
): MooProject {
  const scenes = project.scenes || [];
  const total = scenes.length;
  const existingMap = new Map<string, GeneratedScene>();
  for (const mod of project.composition?.scenes || []) {
    existingMap.set(mod.beatId, mod);
  }

  // 'auto' never gives two shots in a row the same layout.
  let previous: ConcreteArchetype | undefined;
  const compiledScenes: GeneratedScene[] = scenes.map((scene, idx) => {
    const existing = existingMap.get(scene.id);
    if (existing && existing.status === 'ok' && existing.html.trim() && !overwriteExisting) {
      previous = undefined;
      return existing;
    }
    const chosen = resolveProceduralArchetype(scene, idx, archetype, previous);
    previous = chosen;
    return compileProceduralScene(scene, idx, total, existing?.palette, chosen);
  });

  const totalDuration = compiledScenes.reduce((sum, s) => sum + (s.duration || 3), 0);

  return {
    ...project,
    renderMode: 'composition',
    composition: {
      id: project.composition?.id || `comp-${project.id}`,
      width: project.width || 1080,
      height: project.height || 1920,
      fps: project.fps || 30,
      duration: totalDuration,
      globalCss: project.composition?.globalCss || '',
      globalBuildJs: project.composition?.globalBuildJs,
      scenes: compiledScenes,
      createdAt: project.composition?.createdAt || Date.now(),
      updatedAt: Date.now()
    },
    updatedAt: Date.now()
  };
}
