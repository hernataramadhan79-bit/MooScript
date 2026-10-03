import type { Scene, MooProject, SceneModule } from '../../types';
import { cleanWord } from '../../utils/textUtils';

export function escapeHtml(str: string = ''): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getFontFamily(font: string = 'Jakarta'): string {
  switch (font) {
    case 'Mono':
      return "'JetBrains Mono', monospace";
    case 'Impact':
      return "'Syne', sans-serif";
    case 'Jakarta':
    default:
      return "'Plus Jakarta Sans', sans-serif";
  }
}

function renderKineticQuote(
  scene: Scene,
  theme: MooProject['theme'],
  size: { width: number; height: number },
  prefix: string
): { html: string; css: string; buildJs: string } {
  const scale = size.width / 1080;
  const s = (px: number) => Math.max(1, Math.round(px * scale));
  const font = getFontFamily(theme.fontFamily);

  const title = scene.visualData?.title;
  const badgeHtml = title
    ? `<div class="${prefix}-badge">${escapeHtml(title)}</div>`
    : '';

  const rawText = scene.narrationText || scene.text || '';
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean);
  const focusList = scene.visualData?.focusWords || scene.focusWords || [];
  const focusSet = new Set(focusList.map((w) => cleanWord(w)));

  const wordsHtml = rawWords
    .map((word) => {
      const isFocus = focusSet.has(cleanWord(word));
      const focusClass = isFocus ? ` ${prefix}-focus focus` : '';
      return `<span class="${prefix}-w w${focusClass}">${escapeHtml(word)}</span>`;
    })
    .join(' ');

  const html = `
<div class="${prefix}-container">
  ${badgeHtml}
  <div class="${prefix}-quote">
    ${wordsHtml}
  </div>
</div>`.trim();

  const css = `
.${prefix}-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: ${theme.bg};
  font-family: ${font};
  color: ${theme.textPrimary};
  text-align: center;
  padding: ${s(60)}px;
  box-sizing: border-box;
}
.${prefix}-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: ${s(24)}px;
  font-weight: 700;
  color: ${theme.textHighlight};
  background: rgba(132, 204, 22, 0.12);
  border: 1px solid rgba(132, 204, 22, 0.3);
  padding: ${s(8)}px ${s(24)}px;
  border-radius: 9999px;
  letter-spacing: 0.15em;
  margin-bottom: ${s(36)}px;
}
.${prefix}-quote {
  font-size: ${s(64)}px;
  font-weight: 800;
  line-height: 1.2;
  max-width: ${s(900)}px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${s(16)}px;
}
.${prefix}-w {
  display: inline-block;
}
.${prefix}-focus {
  color: ${theme.textHighlight};
  text-shadow: 0 0 ${s(30)}px rgba(132, 204, 22, 0.4);
}
`.trim();

  const buildJs = `
tl.from(root.querySelector(".${prefix}-container"), { opacity: 0, duration: 0.3 })
  .from(root.querySelectorAll(".${prefix}-w"), { opacity: 0, y: 25, scale: 0.85, stagger: 0.08, duration: 0.5, ease: "back.out(1.7)" }, "-=0.1")
  .to(root.querySelectorAll(".${prefix}-focus"), { scale: 1.15, duration: 0.3, ease: "power2.out", stagger: 0.1 }, "-=0.2");
`.trim();

  return { html, css, buildJs };
}

