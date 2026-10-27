import type { GeneratedScene, MooProject } from '../../types';
import { findUnsupportedTimelineApis, unsupportedTimelineApiMessage } from './validator';

/**
 * Scenes saved before MooTween may call APIs it does not have (GSAP plugins, ticker, context ...).
 * They keep their code and keep rendering, since MooTween skips what it cannot run, but they are
 * marked 'needs-repair' so the studio can offer an AI repair. The code itself is never rewritten here.
 */

/** True when the scene has code the stage can run: generated fine, or generated and awaiting repair. */
export function sceneHasRenderableCode(scene: Pick<GeneratedScene, 'status' | 'html'> | undefined | null): boolean {
  return Boolean(scene && (scene.status === 'ok' || scene.status === 'needs-repair') && (scene.html || '').trim());
}

/** Status and errors a scene should carry for the APIs its code uses; null when nothing changes. */
export function repairStateFor(scene: GeneratedScene): Pick<GeneratedScene, 'status' | 'errors'> | null {
  if (scene.status !== 'ok' && scene.status !== 'needs-repair') return null;
  const apis = findUnsupportedTimelineApis(scene.buildJs || '');
  if (apis.length > 0) return { status: 'needs-repair', errors: apis.map(unsupportedTimelineApiMessage) };
  return scene.status === 'needs-repair' ? { status: 'ok', errors: undefined } : null;
}

/** Marks every scene that uses APIs outside MooTween as 'needs-repair' (and clears stale marks). */
export function flagScenesNeedingRepair(project: MooProject): MooProject {
  const scenes = project.composition?.scenes;
  if (!scenes || scenes.length === 0) return project;
  let changed = false;
  const next = scenes.map((scene) => {
    const state = repairStateFor(scene);
    if (!state) return scene;
    changed = true;
    return { ...scene, ...state };
  });
  return changed ? { ...project, composition: { ...project.composition!, scenes: next } } : project;
}
