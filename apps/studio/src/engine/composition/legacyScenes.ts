import type { GeneratedScene, MooProject } from '../../types';
import { findForeignApis, foreignApiMessage } from './validator';

/**
 * Scenes whose code is written for another animation API (GSAP-style tl / gsap calls, old option
 * names) do not run on MooTween. They keep their code and are marked 'needs-repair' so the studio can
 * offer an AI translation into the MooScript API. The code itself is never rewritten here.
 */

/** True when the scene has code to show: generated fine, or generated and awaiting repair. */
export function sceneHasRenderableCode(scene: Pick<GeneratedScene, 'status' | 'html'> | undefined | null): boolean {
  return Boolean(scene && (scene.status === 'ok' || scene.status === 'needs-repair') && (scene.html || '').trim());
}

/** Status and errors a scene should carry for the foreign APIs its code uses; null when nothing changes. */
export function repairStateFor(scene: GeneratedScene): Pick<GeneratedScene, 'status' | 'errors'> | null {
  if (scene.status !== 'ok' && scene.status !== 'needs-repair') return null;
  const apis = findForeignApis(scene.buildJs || '');
  if (apis.length > 0) return { status: 'needs-repair', errors: apis.map(foreignApiMessage) };
  return scene.status === 'needs-repair' ? { status: 'ok', errors: undefined } : null;
}

/** Marks every scene written for another animation API as 'needs-repair' (and clears stale marks). */
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
