import React, { useState, useMemo, useEffect } from 'react';
import { useMooStore } from '../../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { mapFontDisplay } from '../../../store/slices/mographSlice';
import {
  mergeEditableLayers,
  getLayerText,
  setLayerText
} from '../../../engine/composition/layers';
import type {
  EditableLayer,
  LayerOverride,
  ScenePalette
} from '../../../types';
import { CommitNumberInput } from '../../ui/CommitNumberInput';
import { LayerMotionPanel } from '../LayerMotionPanel';
import { TypographyControls } from '../TypographyControls';
import { getSceneStartSeconds } from '../../../utils/projectDuration';
import { L, t, tr } from '../../../i18n';
import { DebouncedColor, DebouncedSlider } from './controls';
import type { InspectorShared } from './shared';

/** What each visual state means to the person editing, not to the engine. */
const SCENE_STATUS_LABEL: Record<string, string> = {
  ok: L('siap'),
  pending: L('belum dibuat'),
  generating: L('sedang dibuat'),
  error: L('gagal'),
  'needs-repair': L('perlu perbaikan')
};

export const StyleTab: React.FC<{ shared: InspectorShared }> = ({ shared }) => {
  const {
    project,
    settings,
    activeSceneId,
    focusScene,
    updateLayerOverride,
    updateLayerMotion,
    addCustomFont,
    insertElementIntoScene,
    resetLayerOverride,
    removeAssetFromScene,
    updateScenePalette,
    compileSceneProcedural,
    setProject,
    isCompilingMograph,
    revisingSceneId,
    revisionProgress,
    regenerateSceneAi,
    repairSceneAi,
    cancelMographGeneration,
    updateThemeFont,
    addToast
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      settings: s.settings,
      activeSceneId: s.activeSceneId,
      focusScene: s.focusScene,
      updateLayerOverride: s.updateLayerOverride,
      updateLayerMotion: s.updateLayerMotion,
      addCustomFont: s.addCustomFont,
      insertElementIntoScene: s.insertElementIntoScene,
      resetLayerOverride: s.resetLayerOverride,
      removeAssetFromScene: s.removeAssetFromScene,
      updateScenePalette: s.updateScenePalette,
      compileSceneProcedural: s.compileSceneProcedural,
      setProject: s.setProject,
      isCompilingMograph: s.isCompilingMograph,
      revisingSceneId: s.revisingSceneId,
      revisionProgress: s.revisionProgress,
      regenerateSceneAi: s.regenerateSceneAi,
      repairSceneAi: s.repairSceneAi,
      cancelMographGeneration: s.cancelMographGeneration,
      updateThemeFont: s.updateThemeFont,
      addToast: s.addToast
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

  const activeCompScene = useMemo(() => {
    const compScenes = project.composition?.scenes || [];
    return compScenes.find((s) => s.id === activeScene?.id || s.beatId === activeScene?.id);
  }, [project.composition?.scenes, activeScene]);

  const availableLayers = useMemo(() => {
    if (!activeCompScene?.html) return [];
    return mergeEditableLayers(activeCompScene.editableLayers, activeCompScene.html);
  }, [activeCompScene?.editableLayers, activeCompScene?.html]);

  const selectedLayerId = useMooStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useMooStore((s) => s.setSelectedLayerId);

  const activeLayer = useMemo(() => {
    if (!availableLayers.length) return null;
    return availableLayers.find((l) => l.id === selectedLayerId) || availableLayers[0];
  }, [availableLayers, selectedLayerId]);

  const currentOverrides = activeCompScene?.overrides || {};
  const activeLayerOverride = activeLayer ? currentOverrides[activeLayer.id] || {} : {};
  const currentPalette = activeCompScene?.palette || {};
  // Local debounced state for layer text editing
  const [localLayerText, setLocalLayerText] = useState<string>('');
  useEffect(() => {
    if (activeLayer && activeLayer.type === 'text' && activeCompScene?.html) {
      setLocalLayerText(getLayerText(activeCompScene.html, activeLayer.id));
    } else {
      setLocalLayerText('');
    }
  }, [activeLayer, activeCompScene?.html]);

  const commitLayerText = (text: string) => {
    if (!activeCompScene?.html || !activeLayer) return;
    const current = getLayerText(activeCompScene.html, activeLayer.id);
    if (current === text) return;
    handleLayerTextChange(text);
  };

  // Single scene AI revision: the job itself runs in the store and survives tab switches.
  const { revisionPrompt, setRevisionPrompt } = shared;
  const isRevisingScene = revisingSceneId !== null;
  const isRevisingThisScene = Boolean(activeScene) && revisingSceneId === activeScene?.id;

  const getLayerIcon = (type: EditableLayer['type']) => {
    switch (type) {
      case 'text':
        return 'title';
      case 'shape':
        return 'crop_square';
      case 'svg':
        return 'polyline';
      case 'image':
        return 'image';
      case 'group':
      default:
        return 'folder';
    }
  };

  const handleOverridesChange = (changes: Partial<LayerOverride>) => {
    if (!activeScene || !activeLayer) return;
    updateLayerOverride(activeScene.id, activeLayer.id, { ...changes, layerType: activeLayer.type });
  };

  const handleOverrideChange = (prop: keyof LayerOverride, val: number | string | boolean | undefined) =>
    handleOverridesChange({ [prop]: val });

  const handleResetLayerOverride = () => {
    if (!activeScene || !activeLayer) return;
    resetLayerOverride(activeScene.id, activeLayer.id);
    addToast(t('Override layer {0} direset.', activeLayer.label), 'info');
  };

  const handleRemoveLayer = () => {
    if (!activeScene || !activeLayer) return;
    removeAssetFromScene(activeLayer.id, activeScene.id);
  };

  const handleLayerTextChange = (newText: string) => {
    if (!activeScene || !activeCompScene || !activeLayer || !project.composition) return;
    const updatedHtml = setLayerText(activeCompScene.html, activeLayer.id, newText);
    const updatedCompScenes = project.composition.scenes.map((s) => {
      if (s.id !== activeCompScene.id && s.beatId !== activeCompScene.beatId) return s;
      return {
        ...s,
        html: updatedHtml,
        userEdited: true
      };
    });
    setProject(
      {
        ...project,
        composition: {
          ...project.composition,
          scenes: updatedCompScenes,
          updatedAt: Date.now()
        }
      },
      { keepStale: true, preserveHistory: true }
    );
  };

  const handlePaletteChange = (prop: keyof ScenePalette, val: string) => {
    if (!activeScene) return;
    updateScenePalette(activeScene.id, { [prop]: val });
  };

  const handleResetPalette = () => {
    if (!activeScene) return;
    updateScenePalette(activeScene.id, {
      bg: undefined,
      primary: undefined,
      accent: undefined,
      text: undefined
    });
    addToast(t('Palet warna adegan dikembalikan ke default.'), 'info');
  };

  const handleReviseSingleScene = async () => {
    if (!activeScene) return;
    const instruction = revisionPrompt;
    await regenerateSceneAi(activeScene.id, instruction);
    setRevisionPrompt('');
  };

  const handleRepairLegacyScene = () => {
    if (activeScene) repairSceneAi(activeScene.id);
  };

  return (
    <>
          <div className="flex flex-col gap-4">
            {!activeScene ? (
              <div className="p-4 rounded-xl bg-surface-2 border border-border text-center text-text-muted text-[13px]">
                {t('Belum ada adegan. Tambahkan adegan pada naskah terlebih dahulu.')}
              </div>
            ) : (
              <>
                {/* 1. Scene Switcher & Summary Card */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-surface-3 text-accent font-mono text-[11px] font-bold">
                        #{activeSceneIndex + 1}
                      </span>
                      <span className="text-[12px] font-semibold text-on-surface truncate">
                        {activeScene.visualIntent || activeScene.narrationText || t('Adegan #{0}', activeSceneIndex + 1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">
                        {activeScene.durationInSeconds.toFixed(1)}s
                      </span>
                      {activeCompScene && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold ${
                            activeCompScene.status === 'ok'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : activeCompScene.status === 'error'
                                ? 'bg-rose-500/15 text-rose-400'
                                : activeCompScene.status === 'needs-repair'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-zinc-500/15 text-zinc-400'
                          }`}
                        >
                          {SCENE_STATUS_LABEL[activeCompScene.status] ? t(SCENE_STATUS_LABEL[activeCompScene.status]) : activeCompScene.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scene Selector Dropdown */}
                  {scenes.length > 1 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <span className="text-[11px] text-text-muted shrink-0">{t('Pilih Adegan:')}</span>
                      <select
                        value={activeScene.id}
                        onChange={(e) => focusScene(e.target.value)}
                        className="flex-1 bg-surface-2 border border-border rounded-lg px-2 py-1 text-[11px] text-on-surface focus:outline-none focus:border-accent"
                      >
                        {scenes.map((s, idx) => (
                          <option key={s.id} value={s.id}>
                            #{idx + 1} - {(s.visualIntent || s.narrationText || t('Adegan {0}', idx + 1)).slice(0, 32)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Status Alert if Scene has Error */}
                {activeCompScene?.status === 'error' && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-[12px]">
                      <span className="material-symbols-outlined text-[17px]">error</span>
                      <span>{t('Adegan ini mengalami kendala rendering')}</span>
                    </div>
                    {activeCompScene.errors && activeCompScene.errors.length > 0 && (
                      <p className="text-[11px] text-rose-300/80 font-mono truncate">
                        {tr(activeCompScene.errors[0])}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleReviseSingleScene}
                      disabled={isRevisingScene || isCompilingMograph || !hasLlmApiKey}
                      title={
                        !hasLlmApiKey
                          ? t('Silakan masukkan API Key untuk {0} di Pengaturan', currentLlmProvider.toUpperCase())
                          : undefined
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-600 transition-colors self-start flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      {t('Generate Ulang Adegan Ini')}
                    </button>
                  </div>
                )}

                {/* Scene saved before MooTween that calls APIs it does not have */}
                {activeCompScene?.status === 'needs-repair' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold text-[12px]">
                      <span className="material-symbols-outlined text-[17px]">build</span>
                      <span>{t('Kode adegan ini bukan API MooScript')}</span>
                    </div>
                    <p className="text-[11px] text-amber-100/70 leading-relaxed">
                      {t('Kodenya ditulis untuk API animasi lain (gaya GSAP), jadi adegan tampil diam sampai diperbaiki. Kode belum diubah; AI akan menerjemahkan bagian berikut ke API MooScript dan mempertahankan desainnya.')}
                    </p>
                    {activeCompScene.errors && activeCompScene.errors.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {activeCompScene.errors.map((err) => (
                          <li key={err} className="text-[11px] text-amber-200/90 font-mono leading-snug">
                            {tr(err).replace(/^(Bukan API MooScript|Not a MooScript API): /, '')}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={handleRepairLegacyScene}
                      disabled={isRevisingScene || isCompilingMograph || !hasLlmApiKey}
                      title={
                        !hasLlmApiKey
                          ? t('Silakan masukkan API Key untuk {0} di Pengaturan', currentLlmProvider.toUpperCase())
                          : undefined
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[11px] font-semibold hover:bg-amber-400 transition-colors self-start flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isRevisingThisScene ? 'animate-spin' : ''}`}>
                        {isRevisingThisScene ? 'progress_activity' : 'auto_fix_high'}
                      </span>
                      {isRevisingThisScene ? revisionProgress || t('Memperbaiki...') : t('Perbaiki dengan AI')}
                    </button>
                  </div>
                )}

                {/* 2. Revisi AI Adegan Tunggal */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">auto_awesome</span>
                      {t('Revisi AI Adegan #')}{activeSceneIndex + 1}
                    </span>
                    <span className="text-[10px] text-text-muted">{t('Khusus adegan ini')}</span>
                  </div>

                  <textarea
                    value={revisionPrompt}
                    onChange={(e) => setRevisionPrompt(e.target.value)}
                    placeholder={t('Instruksi revisi, misal: \'Ubah grafik batang jadi diagram lingkaran\'...')}
                    rows={2}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-1 border border-border text-[12px] text-on-surface placeholder:text-text-muted/60 focus:outline-none focus:border-accent resize-none"
                  />

                  {isRevisingThisScene && revisionProgress && (
                    <div className="p-2 rounded-lg bg-surface-1 border border-border text-[11px] text-accent flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[14px]">sync</span>
                      <span className="truncate">{revisionProgress}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReviseSingleScene}
                      disabled={isRevisingScene || isCompilingMograph || !hasLlmApiKey}
                      title={
                        !hasLlmApiKey
                          ? t('Silakan masukkan API Key untuk {0} di Pengaturan', currentLlmProvider.toUpperCase())
                          : undefined
                      }
                      className="flex-1 py-1.5 px-3 rounded-xl bg-accent text-on-accent text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isRevisingThisScene ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[15px]">sync</span>
                          <span>{t('Merevisi...')}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                          <span>{t('Revisi Adegan Ini')}</span>
                        </>
                      )}
                    </button>
                    {isRevisingThisScene && (
                      <button
                        type="button"
                        onClick={cancelMographGeneration}
                        className="py-1.5 px-2.5 rounded-xl bg-surface-1 border border-border text-[11px] text-text-muted hover:text-rose-400 transition-colors"
                      >
                        {t('Batal')}
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Layer Inspector & Non-Destructive Overrides */}
                <div id="layer-inspector" className="scroll-mt-2 p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">layers</span>
                      {t('Layer & Transform')}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-3">
                      {availableLayers.length} {t('Layer')}
                    </span>
                  </div>

                  {/* New layers from scratch */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-text-muted mr-0.5">{t('Tambah:')}</span>
                    {(
                      [
                        { kind: 'text', icon: 'title', label: t('Teks') },
                        { kind: 'rect', icon: 'crop_square', label: t('Kotak') },
                        { kind: 'circle', icon: 'circle', label: t('Lingkaran') },
                        { kind: 'pill', icon: 'rounded_corner', label: t('Pil') },
                        { kind: 'line', icon: 'horizontal_rule', label: t('Garis') }
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => insertElementIntoScene(activeScene.id, item.kind)}
                        title={t('Tambah {0} ke adegan ini', item.label.toLowerCase())}
                        className="h-7 px-2 rounded-lg bg-surface-1 border border-border text-[10px] font-semibold text-text-muted hover:text-accent hover:border-accent/40 flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {availableLayers.length === 0 ? (
                    <div className="p-3 rounded-xl bg-surface-1 border border-border text-center text-text-muted text-[11px] leading-relaxed flex flex-col items-center gap-2">
                      <span>
                        {activeCompScene?.html
                          ? t('Tidak ada layer yang ditandai data-moo-layer pada adegan ini.')
                          : t('Layer visual belum disusun secara permanen untuk adegan ini.')}
                      </span>
                      <button
                        type="button"
                        onClick={() => compileSceneProcedural(activeScene.id, 'auto')}
                        className="px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/40 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        <span>{t('Susun Layer & Visual Instan')}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Layer Pills Selector */}
                      <div className="flex flex-wrap gap-1">
                        {availableLayers.map((layer) => {
                          const isSelected = layer.id === activeLayer?.id;
                          const hasOverrides = Boolean(currentOverrides[layer.id]);

                          return (
                            <button
                              key={layer.id}
                              type="button"
                              onClick={() => setSelectedLayerId(layer.id)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
                                isSelected
                                  ? 'bg-accent text-on-accent font-semibold shadow-xs'
                                  : 'bg-surface-1 text-text-muted hover:text-on-surface border border-border'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {getLayerIcon(layer.type)}
                              </span>
                              <span className="truncate max-w-[90px]">{layer.label}</span>
                              {hasOverrides && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-accent'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Controls for Active Layer */}
                      {activeLayer && (
                        <div className="p-3 rounded-xl bg-surface-1 border border-border space-y-3.5">
                          {/* Header Layer & Quick Tools */}
                          <div className="flex items-center justify-between pb-2 border-b border-border/40">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="material-symbols-outlined text-accent text-[17px] shrink-0">
                                {getLayerIcon(activeLayer.type)}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-[12px] font-semibold text-on-surface truncate">
                                  {activeLayer.label}
                                </h4>
                                <span className="text-[9px] font-mono text-text-muted">
                                  {activeLayer.id} • {activeLayer.type}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Visibility Toggle */}
                              <button
                                type="button"
                                onClick={() => handleOverrideChange('hidden', !activeLayerOverride.hidden)}
                                className={`p-1 rounded-lg border text-[11px] transition-colors ${
                                  activeLayerOverride.hidden
                                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                    : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                }`}
                                title={activeLayerOverride.hidden ? t('Layer tersembunyi (Klik untuk tampilkan)') : t('Sembunyikan layer')}
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  {activeLayerOverride.hidden ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>

                              {/* Z-Index Controls */}
                              <div className="flex items-center gap-0.5 bg-surface-2 border border-border rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('zIndex', Math.max(0, (activeLayerOverride.zIndex || 0) - 1))}
                                  className="p-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-on-surface transition-colors"
                                  title={t('Kirim ke Belakang (Z-Index -1)')}
                                >
                                  <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                                </button>
                                <span className="text-[10px] font-mono px-1 text-on-surface">
                                  Z:{activeLayerOverride.zIndex ?? 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('zIndex', (activeLayerOverride.zIndex || 0) + 1)}
                                  className="p-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-on-surface transition-colors"
                                  title={t('Bawa ke Depan (Z-Index +1)')}
                                >
                                  <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                                </button>
                              </div>

                              {/* Reset & Delete */}
                              <button
                                type="button"
                                onClick={handleResetLayerOverride}
                                className="p-1 rounded-lg hover:bg-surface-2 text-text-muted hover:text-accent transition-colors"
                                title={t('Reset transform ke default')}
                              >
                                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLayer}
                                className="p-1 rounded-lg hover:bg-surface-2 text-text-muted hover:text-rose-400 transition-colors"
                                title={t('Hapus layer ini dari adegan')}
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Kontrol Khusus Layer Teks */}
                          {activeLayer.type === 'text' && (
                            <div className="space-y-2 p-2.5 rounded-xl bg-surface-2/50 border border-border/70">
                              <div className="space-y-1">
                                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                                  {t('Isi teks')}
                                </span>
                                <input
                                  type="text"
                                  value={localLayerText}
                                  onChange={(e) => setLocalLayerText(e.target.value)}
                                  onBlur={() => commitLayerText(localLayerText)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitLayerText(localLayerText);
                                  }}
                                  placeholder={t('Ketik teks layer di sini...')}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-1 border border-border text-[12px] text-on-surface focus:outline-none focus:border-accent"
                                />
                              </div>

                              {/* Ukuran Teks (fontSizeScale) */}
                              <div className="space-y-1 pt-1 border-t border-border/50">
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                                  <span>{t('Ukuran Font')}</span>
                                  <span className="text-accent">{Math.round((activeLayerOverride.fontSizeScale || 1.0) * 100)}%</span>
                                </div>
                                <DebouncedSlider
                                  min={0.5}
                                  max={2.5}
                                  step={0.05}
                                  value={activeLayerOverride.fontSizeScale || 1.0}
                                  onChangeComplete={(val) => handleOverrideChange('fontSizeScale', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                                <div className="flex items-center gap-1 pt-0.5">
                                  {[0.8, 1.0, 1.25, 1.5, 2.0].map((sc) => (
                                    <button
                                      key={sc}
                                      type="button"
                                      onClick={() => handleOverrideChange('fontSizeScale', sc)}
                                      className={`flex-1 py-0.5 rounded text-[9px] font-mono border transition-all ${
                                        Math.abs((activeLayerOverride.fontSizeScale || 1.0) - sc) < 0.05
                                          ? 'bg-accent/15 border-accent text-accent font-bold'
                                          : 'bg-surface-1 border-border text-text-muted hover:text-on-surface'
                                      }`}
                                    >
                                      {Math.round(sc * 100)}%
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Perataan Teks (textAlign) */}
                              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                <span className="text-[10px] text-text-muted font-medium">{t('Perataan Teks')}</span>
                                <div className="flex items-center gap-1 bg-surface-1 p-0.5 rounded-lg border border-border">
                                  {(['left', 'center', 'right'] as const).map((align) => {
                                    const isSel = (activeLayerOverride.textAlign || 'center') === align;
                                    return (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() => handleOverrideChange('textAlign', align)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                          isSel ? 'bg-surface-3 text-accent font-bold shadow-xs' : 'text-text-muted hover:text-on-surface'
                                        }`}
                                      >
                                        {align === 'left' ? t('Kiri') : align === 'center' ? t('Tengah') : t('Kanan')}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <TypographyControls
                                override={activeLayerOverride}
                                customFonts={project.customFonts || []}
                                onChange={handleOverridesChange}
                                onUploadFont={addCustomFont}
                              />
                            </div>
                          )}

                          {/* Position X and Y */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                              <span className="font-semibold uppercase tracking-wider text-[9px]">{t('Posisi Koordinat')}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('x', 0)}
                                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] hover:text-accent"
                                  title={t('Rata Tengah X')}
                                >
                                  X=0
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('y', 0)}
                                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] hover:text-accent"
                                  title={t('Rata Tengah Y')}
                                >
                                  Y=0
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverridesChange({ x: 0, y: 0 })}
                                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] hover:text-accent"
                                  title={t('Pusat Canvas')}
                                >
                                  {t('Pusat')}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>{t('Pos X')}</span>
                                  <CommitNumberInput
                                    min={-960}
                                    max={960}
                                    step={1}
                                    value={activeLayerOverride.x || 0}
                                    onCommit={(val) => handleOverrideChange('x', val)}
                                    ariaLabel={t('Posisi X')}
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <DebouncedSlider
                                  min={-960}
                                  max={960}
                                  step={2}
                                  value={activeLayerOverride.x || 0}
                                  onChangeComplete={(val) => handleOverrideChange('x', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>{t('Pos Y')}</span>
                                  <CommitNumberInput
                                    min={-1080}
                                    max={1080}
                                    step={1}
                                    value={activeLayerOverride.y || 0}
                                    onCommit={(val) => handleOverrideChange('y', val)}
                                    ariaLabel={t('Posisi Y')}
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <DebouncedSlider
                                  min={-1080}
                                  max={1080}
                                  step={2}
                                  value={activeLayerOverride.y || 0}
                                  onChangeComplete={(val) => handleOverrideChange('y', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Scale, Rotation, and Flip */}
                          <div className="space-y-1.5 pt-1 border-t border-border/40">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>{t('Skala')}</span>
                                  <div className="flex items-center gap-1">
                                    <CommitNumberInput
                                      min={0.1}
                                      max={3.5}
                                      step={0.05}
                                      value={activeLayerOverride.scale !== undefined ? activeLayerOverride.scale : 1.0}
                                      onCommit={(val) => handleOverrideChange('scale', val)}
                                      ariaLabel={t('Skala Layer')}
                                      className="w-11 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange('scale', 1.0)}
                                      className="text-[9px] px-1 py-0.2 rounded bg-surface-2 border border-border text-text-muted hover:text-accent"
                                      title={t('Reset 1.0x')}
                                    >
                                      1x
                                    </button>
                                  </div>
                                </div>
                                <DebouncedSlider
                                  min={0.1}
                                  max={3.5}
                                  step={0.05}
                                  value={activeLayerOverride.scale !== undefined ? activeLayerOverride.scale : 1.0}
                                  onChangeComplete={(val) => handleOverrideChange('scale', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>{t('Rotasi')}</span>
                                  <CommitNumberInput
                                    min={-180}
                                    max={180}
                                    step={5}
                                    value={activeLayerOverride.rotation || 0}
                                    onCommit={(val) => handleOverrideChange('rotation', val)}
                                    ariaLabel={t('Rotasi Layer')}
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <DebouncedSlider
                                  min={-180}
                                  max={180}
                                  step={5}
                                  value={activeLayerOverride.rotation || 0}
                                  onChangeComplete={(val) => handleOverrideChange('rotation', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                                <div className="flex items-center gap-1 pt-0.5">
                                  {[0, 90, 180, -90].map((deg) => (
                                    <button
                                      key={deg}
                                      type="button"
                                      onClick={() => handleOverrideChange('rotation', deg)}
                                      className={`flex-1 py-0.2 rounded text-[8px] font-mono border transition-all ${
                                        (activeLayerOverride.rotation || 0) === deg
                                          ? 'bg-accent/15 border-accent text-accent font-bold'
                                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                      }`}
                                    >
                                      {deg}°
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Flip Buttons */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-text-muted font-medium">{t('Balik Arah (Flip):')}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('flipX', !activeLayerOverride.flipX)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                    activeLayerOverride.flipX
                                      ? 'bg-accent/15 border-accent text-accent font-bold'
                                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                  }`}
                                  title={t('Balik Horisontal (Flip H)')}
                                >
                                  <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                                  <span>{t('Flip H')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('flipY', !activeLayerOverride.flipY)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                    activeLayerOverride.flipY
                                      ? 'bg-accent/15 border-accent text-accent font-bold'
                                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                  }`}
                                  title={t('Balik Vertikal (Flip V)')}
                                >
                                  <span className="material-symbols-outlined text-[13px]">swap_vert</span>
                                  <span>{t('Flip V')}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Border Radius for Shape & Box & Group */}
                          {(activeLayer.type === 'shape' || activeLayer.type === 'group' || activeLayer.type === 'image') && (
                            <div className="space-y-1 pt-1 border-t border-border/40">
                              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                <span>{t('Kelengkungan Sudut')}</span>
                                <div className="flex items-center gap-1">
                                  <CommitNumberInput
                                    min={0}
                                    max={64}
                                    step={1}
                                    value={activeLayerOverride.borderRadius || 0}
                                    onCommit={(val) => handleOverrideChange('borderRadius', val)}
                                    ariaLabel={t('Kelengkungan Sudut')}
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                  <span className="text-[9px]">{t('px')}</span>
                                </div>
                              </div>
                              <DebouncedSlider
                                min={0}
                                max={64}
                                step={2}
                                value={activeLayerOverride.borderRadius || 0}
                                onChangeComplete={(val) => handleOverrideChange('borderRadius', val)}
                                className="w-full accent-accent h-1 cursor-pointer"
                              />
                              <div className="flex items-center gap-1 pt-0.5">
                                {[0, 8, 16, 24, 32].map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleOverrideChange('borderRadius', r)}
                                    className={`flex-1 py-0.2 rounded text-[8px] font-mono border transition-all ${
                                      (activeLayerOverride.borderRadius || 0) === r
                                        ? 'bg-accent/15 border-accent text-accent font-bold'
                                        : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                    }`}
                                  >
                                    {r}{t('px')}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Opacity and Color */}
                          <div className="space-y-2 pt-1 border-t border-border/40">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>{t('Transparansi')}</span>
                                  <span className="text-accent">
                                    {Math.round((activeLayerOverride.opacity !== undefined ? activeLayerOverride.opacity : 1.0) * 100)}%
                                  </span>
                                </div>
                                <DebouncedSlider
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={activeLayerOverride.opacity !== undefined ? activeLayerOverride.opacity : 1.0}
                                  onChangeComplete={(val) => handleOverrideChange('opacity', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>{t('Warna Layer')}</span>
                                  <span className="text-accent text-[9px]">{activeLayerOverride.color || t('Bawaan')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <DebouncedColor
                                    value={activeLayerOverride.color || '#84cc16'}
                                    onChangeComplete={(val) => handleOverrideChange('color', val)}
                                    className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                                  />
                                  {activeLayerOverride.color && (
                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange('color', undefined)}
                                      className="text-[9px] text-text-muted hover:text-on-surface"
                                    >
                                      {t('Reset')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick color palette chips */}
                            <div className="flex items-center gap-1 pt-0.5">
                              <span className="text-[9px] text-text-muted mr-1">{t('Palet Cepat:')}</span>
                              {['#84cc16', '#38bdf8', '#f59e0b', '#ef4444', '#ec4899', '#ffffff'].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => handleOverrideChange('color', c)}
                                  className={`w-4 h-4 rounded-full border transition-transform ${
                                    activeLayerOverride.color === c ? 'border-white scale-125' : 'border-border/60 hover:scale-110'
                                  }`}
                                  style={{ backgroundColor: c }}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>

                          <LayerMotionPanel
                            key={`${activeScene.id}:${activeLayer.id}`}
                            motion={activeCompScene?.layerMotions?.[activeLayer.id]}
                            sceneDuration={activeScene.durationInSeconds}
                            getPlayheadInShot={() => {
                              const { currentFrame, project: p } = useMooStore.getState();
                              const start = getSceneStartSeconds(p.scenes, activeScene.id) ?? 0;
                              return currentFrame / (p.fps || 30) - start;
                            }}
                            onChange={(motion) => updateLayerMotion(activeScene.id, activeLayer.id, motion)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 4. Scene Palette (CSS Variables Overrides) */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">palette</span>
                      {t('Palet Warna Adegan #')}{activeSceneIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetPalette}
                      className="text-[10px] text-text-muted hover:text-rose-400 flex items-center gap-0.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                      {t('Reset')}
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">{t('Bg')}</span>
                      <DebouncedColor
                        value={currentPalette.bg || project.theme.bg || '#09090b'}
                        onChangeComplete={(val) => handlePaletteChange('bg', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">{t('Primary')}</span>
                      <DebouncedColor
                        value={currentPalette.primary || project.theme.textPrimary || '#ffffff'}
                        onChangeComplete={(val) => handlePaletteChange('primary', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">{t('Accent')}</span>
                      <DebouncedColor
                        value={currentPalette.accent || project.theme.textHighlight || '#84cc16'}
                        onChangeComplete={(val) => handlePaletteChange('accent', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">{t('Text')}</span>
                      <DebouncedColor
                        value={currentPalette.text || project.theme.textPrimary || '#ffffff'}
                        onChangeComplete={(val) => handlePaletteChange('text', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Tipografi & Font Utama Proyek */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">font_download</span>
                      {t('Tipografi & Font Proyek')}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {mapFontDisplay(project.theme.fontFamily)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'Jakarta', label: t('Jakarta Sans'), sub: t('Modern & Bersih') },
                        { id: 'Impact', label: t('Syne Display'), sub: t('Kinetik & Bold') },
                        { id: 'Mono', label: t('JetBrains Mono'), sub: t('Teknis & Kode') }
                      ] as const
                    ).map((f) => {
                      const isSel = (project.theme.fontFamily || 'Jakarta') === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateThemeFont(f.id)}
                          className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                            isSel
                              ? 'bg-accent/15 border-accent text-accent font-semibold shadow-xs'
                              : 'bg-surface-1 border-border text-text-muted hover:text-on-surface'
                          }`}
                        >
                          <span className="text-[11px] font-bold truncate">{f.label}</span>
                          <span className="text-[9px] opacity-75 truncate">{f.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

          </div>
    </>
  );
};