function renderMetricCounter(
  scene: Scene,
  theme: MooProject['theme'],
  size: { width: number; height: number },
  prefix: string
): { html: string; css: string; buildJs: string } {
  const scale = size.width / 1080;
  const s = (px: number) => Math.max(1, Math.round(px * scale));
  const font = getFontFamily(theme.fontFamily);

  const title = scene.visualData?.title;
  const badgeHtml = title
    ? `<div class="${prefix}-badge">${escapeHtml(title)}</div>`
    : '';

  const metricVal = scene.visualData?.metricValue || '+100%';
  const metricLbl = scene.visualData?.metricLabel || 'Growth Metric';
  const narration = scene.narrationText || scene.text || '';
  const subHtml = narration
    ? `<p class="${prefix}-sub">${escapeHtml(narration)}</p>`
    : '';

  const html = `
<div class="${prefix}-container">
  <div class="${prefix}-card">
    ${badgeHtml}
    <div class="${prefix}-metric-val">${escapeHtml(metricVal)}</div>
    <div class="${prefix}-metric-lbl">${escapeHtml(metricLbl)}</div>
    ${subHtml}
  </div>
</div>`.trim();

  const css = `
.${prefix}-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: ${theme.bg};
  font-family: ${font};
  padding: ${s(50)}px;
  box-sizing: border-box;
}
.${prefix}-card {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: ${s(60)}px ${s(50)}px;
  border-radius: ${s(32)}px;
  background: rgba(24, 24, 27, 0.7);
  border: 2px solid rgba(132, 204, 22, 0.25);
  box-shadow: 0 0 ${s(60)}px rgba(0, 0, 0, 0.5);
  max-width: ${s(900)}px;
  width: 100%;
  box-sizing: border-box;
}
.${prefix}-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: ${s(20)}px;
  font-weight: 700;
  color: ${theme.textHighlight};
  margin-bottom: ${s(20)}px;
  letter-spacing: 0.1em;
}
.${prefix}-metric-val {
  font-size: ${s(110)}px;
  font-weight: 800;
  color: ${theme.textHighlight};
  letter-spacing: -0.03em;
  line-height: 1.1;
  text-shadow: 0 0 ${s(40)}px rgba(132, 204, 22, 0.4);
}
.${prefix}-metric-lbl {
  font-size: ${s(32)}px;
  font-weight: 600;
  color: ${theme.textPrimary};
  margin-top: ${s(12)}px;
}
.${prefix}-sub {
  margin-top: ${s(24)}px;
  font-size: ${s(24)}px;
  color: #a1a1aa;
  max-width: ${s(700)}px;
}
`.trim();

  const buildJs = `
tl.from(root.querySelector(".${prefix}-card"), { scale: 0.8, opacity: 0, duration: 0.6, ease: "back.out(1.7)" })
  .from(root.querySelector(".${prefix}-metric-val"), { scale: 1.3, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.3")
  .from(root.querySelector(".${prefix}-metric-lbl"), { y: 20, opacity: 0, duration: 0.5 }, "-=0.2");
`.trim();

  return { html, css, buildJs };
}

function renderTerminalMockup(
  scene: Scene,
  theme: MooProject['theme'],
  size: { width: number; height: number },
  prefix: string
): { html: string; css: string; buildJs: string } {
  const scale = size.width / 1080;
  const s = (px: number) => Math.max(1, Math.round(px * scale));

  const title = scene.visualData?.title || 'terminal.sh';
  const snippet = scene.visualData?.codeSnippet || scene.narrationText || scene.text || 'echo "MooScript Engine"';
  const lines = snippet.split('\n');

  const linesHtml = lines
    .map((line, idx) => `<div class="${prefix}-line line-${idx}">${escapeHtml(line) || '&nbsp;'}</div>`)
    .join('');

  const html = `
<div class="${prefix}-container">
  <div class="${prefix}-terminal">
    <div class="${prefix}-bar">
      <span class="${prefix}-dot ${prefix}-red"></span>
      <span class="${prefix}-dot ${prefix}-yellow"></span>
      <span class="${prefix}-dot ${prefix}-green"></span>
      <span class="${prefix}-title">${escapeHtml(title)}</span>
    </div>
    <div class="${prefix}-body">
      ${linesHtml}
    </div>
  </div>
</div>`.trim();

  const css = `
.${prefix}-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: ${theme.bg};
  padding: ${s(48)}px;
  box-sizing: border-box;
  font-family: 'JetBrains Mono', monospace;
}
.${prefix}-terminal {
  width: 100%; max-width: ${s(960)}px;
  background: #121215;
  border: 1px solid #27272a;
  border-radius: ${s(24)}px;
  box-shadow: 0 ${s(25)}px ${s(60)}px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  box-sizing: border-box;
}
.${prefix}-bar {
  display: flex; align-items: center; gap: ${s(10)}px;
  padding: ${s(18)}px ${s(24)}px;
  background: #18181c;
  border-bottom: 1px solid #27272a;
}
.${prefix}-dot { width: ${s(16)}px; height: ${s(16)}px; border-radius: 50%; display: inline-block; }
.${prefix}-red { background: #ef4444; }
.${prefix}-yellow { background: #f59e0b; }
.${prefix}-green { background: #10b981; }
.${prefix}-title { margin-left: ${s(12)}px; font-size: ${s(20)}px; color: #71717a; }
.${prefix}-body {
  padding: ${s(32)}px;
  font-size: ${s(24)}px;
  line-height: 1.6;
  color: ${theme.textPrimary};
  word-break: break-word;
}
.${prefix}-line {
  white-space: pre-wrap;
  color: #e4e4e7;
}
`.trim();

  const buildJs = `
tl.from(root.querySelector(".${prefix}-terminal"), { scale: 0.88, opacity: 0, y: 35, duration: 0.7, ease: "power3.out" })
  .from(root.querySelectorAll(".${prefix}-line"), { opacity: 0, x: -15, stagger: 0.1, duration: 0.4, ease: "power2.out" }, "-=0.2");
`.trim();

  return { html, css, buildJs };
}

