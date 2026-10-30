import type { MooProject } from '../../types';

/**
 * Images in scene markup point at the project's asset table (`moo-asset:<id>`) instead of carrying
 * their data inline, so each image is stored once per project, however many shots, edits and undo
 * steps use it. The document builder swaps the references back to data URIs.
 */
export const ASSET_REF_PREFIX = 'moo-asset:';

const REF_RE = /moo-asset:([A-Za-z0-9_-]+)/g;
const EMBEDDED_RE = /(src|href)=(["'])(data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\2/gi;
/** A 1x1 transparent GIF for a reference whose data is missing. */
const MISSING = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export function assetRef(id: string): string {
  return `${ASSET_REF_PREFIX}${id}`;
}

export function resolveAssetRefs(html: string, assetData: Record<string, string> | undefined): string {
  if (!html || html.indexOf(ASSET_REF_PREFIX) === -1) return html;
  return html.replace(REF_RE, (_m, id: string) => assetData?.[id] || MISSING);
}

/** Asset ids referenced anywhere in the project's scene markup. */
export function referencedAssetIds(project: Pick<MooProject, 'composition'>): Set<string> {
  const ids = new Set<string>();
  for (const mod of project.composition?.scenes || []) {
    for (const m of (mod.html || '').matchAll(REF_RE)) ids.add(m[1]);
  }
  return ids;
}

/** Drops table entries no shot uses any more. */
export function pruneAssetData(project: MooProject): MooProject {
  if (!project.assetData) return project;
  const used = referencedAssetIds(project);
  const kept = Object.fromEntries(Object.entries(project.assetData).filter(([id]) => used.has(id)));
  return Object.keys(kept).length === Object.keys(project.assetData).length ? project : { ...project, assetData: kept };
}

/** Short stable id for embedded data (FNV-1a over the whole string). */
function hashId(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `emb-${(h >>> 0).toString(36)}-${data.length.toString(36)}`;
}

/**
 * Moves images embedded as data URIs in scene markup (projects made before asset references)
 * into the asset table. Returns the same object when there is nothing to move.
 */
export function externalizeEmbeddedAssets(project: MooProject): MooProject {
  const comp = project.composition;
  if (!comp?.scenes?.some((m) => (m.html || '').includes(';base64,'))) return project;
  const assetData = { ...(project.assetData || {}) };
  let changed = false;
  const scenes = comp.scenes.map((mod) => {
    if (!mod.html || !mod.html.includes(';base64,')) return mod;
    const html = mod.html.replace(EMBEDDED_RE, (_m, attr: string, quote: string, data: string) => {
      const id = hashId(data);
      assetData[id] = data;
      changed = true;
      return `${attr}=${quote}${assetRef(id)}${quote}`;
    });
    return html === mod.html ? mod : { ...mod, html };
  });
  return changed ? { ...project, assetData, composition: { ...comp, scenes } } : project;
}
