import React, { useState, useMemo } from 'react';
import { useMooStore } from '../../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { ConfirmModal } from '../../ui/ConfirmModal';
import {
  PROCEDURAL_ARCHETYPES
} from '../../../engine/composition/proceduralCompiler';
import { t } from '../../../i18n';
import type { InspectorShared } from './shared';

export const MographTab: React.FC<{ shared: InspectorShared; onOpenCodeInspector?: (beatId: string) => void }> = ({ shared, onOpenCodeInspector }) => {
  const {
    project,
    settings,
    activeSceneId,
    compileSceneProcedural,
    compileAllScenesProcedural,
    isCompilingMograph,
    mographProgress,
    mographStats,
    generateAllScenesAi,
    cancelMographGeneration,
    updateSettings,
    setSettingsOpen
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      settings: s.settings,
      activeSceneId: s.activeSceneId,
      compileSceneProcedural: s.compileSceneProcedural,
      compileAllScenesProcedural: s.compileAllScenesProcedural,
      isCompilingMograph: s.isCompilingMograph,
      mographProgress: s.mographProgress,
      mographStats: s.mographStats,
      generateAllScenesAi: s.generateAllScenesAi,
      cancelMographGeneration: s.cancelMographGeneration,
      updateSettings: s.updateSettings,
      setSettingsOpen: s.setSettingsOpen
    }))
  );
  const currentLlmProvider = settings.selectedLLMProvider;
  const currentLlmApiKey = settings.apiKeys[currentLlmProvider] || '';
  const hasLlmApiKey = Boolean(currentLlmApiKey.trim());

  // Active Scene & Layer States
  const scenes = useMemo(() => project.scenes || [], [project.scenes]);
  const activeScene = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0];
  }, [scenes, activeSceneId]);

  const activeSceneIndex = useMemo(() => {
    return scenes.findIndex((s) => s.id === activeScene?.id);
  }, [scenes, activeScene]);

  const { selectedArchetype, setSelectedArchetype } = shared;

  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showProceduralOverwriteConfirm, setShowProceduralOverwriteConfirm] = useState(false);
  // AI Mograph generation for every scene. The job runs in the store; this only asks before
  // overwriting scenes the user edited by hand.
  const handleGenerateCustomMograph = (skipConfirm = false) => {
    const existingModules = useMooStore.getState().project.composition?.scenes || [];
    if (!skipConfirm && existingModules.some((m) => m.userEdited === true)) {
      setShowOverwriteConfirm(true);
      return;
    }
    generateAllScenesAi();
  };

  return (
    <>
          <div className="flex flex-col gap-5">
            {/* Studio Visual & Widget Instan (Zero-API Procedural Engine) */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">bolt</span>
                  {t('Visual & Widget Instan')}
                </span>
                <span className="text-[10px] font-mono text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25">
                  {t('Tanpa API key')}
                </span>
              </div>

              <p className="text-[11px] text-text-muted leading-relaxed">
                {t('Susun animasi tipografi kinetik & widget grafik secara instan dari naskah tanpa kuota API. Seluruh elemen langsung memiliki layer yang dapat digeser di kanvas.')}
              </p>

              {/* Pilihan Archetype Widget */}
              <div className="grid grid-cols-3 gap-1.5">
                {PROCEDURAL_ARCHETYPES.map((arch) => {
                  const isSel = selectedArchetype === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => {
                        setSelectedArchetype(arch.id);
                        if (activeScene) {
                          compileSceneProcedural(activeScene.id, arch.id);
                        }
                      }}
                      title={t(arch.description)}
                      className={`p-2 rounded-xl border text-left flex flex-col gap-1 transition-all active:scale-95 ${
                        isSel
                          ? 'bg-accent/15 border-accent text-accent font-semibold shadow-xs'
                          : 'bg-surface-1 border-border text-text-muted hover:text-on-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined text-[15px] text-accent">{arch.icon}</span>
                        {isSel && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </div>
                      <span className="text-[10px] font-semibold leading-tight line-clamp-2 min-h-[2lh]">{t(arch.label)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={!activeScene}
                  onClick={() => activeScene && compileSceneProcedural(activeScene.id, selectedArchetype)}
                  className="py-2 px-2.5 rounded-xl bg-surface-1 hover:bg-surface-3 border border-border text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px] text-accent">auto_fix_high</span>
                  <span>{activeScene ? t('Terapkan ke Shot #{0}', activeSceneIndex + 1) : t('Terapkan ke Shot')}</span>
                </button>

                <button
                  type="button"
                  disabled={scenes.length === 0}
                  onClick={() => {
                    const hasCustomVisuals = (project.composition?.scenes || []).some(
                      (m) => m.userEdited || m.generatorVersion?.startsWith('generative')
                    );
                    if (hasCustomVisuals) {
                      setShowProceduralOverwriteConfirm(true);
                    } else {
                      compileAllScenesProcedural(selectedArchetype, true);
                    }
                  }}
                  className="py-2 px-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">bolt</span>
                  <span>{t('Susun Semua (')}{scenes.length})</span>
                </button>
              </div>
            </div>

            {/* Action Box Utama: Generator Mograph AI */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">auto_awesome</span>
                  {t('Generator Mograph AI')}
                </span>
                <span className="text-[11px] font-mono text-text-muted px-2 py-0.5 rounded-full bg-surface-1 border border-border">
                  {project.scenes?.length || 0} {t('Adegan')}
                </span>
              </div>

              {/* Status & Progress Watchdog saat generate */}
              {isCompilingMograph ? (
                <div className="p-3 rounded-xl bg-surface-1 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-accent flex items-center gap-1.5 font-medium truncate">
                      <span className="material-symbols-outlined animate-spin text-[16px] shrink-0">
                        sync
                      </span>
                      <span className="truncate">{mographProgress || t('Menyiapkan...')}</span>
                    </span>
                    {mographStats && (
                      <span className="text-[11px] font-mono text-text-muted shrink-0 ml-1">
                        {Math.round((mographStats.completed / mographStats.total) * 100)}%
                      </span>
                    )}
                  </div>

                  {mographStats && (
                    <>
                      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-300 rounded-full"
                          style={{
                            width: `${(mographStats.completed / mographStats.total) * 100}%`
                          }}
                        />
                      </div>

                      {/* Scene Badges */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {project.scenes.map((b, idx) => {
                          const st = mographStats.sceneStatuses[b.id] || 'pending';
                          return (
                            <span
                              key={b.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 border ${
                                st === 'ok'
                                  ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                                  : st === 'generating'
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                                    : st === 'error'
                                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                      : 'bg-surface-2 border-border text-text-muted'
                              }`}
                            >
                              {st === 'ok' ? '✓' : st === 'generating' ? '⟳' : st === 'error' ? '!' : '•'}
                              #{idx + 1}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={cancelMographGeneration}
                    className="w-full mt-1 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-rose-400 text-[12px] font-medium transition-colors"
                  >
                    {t('Batalkan Pembuatan')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {!hasLlmApiKey && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                      <div className="flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">key_off</span>
                        <span>
                          {t('API Key untuk')} <strong>{currentLlmProvider.toUpperCase()}</strong> {t('belum diatur. Masukkan API Key di Pengaturan agar AI dapat membuat visual adegan.')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">settings</span>
                        <span>{t('Buka Pengaturan API')}</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleGenerateCustomMograph(false)}
                    disabled={isCompilingMograph || (project.scenes?.length || 0) === 0 || !hasLlmApiKey}
                    title={
                      !hasLlmApiKey
                        ? t('Silakan masukkan API Key untuk {0} di Pengaturan terlebih dahulu', currentLlmProvider.toUpperCase())
                        : undefined
                    }
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">movie_filter</span>
                    <span>{t('Buat Mograph AI')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Akses Editor Kode Adegan */}
            {onOpenCodeInspector && activeScene && (
              <button
                type="button"
                onClick={() => onOpenCodeInspector(activeScene.id)}
                className="p-3 rounded-2xl bg-surface-2/60 border border-border hover:border-accent/40 text-on-surface hover:text-accent flex items-center justify-between transition-colors text-[12px] font-medium"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px]">code</span>
                  {t('Buka Editor Kode Adegan')}
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-muted">chevron_right</span>
              </button>
            )}

            {/* Advanced: how long an AI answer may be (max output tokens) */}
            <details className="group p-3.5 rounded-2xl bg-surface-2/60 border border-border">
              <summary className="flex items-center justify-between cursor-pointer list-none text-[12px] font-semibold text-on-surface">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-text-muted">settings</span>
                  {t('Lanjutan')}
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-muted transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="flex flex-col gap-2.5 pt-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-on-surface">{t('Panjang jawaban AI')}</span>
                  <span className="font-mono text-accent font-semibold">
                    {t('{0} token', settings.maxOutputTokens || 2048)}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {t('Naikkan kalau visual adegan sering terpotong atau gagal. Angka lebih besar memakai kuota API lebih banyak.')}
                </p>
  
                <input
                  type="range"
                  min={512}
                  max={8192}
                  step={256}
                  disabled={isCompilingMograph}
                  value={settings.maxOutputTokens || 2048}
                  onChange={(e) => updateSettings({ maxOutputTokens: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
  
                <div className="flex gap-1 pt-0.5">
                  {[1024, 2048, 4096, 8192].map((tok) => {
                    const isActive = (settings.maxOutputTokens || 2048) === tok;
                    return (
                      <button
                        key={tok}
                        type="button"
                        disabled={isCompilingMograph}
                        onClick={() => updateSettings({ maxOutputTokens: tok })}
                        className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                          isActive
                            ? 'bg-surface-3 border-accent text-accent font-bold'
                            : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                        }`}
                      >
                        {tok}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>
      {/* Konfirmasi Timpa Adegan yang Diedit Manual */}
      <ConfirmModal
        isOpen={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        onConfirm={() => {
          setShowOverwriteConfirm(false);
          handleGenerateCustomMograph(true);
        }}
        title={t('Timpa Perubahan Manual?')}
        description={t('Beberapa adegan dalam proyek ini telah diedit secara manual. Menjalankan AI Generator akan menimpa kode adegan tersebut dengan hasil generasi baru. Lanjutkan?')}
        confirmLabel={t('Timpa & Generate')}
        cancelLabel={t('Batal')}
        variant="warning"
        icon="warning"
      />

      {/* Konfirmasi Ganti Semua Visual dengan Visual Instan */}
      <ConfirmModal
        isOpen={showProceduralOverwriteConfirm}
        onClose={() => setShowProceduralOverwriteConfirm(false)}
        onConfirm={() => {
          setShowProceduralOverwriteConfirm(false);
          compileAllScenesProcedural(selectedArchetype, true);
        }}
        title={t('Ganti Semua Visual?')}
        description={t('Beberapa adegan memakai visual AI atau sudah diedit manual. Visual instan akan menggantikan semuanya. Anda masih bisa mengembalikannya dengan Urungkan (Ctrl+Z).')}
        confirmLabel={t('Ganti Semua')}
        cancelLabel={t('Batal')}
        variant="warning"
        icon="bolt"
      />
    </>
  );
};
