import type { StateCreator } from 'zustand';
import type { BgmPreset } from '../../types';
import { scheduleSave } from './projectSlice';
import type { MooStoreState, BgmSlice } from '../types';

export const createBgmSlice: StateCreator<MooStoreState, [], [], BgmSlice> = (set, get) => {
  const handleBgmUpdate = (newBgm: MooStoreState['project']['bgm']) => {
    const { project, audioStale, addToast } = get();
    const updated = {
      ...project,
      bgm: newBgm
    };
    const hasAudio = !!project.audioBlob;
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
      handleBgmUpdate({ ...project.bgm, preset });
    },

    updateBgmLevel: (level: number) => {
      const { project } = get();
      const clamped = Math.max(0, Math.min(1, level));
      handleBgmUpdate({ ...project.bgm, level: clamped });
    },

    updateBgmDuckRatio: (duckRatio: number) => {
      const { project } = get();
      const clamped = Math.max(0, Math.min(1, duckRatio));
      handleBgmUpdate({ ...project.bgm, duckRatio: clamped });
    }
  };
};
