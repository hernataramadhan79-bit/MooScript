import type { MooProject, AspectRatio, Composition, SceneModule } from '../../types';
import { buildSceneModule } from './sceneTemplates';

export function applySize(
  project: MooProject,
  aspect: AspectRatio,
  tier: '1080p' | '720p' = '1080p'
): MooProject {
  const is1080p = tier === '1080p';
  let width = 1080;
  let height = 1920;

  if (aspect === '9:16') {
    width = is1080p ? 1080 : 720;
    height = is1080p ? 1920 : 1280;
  } else if (aspect === '16:9') {
    width = is1080p ? 1920 : 1280;
    height = is1080p ? 1080 : 720;
  } else if (aspect === '1:1') {
    width = is1080p ? 1080 : 720;
    height = is1080p ? 1080 : 720;
  }

  const updatedComp: Composition | undefined = project.composition
    ? {
        ...project.composition,
        width,
        height
      }
    : undefined;

  return {
    ...project,
    aspectRatio: aspect,
    resolution: tier,
    width,
    height,
    composition: updatedComp
  };
}

export function syncComposition(project: MooProject): MooProject {
  const width = project.width || 1080;
  const height = project.height || 1920;
  const fps = project.fps || 30;
  const now = Date.now();

  const existingComp = project.composition;
  const existingModulesByBeatId = new Map<string, SceneModule>();
  if (existingComp?.scenes) {
    for (const mod of existingComp.scenes) {
      existingModulesByBeatId.set(mod.beatId, mod);
    }
  }

  // Map each scene in project.scenes order; drop modules whose beatId is no longer present
  const syncedScenes: SceneModule[] = project.scenes.map((scene) => {
    const existing = existingModulesByBeatId.get(scene.id);
    if (existing && existing.userEdited === true) {
      return existing;
    }
    return buildSceneModule(scene, project.theme, { width, height });
  });

  const composition: Composition = {
    id: existingComp?.id || `comp-${project.id}`,
    width,
    height,
    fps,
    globalCss: existingComp?.globalCss || '',
    globalBuildJs: existingComp?.globalBuildJs,
    scenes: syncedScenes,
    createdAt: existingComp?.createdAt || now,
    updatedAt: now
  };

  return {
    ...project,
    renderMode: 'composition',
    composition,
    updatedAt: now
  };
}
