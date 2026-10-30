import type { VoiceEdit } from '../../types';

/** How far the voice's words move on the film's clock after trimming and offset. */
export function voiceShift(edit: VoiceEdit | undefined): number {
  return (edit?.offset || 0) - (edit?.trimStart || 0);
}
