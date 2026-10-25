import type { StateCreator } from 'zustand';
import type { BgmPreset } from '../../types';
import { scheduleSave } from './projectSlice';
import { deleteBgmFromDb, saveBgmToDb } from '../../db/mooDb';
import { MAX_CUSTOM_BGM_BYTES } from '../../db/customBgm';
import { decodeCustomBgm, hasCustomBgm, setCustomBgmBuffer } from '../../engine/audio/bgmMixer';
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
      if (preset === 'custom' && !hasCustomBgm()) {
        get().addToast('Unggah berkas musik dulu untuk memakai BGM sendiri.', 'info');
        return;
      }
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
    },

    uploadCustomBgm: async (file: File) => {
      const { project, addToast } = get();
      const looksLikeAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name);
      if (!looksLikeAudio) {
        addToast('Format berkas tidak didukung. Unggah berkas audio (MP3, WAV, M4A, OGG).', 'error');
        return;
      }
      if (file.size > MAX_CUSTOM_BGM_BYTES) {
        addToast('Ukuran BGM melebihi batas 25 MB.', 'error');
        return;
      }
      try {
        const buffer = await decodeCustomBgm(file);
        await saveBgmToDb(project.id, file, file.name);
        setCustomBgmBuffer(buffer);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`BGM gagal diproses: ${msg}`, 'error');
        return;
      }
      addToast(`BGM "${file.name}" dipakai sebagai musik latar.`, 'success');
      await handleBgmUpdate({ ...get().project.bgm, preset: 'custom', customName: file.name });
    },

    removeCustomBgm: async () => {
      const { project } = get();
      setCustomBgmBuffer(null);
      await deleteBgmFromDb(project.id);
      const { customName: _removed, ...rest } = project.bgm;
      await handleBgmUpdate({ ...rest, preset: 'none' });
    }
  };
};
