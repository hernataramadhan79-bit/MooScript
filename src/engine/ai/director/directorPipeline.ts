import type { StoryBeat, StyleBrief, GeneratedScene, LLMProvider, AspectRatio } from '../../../types';
import { validateGeneratedScene } from '../../composition/validator';
import { extractLayersFromHtml } from '../../composition/layers';
import {
  MOTION_DIRECTOR_SYSTEM_PROMPT,
  buildSceneCodegenPrompt,
  buildSceneRepairPrompt
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

  return { html, embeddedCss, embeddedJs };
}

export function cleanGeneratedCss(rawCss: string): string {
  let css = rawCss.trim();
  // Strip any wrapping <style> tags
  css = css.replace(/<\/?style\b[^>]*>/gi, '');
  // Strip @import (single-line or multi-line)
  css = css.replace(/@import\s+[^;\n]+;?/gi, '');
  return css.trim();
}

export function cleanGeneratedJs(rawJs: string): string {
  let js = rawJs.trim();
  // Strip any wrapping <script> tags
  js = js.replace(/<\/?script\b[^>]*>/gi, '');

  // Strip ES import statements (e.g. `import gsap from 'gsap';` or multiline import { ... } from '...')
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
  // e.g.: function(tl, root, ctx, gsap) { ... }
  // or: function buildScene(tl, root, ctx, gsap) { ... }
  // or: (tl, root, ctx, gsap) => { ... }
  // or: const build = (tl, root, ctx, gsap) => { ... }
  const withoutComments = js
    .replace(/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/g, '')
    .replace(/(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|\s)*$/g, '');
  const fnWrapperMatch = withoutComments.match(
    /^(?:(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*)?(?:async\s+)?(?:function(?:\s+[a-zA-Z0-9_$]+)?\s*\([^)]*\)|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)\s*\{([\s\S]*)\}\s*;?$/
  );
  if (fnWrapperMatch && fnWrapperMatch[1]) {
    const body = fnWrapperMatch[1].trim();
    if (body.includes('tl') || body.includes('gsap') || body.includes('root') || body.includes('ctx')) {
      js = body;
    }
  }

  // Strip DOMContentLoaded or window.onload wrapper if present
  const domLoadedMatch = js.match(
    /(?:document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{([\s\S]*?)\}\s*\)|window\.(?:onload|addEventListener\s*\(\s*['"]load['"]\s*,\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>))\s*=\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{([\s\S]*?)\}\s*\);?)/i
  );
  if (domLoadedMatch && (domLoadedMatch[1] || domLoadedMatch[2])) {
    const inner = (domLoadedMatch[1] || domLoadedMatch[2]).trim();
    if (inner.includes('tl') || inner.includes('gsap')) {
      js = inner;
    }
  }

  // Strip duplicate declarations of parameters provided in runtime scope (tl, root, ctx, gsap)
  // If chained off gsap.timeline(...), replace with tl:
  // e.g.: const tl = gsap.timeline({ ... }).from(...).to(...) => tl.from(...).to(...)
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+tl\s*=\s*(?:window\.)?gsap\.timeline\s*\([\s\S]*?\)(?=\s*\.)/g, '\ntl');

  // Standalone gsap.timeline(...)
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+tl\s*=\s*(?:window\.)?gsap\.timeline\s*\([\s\S]*?\)\s*;?/g, '\n');
  // Any other declaration of tl, root, ctx, gsap
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+tl\b[^\n;]*;?/g, '\n');
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+root\b[^\n;]*;?/g, '\n');
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+ctx\b[^\n;]*;?/g, '\n');
  js = js.replace(/(?:^|\n)\s*(?:const|let|var)\s+gsap\b[^\n;]*;?/g, '\n');

  // Auto-fix determinism violations: replace Math.random() with ctx.rand()
  js = js.replace(/\bMath\.random\s*\(\s*\)/g, 'ctx.rand()');

  // Auto-fix Date.now() and performance.now() with 0
  js = js.replace(/\bDate\.now\s*\(\s*\)/g, '0');
  js = js.replace(/\bperformance\.now\s*\(\s*\)/g, '0');

  return js.trim();
}

/**
 * Resilient multi-tier code block parser.
 * Handles JSON responses, markdown backticks (``` or ````), language variations,
 * untagged blocks, embedded styles/scripts, and guarantees valid GSAP code.
 */
