import type { MooProject, GeneratedScene, Composition } from '../../types';
import { CURRENT_SCHEMA_VERSION } from '../../types';
import { buildLegacySceneModule } from '../legacy/legacyTemplates';
import { createPendingSceneModule } from './sync';

/**
 * Migrates legacy (v1 template-based) projects to the v2 generative mograph format.
 *
 * If an old project has `layout` / `visualData` fields on its scenes, this converts
 * them ONCE into independent `GeneratedScene` modules in `project.composition`.
 * After migration, the legacy layout templates are never consulted again.
 */
export function migrateLegacyProject(project: MooProject): MooProject {
  const width = project.width || 1080;
  const height = project.height || 1920;
  const fps = project.fps || 30;
  const now = Date.now();

  const isAlreadyV2 =
    project.schemaVersion === CURRENT_SCHEMA_VERSION &&
    project.renderMode === 'composition' &&
    !!project.composition &&
    (project.composition.scenes || []).length > 0;

  if (isAlreadyV2) {
    return project;
  }

  const existingComp = project.composition;
  const existingModulesByBeatId = new Map<string, GeneratedScene>();
  if (existingComp?.scenes) {
    for (const mod of existingComp.scenes) {
      existingModulesByBeatId.set(mod.beatId, mod);
    }
  }

  const migratedScenes: GeneratedScene[] = (project.scenes || []).map((scene) => {
    const existing = existingModulesByBeatId.get(scene.id);
    if (existing && existing.status === 'ok' && existing.html) {
      return {
        ...existing,
        id: scene.id,
        beatId: scene.id,
        duration: scene.durationInSeconds || existing.duration || 3
      };
    }

    // If scene has legacy layout definition, convert it once via legacy builder
    if (scene.layout) {
      const legacyMod = buildLegacySceneModule(scene, project.theme, { width, height });
      return {
        ...legacyMod,
        id: scene.id,
        beatId: scene.id,
        duration: scene.durationInSeconds || 3,
        generatorVersion: 'legacy-migrated',
        userEdited: false
      };
    }

    return createPendingSceneModule(scene.id, scene.durationInSeconds || 3);
  });

  const totalDuration = migratedScenes.reduce((acc, s) => acc + (s.duration || 3), 0);

  const composition: Composition = {
    id: existingComp?.id || `comp-${project.id}`,
    width,
    height,
    fps,
    duration: totalDuration,
    globalCss: existingComp?.globalCss || `body { background: ${project.theme?.bg || '#09090b'}; }`,
    globalBuildJs: existingComp?.globalBuildJs,
    scenes: migratedScenes,
    createdAt: existingComp?.createdAt || project.createdAt || now,
    updatedAt: existingComp?.updatedAt || project.updatedAt || now
  };

  const updatedScenes = (project.scenes || []).map((scene) => {
    if (!scene.visualIntent) {
      const fallbackIntent = scene.visualData?.title
        ? `${scene.visualData.title}: ${scene.narrationText || scene.text || ''}`
        : scene.narrationText || scene.text || `Adegan`;
      return {
        ...scene,
        visualIntent: fallbackIntent
      };
    }
    return scene;
  });

  return {
    ...project,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    renderMode: 'composition',
    scenes: updatedScenes,
    composition,
    updatedAt: project.updatedAt || now
  };
}
