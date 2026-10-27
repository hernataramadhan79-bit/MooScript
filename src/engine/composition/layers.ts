import type { EditableLayer, EditableLayerType, LayerOverride, ScenePalette } from '../../types';

/**
 * Editable-layer helpers.
 *
 * Generated scenes tag meaningful elements with a stable `data-moo-layer="<id>"`
 * attribute. The editor never needs to understand the scene's structure — it only
 * needs these identifiers to offer inspection, text edits and non-destructive
 * transforms.
 */

const LAYER_ATTR_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)\sdata-moo-layer\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*)>/g;

export function sanitizeLayerId(id: string): string {
  return String(id).trim().replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function escapeLayerAttrSelector(id: string): string {
  const str = String(id).trim();
  if (!/^[a-zA-Z0-9_\s-]+$/.test(str)) {
    return sanitizeLayerId(str);
  }
  return str.replace(/["\\]/g, '\\$&');
}

function humanize(id: string): string {
  const spaced = id.replace(/[-_]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : id;
}

function guessLayerType(tag: string): EditableLayerType {
  const t = tag.toLowerCase();
  if (t === 'svg') return 'svg';
  if (t === 'img' || t === 'picture' || t === 'canvas') return 'image';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'label', 'blockquote'].includes(t)) {
    return 'text';
  }
  if (['path', 'circle', 'rect', 'line', 'polygon', 'ellipse', 'polyline'].includes(t)) return 'shape';
  return 'group';
}

const DEFAULT_PROPS: Record<EditableLayerType, string[]> = {
  text: ['text', 'position', 'scale', 'rotation', 'opacity', 'color'],
  shape: ['position', 'scale', 'rotation', 'opacity', 'color'],
  group: ['position', 'scale', 'rotation', 'opacity'],
  image: ['position', 'scale', 'rotation', 'opacity'],
  svg: ['position', 'scale', 'rotation', 'opacity', 'color'],
  custom: ['position', 'scale', 'rotation', 'opacity']
};

/** Discover layers directly from `data-moo-layer` attributes in the scene markup. */
export function extractLayersFromHtml(html: string): EditableLayer[] {
  const seen = new Set<string>();
  const layers: EditableLayer[] = [];
  const re = new RegExp(LAYER_ATTR_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || '')) !== null) {
    const tag = m[1];
    const id = m[3] ?? m[4];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const type = guessLayerType(tag);
    layers.push({ id, label: humanize(id), type, editableProperties: DEFAULT_PROPS[type] });
  }
  return layers;
}

/**
 * Merge the manifest declared by the generator with what is actually present in the markup.
 * Declared entries win for label/type/properties, but a layer that is not in the markup is dropped
 * (the editor must never offer a handle that points at nothing), and undeclared layers are discovered.
 */
export function mergeEditableLayers(declared: EditableLayer[] | undefined, html: string): EditableLayer[] {
  const discovered = extractLayersFromHtml(html);
  const byId = new Map(discovered.map((l) => [l.id, l]));
  const merged: EditableLayer[] = [];
  const used = new Set<string>();

  for (const d of declared || []) {
    if (!d || typeof d.id !== 'string') continue;
    const found = byId.get(d.id);
    if (!found || used.has(d.id)) continue;
    used.add(d.id);
    merged.push({
      id: d.id,
      label: d.label || found.label,
      type: d.type || found.type,
      editableProperties: d.editableProperties && d.editableProperties.length ? d.editableProperties : found.editableProperties
    });
  }
  for (const f of discovered) {
    if (!used.has(f.id)) merged.push(f);
  }
  return merged;
}

/** Read the plain text of the first layer with the given id (tags stripped). */
export function getLayerText(html: string, layerId: string): string {
  const range = findLayerInnerRange(html, layerId);
  if (!range) return '';
  return decodeEntities(html.slice(range.start, range.end).replace(/<[^>]*>/g, '')).trim();
}

