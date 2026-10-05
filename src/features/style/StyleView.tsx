import React, { useState, useRef } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { generateCustomScene } from '../../engine/ai/director/directorPipeline';
import { callRawLLM } from '../../engine/ai/llm';
import { resolveSkillIcon } from '../../engine/skills/skillManager';
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
    updateThemeFont,
    updateResolution,
    toggleGlobalSubtitles,
    updateThemeCaptionStyle,
    updateThemeCaptionPosition,
    skills,
    activeSkillId,
    setActiveSkillId,
    updateSettings,
    isCompilingMograph,
    setIsCompilingMograph,
    addToast
  } = useMooStore();
  const [compilationProgress, setCompilationProgress] = useState<string>('');
  const [generationStats, setGenerationStats] = useState<{
    completed: number;
    total: number;
    sceneStatuses: Record<number, 'pending' | 'generating' | 'ok' | 'error'>;
  } | null>(null);
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
      let failureCount = 0;
      let completedCount = 0;

      // Track live status of each scene for visual feedback
      const initialStatuses: Record<number, 'pending' | 'generating' | 'ok' | 'error'> = {};
      for (let i = 0; i < total; i++) {
        initialStatuses[i] = 'pending';
      }
      setGenerationStats({ completed: 0, total, sceneStatuses: initialStatuses });

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

      // Initialize composition in store so canvas structure is established immediately
      const initialCompScenes: SceneModule[] = beats.map((b) => ({
        id: b.id,
        beatId: b.id,
        duration: b.durationInSeconds || 3.5,
        html: '',
        css: '',
        buildJs: '',
        status: 'pending' as const,
        version: 1,
        userEdited: false
      }));

      let runningComp: Composition = {
        id: currentProject.composition?.id || `comp-${Date.now()}`,
        width: currentProject.width || 1080,
        height: currentProject.height || 1920,
        fps: currentProject.fps || 30,
        duration: beats.reduce((acc, b) => acc + (b.durationInSeconds || 3.5), 0),
        globalCss: `body { background: ${currentProject.theme.bg}; }`,
        scenes:
          currentProject.composition?.scenes && currentProject.composition.scenes.length === total
            ? [...currentProject.composition.scenes]
            : initialCompScenes,
        createdAt: currentProject.composition?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      const finalScenes: SceneModule[] = new Array(total);

      // Concurrency limit: 1 sequential worker to strictly stay within API rate limits (15 RPM free tier)
      const CONCURRENCY_LIMIT = 1;
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < total) {
          if (controller.signal.aborted) break;
          const i = nextIndex++;
          const beat = beats[i];

          // Update scene status to generating
          setGenerationStats((prev) =>
            prev
              ? {
                  ...prev,
                  sceneStatuses: { ...prev.sceneStatuses, [i]: 'generating' }
                }
              : null
          );
          setCompilationProgress(`Mendesain adegan ${i + 1} dari ${total}... (${completedCount}/${total} selesai)`);

          const projectNow = useMooStore.getState().project;

          // AI Activity Watchdog & Dynamic Ticker
          // Instead of an arbitrary hard cutoff, it monitors live responsiveness:
          // - As long as AI is connected, communicating, or generating, it NEVER aborts.
          // - Realtime elapsed timer provides live feedback in the UI.
          // - Only trips if connection is genuinely frozen with zero activity for 180 consecutive seconds.
          const sceneAbortController = new AbortController();
          const onParentAbort = () => {
            sceneAbortController.abort(controller.signal.reason);
          };
          controller.signal.addEventListener('abort', onParentAbort, { once: true });

          let lastActivityTime = Date.now();
          let currentActivityDetail = 'Menghubungkan ke AI...';
          const sceneStartTime = Date.now();

          const recordActivity = (detail: string) => {
            lastActivityTime = Date.now();
            currentActivityDetail = detail;
          };

          const ticker = setInterval(() => {
            if (sceneAbortController.signal.aborted || controller.signal.aborted) {
              clearInterval(ticker);
              return;
            }

            const elapsedSec = Math.floor((Date.now() - sceneStartTime) / 1000);
            const silenceSec = Math.floor((Date.now() - lastActivityTime) / 1000);

            // True freeze watchdog: 180s of total silence without any socket packet/activity
            if (silenceSec >= 180) {
              clearInterval(ticker);
              sceneAbortController.abort(
                new Error(
                  `Koneksi tidak merespons: server AI tidak mengirim data selama ${silenceSec} detik. Periksa koneksi internet atau ganti model.`
                )
              );
              return;
            }

            setCompilationProgress(
              `Mendesain adegan ${i + 1} dari ${total}... (${elapsedSec}s) • ${currentActivityDetail}`
            );
          }, 1000);

          try {
            const sceneModule = await generateCustomScene({
              beat: {
                id: beat.id,
                narration: beat.narrationText || beat.text || '',
                visualIntent: beat.visualIntent || beat.narrationText || `Adegan ${i + 1}`,
                visualConcept: beat.visualConcept,
                visualElements: beat.visualElements,
                motionIntent: beat.motionIntent,
                cameraIntent: beat.camera,
                durationHint: beat.durationInSeconds || 3.5
              },
              index: i,
              total,
              aspectRatio: projectNow.aspectRatio || '9:16',
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
              onProgress: (status) => {
                recordActivity(status);
              },
              executeLlm: async ({ systemPrompt, userPrompt }) => {
                return await callRawLLM({
                  provider,
                  apiKey,
                  model: modelToUse,
                  systemPrompt,
                  userPrompt,
                  signal: sceneAbortController.signal,
                  maxTokens: settings.maxOutputTokens || 2048,
                  onActivity: (status) => {
                    recordActivity(status);
                  }
                });
              }
            });

            finalScenes[i] = sceneModule;
            if (sceneModule.status !== 'ok') {
              failureCount++;
            }
          } catch (err: unknown) {
            failureCount++;
            console.error(`[MooScript] Error generating scene #${i + 1}:`, err);
            const errMsg = err instanceof Error ? err.message : String(err);
            finalScenes[i] = {
              id: beat.id,
              beatId: beat.id,
              duration: beat.durationInSeconds || 3.5,
              html: '',
              css: '',
              buildJs: '',
              status: 'error',
              errors: [errMsg],
              version: 1,
              userEdited: false
            };
          } finally {
            clearInterval(ticker);
            controller.signal.removeEventListener('abort', onParentAbort);
          }

          if (controller.signal.aborted) break;

          completedCount++;
          const finishedStatus = finalScenes[i]?.status === 'ok' ? 'ok' : 'error';
          setGenerationStats((prev) =>
            prev
              ? {
                  ...prev,
                  completed: completedCount,
                  sceneStatuses: { ...prev.sceneStatuses, [i]: finishedStatus }
                }
              : null
          );

          // PROGRESSIVE STORE UPDATE: immediately commit completed scene into the composition
          runningComp = {
            ...runningComp,
            scenes: runningComp.scenes.map((s, idx) => (idx === i && finalScenes[i] ? finalScenes[i] : s)),
            updatedAt: Date.now()
          };
          useMooStore.getState().setProject(
            {
              ...useMooStore.getState().project,
              renderMode: 'composition' as const,
              composition: runningComp
            },
            { keepStale: true }
          );

          // Pacing delay between scene requests to avoid burst rate limits (HTTP 429)
          await new Promise((r) => setTimeout(r, 1000));
        }
      };

      const workerCount = Math.min(CONCURRENCY_LIMIT, total);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

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

      // Final composition duration & assembly
      const totalCompDuration = finalScenes.reduce((acc, s) => acc + (s?.duration || 3), 0);
      const newComp: Composition = {
        ...runningComp,
        duration: totalCompDuration,
        scenes: finalScenes.filter(Boolean),
        updatedAt: Date.now()
      };

      useMooStore.getState().setProject(
        {
          ...latest,
          renderMode: 'composition' as const,
          composition: newComp
        },
        { keepStale: true }
      );

      if (failureCount > 0) {
        addToast(
          `${failureCount} dari ${total} adegan mengalami kendala rendering. Anda dapat mengedit atau men-generate ulang di Editor.`,
          'warning'
        );
      } else {
        addToast('Mograph custom AI berhasil dihasilkan!', 'success');
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
      setGenerationStats(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 max-w-2xl mx-auto w-full">
      {/* 1. Tone / Persona Preset Selection */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Arah Pacing & Persona Motion (Opsional)
          </span>
          <span className="text-[11px] text-text-muted">
            Murni mengarahkan ritme narasi — bukan template kaku
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Autonomous / Free Director option */}
          <button
            type="button"
            onClick={() => setActiveSkillId('')}
            className={`p-3 rounded-xl border text-left transition-all select-none flex flex-col gap-1.5 ${
              !activeSkillId
                ? 'bg-accent-muted border-accent text-on-surface shadow-sm ring-1 ring-accent/30'
                : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-accent">
                all_inclusive
              </span>
              <span className="text-[13px] font-semibold text-on-surface">Bebas / Murni</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
              AI merancang komposisi kinetik secara bebas sesuai konteks skrip.
            </p>
          </button>

          {skills.map((skill) => {
            const isSelected = skill.id === activeSkillId;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => setActiveSkillId(skill.id)}
                className={`p-3 rounded-xl border text-left transition-all select-none flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-accent-muted border-accent text-on-surface shadow-sm ring-1 ring-accent/30'
                    : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-accent">
                    {resolveSkillIcon(skill.icon)}
                  </span>
                  <span className="text-[13px] font-semibold text-on-surface">{skill.name}</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
                  {skill.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Decoupled Semantic Theming & Font */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-accent">palette</span>
            Theming Visual (Post-Generation)
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent font-medium font-mono">
            Decoupled Mode
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full bg-[#84cc16] ring-1 ring-white/20" title="Primary" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#a3e635] ring-1 ring-white/20" title="Accent" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#18181b] ring-1 ring-white/20" title="Surface" />
              <span className="w-3.5 h-3.5 rounded-full bg-[#0d0d0e] ring-1 ring-white/20" title="Background" />
            </div>
            <div className="text-[12px] text-zinc-300 leading-snug">
              Warna tidak lagi dikunci di awal. AI menghasilkan komposisi murni dengan <strong>Semantic Tokens</strong> yang bebas di-<em>shuffle</em> dan diedit di langkah <strong>3. Edit</strong>.
            </div>
          </div>
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
          <div className="p-3.5 rounded-xl bg-surface-3/80 border border-border flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-accent flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                {compilationProgress}
              </span>
              {generationStats && (
                <span className="text-[12px] font-mono text-text-muted">
                  {Math.round((generationStats.completed / generationStats.total) * 100)}%
                </span>
              )}
            </div>

            {generationStats && (
              <>
                <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(generationStats.completed / generationStats.total) * 100}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {project.scenes.map((b, idx) => {
                    const st = generationStats.sceneStatuses[idx] || 'pending';
                    return (
                      <span
                        key={b.id}
                        className={`text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border transition-colors ${
                          st === 'ok'
                            ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                            : st === 'generating'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                              : st === 'error'
                                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                : 'bg-surface-2 border-border text-text-muted'
                        }`}
                      >
                        {st === 'ok' ? '✓' : st === 'generating' ? '⟳' : st === 'error' ? '!' : '•'}
                        Adegan {idx + 1}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Token Output Budget Control */}
        <div className="p-3 rounded-xl bg-surface-3/70 border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-on-surface font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-accent">data_thresholding</span>
              Alokasi Token Output (Max Tokens)
            </span>
            <span className="font-mono text-accent font-bold text-[11px] bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
              {settings.maxOutputTokens || 2048} tokens
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={512}
              max={8192}
              step={256}
              disabled={isCompilingMograph}
              value={settings.maxOutputTokens || 2048}
              onChange={(e) => updateSettings({ maxOutputTokens: parseInt(e.target.value, 10) })}
              className="w-full accent-accent h-1.5 bg-surface-1 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <span className="text-[10px] text-text-muted">Preset Cepat:</span>
            <div className="flex gap-1.5">
              {[1024, 2048, 4096, 8192].map((tok) => {
                const isActive = (settings.maxOutputTokens || 2048) === tok;
                return (
                  <button
                    key={tok}
                    type="button"
                    disabled={isCompilingMograph}
                    onClick={() => updateSettings({ maxOutputTokens: tok })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border transition-colors disabled:opacity-40 ${
                      isActive
                        ? 'bg-accent/20 border-accent/50 text-accent font-bold'
                        : 'bg-surface-2 border-border text-text-muted hover:text-on-surface hover:bg-surface-1'
                    }`}
                  >
                    {tok}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-text-muted leading-tight">
            *Tip: Gunakan 1024–2048 untuk akun OpenRouter saldo rendah guna menghindari error 402, atau 4096+ untuk animasi kompleks.
          </p>
        </div>

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
            Lanjut ke Edit Visual
          </Button>
        )}
      </div>
    </div>
  );
};