function renderVsComparison(
  scene: Scene,
  theme: MooProject['theme'],
  size: { width: number; height: number },
  prefix: string
): { html: string; css: string; buildJs: string } {
  const scale = size.width / 1080;
  const s = (px: number) => Math.max(1, Math.round(px * scale));
  const font = getFontFamily(theme.fontFamily);

  const title = scene.visualData?.title;
  const badgeHtml = title
    ? `<div class="${prefix}-badge">${escapeHtml(title)}</div>`
    : '';

  const leftTitle = scene.visualData?.leftTitle || 'Before';
  const leftDesc = scene.visualData?.leftDesc || '';
  const rightTitle = scene.visualData?.rightTitle || 'After';
  const rightDesc = scene.visualData?.rightDesc || scene.narrationText || scene.text || '';

  const html = `
<div class="${prefix}-container">
  ${badgeHtml}
  <div class="${prefix}-split">
    <div class="${prefix}-card ${prefix}-left">
      <div class="${prefix}-card-title">${escapeHtml(leftTitle)}</div>
      <div class="${prefix}-card-desc">${escapeHtml(leftDesc)}</div>
    </div>
    <div class="${prefix}-vs">VS</div>
    <div class="${prefix}-card ${prefix}-right">
      <div class="${prefix}-card-title ${prefix}-highlight">${escapeHtml(rightTitle)}</div>
      <div class="${prefix}-card-desc">${escapeHtml(rightDesc)}</div>
    </div>
  </div>
</div>`.trim();

  const css = `
.${prefix}-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: ${theme.bg};
  font-family: ${font};
  padding: ${s(48)}px;
  box-sizing: border-box;
}
.${prefix}-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: ${s(22)}px;
  font-weight: 700;
  color: ${theme.textHighlight};
  margin-bottom: ${s(32)}px;
}
.${prefix}-split {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${s(24)}px;
  width: 100%;
  max-width: ${s(960)}px;
}
.${prefix}-card {
  flex: 1;
  padding: ${s(40)}px ${s(32)}px;
  border-radius: ${s(24)}px;
  background: rgba(24, 24, 27, 0.7);
  border: 1px solid #27272a;
  text-align: center;
  box-sizing: border-box;
}
.${prefix}-right {
  border-color: rgba(132, 204, 22, 0.4);
  box-shadow: 0 0 ${s(40)}px rgba(132, 204, 22, 0.15);
}
.${prefix}-vs {
  font-family: 'JetBrains Mono', monospace;
  font-size: ${s(32)}px;
  font-weight: 800;
  color: ${theme.textHighlight};
  padding: ${s(8)}px ${s(16)}px;
}
.${prefix}-card-title {
  font-size: ${s(36)}px;
  font-weight: 800;
  color: ${theme.textPrimary};
  margin-bottom: ${s(16)}px;
}
.${prefix}-highlight {
  color: ${theme.textHighlight};
}
.${prefix}-card-desc {
  font-size: ${s(22)}px;
  color: #a1a1aa;
  line-height: 1.4;
}
`.trim();

  const buildJs = `
tl.from(root.querySelector(".${prefix}-left"), { x: -30, opacity: 0, duration: 0.6, ease: "power3.out" })
  .from(root.querySelector(".${prefix}-right"), { x: 30, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.3")
  .from(root.querySelector(".${prefix}-vs"), { scale: 0, opacity: 0, duration: 0.5, ease: "back.out(2)" }, "-=0.3");
`.trim();

  return { html, css, buildJs };
}