/** Replace the inner content of a layer with escaped plain text. Returns the same html when the layer is not found. */
export function setLayerText(html: string, layerId: string, text: string): string {
  const range = findLayerInnerRange(html, layerId);
  if (!range) return html;
  const inner = html.slice(range.start, range.end);
  // Check if inner content is wrapped in a single wrapper element (e.g. <span class="accent">...</span>)
  const singleTagMatch = inner.match(/^(\s*<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>)([\s\S]*?)(<\/\2>\s*)$/);
  if (singleTagMatch) {
    const openTag = singleTagMatch[1];
    const closeTag = singleTagMatch[4];
    return html.slice(0, range.start) + openTag + escapeText(text) + closeTag + html.slice(range.end);
  }
  return html.slice(0, range.start) + escapeText(text) + html.slice(range.end);
}

function findLayerInnerRange(html: string, layerId: string): { start: number; end: number } | null {
  const re = new RegExp(LAYER_ATTR_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || '')) !== null) {
    const id = m[3] ?? m[4];
    if (id !== layerId) continue;
    const tag = m[1];
    const openEnd = m.index + m[0].length;
    if (m[0].endsWith('/>')) return null; // self-closing: no inner content
    // Find the matching closing tag with nesting awareness.
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    tagRe.lastIndex = openEnd;
    let depth = 1;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(html)) !== null) {
      if (t[0].endsWith('/>')) continue;
      depth += t[1] ? -1 : 1;
      if (depth === 0) return { start: openEnd, end: t.index };
    }
    return null;
  }
  return null;
}

/** Remove a layer element (and its wrapper container if present) from the scene markup. */
export function removeLayerFromHtml(html: string, layerId: string): string {
  if (!html) return '';
  const re = new RegExp(LAYER_ATTR_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[3] ?? m[4];
    if (id !== layerId) continue;
    const tag = m[1];
    const elemStart = m.index;
    let elemEnd = m.index + m[0].length;

    if (!m[0].endsWith('/>')) {
      const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
      tagRe.lastIndex = elemEnd;
      let depth = 1;
      let t: RegExpExecArray | null;
      while ((t = tagRe.exec(html)) !== null) {
        if (t[0].endsWith('/>')) continue;
        depth += t[1] ? -1 : 1;
        if (depth === 0) {
          elemEnd = t.index + t[0].length;
          break;
        }
      }
    }

    // Check if wrapped by .moo-asset-container
    const before = html.slice(0, elemStart);
    const after = html.slice(elemEnd);
    const containerOpenMatch = before.match(/(?:\n|\r\n)?\s*<div\b[^>]*class="[^"]*moo-asset-container[^"]*"[^>]*>\s*$/);
    const containerCloseMatch = after.match(/^\s*<\/div>(?:\n|\r\n)?/);

    if (containerOpenMatch && containerCloseMatch) {
      const fullStart = elemStart - containerOpenMatch[0].length;
      const fullEnd = elemEnd + containerCloseMatch[0].length;
      return (html.slice(0, fullStart) + html.slice(fullEnd)).trim();
    }

    return (html.slice(0, elemStart) + html.slice(elemEnd)).trim();
  }
  return html;
}

/** Remove an asset from HTML markup either by its layerId or its dataUrl. */
export function removeAssetFromHtml(html: string, identifier: string): string {
  if (!html || !identifier) return html;
  const afterLayer = removeLayerFromHtml(html, identifier);
  if (afterLayer !== html) return afterLayer;

  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const containerRe = new RegExp(
    `(?:\\n|\\r\\n)?\\s*<div\\b[^>]*class="[^"]*moo-asset-container[^"]*"[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/div>(?:\\n|\\r\\n)?`,
    'g'
  );
  if (containerRe.test(html)) {
    return html.replace(containerRe, '').trim();
  }

  const imgRe = new RegExp(
    `(?:\\n|\\r\\n)?\\s*<img\\b[^>]*src=["']?${escaped}["']?[^>]*>(?:\\n|\\r\\n)?`,
    'gi'
  );
  if (imgRe.test(html)) {
    return html.replace(imgRe, '').trim();
  }

  return html;
}

