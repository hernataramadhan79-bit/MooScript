import type { StateCreator } from 'zustand';
import type { BgmPreset } from '../../types';
import { scheduleSave } from './projectSlice';
import type { MooStoreState, BgmSlice } from '../types';

export const createBgmSlice: StateCreator<MooStoreState, [], [], BgmSlice> = (set, get) => {
  const handleBgmUpdate = async (newBgm: MooStoreState['project']['bgm']) => {
    const { project, rawVoiceBlob, audioStale, addToast, remixAudio, generateBgmOnlyAudio } = get();
    const updated = {
      ...project,
      bgm: newBgm
    };

    const hasAudio = !!project.audioBlob;

    if (rawVoiceBlob) {
      set({
        project: updated,
        audioStale: false
      });
      scheduleSave(updated);
      await remixAudio();
      return;
    }

    if (newBgm?.preset && newBgm.preset !== 'none') {
      set({
        project: updated,
        audioStale: false
      });
      scheduleSave(updated);
      await generateBgmOnlyAudio();
      return;
    }

    if (hasAudio && !audioStale) {
      addToast('BGM berubah. Generate ulang audio supaya kedengeran.', 'info');
    }
    set({
      project: updated,
      audioStale: hasAudio ? true : audioStale
    });
    scheduleSave(updated);
  };

  return {
    updateBgmPreset: (preset: BgmPreset) => {
      const { project } = get();
      return handleBgmUpdate({ ...project.bgm, preset });
    },

    updateBgmLevel: (level: number) => {
      const { project } = get();
      const clamped = Math.max(0, Math.min(1, level));
      return handleBgmUpdate({ ...project.bgm, level: clamped });
    },

    updateBgmDuckRatio: (duckRatio: number) => {
      const { project } = get();
      const clamped = Math.max(0, Math.min(1, duckRatio));
      return handleBgmUpdate({ ...project.bgm, duckRatio: clamped });
    }
  };
};
