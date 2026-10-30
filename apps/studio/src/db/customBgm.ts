import { loadBgmFromDb } from './mooDb';
import { decodeCustomBgm, setCustomBgmBuffer } from '../engine/audio/bgmMixer';

export const MAX_CUSTOM_BGM_BYTES = 25 * 1024 * 1024;

/** Point the mixer at this project's uploaded track (or clear it). Call whenever the active project changes. */
export async function syncCustomBgmForProject(projectId: string): Promise<void> {
  setCustomBgmBuffer(null);
  const stored = await loadBgmFromDb(projectId);
  if (!stored) return;
  try {
    setCustomBgmBuffer(await decodeCustomBgm(stored.blob));
  } catch (err) {
    console.warn('Custom BGM could not be decoded', err);
  }
}
