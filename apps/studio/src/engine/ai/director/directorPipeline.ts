import type { StoryBeat, StyleBrief, GeneratedScene, LLMProvider, AspectRatio, WordTimestamp, MooProject, Scene } from '../../../types';
import { validateGeneratedScene } from '../../composition/validator';
import { lintMographQuality } from '../../composition/mographLint';
import { extractLayersFromHtml } from '../../composition/layers';
import {
  MOTION_DIRECTOR_SYSTEM_PROMPT,
  buildSceneCodegenPrompt,
  buildSceneRepairPrompt,
  buildSceneQualityRepairPrompt,
  stageSizeFor
} from './motionLaws';

export function cleanGeneratedHtml(rawHtml: string): { html: string; embeddedCss: string; embeddedJs: string } {
  let html = rawHtml.trim();
  let embeddedCss = '';
  let embeddedJs = '';

  // Extract <style>...</style> if LLM embedded it inside HTML
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    embeddedCss += `\n${css.trim()}`;
    return '';
  });

  // Extract <script>...</script> if LLM embedded it inside HTML
  html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, js) => {
    embeddedJs += `\n${js.trim()}`;
    return '';
  });

  // Strip <!DOCTYPE html>, <html>, <head>...</head>, <body>, </body>, </html> if LLM generated a full document
  html = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<(meta|link|base)\b[^>]*>/gi, '')
    .trim();

  // Strip dangerous inline event handlers
  html = html.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Sanitize external URLs on src/href/xlink:href into safe inline SVG data URIs
  html = html.replace(/(?:src|href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/)[^"']*["']/gi, 'src="data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'><rect width=\'100%\' height=\'100%\' fill=\'%23334155\'/></svg>"');

  return { html, embeddedCss, embeddedJs };
}

export function cleanGeneratedCss(rawCss: string): string {
  let css = rawCss.trim();
  // Strip any wrapping <style> tags
  css = css.replace(/<\/?style\b[^>]*>/gi, '');
  // Strip @import (single-line or multi-line)
  css = css.replace(/@import\s+[^;\n]+;?/gi, '');
  // Sanitize external url(...) to none
  css = css.replace(/url\(\s*["']?\s*(?:https?:|\/\/)[^)'"]*["']?\s*\)/gi, 'none');
  return css.trim();
}

export function cleanGeneratedJs(rawJs: string): string {
  let js = rawJs.trim();
  // Strip any wrapping <script> tags
  js = js.replace(/<\/?script\b[^>]*>/gi, '');

  // Strip ES import statements (single-line or multiline import { ... } from '...')
  js = js.replace(/(?:^|\n)\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '\n');
  js = js.replace(/(?:^|\n)\s*import\s+['"][^'"]+['"]\s*;?/g, '\n');
  js = js.replace(/^\s*import\b[^\n;]+;?\s*$/gm, '').trim();

  // Strip export default and named export keywords
  js = js.replace(/(?:^|\n)\s*export\s+default\s+/g, '\n');
  js = js.replace(/(?:^|\n)\s*export\s+(?:const|let|var|function|async\s+function)\s+/g, (m) => m.replace('export ', ''));

  // Strip wrapping parentheses if the whole block is e.g. (function(...) { ... }) or ((...) => { ... })
  if (js.startsWith('(') && js.endsWith(')')) {
    js = js.slice(1, -1).trim();
  }

  // Unwrap outer function wrapper even with preceding comments or whitespace:
  // e.g.: function(shot, root, ctx, MooTween) { ... }
  // or: function buildScene(shot, root, ctx) { ... }
  // or: (shot, root, ctx) => { ... }
  // or: const build = (shot, root, ctx) => { ... }
  const withoutComments = js
    .replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, '')
    .replace(/(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|\s)*$/g, '');
  const fnWrapperMatch = withoutComments.match(
    /^(?:(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*)?(?:async\s+)?(?:function(?:\s+[a-zA-Z0-9_$]+)?\s*\([^)]*\)|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)\s*\{([\s\S]*)\}\s*;?$/
  );
  if (fnWrapperMatch && fnWrapperMatch[1]) {
    const body = fnWrapperMatch[1].trim();
    if (body.includes('shot') || body.includes('MooTween') || body.includes('root') || body.includes('ctx')) {
      js = body;
    }
  }

  // Strip DOMContentLoaded or window.onload wrapper if present
  const domLoadedMatch = js.match(
    /(?:document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{([\s\S]*?)\}\s*\)|window\.(?:onload|addEventListener\s*\(\s*['"]load['"]\s*,\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>))\s*=\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{([\s\S]*?)\}\s*\);?)/i
  );
  if (domLoadedMatch && (domLoadedMatch[1] || domLoadedMatch[2])) {
    const inner = (domLoadedMatch[1] || domLoadedMatch[2]).trim();
    if (inner.includes('shot') || inner.includes('MooTween') || inner.includes('ctx')) {
      js = inner;
    }
  }

  // A model sometimes builds its own track instead of using `shot`. A track that is never nested into
  // the shot would never play, so its moves are moved onto `shot` and the declaration dropped
  // (this also drops a multi-line `const shot = MooTween.track({...})` redeclaration).
  const ownTracks = [...js.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:window\.)?MooTween\.track\b/g)]
    .map((m) => m[1])
    .filter((name) => !new RegExp(`\\bshot\\s*\\.\\s*nest\\s*\\(\\s*${name}\\b`).test(js));
  for (const name of ownTracks) {
    js = js.replace(new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${name}\\s*=\\s*(?:window\\.)?MooTween\\.track\\s*\\([\\s\\S]*?\\)(?=\\s*\\.)`, 'g'), '\nshot');
    js = js.replace(new RegExp(`(?:^|\\n)\\s*(?:const|let|var)\\s+${name}\\s*=\\s*(?:window\\.)?MooTween\\.track\\s*\\([\\s\\S]*?\\)\\s*;?`, 'g'), '\n');
    js = js.replace(new RegExp(`\\b${name}\\s*\\.`, 'g'), 'shot.');
  }

  // Redeclarations of what the runtime passes in (shot, root, ctx, MooTween)
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+(?:shot|root|ctx|MooTween)\b[^\n;]*;?/g, '\n');

  // Auto-fix determinism violations: replace Math.random() with ctx.rand()
  js = js.replace(/\bMath\.random\s*\([^)]*\)/g, 'ctx.rand()');

  // Auto-fix Date.now() and performance.now() with 0
  js = js.replace(/\bDate\.now\s*\([^)]*\)/g, '0');
  js = js.replace(/\bperformance\.now\s*\([^)]*\)/g, '0');

  return js.trim();
}

/**
 * Resilient multi-tier code block parser.
 * Handles JSON responses, markdown backticks (``` or ````), language variations,
 * untagged blocks, embedded styles/scripts, and guarantees valid MooTween shot code.
 */
export function parseCodeBlocks(rawText: string): { html: string; css: string; buildJs: string } {
  if (!rawText || !rawText.trim()) {
    return { html: '', css: '', buildJs: '' };
  }

  // Strip <think>...</think> if present (DeepSeek, Qwen, Claude 3.7 reasoning blocks)
  let cleanInput = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // If response ended before closing </think> (cut off by token limit), but contains code blocks inside it:
  if (!cleanInput && rawText.includes('<think>')) {
    const codeMatch = rawText.match(/`{3,}[\s\S]*$/);
    if (codeMatch) {
      cleanInput = codeMatch[0].trim();
    }
  }

  const textToParse = cleanInput || rawText;

  let html = '';
  let css = '';
  let buildJs = '';

  // 0. Check if response is JSON (raw or wrapped in ```json)
  const jsonBlockMatch = textToParse.match(/`{3,}json\s*([\s\S]*?)(?:`{3,}|$)/i);
  const candidateJson = jsonBlockMatch ? jsonBlockMatch[1].trim() : textToParse.trim();
  if (candidateJson.startsWith('{') && candidateJson.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(candidateJson);
      if (parsedJson.html || parsedJson.css || parsedJson.buildJs || parsedJson.js || parsedJson.javascript) {
        html = parsedJson.html || '';
        css = parsedJson.css || '';
        buildJs = parsedJson.buildJs || parsedJson.js || parsedJson.javascript || '';
      }
    } catch {
      // Continue to markdown parsing
    }
  }

  // 1. Collect all code blocks in order
  const blockRe = /`{3,}([\w:-]*)\s*([\s\S]*?)(?:`{3,}|$)/g;
  const blocks: Array<{ tag: string; content: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(textToParse)) !== null) {
    const tag = (m[1] || '').toLowerCase().trim();
    const content = m[2].trim();
    if (content) {
      blocks.push({ tag, content });
    }
  }

  // Assign from tagged blocks first
  const used = new Set<number>();
  for (const [i, b] of blocks.entries()) {
    if (!html && (b.tag.includes('html') || b.tag.includes('svg') || b.tag.includes('xml'))) {
      html = b.content;
      used.add(i);
    } else if (!css && (b.tag.includes('css') || b.tag.includes('style') || b.tag.includes('scss') || b.tag.includes('postcss'))) {
      css = b.content;
      used.add(i);
    } else if (!buildJs && (b.tag.includes('javascript') || b.tag.includes('js') || b.tag.includes('typescript') || b.tag.includes('ts') || b.tag.includes('moo') || b.tag.includes('script') || b.tag.includes('anim'))) {
      buildJs = b.content;
      used.add(i);
    }
  }

  // 2. Fallback: If 3 blocks exist and tags were ambiguous, use ordinal assignment
  if (blocks.length >= 3) {
    if (!html) html = blocks[0].content;
    if (!css) css = blocks[1].content;
    if (!buildJs) buildJs = blocks[2].content;
  } else if (blocks.length > 0 && (!html || !css || !buildJs)) {
    // Content-based heuristic assignment for blocks the tags did not claim. Markup is never
    // JavaScript: class names like "scene-root" would otherwise match the \broot\b test.
    for (const [i, b] of blocks.entries()) {
      if (used.has(i)) continue;
      if (!html && (/<[a-z][\s\S]*>/i.test(b.content) || b.content.includes('<div') || b.content.includes('<svg'))) {
        html = b.content;
      } else if (!css && (/\{[\s\S]*?:[\s\S]*?\}/.test(b.content) || b.content.includes('.scene-') || b.content.includes('width:'))) {
        css = b.content;
      } else if (!buildJs && !/^\s*</.test(b.content) && (/\b(shot|MooTween|root|ctx)\b/.test(b.content) || b.content.includes('function') || b.content.includes('=>'))) {
        buildJs = b.content;
      }
    }
  }

  // 3. Fallback: Extract from raw text if blocks weren't found
  if (!html && /<(?:div|svg|section)\b/i.test(textToParse)) {
    const firstTagMatch = textToParse.match(/<(div|svg|section)\b[^>]*>/i);
    if (firstTagMatch && firstTagMatch.index !== undefined) {
      const tag = firstTagMatch[1];
      const startIdx = firstTagMatch.index;
      const lastCloseIdx = textToParse.toLowerCase().lastIndexOf(`</${tag}>`);
      if (lastCloseIdx !== -1 && lastCloseIdx > startIdx) {
        html = textToParse.slice(startIdx, lastCloseIdx + `</${tag}>`.length).trim();
      } else {
        html = textToParse.slice(startIdx).trim();
      }
    }
  }
  if (!buildJs && /\b(?:shot|ctx)\.(?:go|arrive|travel|pin|camera|hero)\b/i.test(textToParse)) {
    const jsSnippetMatch = textToParse.match(/(?:(?:shot|ctx)\.(?:go|arrive|travel|pin|camera|hero)[\s\S]*?)(?:\s*;|\s*`{3,}|\s*$)/i);
    if (jsSnippetMatch) {
      buildJs = jsSnippetMatch[0].replace(/`{3,}.*$/, '').trim();
    }
  }

  // 4. Clean, unwrap, and sanitize each component
  const cleanedHtml = cleanGeneratedHtml(html);
  html = cleanedHtml.html;

  if (!css && cleanedHtml.embeddedCss) {
    css = cleanedHtml.embeddedCss;
  } else if (cleanedHtml.embeddedCss && !css.includes(cleanedHtml.embeddedCss.trim())) {
    css = `${css}\n${cleanedHtml.embeddedCss}`;
  }

  if (!buildJs && cleanedHtml.embeddedJs) {
    buildJs = cleanedHtml.embeddedJs;
  } else if (cleanedHtml.embeddedJs && !buildJs.includes(cleanedHtml.embeddedJs.trim())) {
    buildJs = `${buildJs}\n${cleanedHtml.embeddedJs}`;
  }

  css = cleanGeneratedCss(css);
  buildJs = cleanGeneratedJs(buildJs);

  // 5. Fail-Safe Guarantee: If buildJs is completely empty, but html exists,
  // synthesize a smooth default MooTween animation so the scene never fails validation or stays static.
  if (!buildJs.trim() && html.trim()) {
    buildJs = `// Auto-synthesized motion for scene layers (visible frame 0, camera drift, overshoot pops, hand-off)
const D = ctx.dur || 3.5;
const stage = root.firstElementChild || root;
const targets = stage.children && stage.children.length > 0 ? stage.children : [stage];
shot.travel(stage, { scale: 1.1 }, { scale: 1, dur: Math.max(0.5, D - 0.4), curve: 'gentle-inout' }, 0);
shot.arrive(targets, {
  scale: 0.8,
  spin: -6,
  pivot: '50% 50%',
  dur: Math.min(0.8, D * 0.3),
  cascade: 0.12,
  curve: 'overshoot-out(1.8)'
}, 0);
shot.go(stage, { scale: 1.6, opacity: 0, dur: 0.35, curve: 'sharp-in' }, Math.max(0, D - 0.35));`;
  }

  return { html, css, buildJs };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function synthesizeFallbackScene(params: {
  beat: StoryBeat;
  index: number;
  styleBrief: StyleBrief;
  durationSec: number;
  aspectRatio?: AspectRatio;
}): { html: string; css: string; buildJs: string } {
  const { beat, index, styleBrief, durationSec } = params;
  const palette = styleBrief?.palette || {
    bg: '#090d16',
    surface: '#131b2e',
    primary: '#3b82f6',
    accent: '#06b6d4',
    text: '#f8fafc',
    muted: '#94a3b8'
  };
  const { w, h } = stageSizeFor(params.aspectRatio || '9:16');
  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.56);
  const unit = Math.min(w, h);
  const fontSize = Math.round(unit * 0.1);

  // Only a short kinetic title goes on screen; the narration is spoken and captioned separately.
  const titleWords = (beat.visualIntent || `Scene ${index + 1}`).trim().split(/\s+/).slice(0, 6);
  const sceneClass = `scene-s${index + 1}`;
  const r1 = Math.round(unit * 0.22);
  const r2 = Math.round(unit * 0.34);
  const r3 = Math.round(unit * 0.46);

  const html = `<div class="scene-root ${sceneClass}">
  <div class="moo-camera" data-moo-layer="camera">
    <div class="synth-bg-glow" data-moo-layer="Ambient Glow"></div>
    <svg class="synth-stage" data-moo-layer="Orbit" viewBox="0 0 ${w} ${h}">
      <g class="synth-rings" fill="none" stroke="var(--moo-primary, ${palette.primary})" stroke-width="4">
        <circle cx="${cx}" cy="${cy}" r="${r1}" />
        <circle cx="${cx}" cy="${cy}" r="${r2}" stroke-dasharray="18 22" />
        <circle cx="${cx}" cy="${cy}" r="${r3}" opacity="0.4" />
      </g>
      <circle class="synth-core" cx="${cx}" cy="${cy}" r="${Math.round(unit * 0.07)}" fill="var(--moo-accent, ${palette.accent})" />
      <circle class="synth-satellite" cx="${cx + r2}" cy="${cy}" r="${Math.round(unit * 0.025)}" fill="var(--moo-text, ${palette.text})" />
    </svg>
    <svg class="synth-line-wrap" data-moo-layer="Accent Line" viewBox="0 0 ${w} ${h}">
      <path class="synth-accent-line" d="M ${Math.round(w * 0.2)} ${Math.round(h * 0.3)} L ${Math.round(w * 0.8)} ${Math.round(h * 0.3)}" fill="none" stroke="var(--moo-accent, ${palette.accent})" stroke-width="8" stroke-linecap="round" />
    </svg>
    <div class="synth-headline" data-moo-layer="Headline">${titleWords.map((word) => `<span>${escapeHtml(word)}</span>`).join(' ')}</div>
  </div>
</div>`;

  const css = `.${sceneClass} {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--moo-bg, ${palette.bg});
  color: var(--moo-text, ${palette.text});
  font-family: var(--moo-font-display, '${styleBrief?.fontDisplay || 'system-ui, -apple-system, sans-serif'}');
}

.${sceneClass} .moo-camera {
  position: absolute;
  inset: 0;
  transform-origin: 50% 56%;
}

.${sceneClass} .synth-bg-glow {
  position: absolute;
  left: ${cx - r3 * 1.5}px;
  top: ${cy - r3 * 1.5}px;
  width: ${r3 * 3}px;
  height: ${r3 * 3}px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--moo-primary, ${palette.primary}) 0%, transparent 60%);
  opacity: 0.25;
}

.${sceneClass} .synth-stage,
.${sceneClass} .synth-line-wrap {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.${sceneClass} .synth-headline {
  position: absolute;
  left: ${Math.round(w * 0.08)}px;
  top: ${Math.round(h * 0.1)}px;
  width: ${Math.round(w * 0.84)}px;
  text-align: center;
  font-size: ${fontSize}px;
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: var(--moo-text, ${palette.text});
}

.${sceneClass} .synth-headline span {
  display: inline-block;
}`;

  const buildJs = `// Bespoke synthesis timeline for Scene #${index + 1}
const D = ctx.dur || ${durationSec.toFixed(1)};
const cam = root.querySelector('.moo-camera');
const glow = root.querySelector('.synth-bg-glow');
const rings = root.querySelectorAll('.synth-rings circle');
const core = root.querySelector('.synth-core');
const satellite = root.querySelector('.synth-satellite');
const line = root.querySelector('.synth-accent-line');
const words = root.querySelectorAll('.synth-headline span');

// Camera drifts for the whole shot
shot.travel(cam, { scale: 1.15, spin: -3 }, { scale: 1, spin: 0, dur: Math.max(0.5, D - 0.4), curve: 'gentle-inout' }, 0);
if (glow) shot.travel(glow, { scale: 0.7 }, { scale: 1.2, dur: D, curve: 'gentle-inout' }, 0);

// Core and rings are visible on frame 0 (the editor's still), then expand with overshoot
if (core) shot.travel(core, { scale: 0.55, pivot: '50% 50%' }, { scale: 1, dur: 0.5, curve: 'overshoot-out(2.5)' }, 0);
shot.travel(rings, { scale: 0.6, spin: -90, pivot: '50% 50%' }, { scale: 1, spin: 0, dur: 0.8, cascade: 0.12, curve: 'rush-out' }, 0);
if (rings[1]) shot.go(rings[1], { spin: 120, pivot: '50% 50%', dur: D, curve: 'linear' }, 0);
if (satellite) shot.go(satellite, { spin: 300, pivotPoint: '${cx} ${cy}', dur: D, curve: 'linear' }, 0);

// Accent line draws, title snaps in word by word
if (line) {
  const len = line.getTotalLength ? line.getTotalLength() : ${Math.round(w * 0.6)};
  shot.pin(line, { strokeDasharray: len, strokeDashoffset: len }, 0);
  shot.go(line, { strokeDashoffset: 0, dur: 0.6, curve: 'smooth-inout' }, 0.3);
}
shot.arrive(words, { shiftY: 110, spin: 8, scale: 0.8, opacity: 0, dur: 0.45, cascade: 0.07, curve: 'rush-out' }, 0.35);

// Hand-off into the next shot
shot.go(cam, { scale: 2.4, opacity: 0, dur: 0.4, curve: 'sharp-in' }, Math.max(0, D - 0.4));`;

  return { html, css, buildJs };
}

/** Storyboard beat for a timeline scene, reading the current intent fields before legacy ones. */
export function sceneToStoryBeat(scene: Scene): StoryBeat {
  return {
    id: scene.id,
    narration: scene.narrationText || scene.text || '',
    visualIntent: scene.visualIntent || scene.narrationText || 'Adegan mograph dinamis',
    visualConcept: scene.visualConcept,
    visualElements: scene.visualElements,
    motionIntent: scene.motionIntent,
    cameraIntent: scene.cameraIntent || scene.camera,
    heroObject: scene.heroObject,
    matchCut: scene.matchCut,
    durationHint: scene.durationInSeconds || 3.5,
    focusWords: scene.focusWords || scene.emphasis,
    assignedAssets: scene.assignedAssets
  };
}

function shotSummary(scene: Scene | undefined): string | undefined {
  if (!scene) return undefined;
  const intent = scene.visualIntent || scene.narrationText || '';
  return scene.heroObject ? `${intent} (subjek: ${scene.heroObject})` : intent || undefined;
}

/**
 * Everything a shot needs from the rest of the film: the world bible as a style brief, the
 * neighbouring shots, and the match cut it opens on. Shots are generated in parallel, so
 * continuity comes from the storyboard rather than from previously generated code.
 */
export function buildSceneGenerationContext(
  project: MooProject,
  index: number,
  fontDisplay: string
): Pick<GenerateCustomSceneParams, 'styleBrief' | 'previousSceneSummary' | 'nextSceneSummary' | 'incomingMatchCut'> {
  const scenes = project.scenes || [];
  const prev = index > 0 ? scenes[index - 1] : undefined;
  const next = scenes[index + 1];
  const theme = project.theme;
  const world = project.styleBrief;
  return {
    styleBrief: {
      adjectives: world?.adjectives?.length ? world.adjectives : ['cinematic', 'expressive', 'bespoke'],
      palette: {
        bg: theme.bg || '#09090b',
        primary: world?.palette?.primary || theme.textPrimary || '#f4f4f6',
        // Lime is the app's UI default, not a topic choice; let the model pick a thematic accent.
        accent: theme.textHighlight && theme.textHighlight !== '#84cc16' ? theme.textHighlight : '',
        text: theme.textPrimary || '#ffffff'
      },
      fontDisplay,
      fontBody: 'Plus Jakarta Sans',
      backgroundLanguage: world?.backgroundLanguage || 'Visual atmosfer tematik yang secara organik mengekspresikan ide adegan',
      motionSignature: world?.motionSignature || 'Animasi kinetik dinamis yang secara akurat memvisualisasikan narasi & konsep',
      motif: world?.motif
    },
    previousSceneSummary: shotSummary(prev),
    nextSceneSummary: shotSummary(next),
    incomingMatchCut: prev?.matchCut
  };
}

export interface GenerateCustomSceneParams {
  beat: StoryBeat;
  index: number;
  total: number;
  styleBrief: StyleBrief;
  aspectRatio?: AspectRatio;
  previousSceneSummary?: string;
  nextSceneSummary?: string;
  /** The previous shot's match cut, which this shot must open on. */
  incomingMatchCut?: string;
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  styleAdvice?: string;
  /** Scene-relative voice-over word timings, used to sync accents via ctx.at(). */
  wordTimestamps?: WordTimestamp[];
  onProgress?: (status: string) => void;
}

/**
 * Asks the LLM to rewrite a valid-but-slide-like scene. Returns the rewrite only when it
 * still validates and scores better on the anti-PPT lint; otherwise the original is kept.
 */
export async function improveSceneMographQuality(params: {
  code: { html: string; css: string; buildJs: string };
  issues: string[];
  score: number;
  beatIndex: number;
  visualIntent: string;
  narration?: string;
  durationSec: number;
  aspectRatio: AspectRatio;
  wordTimestamps?: WordTimestamp[];
  executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
}): Promise<{ html: string; css: string; buildJs: string; improved: boolean }> {
  try {
    const rawResponse = await params.executeLlm({
      systemPrompt: MOTION_DIRECTOR_SYSTEM_PROMPT,
      userPrompt: buildSceneQualityRepairPrompt({
        originalCode: params.code,
        issues: params.issues,
        beatIndex: params.beatIndex,
        visualIntent: params.visualIntent,
        narration: params.narration,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
        wordTimestamps: params.wordTimestamps
      })
    });
    const rewritten = parseCodeBlocks(rawResponse);
    if (!validateGeneratedScene(rewritten).valid) {
      return { ...params.code, improved: false };
    }
    const lint = lintMographQuality(rewritten, {
      narration: params.narration,
      hasWordTimestamps: Boolean(params.wordTimestamps?.length)
    });
    if (lint.score >= params.score) {
      return { ...params.code, improved: false };
    }
    return { ...rewritten, improved: true };
  } catch (err: unknown) {
    console.warn('[MooScript] Mograph quality rewrite failed, keeping original scene:', err);
    return { ...params.code, improved: false };
  }
}

/**
 * Attempts to repair a generated scene using LLM feedback when validation fails.
 */
export async function repairGeneratedScene(params: {
  originalCode: { html: string; css: string; buildJs: string };
  errors: string[];
  visualIntent: string;
  narration?: string;
  durationSec: number;
  executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  onProgress?: (status: string) => void;
}): Promise<{ html: string; css: string; buildJs: string; valid: boolean; errors: string[] }> {
  try {
    params.onProgress?.('AI sedang menganalisis error dan mereparasi timeline MooTween...');
    const repairPrompt = buildSceneRepairPrompt({
      originalCode: params.originalCode,
      errors: params.errors,
      visualIntent: params.visualIntent,
      narration: params.narration,
      durationSec: params.durationSec
    });

    const rawResponse = await params.executeLlm({
      systemPrompt: MOTION_DIRECTOR_SYSTEM_PROMPT,
      userPrompt: repairPrompt
    });

    const parsed = parseCodeBlocks(rawResponse);
    const validation = validateGeneratedScene(parsed);
    return {
      ...parsed,
      valid: validation.valid,
      errors: validation.errors
    };
  } catch (err: unknown) {
    return {
      ...params.originalCode,
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)]
    };
  }
}

/**
 * Generates a bespoke motion graphics scene for a storyboard beat.
 * 
 * Strict architectural rule:
 * Under NO circumstances does this function fall back to a hard-coded layout template.
 * If generation fails validation, it attempts repair once. If it still fails, it yields
 * an explicit `error` state.
 */
export async function generateCustomScene(params: GenerateCustomSceneParams): Promise<GeneratedScene> {
  const {
    beat,
    index,
    total,
    styleBrief,
    aspectRatio = '9:16',
    previousSceneSummary,
    nextSceneSummary,
    incomingMatchCut,
    executeLlm,
    styleAdvice,
    wordTimestamps,
    onProgress
  } = params;

  const duration = beat.durationHint || 3.5;

  onProgress?.('Menganalisis konsep visual & menyusun prompt mograph...');

  let prompt = buildSceneCodegenPrompt({
    beatIndex: index,
    totalBeats: total,
    narration: beat.narration,
    visualIntent: beat.visualIntent,
    visualConcept: beat.visualConcept,
    visualElements: beat.visualElements,
    motionIntent: beat.motionIntent,
    cameraIntent: beat.cameraIntent,
    durationSec: duration,
    aspectRatio,
    previousSceneSummary,
    nextSceneSummary,
    focusWords: beat.focusWords,
    heroObject: beat.heroObject,
    matchCut: beat.matchCut,
    incomingMatchCut,
    assignedAssets: beat.assignedAssets,
    wordTimestamps,
    styleBrief: {
      palette: styleBrief.palette,
      fontDisplay: styleBrief.fontDisplay,
      motionSignature: styleBrief.motionSignature,
      backgroundLanguage: styleBrief.backgroundLanguage,
      motif: styleBrief.motif
    }
  });

  if (styleAdvice) {
    prompt += `\n=== STYLE ADVICE ===\n${styleAdvice}\n`;
  }

  try {
    onProgress?.('Menghubungi AI Motion Director untuk generasi kode...');
    const rawResponse = await executeLlm({
      systemPrompt: MOTION_DIRECTOR_SYSTEM_PROMPT,
      userPrompt: prompt
    });

    onProgress?.('Mem-parsing blok kode HTML, CSS, dan MooTween...');
    let parsed = parseCodeBlocks(rawResponse);
    let validation = validateGeneratedScene(parsed);
    let synthesized = false;

    // If validation fails, attempt 1-time automatic repair with validation errors
    if (!validation.valid) {
      console.warn(`[MooScript] Validation failed for scene #${index + 1}, attempting auto-repair:`, validation.errors.join(' | '));
      onProgress?.('Validasi timeline MooTween: AI sedang mereparasi animasi...');
      const repaired = await repairGeneratedScene({
        originalCode: parsed,
        errors: validation.errors,
        visualIntent: beat.visualIntent,
        narration: beat.narration,
        durationSec: duration,
        executeLlm,
        onProgress
      });
      if (repaired.valid) {
        parsed = { html: repaired.html, css: repaired.css, buildJs: repaired.buildJs };
        validation = { valid: true, errors: [] };
      } else {
        console.warn(`[MooScript] Repair attempt did not pass validation for scene #${index + 1}:`, repaired.errors.join(' | '));
        validation.errors = repaired.errors;

        // If the scene is STILL completely empty after repair (e.g. AI token cutoff / no HTML generated),
        // synthesize a bespoke motion graphic scene based on the story beat so that the project
        // is never stranded with empty unrenderable scenes.
        if (!parsed.html.trim()) {
          console.warn(`[MooScript] Synthesizing bespoke fail-safe scene for scene #${index + 1} (${beat.visualIntent || 'Scene'})`);
          parsed = synthesizeFallbackScene({
            beat,
            index,
            styleBrief,
            durationSec: duration,
            aspectRatio
          });
          validation = validateGeneratedScene(parsed);
          synthesized = true;
        }
      }
    }

    // Valid code can still read as a slide / web page: lint it and ask for one rewrite.
    if (validation.valid && !synthesized) {
      const lint = lintMographQuality(parsed, {
        narration: beat.narration,
        hasWordTimestamps: Boolean(wordTimestamps?.length)
      });
      if (lint.needsRepair) {
        console.warn(`[MooScript] Scene #${index + 1} reads like a slide (score ${lint.score}), requesting mograph rewrite:`, lint.issues.map((i) => i.id).join(', '));
        onProgress?.('Hasil masih terasa seperti slide: AI sedang menulis ulang jadi mograph...');
        const improved = await improveSceneMographQuality({
          code: parsed,
          issues: lint.issues.map((i) => i.message),
          score: lint.score,
          beatIndex: index,
          visualIntent: beat.visualIntent,
          narration: beat.narration,
          durationSec: duration,
          aspectRatio,
          wordTimestamps,
          executeLlm
        });
        parsed = { html: improved.html, css: improved.css, buildJs: improved.buildJs };
      }
    }

    const editableLayers = extractLayersFromHtml(parsed.html);
    onProgress?.('Selesai merakit layer adegan');

    if (validation.valid) {
      return {
        id: beat.id,
        beatId: beat.id,
        duration,
        html: parsed.html,
        css: parsed.css,
        buildJs: parsed.buildJs,
        editableLayers,
        generatorVersion: 'generative-mograph-v2',
        status: 'ok',
        version: 1,
        userEdited: false
      };
    }

    // Explicit error state — preserves the generated code so user can inspect / edit / retry
    return {
      id: beat.id,
      beatId: beat.id,
      duration,
      html: parsed.html,
      css: parsed.css,
      buildJs: parsed.buildJs,
      editableLayers,
      generatorVersion: 'generative-mograph-v2',
      status: 'error',
      errors: validation.errors,
      version: 1,
      userEdited: false
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[MooScript] Exception generating scene #${index + 1}:`, err);
    return {
      id: beat.id,
      beatId: beat.id,
      duration,
      html: '',
      css: '',
      buildJs: '',
      generatorVersion: 'generative-mograph-v2',
      status: 'error',
      errors: [message],
      version: 1,
      userEdited: false
    };
  }
}

/**
 * Backward-compatible wrapper for existing callers/tests.
 */
export async function generateSingleSceneModule(params: GenerateCustomSceneParams): Promise<GeneratedScene> {
  return generateCustomScene(params);
}
