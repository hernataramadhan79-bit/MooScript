import type { MooProject } from '../types';
import { loadVoiceTrackFromDb } from './mooDb';

export interface ProjectVoice {
  /** The narration before BGM mixing, when the project has one. */
  rawVoiceBlob: Blob | null;
  /** The project audio is background music only (no voice-over). */
  bgmOnlyAudio: boolean;
}

export const NO_VOICE: ProjectVoice = { rawVoiceBlob: null, bgmOnlyAudio: false };

/** What the saved project audio is made of, so a BGM change can remix it instead of replacing it. */
export async function loadProjectVoice(project: MooProject): Promise<ProjectVoice> {
  if (!project.audioBlob) return NO_VOICE;
  const stored = await loadVoiceTrackFromDb(project.id);
  if (stored?.kind === 'voice' && stored.blob) return { rawVoiceBlob: stored.blob, bgmOnlyAudio: false };
  if (stored?.kind === 'bgm') return { rawVoiceBlob: null, bgmOnlyAudio: true };
  // Saved before voice tracks were kept apart: without music, the project audio is the voice itself.
  if (!project.bgm || project.bgm.preset === 'none') return { rawVoiceBlob: project.audioBlob, bgmOnlyAudio: false };
  return NO_VOICE;
}