function escapeText(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function num(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * Compile non-destructive layer overrides into CSS.
 *
 * MooTween writes the shorthand `transform` inline while the timeline plays; the CSS *individual*
 * transform properties (`translate`, `scale`, `rotate`) are separate and compose with it, and
 * `filter: opacity()` multiplies with the inline `opacity`. That lets user tweaks coexist with
 * the generated animation instead of fighting it, in the editor and in the export alike.
 *
 * MooTween never writes translate/scale/rotate. `important` is still used by the editor's live
 * override stylesheet so it wins over inline values a scene's own code may set.
 */
export function compileOverridesCss(
  sceneDomId: string,
  overrides?: Record<string, LayerOverride>,
  options?: { important?: boolean }
): string {
  if (!overrides) return '';
  const imp = options?.important ? ' !important' : '';
  const safeDomId = String(sceneDomId).trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const rules: string[] = [];
  for (const [rawId, o] of Object.entries(overrides)) {
    if (!o) continue;
    const selectorVal = escapeLayerAttrSelector(rawId);
    const sanitized = sanitizeLayerId(rawId);
    const selector = selectorVal !== sanitized
      ? `#${safeDomId} [data-moo-layer="${selectorVal}"], #${safeDomId} [data-moo-layer="${sanitized}"]`
      : `#${safeDomId} [data-moo-layer="${selectorVal}"]`;
    const decls: string[] = [];

    if (o.hidden === true) {
      decls.push('display: none !important');
    }

    const x = num(o.x);
    const y = num(o.y);
    if ((x !== undefined && x !== 0) || (y !== undefined && y !== 0)) {
      decls.push(`translate: ${x ?? 0}px ${y ?? 0}px${imp}`);
    }

    const sc = num(o.scale);
    if (sc !== undefined && sc !== 1) {
      const sx = o.flipX ? -sc : sc;
      const sy = o.flipY ? -sc : sc;
      if (sx === sy) {
        decls.push(`scale: ${sx}${imp}`);
      } else {
        decls.push(`scale: ${sx} ${sy}${imp}`);
      }
    } else if (o.flipX || o.flipY) {
      const base = sc ?? 1;
      const sx = o.flipX ? -base : base;
      const sy = o.flipY ? -base : base;
      if (sx === sy) {
        decls.push(`scale: ${sx}${imp}`);
      } else {
        decls.push(`scale: ${sx} ${sy}${imp}`);
      }
    }

    const rot = num(o.rotation);
    if (rot !== undefined && rot !== 0) {
      decls.push(`rotate: ${rot}deg${imp}`);
    }

    const op = num(o.opacity);
    if (op !== undefined && op !== 1) {
      decls.push(`filter: opacity(${Math.min(1, Math.max(0, op))})`);
    }

    const zi = num(o.zIndex);
    if (zi !== undefined) {
      decls.push(`z-index: ${zi} !important`);
    }

    const fs = num(o.fontSizeScale);
    if (fs !== undefined && fs !== 1) {
      decls.push(`font-size: calc(100% * ${fs}) !important`);
    }

    if (o.textAlign && ['left', 'center', 'right'].includes(o.textAlign)) {
      decls.push(`text-align: ${o.textAlign} !important`);
    }

    const br = num(o.borderRadius);
    if (br !== undefined) {
      decls.push(`border-radius: ${br}px !important`);
    }

    const col = typeof o.color === 'string' && /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s.,%]+\)$|^hsla?\([\d\s.,%]+\)$/.test(o.color.trim())
      ? o.color.trim()
      : undefined;

    if (col) {
      decls.push(`color: ${col} !important`, `fill: ${col} !important`, `border-color: ${col} !important`);
      if (o.layerType === 'shape') {
        decls.push(`background-color: ${col} !important`);
      }
    }

    if (decls.length) {
      rules.push(`${selector} { ${decls.join('; ')}; }`);
    }

    if (col) {
      const childSelector = selectorVal !== sanitized
        ? `#${safeDomId} [data-moo-layer="${selectorVal}"] *, #${safeDomId} [data-moo-layer="${sanitized}"] *`
        : `#${safeDomId} [data-moo-layer="${selectorVal}"] *`;
      const svgSelector = selectorVal !== sanitized
        ? `#${safeDomId} [data-moo-layer="${selectorVal}"] :is(svg, path, circle, rect, polygon, ellipse), #${safeDomId} :is(path, circle, rect, polygon, ellipse)[data-moo-layer="${selectorVal}"], #${safeDomId} [data-moo-layer="${sanitized}"] :is(svg, path, circle, rect, polygon, ellipse), #${safeDomId} :is(path, circle, rect, polygon, ellipse)[data-moo-layer="${sanitized}"]`
        : `#${safeDomId} [data-moo-layer="${selectorVal}"] :is(svg, path, circle, rect, polygon, ellipse), #${safeDomId} :is(path, circle, rect, polygon, ellipse)[data-moo-layer="${selectorVal}"]`;
      const shapeSelector = selectorVal !== sanitized
        ? `#${safeDomId} [data-moo-layer="${selectorVal}"]:is([class*="bar"], [class*="line"], [class*="dot"], [class*="divider"], [class*="shape"], :empty), #${safeDomId} [data-moo-layer="${sanitized}"]:is([class*="bar"], [class*="line"], [class*="dot"], [class*="divider"], [class*="shape"], :empty)`
        : `#${safeDomId} [data-moo-layer="${selectorVal}"]:is([class*="bar"], [class*="line"], [class*="dot"], [class*="divider"], [class*="shape"], :empty)`;

      rules.push(
        `${childSelector} { color: ${col} !important; }`,
        `${svgSelector} { fill: ${col} !important; stroke: ${col} !important; }`,
        `${shapeSelector} { background-color: ${col} !important; }`
      );
    }

    if (zi !== undefined) {
      const relSelector = selectorVal !== sanitized
        ? `#${safeDomId} [data-moo-layer="${selectorVal}"]:not([class*="absolute"]), #${safeDomId} [data-moo-layer="${sanitized}"]:not([class*="absolute"])`
        : `#${safeDomId} [data-moo-layer="${selectorVal}"]:not([class*="absolute"])`;
      rules.push(`${relSelector} { position: relative; }`);
    }
  }
  return rules.join('\n');
}