function renderListStagger(
  scene: Scene,
  theme: MooProject['theme'],
  size: { width: number; height: number },
  prefix: string
): { html: string; css: string; buildJs: string } {
  const scale = size.width / 1080;
  const s = (px: number) => Math.max(1, Math.round(px * scale));
  const font = getFontFamily(theme.fontFamily);

  const title = scene.visualData?.title || 'Key Points';
  let items = scene.visualData?.bulletItems;
  if (!items || items.length === 0) {
    const raw = scene.narrationText || scene.text || '';
    items = raw
      .split(/[.,;\n]+/)
      .map((i) => i.trim())
      .filter((i) => i.length > 2);
  }
  if (!items || items.length === 0) {
    items = ['Point 1', 'Point 2', 'Point 3'];
  }

  const itemsHtml = items
    .map(
      (item) => `
    <div class="${prefix}-item">
      <span class="${prefix}-bullet">✓</span>
      <span class="${prefix}-text">${escapeHtml(item)}</span>
    </div>`
    )
    .join('');

  const html = `
<div class="${prefix}-container">
  <div class="${prefix}-title">${escapeHtml(title)}</div>
  <div class="${prefix}-list">
    ${itemsHtml}
  </div>
</div>`.trim();

  const css = `
.${prefix}-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: ${theme.bg};
  font-family: ${font};
  padding: ${s(48)}px;
  box-sizing: border-box;
}
.${prefix}-title {
  font-size: ${s(48)}px;
  font-weight: 800;
  color: ${theme.textHighlight};
  margin-bottom: ${s(36)}px;
  text-align: center;
}
.${prefix}-list {
  display: flex; flex-direction: column;
  gap: ${s(20)}px;
  width: 100%; max-width: ${s(800)}px;
}
.${prefix}-item {
  display: flex; align-items: center; gap: ${s(16)}px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: ${s(20)}px ${s(24)}px;
  border-radius: ${s(16)}px;
}
.${prefix}-bullet {
  font-size: ${s(24)}px;
  font-weight: 800;
  color: ${theme.textHighlight};
}
.${prefix}-text {
  font-size: ${s(26)}px;
  color: ${theme.textPrimary};
  font-weight: 500;
}
`.trim();

  const buildJs = `
tl.from(root.querySelector(".${prefix}-title"), { y: -20, opacity: 0, duration: 0.5, ease: "power2.out" })
  .from(root.querySelectorAll(".${prefix}-item"), { x: -25, opacity: 0, stagger: 0.12, duration: 0.5, ease: "power2.out" }, "-=0.2");
`.trim();

  return { html, css, buildJs };
}

export function buildSceneModule(
  scene: Scene,
  theme: MooProject['theme'],
  size: { width: number; height: number }
): SceneModule {
  const prefix = `m_${scene.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  let rendered: { html: string; css: string; buildJs: string };

  switch (scene.layout) {
    case 'METRIC_COUNTER':
      rendered = renderMetricCounter(scene, theme, size, prefix);
      break;
    case 'TERMINAL_MOCKUP':
      rendered = renderTerminalMockup(scene, theme, size, prefix);
      break;
    case 'VS_COMPARISON':
      rendered = renderVsComparison(scene, theme, size, prefix);
      break;
    case 'LIST_STAGGER':
      rendered = renderListStagger(scene, theme, size, prefix);
      break;
    case 'KINETIC_QUOTE':
    default:
      rendered = renderKineticQuote(scene, theme, size, prefix);
      break;
  }

  return {
    beatId: scene.id,
    html: rendered.html,
    css: rendered.css,
    buildJs: rendered.buildJs,
    status: 'ok',
    version: 1
  };
}
