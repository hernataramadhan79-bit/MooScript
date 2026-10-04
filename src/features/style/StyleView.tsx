import React, { useState, useRef } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { generateSingleSceneModule } from '../../engine/ai/director/directorPipeline';
import { buildSceneModule } from '../../engine/composition/sceneTemplates';
import { callRawLLM } from '../../engine/ai/llm';
import type { Composition, SceneModule, CaptionStyle, CaptionPosition } from '../../types';

const mapFontDisplay = (fontFamily?: string): string => {
  switch (fontFamily) {
    case 'Mono':
      return 'JetBrains Mono';
    case 'Impact':
      return 'Syne';
    case 'Jakarta':
    default:
      return 'Plus Jakarta Sans';
  }
};

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
    updateResolution,
    toggleGlobalSubtitles,
    updateThemeCaptionStyle,
    updateThemeCaptionPosition,
    skills,
    activeSkillId,
    setActiveSkillId,
    addToast
  } = useMooStore();

  const [isCompilingMograph, setIsCompilingMograph] = useState(false);
  const [compilationProgress, setCompilationProgress] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fontOptions = [
    { value: 'Jakarta', label: 'Plus Jakarta', icon: 'font_download' },
    { value: 'Mono', label: 'JetBrains Mono', icon: 'terminal' },
    { value: 'Impact', label: 'Syne / Bold Display', icon: 'title' }
  ];

  const resolutionOptions: { value: '1080p' | '720p'; label: string; icon: string }[] = [
    { value: '1080p', label: '1080p (Full HD)', icon: 'hd' },
    { value: '720p', label: '720p (HD)', icon: 'sd' }
  ];

  const captionStyleOptions: { value: CaptionStyle; label: string }[] = [
    { value: 'boxed', label: 'Boxed Pill (Badge kontras)' },
    { value: 'karaoke', label: 'Karaoke (Highlight kata)' },
    { value: 'bold-pop', label: 'Bold Pop (Bounce dinamis)' },
    { value: 'minimal', label: 'Minimal Clean' }
  ];

  const captionPositionOptions: { value: CaptionPosition; label: string }[] = [
    { value: 'top', label: 'Atas (Top)' },
    { value: 'center', label: 'Tengah (Center)' },
    { value: 'bottom', label: 'Bawah (Bottom)' }
  ];

  const currentResolution =
    project.resolution ||
    (project.width === 1080 || project.height === 1080 ? '1080p' : '720p');

  const handleGenerateCustomMograph = async () => {
    const currentProject = useMooStore.getState().project;
    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';

    if (!apiKey) {
      addToast(`Silakan masukkan API Key untuk ${provider.toUpperCase()} di Pengaturan terlebih dahulu.`, 'warning');
      return;
    }

    // Check if any scene was manually edited by user
    const existingModules = currentProject.composition?.scenes || [];
    const hasUserEdited = existingModules.some((m) => m.userEdited === true);
    if (hasUserEdited) {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(
              'Beberapa adegan telah diedit secara manual. Menjalankan AI generator akan menimpa perubahan tersebut. Lanjutkan?'
            )
          : true;
      if (!confirmed) {
        return;
      }
    }

    const startedId = currentProject.id;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCompilingMograph(true);
    setCompilationProgress('Menyiapkan style brief dan instruksi motion director...');

    try {
      const beats = currentProject.scenes;
      const total = beats.length;
      const generatedScenes: SceneModule[] = [];
      let failureCount = 0;

      // Extract active skill system prompt as style advice (sliced to 2000 chars)
      const activeSkill = skills.find((s) => s.id === activeSkillId);
      const styleAdvice = activeSkill?.systemPrompt
        ? activeSkill.systemPrompt.slice(0, 2000)
        : undefined;

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

      for (let i = 0; i < total; i++) {
        if (controller.signal.aborted) {
          break;
        }

        const beat = beats[i];
        setCompilationProgress(`Mendesain dan mengoding adegan ${i + 1} dari ${total}...`);

        const projectNow = useMooStore.getState().project;
        const existingModule = projectNow.composition?.scenes?.find((m) => m.beatId === beat.id);
        const fallbackModule: SceneModule =
          existingModule ||
          buildSceneModule(beat, projectNow.theme, {
            width: projectNow.width || 1080,
            height: projectNow.height || 1920
          });

        // 60-second per-scene timeout linked with parent abort signal
        const sceneTimeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          sceneTimeoutController.abort(new Error('Batas waktu 60 detik per-adegan terlampaui'));
        }, 60000);

        const onParentAbort = () => {
          sceneTimeoutController.abort(controller.signal.reason);
        };
        if (controller.signal.aborted) {
          sceneTimeoutController.abort();
        } else {
          controller.signal.addEventListener('abort', onParentAbort, { once: true });
        }

        try {
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
                bg: projectNow.theme.bg || '#09090b',
                primary: projectNow.theme.textPrimary || '#f4f4f6',
                accent: projectNow.theme.textHighlight || '#84cc16',
                text: projectNow.theme.textPrimary || '#ffffff'
              },
              fontDisplay: mapFontDisplay(projectNow.theme.fontFamily),
              fontBody: 'Plus Jakarta Sans',
              backgroundLanguage: 'Subtle animated mesh gradient with floating particles',
              motionSignature: 'Smooth camera punch-in with kinetic typography bounce'
            },
            styleAdvice,
            provider,
            apiKey,
            model: modelToUse,
            executeLlm: async ({ systemPrompt, userPrompt }) => {
              return await callRawLLM({
                provider,
                apiKey,
                model: modelToUse,
                systemPrompt,
                userPrompt,
                signal: sceneTimeoutController.signal
              });
            }
          });

          if (controller.signal.aborted) {
            break;
          }

          if (sceneModule.status === 'ok') {
            generatedScenes.push({
              ...sceneModule,
              userEdited: false
            });
          } else {
            failureCount++;
            generatedScenes.push(fallbackModule);
          }
        } catch {
          if (controller.signal.aborted) {
            break;
          }
          failureCount++;
          generatedScenes.push(fallbackModule);
        } finally {
          clearTimeout(timeoutId);
          controller.signal.removeEventListener('abort', onParentAbort);
        }
      }

      if (controller.signal.aborted) {
        addToast('Pembuatan mograph dibatalkan.', 'info');
        return;
      }

      // Check if project changed while generating
      const latest = useMooStore.getState().project;
      if (latest.id !== startedId) {
        addToast('Project berganti, hasil visual dibuang.', 'warning');
        return;
      }

      // Update project composition
      const existingComp = latest.composition;
      const newComp: Composition = {
        id: existingComp?.id || `comp-${Date.now()}`,
        width: latest.width || 1080,
        height: latest.height || 1920,
        fps: latest.fps || 30,
        globalCss: `body { background: ${latest.theme.bg}; }`,
        scenes: generatedScenes,
        createdAt: existingComp?.createdAt || Date.now()
      };

      // Set to store without spreading old project
      useMooStore.getState().setProject(
        {
          ...latest,
          renderMode: 'composition' as const,
          composition: newComp
        },
        { keepStale: true }
      );

      if (failureCount > 0) {
        addToast(`${failureCount} dari ${total} adegan gagal, dipakai template bawaan`, 'warning');
      } else {
        addToast('Mograph custom HTML/GSAP berhasil dibuat dan dipasang!', 'success');
        if (onNextStep) onNextStep();
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        addToast('Pembuatan mograph dibatalkan.', 'info');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal mengenerate mograph: ${msg}`, 'error');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
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

      {/* 3. Resolusi & Pengaturan Teks Subtitel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-accent">subtitles</span>
          Resolusi & Pengaturan Subtitel
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Resolusi Video Kanvas" hint={`Ukuran kanvas saat ini: ${project.width}×${project.height}`}>
            <SegmentedControl<'1080p' | '720p'>
              options={resolutionOptions}
              value={currentResolution}
              onChange={(val) => updateResolution(val)}
            />
          </Field>

          <Field label="Tampilan Subtitel Global" hint="Aktifkan atau matikan teks overlay di seluruh adegan">
            <button
              type="button"
              onClick={toggleGlobalSubtitles}
              className={`w-full min-h-[44px] px-4 py-2 rounded-lg border flex items-center justify-between transition-all select-none ${
                project.theme.showSubtitles
                  ? 'bg-accent/15 border-accent text-accent font-semibold shadow-sm'
                  : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-on-surface'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">
                  {project.theme.showSubtitles ? 'subtitles' : 'subtitles_off'}
                </span>
                <span className="text-[13px]">
                  {project.theme.showSubtitles ? 'Subtitel Aktif' : 'Subtitel Nonaktif'}
                </span>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${project.theme.showSubtitles ? 'bg-accent' : 'bg-zinc-600'}`} />
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Field label="Gaya Visual Subtitel">
            <select
              value={project.theme.captionStyle || 'boxed'}
              onChange={(e) => updateThemeCaptionStyle(e.target.value as CaptionStyle)}
              className="w-full bg-surface-2 border border-border rounded-lg h-10 px-3 text-[13px] text-on-surface focus:outline-none focus:border-accent cursor-pointer"
            >
              {captionStyleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Posisi Vertikal Subtitel">
            <select
              value={project.theme.captionPosition || 'bottom'}
              onChange={(e) => updateThemeCaptionPosition(e.target.value as CaptionPosition)}
              className="w-full bg-surface-2 border border-border rounded-lg h-10 px-3 text-[13px] text-on-surface focus:outline-none focus:border-accent cursor-pointer"
            >
              {captionPositionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* 4. AI Motion Generator Action Box */}
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

        {isCompilingMograph ? (
          <div className="flex gap-2 mt-1">
            <Button
              variant="primary"
              icon="auto_awesome"
              isLoading={true}
              disabled={true}
              className="flex-1"
            >
              Mengoding Animasi Mograph...
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                abortControllerRef.current?.abort();
              }}
            >
              Batalkan
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            icon="auto_awesome"
            onClick={handleGenerateCustomMograph}
            className="w-full mt-1"
          >
            Generate Mograph Custom dengan AI
          </Button>
        )}
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
