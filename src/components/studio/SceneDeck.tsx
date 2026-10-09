import React, { useEffect, useRef } from 'react';
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

export interface SceneDeckProps {
  className?: string;
}

export const SceneDeck: React.FC<SceneDeckProps> = ({ className = '' }) => {
  const {
    project,
    addScene,
    removeScene,
    duplicateScene,
    updateSceneText,
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

  return (
    <div className={`flex flex-col gap-3 p-3 sm:p-4 w-full ${className}`}>
      {/* Bagian Atas: Input Ide / Naskah & Generator AI */}
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

      {/* Daftar Kartu Adegan (Scene List) */}
      <div className="flex flex-col gap-2.5">
        {scenes.map((scene, index) => {
          const isActive = activeSceneId === scene.id;
          const narration = scene.narrationText ?? scene.text ?? '';
          const duration = Math.min(15, Math.max(1, scene.durationInSeconds || 3));

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
              {/* Header Kartu */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-surface-3 text-accent font-mono text-[11px] font-semibold select-none">
                    #{index + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border/60 text-[11px] font-mono text-text-muted select-none">
                    {duration.toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <IconButton
                    icon="arrow_upward"
                    aria-label="Geser ke atas"
                    size="sm"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderScenes(index, index - 1);
                    }}
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[16px]"
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
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[16px]"
                  />
                  <IconButton
                    icon="content_copy"
                    aria-label="Duplikat adegan"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateScene(scene.id);
                    }}
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[16px]"
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
                    className="!w-7 !h-7 !min-w-0 !min-h-0 !text-[16px]"
                  />
                </div>
              </div>

              {/* Isi Kartu: Textarea Naskah Narasi Auto-Expand */}
              <AutoExpandTextarea
                value={narration}
                onChange={(text) => updateSceneText(scene.id, text)}
                onFocus={() => setActiveSceneId(scene.id)}
                placeholder="Tulis naskah adegan..."
              />

              {/* Slider Durasi Adegan Minimalis (1s - 15s) */}
              <div
                className="flex items-center gap-2 pt-1 px-1 text-text-faint text-[11px] font-mono"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={duration}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
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
      </div>
    </div>
  );
};
