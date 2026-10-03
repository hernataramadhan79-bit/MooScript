import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { AspectRatio } from '../../types';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Field, Textarea } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';

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
    addScene,
    removeScene,
    updateSceneText,
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

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            icon="auto_awesome"
            isLoading={isGeneratingScript}
            disabled={!scriptPrompt.trim() || isGeneratingScript}
            onClick={generateScript}
          >
            {isGeneratingScript ? 'Menyusun Storyboard...' : 'Kembangkan Ide dengan AI'}
          </Button>
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
                    <span className="text-[13px] font-medium text-on-surface truncate">
                      {visualTitle}
                    </span>
                    <span className="text-[12px] font-mono text-text-faint ml-1">
                      {scene.durationInSeconds.toFixed(1)}s
                    </span>
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

                {/* Narration Text Input */}
                <Field label="Naskah Narasi (Voiceover)">
                  <Textarea
                    rows={2}
                    value={rawText}
                    onChange={(e) => updateSceneText(scene.id, e.target.value)}
                    placeholder="Teks yang dibaca oleh narator / ditampilkan di layar..."
                  />
                </Field>
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