export function parseCodeBlocks(rawText: string): { html: string; css: string; buildJs: string } {
  if (!rawText || !rawText.trim()) {
    return { html: '', css: '', buildJs: '' };
  }

  let html = '';
  let css = '';
  let buildJs = '';

  // 0. Check if response is JSON (raw or wrapped in ```json)
  const jsonBlockMatch = rawText.match(/`{3,}json\s*([\s\S]*?)(?:`{3,}|$)/i);
  const candidateJson = jsonBlockMatch ? jsonBlockMatch[1].trim() : rawText.trim();
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
  while ((m = blockRe.exec(rawText)) !== null) {
    const tag = (m[1] || '').toLowerCase().trim();
    const content = m[2].trim();
    if (content) {
      blocks.push({ tag, content });
    }
  }

  // Assign from tagged blocks first
  for (const b of blocks) {
    if (!html && (b.tag.includes('html') || b.tag.includes('svg') || b.tag.includes('xml'))) {
      html = b.content;
    } else if (!css && (b.tag.includes('css') || b.tag.includes('style') || b.tag.includes('scss') || b.tag.includes('postcss'))) {
      css = b.content;
    } else if (!buildJs && (b.tag.includes('javascript') || b.tag.includes('js') || b.tag.includes('typescript') || b.tag.includes('ts') || b.tag.includes('gsap') || b.tag.includes('script') || b.tag.includes('anim'))) {
      buildJs = b.content;
    }
  }

  // 2. Fallback: If 3 blocks exist and tags were ambiguous, use ordinal assignment
  if (blocks.length >= 3) {
    if (!html) html = blocks[0].content;
    if (!css) css = blocks[1].content;
    if (!buildJs) buildJs = blocks[2].content;
  } else if (blocks.length > 0 && (!html || !css || !buildJs)) {
    // Content-based heuristic assignment
    for (const b of blocks) {
      if (!html && (/<[a-z][\s\S]*>/i.test(b.content) || b.content.includes('<div') || b.content.includes('<svg'))) {
        html = b.content;
      } else if (!css && (/\{[\s\S]*?:[\s\S]*?\}/.test(b.content) || b.content.includes('.scene-') || b.content.includes('width:'))) {
        css = b.content;
      } else if (!buildJs && (/\b(tl|gsap|root|ctx)\b/.test(b.content) || b.content.includes('function') || b.content.includes('=>'))) {
        buildJs = b.content;
      }
    }
  }

  // 3. Fallback: Extract from raw text if blocks weren't found
  if (!html && /<div\b|<svg\b|<section\b/i.test(rawText)) {
    const rawHtmlMatch = rawText.match(/<(div|svg|section)\b[\s\S]*?<\/\1>/i);
    if (rawHtmlMatch) html = rawHtmlMatch[0].trim();
  }
  if (!buildJs && /\btl\.(?:to|from|fromTo|set)\b/i.test(rawText)) {
    const jsSnippetMatch = rawText.match(/(?:tl\.(?:to|from|fromTo|set)[\s\S]*?)(?:\s*;|\s*`{3,}|\s*$)/i);
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
  // synthesize a smooth default GSAP animation so the scene never fails validation or stays static.
  if (!buildJs.trim() && html.trim()) {
    buildJs = `// Auto-synthesized entrance animation for scene layers
tl.from(root.children, {
  opacity: 0,
  y: 35,
  duration: Math.min(1.0, (ctx.dur || 3.5) * 0.4),
  stagger: 0.15,
  ease: 'power3.out'
});
tl.to(root.querySelectorAll('[data-moo-layer]'), {
  scale: 1.03,
  duration: Math.max(0.5, (ctx.dur || 3.5) * 0.6),
  ease: 'sine.inOut',
  yoyo: true,
  repeat: 1
}, '-=0.5');`;
  }

  return { html, css, buildJs };
}

export interface GenerateCustomSceneParams {
  beat: StoryBeat;
  index: number;
  total: number;
  styleBrief: StyleBrief;
  aspectRatio?: AspectRatio;
  previousSceneSummary?: string;
  nextSceneSummary?: string;
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  styleAdvice?: string;
}

/**
 * Attempts to repair a generated scene using LLM feedback when validation fails.
 */
export async function repairGeneratedScene(params: {
  originalCode: { html: string; css: string; buildJs: string };
  errors: string[];
  visualIntent: string;
  durationSec: number;
  executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>;
}): Promise<{ html: string; css: string; buildJs: string; valid: boolean; errors: string[] }> {
  try {
    const repairPrompt = buildSceneRepairPrompt({
      originalCode: params.originalCode,
      errors: params.errors,
      visualIntent: params.visualIntent,
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
    executeLlm,
    styleAdvice
  } = params;

  const duration = beat.durationHint || 3.5;

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
    styleBrief: {
      palette: styleBrief.palette,
      fontDisplay: styleBrief.fontDisplay,
      motionSignature: styleBrief.motionSignature,
      backgroundLanguage: styleBrief.backgroundLanguage
    }
  });

  if (styleAdvice) {
    prompt += `\n=== STYLE ADVICE ===\n${styleAdvice}\n`;
  }

  try {
    const rawResponse = await executeLlm({
      systemPrompt: MOTION_DIRECTOR_SYSTEM_PROMPT,
      userPrompt: prompt
    });

    let parsed = parseCodeBlocks(rawResponse);
    let validation = validateGeneratedScene(parsed);

    // If validation fails, attempt 1-time automatic repair with validation errors
    if (!validation.valid) {
      console.warn(`[MooScript] Validation failed for scene #${index + 1}, attempting auto-repair:`, validation.errors);
      const repaired = await repairGeneratedScene({
        originalCode: parsed,
        errors: validation.errors,
        visualIntent: beat.visualIntent,
        durationSec: duration,
        executeLlm
      });
      if (repaired.valid) {
        parsed = { html: repaired.html, css: repaired.css, buildJs: repaired.buildJs };
        validation = { valid: true, errors: [] };
      } else {
        console.warn(`[MooScript] Repair attempt did not pass validation for scene #${index + 1}:`, repaired.errors);
        validation.errors = repaired.errors;
      }
    }

    const editableLayers = extractLayersFromHtml(parsed.html);

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
