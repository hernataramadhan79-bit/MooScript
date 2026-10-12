import React, { useEffect, useRef } from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { AssetRecord } from '../../db/mooDb';
import { MAX_ASSET_BYTES } from '../../store/slices/assetSlice';

export const AssetManagerPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProject = useMooStore((s) => s.project);
  const activeSceneId = useMooStore((s) => s.activeSceneId);
  const setActiveSceneId = useMooStore((s) => s.setActiveSceneId);
  const assets = useMooStore((s) => s.assets);
  const isLoadingAssets = useMooStore((s) => s.isLoadingAssets);
  const loadAssets = useMooStore((s) => s.loadAssets);
  const addAsset = useMooStore((s) => s.addAsset);
  const deleteAsset = useMooStore((s) => s.deleteAsset);
  const insertAssetIntoScene = useMooStore((s) => s.insertAssetIntoScene);
  const removeAssetFromScene = useMooStore((s) => s.removeAssetFromScene);
  const addToast = useMooStore((s) => s.addToast);

  useEffect(() => {
    if (activeProject.id) {
      loadAssets(activeProject.id);
    }
  }, [activeProject.id, loadAssets]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Harap pilih berkas gambar (PNG, JPG, WebP, SVG).', 'error');
      return;
    }

    if (file.size > MAX_ASSET_BYTES) {
      addToast('Ukuran berkas melebihi batas 5 MB.', 'error');
      return;
    }

    await addAsset(file);
  };

  const targetSceneId = activeSceneId || activeProject.scenes[0]?.id;
  const targetSceneIdx = activeProject.scenes.findIndex((s) => s.id === targetSceneId);
  const targetScene = activeProject.scenes[targetSceneIdx];
  const targetCompScene = activeProject.composition?.scenes.find((s) => s.beatId === targetSceneId);

  const handleInsert = (asset: AssetRecord) => {
    insertAssetIntoScene(asset, targetSceneId);
  };

  const handleRemove = (asset: AssetRecord) => {
    if (asset.dataUrl) {
      removeAssetFromScene(asset.dataUrl, targetSceneId);
    }
  };
  return (
    <div className="p-4 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
      {/* Header Panel Aset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-accent">perm_media</span>
          <span className="text-[13px] font-bold text-on-surface">Aset Media Lokal</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-3 text-text-muted border border-border">
            {assets.length} berkas
          </span>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 border border-border text-on-surface text-[11px] font-semibold flex items-center gap-1 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[15px] text-accent">upload_file</span>
          <span>Unggah</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Info subheader */}
      <p className="text-[11px] text-text-muted leading-relaxed">
        Unggah gambar, logo, atau stiker (maks 5 MB) tersimpan di browser Anda untuk disisipkan ke adegan.
      </p>

      {/* Target Adegan untuk Disisipkan */}
      {activeProject.scenes.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-1 border border-border">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-text-muted uppercase tracking-wider">
              Target Adegan untuk Disisipkan:
            </span>
            <span className="text-accent font-mono font-bold text-[10px]">
              {targetScene ? `Shot #${targetSceneIdx + 1}` : 'Belum dipilih'}
            </span>
          </div>
          <select
            value={targetSceneId || ''}
            onChange={(e) => setActiveSceneId(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-on-surface font-medium focus:outline-none focus:border-accent cursor-pointer"
          >
            {activeProject.scenes.map((s, idx) => (
              <option key={s.id} value={s.id} className="bg-surface-1">
                Shot #{idx + 1}: {s.narrationText?.slice(0, 32) || s.text?.slice(0, 32) || `Adegan ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Galeri / List Aset */}
      {isLoadingAssets ? (
        <div className="py-6 text-center text-[12px] text-text-muted">Memuat aset...</div>
      ) : assets.length === 0 ? (
        <div className="py-6 px-4 rounded-xl border border-dashed border-border text-center flex flex-col items-center justify-center gap-1.5 text-text-muted">
          <span className="material-symbols-outlined text-[24px] text-text-faint">image_not_supported</span>
          <span className="text-[12px]">Belum ada gambar yang diunggah.</span>
          <span className="text-[10px] text-text-faint">Klik tombol Unggah untuk menambahkan logo atau foto.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
          {assets.map((asset) => {
            const isInserted = Boolean(asset.dataUrl && targetCompScene?.html?.includes(asset.dataUrl));
            return (
              <div
                key={asset.id}
                className="p-2.5 rounded-xl bg-surface-1 border border-border flex items-center justify-between gap-2.5 hover:border-border-active transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={asset.dataUrl}
                      alt={asset.name}
                      className="w-10 h-10 rounded-lg object-contain bg-black/40 border border-border/80 p-0.5"
                    />
                    {isInserted && (
                      <span className="absolute -top-1 -right-1 bg-accent text-black rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold shadow" title="Aktif di shot ini">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-medium text-on-surface truncate" title={asset.name}>
                      {asset.name}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted uppercase">
                      {asset.mimeType.replace('image/', '')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isInserted ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(asset)}
                      title={`Keluarkan dari Shot #${targetSceneIdx + 1}`}
                      className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">remove_circle</span>
                      <span>Keluarkan</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInsert(asset)}
                      title={`Sisipkan ke Shot #${targetSceneIdx + 1}`}
                      className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">add_photo_alternate</span>
                      <span>Sisipkan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteAsset(asset.id)}
                    title="Hapus aset dari database"
                    className="p-1.5 rounded-lg hover:bg-red-500/15 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
