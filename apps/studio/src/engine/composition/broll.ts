import type { Scene, SceneBroll } from '../../types';
import { sceneSeconds } from '../../utils/projectDuration';

/** The B-roll playing at a film time: which shot, its settings, and the time inside the video. */
export function activeBrollAt(
  scenes: Scene[],
  timeSec: number
): { sceneId: string; broll: SceneBroll; videoTime: number } | null {
  let start = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const end = start + sceneSeconds(s);
    // The last frame of the film belongs to the last shot.
    if (timeSec >= start && (timeSec < end || i === scenes.length - 1)) {
      return s.broll ? { sceneId: s.id, broll: s.broll, videoTime: s.broll.start + Math.max(0, timeSec - start) } : null;
    }
    start = end;
  }
  return null;
}
