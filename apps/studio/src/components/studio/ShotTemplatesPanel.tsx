import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMooStore } from '../../store/useMooStore';
import { t } from '../../i18n';

/** Shots saved for reuse in any project: save the active one, insert one after the active shot. */
export const ShotTemplatesPanel: React.FC = () => {
  const { templates, load, saveShot, insert, remove, activeSceneId, scenes } = useMooStore(
    useShallow((s) => ({
      templates: s.shotTemplates,
      load: s.loadShotTemplates,
      saveShot: s.saveShotAsTemplate,
      insert: s.insertShotTemplate,
      remove: s.deleteShotTemplate,
      activeSceneId: s.activeSceneId,
      scenes: s.project.scenes
    }))
  );
  const [name, setName] = useState('');

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const activeIndex = scenes.findIndex((s) => s.id === activeSceneId);

  return (
    <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
      <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
        <span aria-hidden="true" className="material-symbols-outlined text-[17px] text-accent">bookmarks</span>
        {t('Template Shot')}
      </span>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder={activeIndex >= 0 ? t('Nama template shot #{0}', activeIndex + 1) : t('Pilih shot dulu')}
          aria-label={t('Nama template')}
          className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-surface-1 border border-border focus:border-accent text-[12px] text-on-surface focus:outline-none"
        />
        <button
          type="button"
          disabled={activeIndex < 0}
          onClick={async () => {
            if (!activeSceneId) return;
            if (await saveShot(activeSceneId, name)) setName('');
          }}
          className="h-8 px-2.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-[11px] font-semibold disabled:opacity-40 shrink-0"
        >
          {t('Simpan shot')}
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="text-[11px] text-text-faint leading-snug">
          {t('Simpan shot favorit (kode, animasi layer, gambar) untuk dipakai lagi di proyek mana pun.')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {templates.map((tpl) => (
            <li key={tpl.id} className="flex items-center gap-2 p-2 rounded-xl bg-surface-1 border border-border">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-on-surface truncate">{tpl.name}</div>
                <div className="text-[10px] font-mono text-text-muted">
                  {tpl.aspectRatio} · {tpl.durationInSeconds.toFixed(1)} {t('dtk')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => insert(tpl.id, activeSceneId)}
                title={activeIndex >= 0 ? t('Sisipkan setelah shot #{0}', activeIndex + 1) : t('Sisipkan di akhir')}
                className="h-8 px-2 rounded-lg bg-surface-2 border border-border text-[11px] font-semibold text-text-muted hover:text-accent"
              >
                {t('Sisipkan')}
              </button>
              <button
                type="button"
                onClick={() => remove(tpl.id)}
                aria-label={t('Hapus template {0}', tpl.name)}
                className="h-8 w-8 rounded-lg text-text-muted hover:text-rose-300 flex items-center justify-center"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
