import type { MooProject, AspectRatio, Composition, GeneratedScene } from '../../types';

export function createPendingSceneModule(beatId: string, duration = 3): GeneratedScene {
  return {
    id: beatId,
    beatId,
    duration,
    html: '',
    css: '',
    buildJs: '',
    status: 'pending',
    version: 1,
    userEdited: false
  };
}

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

/**
 * Pure metadata and sequence synchronization for Composition.
 * 
 * CRITICAL RULE:
 * `syncComposition` NEVER builds visual templates or invokes fallback templates.
 * If a storyboard scene lacks a generated module, its module status is marked 'pending'.
 * User-edited and AI-generated modules are strictly preserved.
 */
export function syncComposition(project: MooProject): MooProject {
  const width = project.width || 1080;
  const height = project.height || 1920;
  const fps = project.fps || 30;
  const now = Date.now();

  const existingComp = project.composition;
  const existingModulesByBeatId = new Map<string, GeneratedScene>();
  if (existingComp?.scenes) {
    for (const mod of existingComp.scenes) {
      existingModulesByBeatId.set(mod.beatId, mod);
    }
  }

  // Map each scene in project.scenes order; preserve existing modules or mark pending
  const syncedScenes: GeneratedScene[] = (project.scenes || []).map((scene) => {
    const existing = existingModulesByBeatId.get(scene.id);
    if (existing) {
      return {
        ...existing,
        id: scene.id,
        beatId: scene.id,
        duration: scene.durationInSeconds || existing.duration || 3
      };
    }
    // New scene without generated module -> pending (NOT a template!)
    return createPendingSceneModule(scene.id, scene.durationInSeconds || 3);
  });

  const totalDuration = syncedScenes.reduce((acc, s) => acc + (s.duration || 3), 0);

  const composition: Composition = {
    id: existingComp?.id || `comp-${project.id}`,
    width,
    height,
    fps,
    duration: totalDuration,
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
