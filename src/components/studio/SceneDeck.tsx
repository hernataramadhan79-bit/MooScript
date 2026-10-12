import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { SceneTransition } from '../../types';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

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
      el.style.height = 'auto';
      el.style.height = `${Math.max(24, el.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.max(24, e.target.scrollHeight)}px`;
      }}
      onFocus={onFocus}
      placeholder={placeholder}
      rows={1}
      className={`w-full bg-transparent text-[13px] text-text placeholder:text-text-faint/60 leading-relaxed resize-none focus:outline-none focus:ring-0 p-1 rounded transition-colors ${className}`}
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
      className="flex items-center gap-0.5 text-[11px] font-mono text-text-muted shrink-0 ml-1"
      onClick={(e) => e.stopPropagation()}
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
        className="w-12 bg-surface-2 border border-border/70 focus:border-accent rounded px-1 py-0.5 text-center text-on-surface text-[11px] font-mono focus:outline-none"
        aria-label="Durasi detik"
      />
      <span>s</span>
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
    seekFrame
  } = useMooStore();

  const scenes = project.scenes || [];
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeSceneId && cardRefs.current[activeSceneId]) {
      cardRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSceneId]);

  const toggleDetail = (sceneId: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [sceneId]: !prev[sceneId]
    }));
  };

  return (
    <div className={`flex flex-col gap-3 p-3 sm:p-4 w-full ${className}`}>
      {/* 1. Generator Naskah AI */}
      <div className="p-3.5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-2.5">
        <textarea
          value={scriptPrompt}
          onChange={(e) => setScriptPrompt(e.target.value)}
          placeholder="Tulis topik atau naskah video..."
          rows={2}
          className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl p-3 text-[13px] text-text placeholder:text-text-faint resize-none focus:outline-none transition-all leading-relaxed"
        />

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div>
            {previousScenesSnapshot && previousScenesSnapshot.length > 0 && (
              <IconButton
                icon="undo"
                aria-label="Kembalikan naskah sebelumnya"
                size="sm"
                variant="secondary"
                onClick={() => undoGenerateScript()}
                className="!w-8 !h-8 !min-w-0 !min-h-0"
              />
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            icon="auto_awesome"
            isLoading={isGeneratingScript}
            disabled={!scriptPrompt.trim() || isGeneratingScript}
            onClick={() => generateScript()}
          >
            Buat Adegan
          </Button>
        </div>
      </div>

      {/* 2. Daftar Kartu Adegan (Scene Storyboard) */}
      <div className="flex flex-col gap-2.5">
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
          const isDetailOpen = Boolean(expandedDetails[scene.id] || scene.visualIntent || scene.visualConcept);

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
              className={`p-3 rounded-xl border transition-all duration-150 flex flex-col gap-2.5 cursor-pointer ${
                isActive
                  ? 'bg-surface-2/70 border-accent/60 shadow-sm ring-1 ring-accent/20'
                  : 'bg-surface-1 border-border/70 hover:border-border hover:bg-surface-1/90'
              }`}
            >
              {/* Header Kartu: Identitas, Durasi, dan Kontrol Manajemen */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40 gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-surface-3 text-accent font-mono text-[11px] font-bold shrink-0 select-none">
                    #{index + 1}
                  </span>

                  {/* Status & Edit Badges */}
                  {compStatus && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold shrink-0 border ${
                        compStatus === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : compStatus === 'error'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                      }`}
                    >
                      {compStatus}
                    </span>
                  )}
                  {isEdited && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono shrink-0 border border-amber-500/30"
                      title="Adegan telah disunting manual"
                    >
                      edit
                    </span>
                  )}

                  {/* Input Durasi Angka */}
                  <SceneDurationInput
                    duration={duration}
                    onCommit={(val) => setSceneDuration(scene.id, val)}
                  />
                </div>

                {/* Tombol Manajemen Adegan: Urutan, Duplikat, Hapus */}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => reorderScenes(index, index - 1)}
                    title="Geser adegan ke atas"
                    className="w-7 h-7 rounded-lg hover:bg-surface-3 disabled:opacity-25 disabled:pointer-events-none text-text-muted hover:text-on-surface flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    disabled={index === scenes.length - 1}
                    onClick={() => reorderScenes(index, index + 1)}
                    title="Geser adegan ke bawah"
                    className="w-7 h-7 rounded-lg hover:bg-surface-3 disabled:opacity-25 disabled:pointer-events-none text-text-muted hover:text-on-surface flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateScene(scene.id)}
                    title="Duplikat adegan"
                    className="w-7 h-7 rounded-lg hover:bg-surface-3 text-text-muted hover:text-on-surface flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  </button>
                  <button
                    type="button"
                    disabled={scenes.length <= 1}
                    onClick={() => removeScene(scene.id)}
                    title="Hapus adegan"
                    className="w-7 h-7 rounded-lg hover:bg-rose-500/15 disabled:opacity-25 disabled:pointer-events-none text-text-muted hover:text-rose-400 flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Isi Naskah Narasi (Voiceover) */}
              <div className="flex flex-col gap-1">
                <AutoExpandTextarea
                  value={narration}
                  onChange={(text) => updateSceneText(scene.id, text)}
                  onFocus={() => setActiveSceneId(scene.id)}
                  placeholder="Tulis naskah narasi adegan..."
                />
              </div>

              {/* Sorotan Kata Kunci (Word Focus Tokens) */}
              {words.length > 0 && (
                <div
                  className="flex flex-col gap-1 pt-1 border-t border-border/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] font-medium text-text-muted flex items-center gap-1 select-none">
                    <span className="material-symbols-outlined text-[13px] text-accent">star</span>
                    Sorotan Kata Kunci:
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

              {/* Detail Visual & Konsep Staging (Collapsible Accordion) */}
              <div className="flex flex-col gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => toggleDetail(scene.id)}
                  className="flex items-center justify-between py-1 px-1.5 rounded-lg bg-surface-2/40 hover:bg-surface-2 text-text-muted hover:text-on-surface text-[11px] font-medium transition-colors select-none"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-accent">visibility</span>
                    <span>Detail Visual & Staging</span>
                    {(scene.visualIntent || scene.visualConcept) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-text-faint">
                    {isDetailOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {isDetailOpen && (
                  <div className="flex flex-col gap-2 p-2 rounded-lg bg-surface-2/30 border border-border/40 mt-0.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Arah Visual (Visual Intent)
                      </label>
                      <input
                        type="text"
                        value={scene.visualIntent || ''}
                        onChange={(e) => updateSceneVisualIntent(scene.id, e.target.value)}
                        placeholder="Contoh: Pesawat masuk frame, aliran udara digambar..."
                        className="w-full bg-surface-2 border border-border/70 focus:border-accent rounded-md px-2.5 py-1 text-[12px] text-on-surface focus:outline-none"
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
                        className="w-full bg-surface-2 border border-border/70 focus:border-accent rounded-md px-2.5 py-1 text-[12px] text-on-surface focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Kartu: Akses Cepat Alat Desain & Slider Durasi */}
              <div className="flex flex-col gap-2 pt-1 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                {/* Bar Akses Cepat Alat Adegan */}
                <div className="grid grid-cols-3 gap-1">
                  {onEditScene && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSceneId(scene.id);
                        onEditScene(scene.id);
                      }}
                      className="py-1 px-1.5 rounded-lg bg-surface-2/60 hover:bg-surface-3 hover:text-accent border border-border/50 text-text-muted text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Sesuaikan Gaya & Layer adegan ini"
                    >
                      <span className="material-symbols-outlined text-[14px] text-accent">tune</span>
                      <span>Gaya</span>
                    </button>
                  )}
                  {onOpenAssets && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSceneId(scene.id);
                        onOpenAssets(scene.id);
                      }}
                      className="py-1 px-1.5 rounded-lg bg-surface-2/60 hover:bg-surface-3 hover:text-accent border border-border/50 text-text-muted text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Sisipkan Aset / Media ke adegan ini"
                    >
                      <span className="material-symbols-outlined text-[14px] text-accent">perm_media</span>
                      <span>Aset</span>
                    </button>
                  )}
                  {onOpenCodeInspector && (
                    <button
                      type="button"
                      onClick={() => onOpenCodeInspector(scene.id)}
                      className="py-1 px-1.5 rounded-lg bg-surface-2/60 hover:bg-surface-3 hover:text-accent border border-border/50 text-text-muted text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Buka Editor Kode Mograph"
                    >
                      <span className="material-symbols-outlined text-[14px] text-accent">code</span>
                      <span>Kode</span>
                    </button>
                  )}
                </div>

                {/* Slider Durasi Adegan */}
                <div className="flex items-center gap-2 px-0.5 text-text-faint text-[10px] font-mono">
                  <input
                    type="range"
                    min="0.5"
                    max="30"
                    step="0.5"
                    value={Math.min(30, duration)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        setSceneDuration(scene.id, val);
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
            </div>

            {/* Transisi Antar Adegan */}
            {index < scenes.length - 1 && (
              <div className="flex items-center justify-center my-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[10px] text-text-muted hover:border-accent/40 transition-colors">
                  <span className="material-symbols-outlined text-[13px] text-accent">swap_horiz</span>
                  <span className="font-medium">Transisi:</span>
                  <select
                    value={scene.transition || 'cut'}
                    onChange={(e) => setSceneTransition(scene.id, e.target.value as SceneTransition)}
                    className="bg-transparent text-on-surface font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="cut" className="bg-surface-1">Cut (Langsung)</option>
                    <option value="fade" className="bg-surface-1">Fade (Pudar)</option>
                    <option value="slide" className="bg-surface-1">Slide (Geser)</option>
                    <option value="zoom" className="bg-surface-1">Zoom (Perbesar)</option>
                    <option value="wipe" className="bg-surface-1">Wipe (Sapuan)</option>
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
