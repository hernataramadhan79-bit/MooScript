import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
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

export interface SceneDeckProps {
  className?: string;
  onOpenCodeInspector?: (beatId: string) => void;
  onNavigateToMograph?: () => void;
}

export const SceneDeck: React.FC<SceneDeckProps> = ({
  className = '',
  onOpenCodeInspector,
  onNavigateToMograph
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
    reorderScenes,
    scriptPrompt,
    setScriptPrompt,
    generateScript,
    isGeneratingScript,
    undoGenerateScript,
    previousScenesSnapshot,
    activeSceneId,
    setActiveSceneId
  } = useMooStore();

  const scenes = project.scenes || [];
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

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
        {scenes.map((scene, index) => {
          const isActive = activeSceneId === scene.id;
          const narration = scene.narrationText ?? scene.text ?? '';
          const duration = Math.min(30, Math.max(0.5, scene.durationInSeconds || 3));
          const visualTitle = scene.visualIntent
            ? scene.visualIntent.length > 24
              ? scene.visualIntent.slice(0, 24) + '...'
              : scene.visualIntent
            : `Adegan #${index + 1}`;

          const words = narration.trim().split(/\s+/).filter(Boolean);
          const focusSet = new Set((scene.focusWords || []).map(cleanWord));
          const isDetailOpen = Boolean(expandedDetails[scene.id] || scene.visualIntent || scene.visualConcept);

          return (
            <div
              key={scene.id}
              onClick={() => setActiveSceneId(scene.id)}
              className={`p-3 rounded-xl border transition-all duration-150 flex flex-col gap-2.5 cursor-pointer ${
                isActive
                  ? 'bg-surface-2/70 border-accent/60 shadow-sm ring-1 ring-accent/20'
                  : 'bg-surface-1 border-border/70 hover:border-border hover:bg-surface-1/90'
              }`}
            >
              {/* Header Kartu: Identitas, Durasi, dan Tombol Aksi */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-surface-3 text-accent font-mono text-[11px] font-semibold shrink-0 select-none">
                    #{index + 1}
                  </span>
                  <span className="text-[12px] font-medium text-on-surface truncate max-w-[120px] sm:max-w-[150px]">
                    {visualTitle}
                  </span>

                  {/* Input Durasi Angka */}
                  <div
                    className="flex items-center gap-0.5 text-[11px] font-mono text-text-muted shrink-0 ml-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="number"
                      min="0.5"
                      max="30"
                      step="0.5"
                      value={duration}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          setSceneDuration(scene.id, val);
                        }
                      }}
                      className="w-11 bg-surface-2 border border-border/70 focus:border-accent rounded px-1 py-0.5 text-center text-on-surface text-[11px] font-mono focus:outline-none"
                      aria-label="Durasi detik"
                    />
                    <span>s</span>
                  </div>
                </div>

                {/* Tombol Aksi: Code Inspector, Urutan, Duplikat, Hapus */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {onOpenCodeInspector && (
                    <IconButton
                      icon="code"
                      aria-label="Inspeksi Kode Mograph"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCodeInspector(scene.id);
                      }}
                      className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[15px]"
                    />
                  )}
                  <IconButton
                    icon="arrow_upward"
                    aria-label="Geser ke atas"
                    size="sm"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderScenes(index, index - 1);
                    }}
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[15px]"
                  />
                  <IconButton
                    icon="arrow_downward"
                    aria-label="Geser ke bawah"
                    size="sm"
                    disabled={index === scenes.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderScenes(index, index + 1);
                    }}
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[15px]"
                  />
                  <IconButton
                    icon="content_copy"
                    aria-label="Duplikat adegan"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateScene(scene.id);
                    }}
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[15px]"
                  />
                  <IconButton
                    icon="delete"
                    aria-label="Hapus adegan"
                    size="sm"
                    variant="danger"
                    disabled={scenes.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScene(scene.id);
                    }}
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[15px]"
                  />
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

              {/* Slider Durasi Adegan */}
              <div
                className="flex items-center gap-2 pt-0.5 px-0.5 text-text-faint text-[11px] font-mono"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="range"
                  min="0.5"
                  max="15"
                  step="0.5"
                  value={Math.min(15, duration)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setSceneDuration(scene.id, val);
                    }
                  }}
                  className="flex-1 h-1 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                  aria-label={`Durasi adegan #${index + 1}`}
                />
                <span className="w-9 text-right font-medium text-text-muted select-none">
                  {duration.toFixed(1)}s
                </span>
              </div>
            </div>
          );
        })}

        {/* Tombol Tambah Adegan */}
        <button
          type="button"
          onClick={addScene}
          className="w-full py-2.5 px-3 rounded-xl border border-dashed border-border/80 hover:border-border-strong bg-surface-1/40 hover:bg-surface-2 text-text-muted hover:text-on-surface text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] select-none"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>+ Tambah Adegan</span>
        </button>

        {/* Tombol Navigasi Cepat ke Mograph AI */}
        {onNavigateToMograph && (
          <button
            type="button"
            onClick={onNavigateToMograph}
            className="w-full mt-1 py-2 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-on-surface text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] select-none"
          >
            <span className="material-symbols-outlined text-[16px] text-accent">movie_filter</span>
            <span>Konfigurasi & Generate Mograph AI →</span>
          </button>
        )}
      </div>
    </div>
  );
};
