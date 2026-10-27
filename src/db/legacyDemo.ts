import type { MooProject } from '../types';
import { db, deleteProjectFromDb, loadBgmFromDb } from './mooDb';

/**
 * Older builds seeded every install with a "WebCodecs Architecture" demo project. New installs
 * start empty; on startup an existing user's copy of that demo is removed, but only while it is
 * still exactly as shipped. Any edit (script, code, layers, theme, voice-over, music, assets)
 * keeps the project.
 */
export const LEGACY_DEMO_PROJECT_ID = 'moo-default-project';

const DEMO_TITLE = 'WebCodecs Architecture';

const DEMO_NARRATION: Record<string, string> = {
  'sc-1': 'Zero server rendering directly inside your browser tabs',
  'sc-2': 'WebCodecs Hardware acceleration with deterministic canvas math',
  'sc-3': 'Instant 1080p MP4 exports with zero memory leaks'
};

// FNV-1a of `html \0 css \0 buildJs` for every demo scene shipped in the app's history.
const DEMO_SCENE_CODE_HASHES = new Set([
  '34c14fc5',
  'f464702b',
  '9f0bd5af',
  '18f5b204',
  'cb351b15',
  'a581a613',
  'ea4bf121'
]);

const DEMO_THEME = { bg: '#09090b', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' };

export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function demoSceneCodeHash(code: { html?: string; css?: string; buildJs?: string }): string {
  return fnv1a([code.html || '', code.css || '', code.buildJs || ''].join('\u0000'));
}

const isEmptyRecord = (value: unknown) => !value || Object.keys(value as object).length === 0;

/** True when the project content is the untouched demo (storage side effects are checked separately). */
export function isPristineLegacyDemo(project: MooProject): boolean {
  if (project.id !== LEGACY_DEMO_PROJECT_ID || project.title !== DEMO_TITLE) return false;
  if ((project.aspectRatio || '9:16') !== '9:16') return false;

  const theme = project.theme || ({} as MooProject['theme']);
  if (
    theme.bg !== DEMO_THEME.bg ||
    theme.textPrimary !== DEMO_THEME.textPrimary ||
    theme.textHighlight !== DEMO_THEME.textHighlight ||
    theme.fontFamily !== DEMO_THEME.fontFamily
  ) {
    return false;
  }

  const scenes = project.scenes || [];
  const ids = Object.keys(DEMO_NARRATION);
  if (scenes.length !== ids.length) return false;
  for (let i = 0; i < ids.length; i++) {
    const scene = scenes[i];
    const narration = scene.narrationText ?? scene.text ?? '';
    if (scene.id !== ids[i] || narration !== DEMO_NARRATION[ids[i]]) return false;
    if (scene.assignedAssets && scene.assignedAssets.length > 0) return false;
  }

  for (const mod of project.composition?.scenes || []) {
    if (!isEmptyRecord(mod.overrides) || !isEmptyRecord(mod.palette)) return false;
    const shippedCode =
      DEMO_SCENE_CODE_HASHES.has(demoSceneCodeHash(mod)) ||
      // The oldest builds had no hand-written demo code; migration generated it.
      mod.generatorVersion === 'legacy-migrated' ||
      (mod.status === 'pending' && !(mod.html || '').trim());
    if (!shippedCode) return false;
  }
  return true;
}

/**
 * Deletes the stored legacy demo when it is still pristine and has no voice-over, custom music
 * or uploaded assets of its own. Returns true when it was removed.
 */
export async function removePristineLegacyDemo(project: MooProject | undefined): Promise<boolean> {
  if (!project || !isPristineLegacyDemo(project)) return false;
  try {
    const [audio, bgm, assetCount] = await Promise.all([
      db.audioBlobs.get(project.id),
      loadBgmFromDb(project.id),
      db.assets.where('projectId').equals(project.id).count()
    ]);
    if (audio || bgm || assetCount > 0 || (project.bgm?.preset || 'none') !== 'none') return false;
    await deleteProjectFromDb(project.id);
    return true;
  } catch (err) {
    console.warn('[MooScript] Could not check the legacy demo project, keeping it', err);
    return false;
  }
}
