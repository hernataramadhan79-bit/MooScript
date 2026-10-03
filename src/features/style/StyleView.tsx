import React, { useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { generateSingleSceneModule } from '../../engine/ai/director/directorPipeline';
import { callRawLLM } from '../../engine/ai/llm';
import type { Composition, SceneModule } from '../../types';

interface StyleViewProps {
  onBackStep?: () => void;
  onNextStep?: () => void;
}

export const StyleView: React.FC<StyleViewProps> = ({ onBackStep, onNextStep }) => {
  const {
    project,
    settings,
    updateThemeBg,
    updateThemePrimary,
    updateThemeHighlight,
    updateThemeFont,
    skills,
    activeSkillId,
    setActiveSkillId,
    addToast
  } = useMooStore();

  const [isCompilingMograph, setIsCompilingMograph] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState<string>('');

  const fontOptions = [
    { value: 'Jakarta', label: 'Plus Jakarta', icon: 'font_download' },
    { value: 'Mono', label: 'JetBrains Mono', icon: 'terminal' },
    { value: 'Impact', label: 'Syne / Bold Display', icon: 'title' }
  ];

  const handleGenerateCustomMograph = async () => {
    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';

    if (!apiKey) {
      addToast(`Silakan masukkan API Key untuk ${provider.toUpperCase()} di Pengaturan terlebih dahulu.`, 'warning');
      return;
    }

    setIsCompilingMograph(true);
    setCompilationProgress('Menyiapkan style brief dan instruksi motion director...');

    try {
      const beats = project.scenes;
      const total = beats.length;
      const generatedScenes: SceneModule[] = [];

      for (let i = 0; i < total; i++) {
        const beat = beats[i];
        setCompilationProgress(`Mendesain dan mengoding adegan ${i + 1} dari ${total}...`);

        const sceneModule = await generateSingleSceneModule({
          beat: {
            id: beat.id,
            narration: beat.narrationText || beat.text || '',
            visualIntent: beat.visualData?.title || beat.narrationText || `Adegan ${i + 1}`,
            durationHint: beat.durationInSeconds || 3.5
          },
          index: i,
          total,
          styleBrief: {
            adjectives: ['energetic', 'clean', 'cinematic'],
            palette: {
              bg: project.theme.bg || '#09090b',
              primary: project.theme.textPrimary || '#f4f4f6',
              accent: project.theme.textHighlight || '#84cc16',
              text: project.theme.textPrimary || '#ffffff'
            },
            fontDisplay: project.theme.fontFamily || 'Plus Jakarta Sans',
            fontBody: 'Plus Jakarta Sans',
            backgroundLanguage: 'Subtle animated mesh gradient with floating particles',
            motionSignature: 'Smooth camera punch-in with kinetic typography bounce'
          },
          provider,
          apiKey,
          model:
            provider === 'gemini'
              ? settings.geminiModel
              : provider === 'openai'
                ? settings.openaiModel
                : provider === 'groq'
                  ? settings.groqModel
                  : provider === 'anthropic'
                    ? settings.anthropicModel
                    : settings.openrouterModel,
          executeLlm: async ({ systemPrompt, userPrompt }) => {
            const modelToUse =
              provider === 'gemini'
                ? settings.geminiModel
                : provider === 'openai'
                  ? settings.openaiModel
                  : provider === 'groq'
                    ? settings.groqModel
                    : provider === 'anthropic'
                      ? settings.anthropicModel
                      : settings.openrouterModel;

            return await callRawLLM({
              provider,
              apiKey,
              model: modelToUse,
              systemPrompt,
              userPrompt
            });
          }
        });

        generatedScenes.push(sceneModule);
      }

      // Update project composition
      const newComp: Composition = {
        id: `comp-${Date.now()}`,
        width: project.width || 1080,
        height: project.height || 1920,
        fps: project.fps || 30,
        globalCss: `body { background: ${project.theme.bg}; }`,
        scenes: generatedScenes,
        createdAt: Date.now()
      };

      // Set to store
      const updatedProject = {
        ...project,
        renderMode: 'composition' as const,
        composition: newComp
      };

      useMooStore.getState().setProject(updatedProject, { keepStale: true });

      addToast('Mograph custom HTML/GSAP berhasil dibuat dan dipasang!', 'success');
      if (onNextStep) onNextStep();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal mengenerate mograph: ${msg}`, 'error');
    } finally {
      setIsCompilingMograph(false);
      setCompilationProgress('');
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 max-w-2xl mx-auto w-full">
      {/* 1. Tone / Persona Preset Selection */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">palette</span>
          Arah Gaya & Persona Motion
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {skills.map((skill) => {
            const isSelected = skill.id === activeSkillId;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => setActiveSkillId(skill.id)}
                className={`p-3 rounded-xl border text-left transition-all select-none flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-accent-muted border-accent text-on-surface shadow-sm'
                    : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-accent">
                    {skill.icon || 'auto_awesome'}
                  </span>
                  <span className="text-[14px] font-semibold text-on-surface">{skill.name}</span>
                </div>
                <p className="text-[12px] text-text-muted leading-relaxed line-clamp-2">
                  {skill.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Palet Warna & Tipografi */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-accent">format_paint</span>
          Warna & Tipografi Video
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Warna Background">
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg p-1.5 min-h-[44px]">
              <input
                type="color"
                value={project.theme.bg || '#09090b'}
                onChange={(e) => updateThemeBg(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <span className="text-[13px] font-mono text-on-surface">{project.theme.bg}</span>
            </div>
          </Field>

          <Field label="Warna Teks Utama">
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg p-1.5 min-h-[44px]">
              <input
                type="color"
                value={project.theme.textPrimary || '#f4f4f6'}
                onChange={(e) => updateThemePrimary(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <span className="text-[13px] font-mono text-on-surface">{project.theme.textPrimary}</span>
            </div>
          </Field>

          <Field label="Warna Aksen Highlight">
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg p-1.5 min-h-[44px]">
              <input
                type="color"
                value={project.theme.textHighlight || '#84cc16'}
                onChange={(e) => updateThemeHighlight(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <span className="text-[13px] font-mono text-on-surface">{project.theme.textHighlight}</span>
            </div>
          </Field>
        </div>

        <Field label="Karakter Font Display">
          <SegmentedControl
            options={fontOptions}
            value={project.theme.fontFamily || 'Jakarta'}
            onChange={(val) => updateThemeFont(val as any)}
          />
        </Field>
      </div>

      {/* 3. AI Motion Generator Action Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-surface-2 to-surface-1 border border-accent/30 flex flex-col gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-accent text-[22px]">movie_filter</span>
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface">Generate Mograph HTML/GSAP Custom</h3>
            <p className="text-[12px] text-text-muted mt-0.5">
              AI akan mengoding efek visual, pergerakan kamera, dan kinetik teks unik berbasis web untuk setiap adegan.
            </p>
          </div>
        </div>

        {compilationProgress && (
          <div className="p-3 rounded-lg bg-surface-3/80 border border-border text-[13px] text-accent flex items-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
            <span>{compilationProgress}</span>
          </div>
        )}

        <Button
          variant="primary"
          icon="auto_awesome"
          isLoading={isCompilingMograph}
          disabled={isCompilingMograph}
          onClick={handleGenerateCustomMograph}
          className="w-full mt-1"
        >
          {isCompilingMograph ? 'Mengoding Animasi Mograph...' : 'Generate Mograph Custom dengan AI'}
        </Button>
      </div>

      {/* Navigasi Langkah */}
      <div className="flex items-center justify-between pt-2">
        {onBackStep ? (
          <Button variant="secondary" icon="arrow_back" onClick={onBackStep}>
            Kembali ke Ide
          </Button>
        ) : <div />}
        {onNextStep && (
          <Button variant="primary" icon="arrow_forward" iconPosition="right" onClick={onNextStep}>
            Lanjut ke Suara & Audio
          </Button>
        )}
      </div>
    </div>
  );
};
