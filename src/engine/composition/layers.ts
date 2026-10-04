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
 * GSAP writes the shorthand `transform` inline while the timeline plays; the CSS *individual*
 * transform properties (`translate`, `scale`, `rotate`) are separate and compose with it, and
 * `filter: opacity()` multiplies with GSAP's inline `opacity`. That lets user tweaks coexist with
 * the generated animation instead of fighting it.
 */
export function compileOverridesCss(sceneDomId: string, overrides?: Record<string, LayerOverride>): string {
  if (!overrides) return '';
  const rules: string[] = [];
  for (const [rawId, o] of Object.entries(overrides)) {
    if (!o) continue;
    const id = sanitizeLayerId(rawId);
    const decls: string[] = [];
    const x = num(o.x);
    const y = num(o.y);
    if ((x !== undefined && x !== 0) || (y !== undefined && y !== 0)) {
      decls.push(`translate: ${x ?? 0}px ${y ?? 0}px`);
    }
    const sc = num(o.scale);
    if (sc !== undefined && sc !== 1) decls.push(`scale: ${sc}`);
    const rot = num(o.rotation);
    if (rot !== undefined && rot !== 0) decls.push(`rotate: ${rot}deg`);
    const op = num(o.opacity);
    if (op !== undefined && op !== 1) decls.push(`filter: opacity(${Math.min(1, Math.max(0, op))})`);
    if (typeof o.color === 'string' && /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s.,%]+\)$|^hsla?\([\d\s.,%]+\)$/.test(o.color.trim())) {
      decls.push(`color: ${o.color.trim()} !important`, `fill: ${o.color.trim()} !important`);
    }
    if (decls.length) {
      rules.push(`#${sceneDomId} [data-moo-layer="${id}"] { ${decls.join('; ')}; }`);
    }
  }
  return rules.join('\n');
}

export function compilePaletteVars(palette: Partial<ScenePalette> | undefined): string {
  if (!palette) return '';
  const safe = (v?: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s.,%]+\)$/.test(v.trim()) ? v.trim() : undefined);
  const parts: string[] = [];
  const bg = safe(palette.bg);
  const primary = safe(palette.primary);
  const accent = safe(palette.accent);
  const text = safe(palette.text);
  if (bg) parts.push(`--moo-bg: ${bg}`);
  if (primary) parts.push(`--moo-primary: ${primary}`);
  if (accent) parts.push(`--moo-accent: ${accent}`);
  if (text) parts.push(`--moo-text: ${text}`);
  return parts.join('; ');
}