function sanitizePaletteColor(v?: string): string | undefined {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s.,%]+\)$|^hsla?\([\d\s.,%]+\)$/.test(v.trim()) ? v.trim() : undefined;
}

export function compilePaletteVars(
  paletteOrDomId: string | Partial<ScenePalette> | undefined,
  maybePalette?: Partial<ScenePalette>
): string {
  if (typeof paletteOrDomId === 'string') {
    return compileScenePaletteCss(paletteOrDomId, maybePalette);
  }
  if (!paletteOrDomId) return '';
  const parts: string[] = [];
  const bg = sanitizePaletteColor(paletteOrDomId.bg);
  const primary = sanitizePaletteColor(paletteOrDomId.primary);
  const accent = sanitizePaletteColor(paletteOrDomId.accent);
  const text = sanitizePaletteColor(paletteOrDomId.text);
  if (bg) parts.push(`--moo-bg: ${bg}`);
  if (primary) parts.push(`--moo-primary: ${primary}`);
  if (accent) parts.push(`--moo-accent: ${accent}`);
  if (text) parts.push(`--moo-text: ${text}`);
  return parts.join('; ');
}

export function compileScenePaletteCss(sceneDomId: string, palette: Partial<ScenePalette> | undefined): string {
  if (!palette) return '';
  const safeDomId = String(sceneDomId).trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const bg = sanitizePaletteColor(palette.bg);
  const primary = sanitizePaletteColor(palette.primary);
  const accent = sanitizePaletteColor(palette.accent);
  const text = sanitizePaletteColor(palette.text);

  if (!bg && !primary && !accent && !text) return '';

  const vars = compilePaletteVars(palette);
  const lines: string[] = [];
  lines.push(`#${safeDomId} {`);
  if (vars) lines.push(`  ${vars};`);
  if (bg) lines.push(`  background-color: var(--moo-bg) !important;`);
  if (text) lines.push(`  color: var(--moo-text);`);
  lines.push(`}`);

  if (bg) {
    lines.push(`#${safeDomId} > div:first-child, #${safeDomId} [class*="container"], #${safeDomId} [class*="root"] { background-color: var(--moo-bg) !important; }`);
  }
  if (accent) {
    lines.push(`#${safeDomId} .accent, #${safeDomId} [class*="accent"], #${safeDomId} [class*="highlight"], #${safeDomId} [class*="badge"] { color: var(--moo-accent) !important; border-color: var(--moo-accent) !important; }`);
  }
  if (primary) {
    lines.push(`#${safeDomId} [class*="primary"], #${safeDomId} h1, #${safeDomId} h2 { color: var(--moo-primary) !important; }`);
  }
  if (text) {
    lines.push(`#${safeDomId} [class*="sub"], #${safeDomId} [class*="narration"], #${safeDomId} p { color: var(--moo-text) !important; }`);
  }

  return lines.join('\n');
}
