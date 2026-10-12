import type { StateCreator } from 'zustand';
import type { MooStoreState, AssetSlice } from '../types';
import type { AssetRecord } from '../../db/mooDb';
import { saveAssetToDb, listAssetsFromDb, deleteAssetFromDb } from '../../db/mooDb';
import { syncComposition } from '../../engine/composition/sync';
import { removeAssetFromHtml } from '../../engine/composition/layers';
import { scheduleSave } from './projectSlice';
export const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5 MB

export const createAssetSlice: StateCreator<MooStoreState, [], [], AssetSlice> = (set, get) => ({
  assets: [],
  isLoadingAssets: false,

  loadAssets: async (projectId?: string) => {
    const pid = projectId || get().project.id;
    if (!pid) return;
    set({ isLoadingAssets: true });
    try {
      const records = await listAssetsFromDb(pid);
      set({ assets: records, isLoadingAssets: false });
    } catch {
      set({ isLoadingAssets: false });
    }
  },

  addAsset: async (file: File): Promise<AssetRecord | null> => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedMimes.includes(file.type) && !file.type.startsWith('image/')) {
      get().addToast('Format berkas tidak didukung. Harap unggah PNG, JPG, WebP, atau SVG.', 'error');
      return null;
    }

    if (file.size > MAX_ASSET_BYTES) {
      get().addToast('Ukuran berkas melebihi batas 5 MB.', 'error');
      return null;
    }

    const currentProject = get().project;
    const now = Date.now();
    const id = `asset-${now}-${Math.random().toString(36).slice(2, 7)}`;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    const record: AssetRecord = {
      id,
      projectId: currentProject.id,
      name: file.name,
      mimeType: file.type || 'image/png',
      dataUrl,
      blob: file,
      createdAt: now
    };

    await saveAssetToDb(record);
    const updated = [...get().assets, record];
    set({ assets: updated });
    get().addToast(`Aset "${file.name}" berhasil diunggah!`, 'success');
    return record;
  },

  deleteAsset: async (id: string) => {
    await deleteAssetFromDb(id);
    const updated = get().assets.filter((a) => a.id !== id);
    set({ assets: updated });
    get().addToast('Aset dihapus.', 'info');
  },

  insertAssetIntoScene: (asset: AssetRecord, sceneId?: string) => {
    const current = get().project;
    const targetId = sceneId || get().activeSceneId || current.scenes[0]?.id;
    if (!targetId) {
      get().addToast('Pilih adegan terlebih dahulu.', 'warning');
      return;
    }

    const sceneIdx = current.scenes.findIndex((s) => s.id === targetId);
    if (sceneIdx === -1) return;

    const activeComp = current.composition || syncComposition(current).composition;
    if (!activeComp) return;

    const compScenes = activeComp.scenes.map((s) => {
      if (s.beatId !== targetId) return s;

      const existingMatches = (s.html || '').match(/data-moo-layer="asset(?:-[0-9]+)?"/g);
      const layerId = existingMatches && existingMatches.length > 0 ? `asset-${existingMatches.length + 1}` : 'asset';

      const imgHtml = `\n<div class="moo-asset-container" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;display:flex;align-items:center;justify-content:center;pointer-events:auto;"><img data-moo-layer="${layerId}" src="${asset.dataUrl}" alt="${asset.name}" style="max-width:480px;max-height:480px;object-fit:contain;border-radius:12px;filter:drop-shadow(0 10px 25px rgba(0,0,0,0.5));" /></div>`;

      const defaultBuildJs = 'tl.from(".moo-asset-container", { opacity: 0, scale: 0.85, duration: 0.6, ease: "back.out(1.4)" });';

      return {
        ...s,
        html: s.html ? s.html + imgHtml : imgHtml,
        css: s.css || '.moo-asset-container { pointer-events: auto; }',
        buildJs: s.buildJs && s.buildJs.trim() ? s.buildJs : defaultBuildJs,
        status: 'ok' as const,
        userEdited: true,
        version: (s.version || 1) + 1
      };
    });

    const updatedProject = syncComposition({
      ...current,
      composition: { ...activeComp, scenes: compScenes }
    });

    set({ project: updatedProject });
    scheduleSave(updatedProject, (msg) => get().addToast(msg, 'error'));
    get().addToast(`Aset "${asset.name}" disisipkan ke adegan!`, 'success');
  },

  removeAssetFromScene: (assetDataUrlOrLayerId: string, sceneId?: string) => {
    const current = get().project;
    const targetId = sceneId || get().activeSceneId || current.scenes[0]?.id;
    if (!targetId || !current.composition) return;

    let changed = false;
    const compScenes = current.composition.scenes.map((s) => {
      if (s.beatId !== targetId || !s.html) return s;
      const updatedHtml = removeAssetFromHtml(s.html, assetDataUrlOrLayerId);
      if (updatedHtml === s.html) return s;
      changed = true;
      return {
        ...s,
        html: updatedHtml,
        userEdited: true,
        version: (s.version || 1) + 1
      };
    });

    if (!changed) {
      get().addToast('Aset tidak ditemukan di adegan ini.', 'warning');
      return;
    }

    const updatedProject = syncComposition({
      ...current,
      composition: { ...current.composition, scenes: compScenes }
    });

    set({ project: updatedProject });
    scheduleSave(updatedProject, (msg) => get().addToast(msg, 'error'));
    get().addToast('Aset berhasil dihapus dari adegan.', 'info');
  }
});
