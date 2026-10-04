import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { AspectRatio, LayoutType } from '../../types';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Field, Textarea } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { cleanWord } from '../../utils/textUtils';

interface IdeaViewProps {
  onNextStep?: () => void;
  onOpenCodeInspector?: (beatId: string) => void;
}

const LAYOUT_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: 'KINETIC_QUOTE', label: 'Kinetic Typography' },
  { value: 'METRIC_COUNTER', label: 'Rolling Metric Counter' },
  { value: 'TERMINAL_MOCKUP', label: 'Terminal / Code Mockup' },
  { value: 'VS_COMPARISON', label: 'VS Battle Comparison' },
  { value: 'LIST_STAGGER', label: 'Staggered Bullet List' }
];

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
    updateSceneLayout,
    updateSceneVisualData,
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
            const visualTitle = scene.visualData?.title || `Adegan #${idx + 1}`;
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

                {/* Layout Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 rounded-lg bg-surface-2/40 border border-border/60">
                  <span className="text-[12px] font-medium text-text-muted flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-accent">view_quilt</span>
                    Layout Visual:
                  </span>
                  <select
                    value={scene.layout || 'KINETIC_QUOTE'}
                    onChange={(e) => updateSceneLayout(scene.id, e.target.value as LayoutType)}
                    className="bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-[12px] font-semibold text-on-surface focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Narration Text Input */}
                <Field label="Naskah Narasi (Voiceover)">
                  <Textarea
                    rows={2}
                    value={rawText}
                    onChange={(e) => updateSceneText(scene.id, e.target.value)}
                    placeholder="Teks yang dibaca oleh narator / ditampilkan di layar..."
                  />
                </Field>

                {/* Word Focus Taps (for KINETIC_QUOTE) */}
                {scene.layout === 'KINETIC_QUOTE' && words.length > 0 && (
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

                {/* Visual Data Title Header */}
                <Field label="Judul / Headline Visual" hint="Header utama yang tampil di kartu visual adegan">
                  <input
                    type="text"
                    value={scene.visualData?.title || ''}
                    onChange={(e) => updateSceneVisualData(scene.id, { title: e.target.value })}
                    placeholder="Contoh: Zero-Server WebCodecs, Pertumbuhan YoY, dsb."
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[13px] text-on-surface focus:outline-none focus:border-accent"
                  />
                </Field>

                {/* Conditional Fields: METRIC_COUNTER */}
                {scene.layout === 'METRIC_COUNTER' && (
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-surface-2/60 border border-border/80">
                    <Field label="Nilai Metrik" hint="Misal: +400%, 99.9%, 60 FPS">
                      <input
                        type="text"
                        value={scene.visualData?.metricValue || ''}
                        onChange={(e) => updateSceneVisualData(scene.id, { metricValue: e.target.value })}
                        placeholder="+400%"
                        className="w-full bg-surface-1 border border-border rounded-lg px-2.5 py-1 text-[13px] text-accent font-mono font-bold focus:outline-none focus:border-accent"
                      />
                    </Field>
                    <Field label="Label Metrik" hint="Misal: Pertumbuhan YoY">
                      <input
                        type="text"
                        value={scene.visualData?.metricLabel || ''}
                        onChange={(e) => updateSceneVisualData(scene.id, { metricLabel: e.target.value })}
                        placeholder="Pertumbuhan YoY"
                        className="w-full bg-surface-1 border border-border rounded-lg px-2.5 py-1 text-[13px] text-on-surface focus:outline-none focus:border-accent"
                      />
                    </Field>
                  </div>
                )}

                {/* Conditional Fields: TERMINAL_MOCKUP */}
                {scene.layout === 'TERMINAL_MOCKUP' && (
                  <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface-2/60 border border-border/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-mono text-accent flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">terminal</span>
                        Snippet Kode Terminal
                      </span>
                      <select
                        value={scene.visualData?.codeLanguage || 'typescript'}
                        onChange={(e) => updateSceneVisualData(scene.id, { codeLanguage: e.target.value })}
                        className="bg-surface-1 border border-border rounded px-2 py-0.5 text-[11px] font-mono text-on-surface focus:outline-none focus:border-accent cursor-pointer"
                      >
                        <option value="bash">bash</option>
                        <option value="typescript">typescript</option>
                        <option value="javascript">javascript</option>
                        <option value="python">python</option>
                        <option value="rust">rust</option>
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      value={scene.visualData?.codeSnippet || ''}
                      onChange={(e) => updateSceneVisualData(scene.id, { codeSnippet: e.target.value })}
                      placeholder="$ npm install mooscript&#10;const encoder = new VideoEncoder(...);"
                      className="w-full bg-surface-1 border border-border rounded-lg p-2 font-mono text-[12px] text-text-muted focus:text-on-surface focus:outline-none focus:border-accent resize-none"
                    />
                  </div>
                )}

                {/* Conditional Fields: VS_COMPARISON */}
                {scene.layout === 'VS_COMPARISON' && (
                  <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface-2/60 border border-border/80">
                    <span className="text-[12px] font-mono text-accent flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">compare</span>
                      Komparasi Kiri (Problem) vs Kanan (Solution)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-red-950/20 border border-red-500/20">
                        <input
                          type="text"
                          value={scene.visualData?.leftTitle || ''}
                          onChange={(e) => updateSceneVisualData(scene.id, { leftTitle: e.target.value })}
                          placeholder="Judul Kiri (e.g. TRADISIONAL)"
                          className="w-full bg-surface-1 border border-border rounded px-2 py-1 text-[12px] font-bold text-red-400 focus:outline-none focus:border-red-400"
                        />
                        <input
                          type="text"
                          value={scene.visualData?.leftDesc || ''}
                          onChange={(e) => updateSceneVisualData(scene.id, { leftDesc: e.target.value })}
                          placeholder="Deskripsi Kiri (e.g. Lambat & boros)"
                          className="w-full bg-surface-1 border border-border rounded px-2 py-1 text-[12px] text-on-surface focus:outline-none focus:border-border-strong"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                        <input
                          type="text"
                          value={scene.visualData?.rightTitle || ''}
                          onChange={(e) => updateSceneVisualData(scene.id, { rightTitle: e.target.value })}
                          placeholder="Judul Kanan (e.g. MOOSCRIPT)"
                          className="w-full bg-surface-1 border border-border rounded px-2 py-1 text-[12px] font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                        <input
                          type="text"
                          value={scene.visualData?.rightDesc || ''}
                          onChange={(e) => updateSceneVisualData(scene.id, { rightDesc: e.target.value })}
                          placeholder="Deskripsi Kanan (e.g. Zero-server 60 FPS)"
                          className="w-full bg-surface-1 border border-border rounded px-2 py-1 text-[12px] text-on-surface focus:outline-none focus:border-border-strong"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional Fields: LIST_STAGGER */}
                {scene.layout === 'LIST_STAGGER' && (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-2/60 border border-border/80">
                    <span className="text-[12px] font-mono text-accent flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">format_list_bulleted</span>
                      Daftar Butir Poin (Satu baris per poin)
                    </span>
                    <textarea
                      rows={3}
                      value={(scene.visualData?.bulletItems || []).join('\n')}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n').filter((l) => l.trim().length > 0);
                        updateSceneVisualData(scene.id, { bulletItems: lines });
                      }}
                      placeholder="Poin 1: Ringan&#10;Poin 2: Cepat&#10;Poin 3: Tanpa Server"
                      className="w-full bg-surface-1 border border-border rounded-lg p-2 text-[12px] text-on-surface focus:outline-none focus:border-accent resize-none font-mono"
                    />
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
          <Button variant="primary" icon="arrow_forward" iconPosition="right" onClick={onNextStep}>
            Lanjut ke Pengaturan Gaya
          </Button>
        </div>
      )}
    </div>
  );
};
