import type { MooProject, Scene } from '../types';

/** Length a scene gets when it has no duration of its own. */
export const DEFAULT_SCENE_SECONDS = 3;
/** Longest duration a single scene can be given from the editor. */
export const MAX_SCENE_SECONDS = 60;

export function sceneSeconds(scene: Pick<Scene, 'durationInSeconds'>): number {
  return scene.durationInSeconds > 0 ? scene.durationInSeconds : DEFAULT_SCENE_SECONDS;
}

/**
 * Length of the film in seconds. The scenes decide it (that is what the stage renders and the
 * timeline draws); the voice-over length is only used while there are no scenes yet. Timeline,
 * playback and keyboard shortcuts all read this so the playhead and the clock never disagree.
 */
export function getProjectDuration(
  project: Pick<MooProject, 'scenes' | 'audioDuration' | 'composition'>
): number {
  const scenes = project.scenes || [];
  const fromScenes = scenes.reduce((sum, s) => sum + sceneSeconds(s), 0);
  if (fromScenes > 0) return fromScenes;
  if (project.audioDuration && project.audioDuration > 0) return project.audioDuration;
  if (project.composition?.duration && project.composition.duration > 0) return project.composition.duration;
  return 0;
}

/** Start time in seconds of the scene with this id, or null when it does not exist. */
export function getSceneStartSeconds(scenes: Scene[], sceneId: string): number | null {
  let acc = 0;
  for (const s of scenes) {
    if (s.id === sceneId) return acc;
    acc += sceneSeconds(s);
  }
  return null;
}
