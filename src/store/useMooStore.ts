import { create } from 'zustand';
import type { MooStoreState } from './types';
import { createUiSlice } from './slices/uiSlice';
import { createProjectSlice, flushPendingSave } from './slices/projectSlice';
import { createScriptSlice } from './slices/scriptSlice';
import { createAudioSlice } from './slices/audioSlice';
import { createPlaybackSlice } from './slices/playbackSlice';
import { createExportSlice } from './slices/exportSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createBgmSlice } from './slices/bgmSlice';

export type { MooStoreState };
export { flushPendingSave };

export const useMooStore = create<MooStoreState>()((...a) => ({
  ...createUiSlice(...a),
  ...createProjectSlice(...a),
  ...createScriptSlice(...a),
  ...createAudioSlice(...a),
  ...createPlaybackSlice(...a),
  ...createExportSlice(...a),
  ...createSettingsSlice(...a),
  ...createBgmSlice(...a)
}));
