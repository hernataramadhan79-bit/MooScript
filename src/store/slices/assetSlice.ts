import type { StateCreator } from 'zustand';
import type { MooStoreState, AssetSlice, InsertAssetOptions } from '../types';
import type { AssetRecord } from '../../db/mooDb';
import { saveAssetToDb, listAssetsFromDb, deleteAssetFromDb } from '../../db/mooDb';
import { syncComposition } from '../../engine/composition/sync';
import { removeAssetFromHtml, extractLayersFromHtml } from '../../engine/composition/layers';
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

  insertAssetIntoScene: (asset: AssetRecord, sceneId?: string, options?: InsertAssetOptions) => {
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

    const animPreset = options?.animationPreset || 'pop';
    const framePreset = options?.framePreset || 'cutout';

    let frameStyle = 'max-width:480px;max-height:480px;object-fit:contain;border-radius:12px;filter:drop-shadow(0 15px 30px rgba(0,0,0,0.6));';
    if (framePreset === 'bento') {
      frameStyle = 'max-width:440px;max-height:440px;object-fit:contain;padding:16px;border-radius:24px;background:rgba(24,24,27,0.85);border:1px solid rgba(255,255,255,0.12);box-shadow:0 20px 40px rgba(0,0,0,0.5);';
    } else if (framePreset === 'avatar') {
      frameStyle = 'width:320px;height:320px;object-fit:cover;border-radius:9999px;border:3px solid var(--moo-accent,#84cc16);box-shadow:0 10px 30px rgba(0,0,0,0.5);';
    }

    const compScenes = activeComp.scenes.map((s) => {
      if (s.beatId !== targetId) return s;

      const existingMatches = (s.html || '').match(/data-moo-layer="asset(?:-[0-9]+)?"/g);
      const layerId = existingMatches && existingMatches.length > 0 ? `asset-${existingMatches.length + 1}` : 'asset';
      const targetSelector = `.moo-asset-container.moo-asset-${layerId}`;

      const imgHtml = `\n<div class="moo-asset-container moo-asset-${layerId}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;display:flex;align-items:center;justify-content:center;pointer-events:auto;"><img data-moo-layer="${layerId}" src="${asset.dataUrl}" alt="${asset.name}" style="${frameStyle}" /></div>`;

      let animJs = `tl.from("${targetSelector}", { scale: 0, opacity: 0, duration: 0.7, ease: "back.out(1.7)" });`;
      if (animPreset === 'slide') {
        animJs = `tl.from("${targetSelector}", { y: 100, opacity: 0, duration: 0.6, ease: "power3.out" });`;
      } else if (animPreset === 'float') {
        animJs = `tl.from("${targetSelector}", { scale: 0.8, opacity: 0, duration: 0.6, ease: "power2.out" }).to("${targetSelector}", { y: -15, repeat: -1, yoyo: true, duration: 1.5, ease: "sine.inOut" });`;
      } else if (animPreset === 'zoom') {
        animJs = `tl.from("${targetSelector}", { scale: 1.5, opacity: 0, duration: 0.5, ease: "power2.out" });`;
      }

      const mergedHtml = s.html ? s.html + imgHtml : imgHtml;
      const mergedBuildJs = s.buildJs && s.buildJs.trim()
        ? `${s.buildJs}\n${animJs}`
        : animJs;

      return {
        ...s,
        html: mergedHtml,
        css: s.css || '.moo-asset-container { pointer-events: auto; }',
        buildJs: mergedBuildJs,
        editableLayers: extractLayersFromHtml(mergedHtml),
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
