import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { AspectRatio } from '../../types';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Field, Textarea } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { cleanWord } from '../../utils/textUtils';

interface IdeaViewProps {
  onNextStep?: () => void;
  onOpenCodeInspector?: (beatId: string) => void;
}

export const IdeaView: React.FC<IdeaViewProps> = ({ onNextStep, onOpenCodeInspector }) => {
  const {
    project,
    updateProjectAspectRatio,
    scriptPrompt,
    setScriptPrompt,
    isGeneratingScript,
    generateScript,
    cancelGenerateScript,
    undoGenerateScript,
    previousScenesSnapshot,
    addScene,
    removeScene,
    duplicateScene,
    updateSceneText,
    updateSceneVisualIntent,
    updateSceneVisualConcept,
    setSceneDuration,
    toggleWordFocus,
    reorderScenes
  } = useMooStore();

  const aspectRatioOptions: { value: AspectRatio; label: string; icon: string }[] = [
    { value: '9:16', label: '9:16', icon: 'stay_current_portrait' },
    { value: '16:9', label: '16:9', icon: 'stay_current_landscape' },
    { value: '1:1', label: '1:1', icon: 'crop_square' }
  ];

  const quickConcepts = [
    'Penjelasan zero-server WebCodecs di browser',
    'Mengapa AI Agents butuh structured outputs',
    'Tips produktivitas developer 2026',
    'Komparasi performa Rust vs C++'
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 max-w-2xl mx-auto w-full">
      {/* 1. Brief & Rasio Video */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            Konsep & Ide Video
          </span>
          <SegmentedControl<AspectRatio>
            options={aspectRatioOptions}
            value={project.aspectRatio || '9:16'}
            onChange={(val) => {
              if (updateProjectAspectRatio) {
                updateProjectAspectRatio(val);
              }
            }}
            size="sm"
          />
        </div>

        <Field label="Ide atau Topik Cerita" hint="Deskripsikan ide bebas atau naskah Anda">
          <Textarea
            rows={3}
            placeholder="Contoh: Video promosi singkat tentang aplikasi pencatat keuangan pintar dengan animasi rolling counter dan grafik visual..."
            value={scriptPrompt}
            onChange={(e) => setScriptPrompt(e.target.value)}
          />
        </Field>

        {/* Quick Idea Chips */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[12px] text-text-faint mr-1">Inspirasi:</span>
          {quickConcepts.map((concept) => (
            <button
              key={concept}
              type="button"
              onClick={() => setScriptPrompt(concept)}
              className="text-[12px] px-2.5 py-1 rounded-full bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-on-surface border border-border transition-colors select-none"
            >
              + {concept}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          {isGeneratingScript ? (
            <div className="flex gap-2">
              <Button
                variant="primary"
                icon="auto_awesome"
                isLoading={true}
                disabled={true}
              >
                Menyusun Storyboard...
              </Button>
              <Button
                variant="secondary"
                onClick={cancelGenerateScript}
              >
                Batalkan
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {previousScenesSnapshot && (
                <Button
                  variant="secondary"
                  icon="undo"
                  onClick={() => undoGenerateScript()}
                >
                  Undo
                </Button>
              )}
              <Button
                variant="primary"
                icon="auto_awesome"
                disabled={!scriptPrompt.trim()}
                onClick={generateScript}
              >
                Kembangkan Ide dengan AI
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Daftar Beat / Adegan Storyboard */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-on-surface">
              Storyboard Beats ({project.scenes.length})
            </span>
            <span className="text-[12px] text-text-muted">
              Total durasi: ~{(project.audioDuration || project.scenes.length * 3).toFixed(1)}s
            </span>
          </div>
          <Button variant="secondary" size="sm" icon="add" onClick={addScene}>
            Tambah Adegan
          </Button>
        </div>

        {/* List of Scenes / Beats */}
        <div className="flex flex-col gap-3">
          {project.scenes.map((scene, idx) => {
            const rawText = scene.narrationText || scene.text || '';
            const visualTitle = scene.visualIntent ? (scene.visualIntent.length > 36 ? scene.visualIntent.slice(0, 36) + '...' : scene.visualIntent) : `Adegan #${idx + 1}`;
            const words = rawText.trim().split(/\s+/).filter(Boolean);
            const focusSet = new Set((scene.focusWords || []).map(cleanWord));

            return (
              <div
                key={scene.id}
                className="p-4 rounded-xl bg-surface-1 border border-border flex flex-col gap-3 transition-colors hover:border-border-strong group"
              >
                {/* Scene Header */}
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-surface-3 text-accent text-[12px] font-semibold flex items-center justify-center font-mono">
                      #{idx + 1}
                    </span>
                    <span className="text-[13px] font-medium text-on-surface truncate max-w-[140px] sm:max-w-[200px]">
                      {visualTitle}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-text-muted ml-1">
                      <span>Durasi:</span>
                      <input
                        type="number"
                        min="0.5"
                        max="30"
                        step="0.5"
                        value={scene.durationInSeconds}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0 && setSceneDuration) {
                            setSceneDuration(scene.id, val);
                          }
                        }}
                        className="w-12 bg-surface-2 border border-border rounded px-1 py-0.5 text-center text-on-surface text-[11px] font-mono focus:outline-none focus:border-accent"
                      />
                      <span>s</span>
                    </div>
                  </div>

                  {/* Scene Actions */}
                  <div className="flex items-center gap-1">
                    {onOpenCodeInspector && (
                      <IconButton
                        icon="code"
                        aria-label="Lihat / Edit Kode Mograph"
                        size="sm"
                        onClick={() => onOpenCodeInspector(scene.id)}
                      />
                    )}
                    <IconButton
                      icon="content_copy"
                      aria-label="Duplikasi adegan"
                      size="sm"
                      onClick={() => duplicateScene(scene.id)}
                    />
                    <IconButton
                      icon="arrow_upward"
                      aria-label="Geser ke atas"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => reorderScenes(idx, idx - 1)}
                    />
                    <IconButton
                      icon="arrow_downward"
                      aria-label="Geser ke bawah"
                      size="sm"
                      disabled={idx === project.scenes.length - 1}
                      onClick={() => reorderScenes(idx, idx + 1)}
                    />
                    {project.scenes.length > 1 && (
                      <IconButton
                        icon="delete"
                        aria-label="Hapus adegan"
                        size="sm"
                        variant="danger"
                        onClick={() => removeScene(scene.id)}
                      />
                    )}
                  </div>
                </div>

                {/* Visual Intent Input */}
                <Field label="Arah Visual (Visual Intent)" hint="Apa yang secara visual digambar, dimunculkan, atau dijelaskan pada scene ini">
                  <input
                    type="text"
                    value={scene.visualIntent || ''}
                    onChange={(e) => updateSceneVisualIntent(scene.id, e.target.value)}
                    placeholder="Contoh: Pesawat masuk dari bawah frame, airflow digambar mengalir di atas sayap..."
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[13px] text-on-surface focus:outline-none focus:border-accent"
                  />
                </Field>

                {/* Visual Concept Input */}
                <Field label="Konsep / Metafora Visual (Opsional)" hint="Pendekatan staging, grafik, diagram, atau metafora visual">
                  <input
                    type="text"
                    value={scene.visualConcept || ''}
                    onChange={(e) => updateSceneVisualConcept(scene.id, e.target.value)}
                    placeholder="Contoh: Garis airflow fluida melengkung, vector panah gaya angkat..."
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[13px] text-on-surface focus:outline-none focus:border-accent"
                  />
                </Field>

                {/* Narration Text Input */}
                <Field label="Naskah Narasi (Voiceover)">
                  <Textarea
                    rows={2}
                    value={rawText}
                    onChange={(e) => updateSceneText(scene.id, e.target.value)}
                    placeholder="Teks yang dibaca oleh narator / ditampilkan di layar..."
                  />
                </Field>

                {/* Word Focus Taps */}
                {words.length > 0 && (
                  <div className="flex flex-col gap-1 pt-0.5">
                    <span className="text-[11px] font-medium text-text-muted flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-accent">star</span>
                      Sorotan Kata Kunci (Klik untuk highlight badge ★):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {words.map((w, wIdx) => {
                        const clean = cleanWord(w);
                        const isFocus = focusSet.has(clean);
                        return (
                          <button
                            key={`${w}-${wIdx}`}
                            type="button"
                            onClick={() => toggleWordFocus(scene.id, w)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 select-none active:scale-95 ${
                              isFocus
                                ? 'bg-accent text-on-accent font-bold shadow-sm'
                                : 'bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-on-surface border border-border'
                            }`}
                          >
                            {isFocus && <span className="text-[10px]">★</span>}
                            <span>{w}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigasi Langkah Selanjutnya */}
      {onNextStep && (
        <div className="flex justify-end pt-2">
          <Button variant="primary" icon="auto_awesome" iconPosition="right" onClick={onNextStep}>
            Lanjut ke Generate Mograph
          </Button>
        </div>
      )}
    </div>
  );
};
