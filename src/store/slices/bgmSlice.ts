import type { StateCreator } from 'zustand';
import type { BgmPreset } from '../../types';
import { saveProjectToDb } from '../../db/mooDb';
import type { MooStoreState, BgmSlice } from '../types';

export const createBgmSlice: StateCreator<MooStoreState, [], [], BgmSlice> = (set, get) => ({
  updateBgmPreset: (preset: BgmPreset) => {
    const { project } = get();
    const updated = {
      ...project,
      bgm: { ...project.bgm, preset }
    };
    set({ project: updated });
    saveProjectToDb(updated).catch(console.error);
  },

  updateBgmLevel: (level: number) => {
    const { project } = get();
    const clamped = Math.max(0, Math.min(1, level));
    const updated = {
      ...project,
      bgm: { ...project.bgm, level: clamped }
    };
    set({ project: updated });
    saveProjectToDb(updated).catch(console.error);
  },

  updateBgmDuckRatio: (duckRatio: number) => {
    const { project } = get();
    const clamped = Math.max(0, Math.min(1, duckRatio));
    const updated = {
      ...project,
      bgm: { ...project.bgm, duckRatio: clamped }
    };
    set({ project: updated });
    saveProjectToDb(updated).catch(console.error);
  }
});
