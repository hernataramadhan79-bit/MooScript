import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import type { SceneTransition } from '../../types';
import { resolveSkillIcon } from '../../engine/skills/skillManager';
import { Button } from '../ui/Button';

interface AutoExpandTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  className?: string;
}

const AutoExpandTextarea: React.FC<AutoExpandTextareaProps> = ({
  value,
  onChange,
  onFocus,
  placeholder,
  className = ''
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0px';
      el.style.height = `${Math.min(140, Math.max(34, el.scrollHeight))}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = '0px';
        e.target.style.height = `${Math.min(140, Math.max(34, e.target.scrollHeight))}px`;
      }}
      onFocus={onFocus}
      placeholder={placeholder}
      rows={1}
      className={`w-full bg-surface-2/40 hover:bg-surface-2/60 focus:bg-surface-2/80 border border-border/40 focus:border-accent/60 text-[13px] text-text placeholder:text-text-faint/60 leading-relaxed resize-none focus:outline-none px-2.5 py-2 rounded-lg transition-colors overflow-y-auto max-h-36 ${className}`}
    />
  );
};

const cleanWord = (w: string): string => w.replace(/^[^\w\s]+|[^\w\s]+$/g, '').toLowerCase();

interface SceneDurationInputProps {
  duration: number;
  onCommit: (val: number) => void;
}

const SceneDurationInput: React.FC<SceneDurationInputProps> = ({ duration, onCommit }) => {
  const [localVal, setLocalVal] = useState(duration.toString());

  useEffect(() => {
    setLocalVal(duration.toString());
  }, [duration]);

  const commit = () => {
    const parsed = parseFloat(localVal);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(60, Math.max(0.5, Math.round(parsed * 10) / 10));
      onCommit(clamped);
      setLocalVal(clamped.toString());
    } else {
      setLocalVal(duration.toString());
    }
  };

  return (
    <div
      className="flex items-center text-[11px] font-mono text-text-muted bg-surface-2/80 border border-border/60 hover:border-border rounded-md px-1.5 py-0.5 transition-colors shrink-0"
      onClick={(e) => e.stopPropagation()}
      title="Durasi tayang adegan (detik)"
    >
      <input
        type="number"
        min="0.5"
        max="30"
        step="0.5"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setLocalVal(duration.toString());
            e.currentTarget.blur();
          }
        }}
        className="w-8 bg-transparent text-center text-text font-medium text-[11px] font-mono focus:outline-none"
        aria-label="Durasi detik"
      />
      <span className="text-[10px] text-text-faint select-none">s</span>
    </div>
  );
};

export interface SceneDeckProps {
  className?: string;
  onOpenCodeInspector?: (beatId: string) => void;
  onEditScene?: (sceneId: string) => void;
  onOpenAssets?: (sceneId: string) => void;
}

export const SceneDeck: React.FC<SceneDeckProps> = ({
  className = '',
  onOpenCodeInspector,
  onEditScene,
  onOpenAssets
}) => {
  const {
    project,
    addScene,
    removeScene,
    duplicateScene,
    updateSceneText,
    updateSceneVisualIntent,
    updateSceneVisualConcept,
    toggleWordFocus,
    setSceneDuration,
    setSceneTransition,
    reorderScenes,
    scriptPrompt,
    setScriptPrompt,
    generateScript,
    isGeneratingScript,
    undoGenerateScript,
    previousScenesSnapshot,
    activeSceneId,
    setActiveSceneId,
    seekFrame,
    assets,
    assignAssetToScene,
    removeAssetFromSceneBeat,
    updateSceneAssetRole,
    skills,
    activeSkillId,
    setSettingsOpen,
    compileSceneProcedural
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      addScene: s.addScene,
      removeScene: s.removeScene,
      duplicateScene: s.duplicateScene,
      updateSceneText: s.updateSceneText,
      updateSceneVisualIntent: s.updateSceneVisualIntent,
      updateSceneVisualConcept: s.updateSceneVisualConcept,
      toggleWordFocus: s.toggleWordFocus,
      setSceneDuration: s.setSceneDuration,
      setSceneTransition: s.setSceneTransition,
      reorderScenes: s.reorderScenes,
      scriptPrompt: s.scriptPrompt,
      setScriptPrompt: s.setScriptPrompt,
      generateScript: s.generateScript,
      isGeneratingScript: s.isGeneratingScript,
      undoGenerateScript: s.undoGenerateScript,
      previousScenesSnapshot: s.previousScenesSnapshot,
      activeSceneId: s.activeSceneId,
      setActiveSceneId: s.setActiveSceneId,
      seekFrame: s.seekFrame,
      assets: s.assets,
      assignAssetToScene: s.assignAssetToScene,
      removeAssetFromSceneBeat: s.removeAssetFromSceneBeat,
      updateSceneAssetRole: s.updateSceneAssetRole,
      skills: s.skills,
      activeSkillId: s.activeSkillId,
      setSettingsOpen: s.setSettingsOpen,
      compileSceneProcedural: s.compileSceneProcedural
    }))
  );

  const scenes = project.scenes || [];
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [openAssetPickerForScene, setOpenAssetPickerForScene] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevActiveSceneIdRef = useRef<string | null>(activeSceneId);

  useEffect(() => {
    if (prevActiveSceneIdRef.current !== activeSceneId) {
      prevActiveSceneIdRef.current = activeSceneId;
      if (activeSceneId && cardRefs.current[activeSceneId]) {
        cardRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSceneId]);
  const toggleDetail = (sceneId: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [sceneId]: !prev[sceneId]
    }));
  };

  return (
    <div className={`flex flex-col gap-2.5 p-2.5 sm:p-3.5 w-full ${className}`}>
      {/* 1. Generator Naskah & Ide Cerita */}
      <div className="p-3 rounded-xl bg-surface-1 border border-border/80 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-text flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-accent">subtitles</span>
            Ide Cerita & Naskah
          </span>
          {previousScenesSnapshot && previousScenesSnapshot.length > 0 && (
            <button
              type="button"
              onClick={() => undoGenerateScript()}
              className="text-[10px] font-medium text-text-muted hover:text-text flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 border border-border transition-colors"
              title="Kembalikan naskah sebelumnya"
            >
              <span className="material-symbols-outlined text-[13px]">undo</span>
              <span>Urungkan</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <textarea
            value={scriptPrompt}
            onChange={(e) => setScriptPrompt(e.target.value)}
            placeholder="Tulis topik atau naskah video..."
            rows={2}
            className="w-full bg-surface-2/70 border border-border/70 focus:border-accent rounded-lg px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-faint resize-none focus:outline-none transition-all leading-snug max-h-20 overflow-y-auto"
          />

          <div className="flex items-center justify-between gap-2">
            {(() => {
              const activeSkill = skills.find((s) => s.id === activeSkillId) || skills[0];
              return (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2/60 hover:bg-surface-3 text-[11px] text-text-muted hover:text-text border border-border/60 transition-all truncate max-w-[170px]"
                  title="Ganti atau sesuaikan Persona Sutradara di Pengaturan"
                >
                  <span className="material-symbols-outlined text-[14px] text-text-muted shrink-0">
                    {activeSkill ? resolveSkillIcon(activeSkill.icon) : 'palette'}
                  </span>
                  <span className="truncate">
                    Gaya: <strong className="text-text font-medium">{activeSkill?.name || 'Creative'}</strong>
                  </span>
                </button>
              );
            })()}

            <Button
              variant="primary"
              size="sm"
              icon="movie_creation"
              isLoading={isGeneratingScript}
              disabled={!scriptPrompt.trim() || isGeneratingScript}
              onClick={() => generateScript()}
              className="!py-1.5 !px-3 !text-[12px] !min-h-[30px] whitespace-nowrap shrink-0"
            >
              Susun Adegan
            </Button>
          </div>
        </div>
      </div>
      {/* 2. Daftar Kartu Adegan (Scene Storyboard) */}
      <div className="flex flex-col gap-2">
        {scenes.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border/80 flex flex-col items-center justify-center text-center gap-3 bg-surface-1/40 my-1">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <span className="material-symbols-outlined text-[20px]">movie_edit</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-text">Mulai Naskah Motion Graphics</h4>
              <p className="text-[11px] text-text-muted max-w-[240px]">
                Ketik ide atau naskah Anda di kolom atas untuk menyusun shot otomatis, atau buat adegan manual.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="add"
              onClick={addScene}
              className="mt-1"
            >
              Tambah Adegan Pertama
            </Button>
          </div>
        ) : (
          scenes.map((scene, index) => {
          const isActive = activeSceneId === scene.id;
          const startSec = scenes.slice(0, index).reduce((acc, s) => acc + (s.durationInSeconds || 3), 0);
          const narration = scene.narrationText ?? scene.text ?? '';
          const duration = Math.min(30, Math.max(0.5, scene.durationInSeconds || 3));

          const words = narration.trim().split(/\s+/).filter(Boolean);
          const focusSet = new Set((scene.focusWords || []).map(cleanWord));
          const isDetailOpen = Boolean(expandedDetails[scene.id]);

          const compScene = project.composition?.scenes?.find(
            (s) => s.id === scene.id || s.beatId === scene.id
          );
          const isEdited = Boolean(
            compScene?.userEdited ||
            (compScene?.overrides && Object.keys(compScene.overrides).length > 0)
          );
          const compStatus = compScene?.status;

          return (
            <React.Fragment key={scene.id}>
            <div
              key={scene.id}
              ref={(el) => {
                cardRefs.current[scene.id] = el;
              }}
              onClick={() => {
                const fps = project.fps || 30;
                seekFrame(Math.round(startSec * fps));
                setActiveSceneId(scene.id);
              }}
              className={`p-2.5 sm:p-3 rounded-xl border transition-all duration-150 flex flex-col gap-2 cursor-pointer ${
                isActive
                  ? 'bg-surface-2/70 border-accent/60 shadow-sm ring-1 ring-accent/20'
                  : 'bg-surface-1 border-border/70 hover:border-border hover:bg-surface-1/90'
              }`}
            >
              {/* Header Kartu: Identitas, Status, Durasi, dan Kontrol Manajemen */}
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-surface-2 text-text-muted font-mono text-[11px] font-bold shrink-0 select-none">
                    #{String(index + 1).padStart(2, '0')}
                  </span>

                  {/* Status error only (per R-09: don't badge normal status) */}
                  {compStatus === 'error' && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold shrink-0 bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      title="Kesalahan kompilasi adegan"
                    >
                      error
                    </span>
                  )}
                  {isEdited && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted font-mono shrink-0 border border-border"
                      title="Adegan telah disunting manual"
                    >
                      edit
                    </span>
                  )}

                  {/* Input Durasi Angka */}
                  <SceneDurationInput
                    duration={duration}
                    onCommit={(val) => setSceneDuration(scene.id, val, true)}
                  />
                </div>

                {/* Tombol Manajemen Adegan: Urutan, Duplikat, Hapus */}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => reorderScenes(index, index - 1)}
                    title="Geser adegan ke atas"
                    className="w-6 h-6 rounded-md hover:bg-surface-3 disabled:opacity-25 disabled:pointer-events-none text-text-muted hover:text-text flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    disabled={index === scenes.length - 1}
                    onClick={() => reorderScenes(index, index + 1)}
                    title="Geser adegan ke bawah"
                    className="w-6 h-6 rounded-md hover:bg-surface-3 disabled:opacity-25 disabled:pointer-events-none text-text-muted hover:text-text flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateScene(scene.id)}
                    title="Duplikat adegan"
                    className="w-6 h-6 rounded-md hover:bg-surface-3 text-text-muted hover:text-text flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  </button>
                  <button
                    type="button"
                    disabled={scenes.length <= 1}
                    onClick={() => removeScene(scene.id)}
                    title="Hapus adegan"
                    className="w-6 h-6 rounded-md hover:bg-rose-500/15 disabled:opacity-25 disabled:pointer-events-none text-text-muted hover:text-rose-400 flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Isi Naskah Narasi (Voiceover) */}
              <div className="flex flex-col">
                <AutoExpandTextarea
                  value={narration}
                  onChange={(text) => updateSceneText(scene.id, text)}
                  onFocus={() => setActiveSceneId(scene.id)}
                  placeholder="Tulis naskah narasi adegan..."
                />
              </div>

              {/* Baris Aksi & Studio Toolbar (Sleek, Anti-Slop, Non-Colliding) */}
              <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => toggleDetail(scene.id)}
                  className={`h-7 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 select-none ${
                    isDetailOpen
                      ? 'bg-surface-3 border-accent/40 text-text font-semibold'
                      : 'bg-surface-2/60 hover:bg-surface-2 border-border/50 text-text-muted hover:text-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] text-text-muted">
                    {isDetailOpen ? 'expand_less' : 'tune'}
                  </span>
                  <span>Detail & Aset</span>
                  {(scene.visualIntent || scene.visualConcept || (scene.focusWords?.length || 0) > 0) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Memiliki arahan visual / kata kunci" />
                  )}
                  {(scene.assignedAssets?.length || 0) > 0 && (
                    <span className="text-[9px] px-1 rounded-full bg-surface-3 text-text-muted font-mono font-bold shrink-0">
                      {scene.assignedAssets?.length}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSceneId(scene.id);
                      compileSceneProcedural(scene.id, 'auto');
                    }}
                    className="h-7 px-2.5 rounded-md bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                    title="Susun visual motion graphics instan tanpa kuota API (berdasarkan konteks naskah)"
                  >
                    <span className="material-symbols-outlined text-[13px]">bolt</span>
                    <span>Visual</span>
                  </button>

                  <div className="flex items-center bg-surface-2/70 border border-border/50 rounded-md p-0.5 shrink-0">
                    {onEditScene && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSceneId(scene.id);
                          onEditScene(scene.id);
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                        title="Gaya & Layer Adegan"
                      >
                        <span className="material-symbols-outlined text-[14px]">palette</span>
                      </button>
                    )}
                    {onOpenAssets && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSceneId(scene.id);
                          onOpenAssets(scene.id);
                        }}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                        title="Sisipkan Aset / Media"
                      >
                        <span className="material-symbols-outlined text-[14px]">perm_media</span>
                      </button>
                    )}
                    {onOpenCodeInspector && (
                      <button
                        type="button"
                        onClick={() => onOpenCodeInspector(scene.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                        title="Editor Kode Mograph"
                      >
                        <span className="material-symbols-outlined text-[14px]">code</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel Detail Collapsible: Kata Kunci, Visual Intent, Aset Adegan & Slider Durasi */}
              {isDetailOpen && (
                <div
                  className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-surface-2/40 border border-border/50 mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 1. Sorotan Kata Kunci */}
                  {words.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1 select-none">
                        <span className="material-symbols-outlined text-[13px] text-accent">star</span>
                        Sorotan Kata Kunci
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {words.map((w, wIdx) => {
                          const clean = cleanWord(w);
                          const isFocus = focusSet.has(clean);
                          return (
                            <button
                              key={`${w}-${wIdx}`}
                              type="button"
                              onClick={() => toggleWordFocus(scene.id, w)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all flex items-center gap-1 select-none active:scale-95 ${
                                isFocus
                                  ? 'bg-accent text-on-accent font-bold shadow-sm'
                                  : 'bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-on-surface border border-border/60'
                              }`}
                            >
                              {isFocus && <span className="text-[9px]">★</span>}
                              <span>{w}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Arah Visual & Konsep */}
                  <div className="grid grid-cols-1 gap-2 pt-1 border-t border-border/30">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Arah Visual (Visual Intent)
                      </label>
                      <input
                        type="text"
                        value={scene.visualIntent || ''}
                        onChange={(e) => updateSceneVisualIntent(scene.id, e.target.value)}
                        placeholder="Contoh: Pesawat masuk frame, aliran udara digambar..."
                        className="w-full bg-surface-1 border border-border/70 focus:border-accent rounded-lg px-2.5 py-1 text-[11px] sm:text-[12px] text-on-surface focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Konsep / Metafora Visual
                      </label>
                      <input
                        type="text"
                        value={scene.visualConcept || ''}
                        onChange={(e) => updateSceneVisualConcept(scene.id, e.target.value)}
                        placeholder="Contoh: Diagram vektor gaya angkat, partikel melengkung..."
                        className="w-full bg-surface-1 border border-border/70 focus:border-accent rounded-lg px-2.5 py-1 text-[11px] sm:text-[12px] text-on-surface focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 3. Lampiran Aset Visual Adegan */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-accent">attach_file</span>
                        <span>Aset Visual Adegan</span>
                        {(scene.assignedAssets?.length || 0) > 0 && (
                          <span className="text-[9px] px-1 rounded-full bg-accent/20 text-accent font-mono font-bold">
                            {scene.assignedAssets?.length}
                          </span>
                        )}
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenAssetPickerForScene(openAssetPickerForScene === scene.id ? null : scene.id)}
                          className="text-[10px] text-accent hover:text-accent-hover font-medium flex items-center gap-0.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[13px]">add_circle</span>
                          <span>Lampirkan Aset</span>
                        </button>

                        {openAssetPickerForScene === scene.id && (
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-64 p-2 rounded-xl bg-surface-2 border border-border shadow-xl flex flex-col gap-1.5">
                            <div className="flex items-center justify-between pb-1 border-b border-border/50">
                              <span className="text-[11px] font-semibold text-on-surface">Pilih Aset untuk Adegan</span>
                              <button
                                type="button"
                                onClick={() => setOpenAssetPickerForScene(null)}
                                className="text-text-muted hover:text-on-surface text-[12px]"
                              >
                                ✕
                              </button>
                            </div>

                            {assets.length === 0 ? (
                              <div className="p-3 text-center text-text-muted text-[11px] leading-relaxed">
                                Belum ada aset diunggah. Unggah gambar/logo pada Tab Aset terlebih dahulu.
                              </div>
                            ) : (
                              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                                {assets.map((asset) => {
                                  const isAlreadyAttached = (scene.assignedAssets || []).some((a) => a.assetId === asset.id);
                                  return (
                                    <button
                                      key={asset.id}
                                      type="button"
                                      disabled={isAlreadyAttached}
                                      onClick={() => {
                                        assignAssetToScene(scene.id, {
                                          assetId: asset.id,
                                          assetName: asset.name,
                                          dataUrl: asset.dataUrl || '',
                                          role: 'logo',
                                          motionGuidance: ''
                                        });
                                        setOpenAssetPickerForScene(null);
                                      }}
                                      className={`flex items-center gap-2 p-1.5 rounded-lg text-left transition-colors ${
                                        isAlreadyAttached
                                          ? 'opacity-40 cursor-not-allowed bg-surface-1'
                                          : 'hover:bg-surface-3 text-on-surface'
                                      }`}
                                    >
                                      <img
                                        src={asset.dataUrl}
                                        alt={asset.name}
                                        className="w-7 h-7 rounded object-contain bg-black/40 border border-border shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium truncate">{asset.name}</p>
                                        <p className="text-[9px] text-text-muted font-mono">
                                          {isAlreadyAttached ? 'Sudah dilampirkan' : 'Klik untuk melampirkan'}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {(scene.assignedAssets || []).length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {(scene.assignedAssets || []).map((att) => (
                          <div
                            key={att.assetId}
                            className="p-2 rounded-xl bg-surface-1 border border-border/80 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={att.dataUrl}
                                  alt={att.assetName}
                                  className="w-8 h-8 rounded-lg object-contain bg-black/50 border border-border shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-on-surface truncate">{att.assetName}</p>
                                  <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                                    {(['logo', 'product', 'screenshot', 'character', 'badge'] as const).map((r) => (
                                      <button
                                        key={r}
                                        type="button"
                                        onClick={() => updateSceneAssetRole(scene.id, att.assetId, r, att.motionGuidance)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                                          att.role === r
                                            ? 'bg-accent/20 border border-accent text-accent font-bold'
                                            : 'bg-surface-2 border border-border/60 text-text-muted hover:text-on-surface'
                                        }`}
                                      >
                                        {r === 'logo' ? 'Logo' : r === 'product' ? 'Produk' : r === 'screenshot' ? 'Screenshot' : r === 'character' ? 'Karakter' : 'Badge'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeAssetFromSceneBeat(scene.id, att.assetId)}
                                className="p-1 rounded hover:bg-surface-3 text-text-muted hover:text-rose-400 transition-colors shrink-0"
                                title="Copot aset dari adegan ini"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            </div>

                            <input
                              type="text"
                              value={att.motionGuidance || ''}
                              onChange={(e) => updateSceneAssetRole(scene.id, att.assetId, att.role, e.target.value)}
                              placeholder="Arahan gerak AI (misal: 'Posisikan di tengah memantul masuk')"
                              className="w-full px-2 py-1 rounded-lg bg-surface-2 border border-border text-[11px] text-on-surface placeholder:text-text-muted/60 focus:outline-none focus:border-accent"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Slider Durasi Adegan */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/30 text-text-faint text-[10px] font-mono">
                    <span>Durasi:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="30"
                      step="0.5"
                      value={Math.min(30, duration)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          setSceneDuration(scene.id, val, true);
                        }
                      }}
                      className="flex-1 h-1 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                      aria-label={`Durasi adegan #${index + 1}`}
                    />
                    <span className="w-8 text-right font-medium text-text-muted select-none">
                      {duration.toFixed(1)}s
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Transisi Antar Adegan */}
            {index < scenes.length - 1 && (
              <div className="relative flex items-center justify-center my-1 select-none">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-1 border border-border/70 text-[10px] text-text-muted hover:border-border transition-colors">
                  <span className="material-symbols-outlined text-[12px] text-text-faint">swap_horiz</span>
                  <span className="text-[10px] text-text-muted">Transisi:</span>
                  <select
                    value={scene.transition || 'flow'}
                    onChange={(e) => setSceneTransition(scene.id, e.target.value as SceneTransition)}
                    className="bg-transparent text-text text-[10px] font-medium focus:outline-none cursor-pointer pr-1"
                    aria-label={`Transisi dari adegan ${index + 1}`}
                  >
                    <option value="flow" className="bg-surface-1 text-text">Flow (Menyambung)</option>
                    <option value="cut" className="bg-surface-1 text-text">Cut (Langsung)</option>
                    <option value="fade" className="bg-surface-1 text-text">Fade (Pudar)</option>
                    <option value="slide" className="bg-surface-1 text-text">Slide (Geser)</option>
                    <option value="zoom" className="bg-surface-1 text-text">Zoom (Perbesar)</option>
                    <option value="wipe" className="bg-surface-1 text-text">Wipe (Sapuan)</option>
                  </select>
                </div>
              </div>
            )}
          </React.Fragment>
          );
        })
      )}

        {/* Tombol Tambah Adegan */}
        <button
          type="button"
          onClick={addScene}
          className="w-full py-2.5 px-3 rounded-xl border border-dashed border-border/80 hover:border-border-strong bg-surface-1/40 hover:bg-surface-2 text-text-muted hover:text-on-surface text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] select-none"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Tambah Adegan</span>
        </button>

      </div>
    </div>
  );
};
