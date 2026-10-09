import React, { useState, useMemo, useRef } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { downloadSubtitleFile } from '../../engine/export/subtitleExporter';
import { generateCustomScene } from '../../engine/ai/director/directorPipeline';
import { callRawLLM } from '../../engine/ai/llm';
import { resolveSkillIcon } from '../../engine/skills/skillManager';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';
import { syncComposition } from '../../engine/composition/sync';
import type {
  ThemeTokens,
  CaptionPosition,
  CaptionStyle,
  BgmPreset,
  Composition,
  SceneModule
} from '../../types';

export type InspectorTab = 'mograph' | 'gaya' | 'suara' | 'ekspor';

export interface InspectorRackProps {
  className?: string;
  defaultTab?: InspectorTab;
  activeTab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
}

interface ThemePresetItem {
  id: string;
  name: string;
  previewColors: { bg: string; primary: string; accent: string };
  tokens: ThemeTokens;
}

const THEME_PRESETS: ThemePresetItem[] = [
  {
    id: 'dark-minimal',
    name: 'Dark Minimal',
    previewColors: { bg: '#09090b', primary: '#f4f4f5', accent: '#a1a1aa' },
    tokens: {
      id: 'dark-minimal',
      name: 'Dark Minimal',
      bg: '#09090b',
      surface: '#18181b',
      primary: '#f4f4f5',
      accent: '#ffffff',
      text: '#fafafa',
      muted: '#71717a'
    }
  },
  {
    id: 'lime-cyber',
    name: 'Lime Cyber',
    previewColors: { bg: '#0d0d0e', primary: '#84cc16', accent: '#a3e635' },
    tokens: {
      id: 'lime-cyber',
      name: 'Lime Cyber',
      bg: '#0d0d0e',
      surface: '#18181b',
      primary: '#84cc16',
      accent: '#a3e635',
      text: '#f4f4f5',
      muted: '#71717a'
    }
  },
  {
    id: 'mono-swiss',
    name: 'Mono Swiss',
    previewColors: { bg: '#000000', primary: '#ffffff', accent: '#e4e4e7' },
    tokens: {
      id: 'mono-swiss',
      name: 'Mono Swiss',
      bg: '#000000',
      surface: '#121212',
      primary: '#ffffff',
      accent: '#e4e4e7',
      text: '#ffffff',
      muted: '#a1a1aa'
    }
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    previewColors: { bg: '#1c1017', primary: '#f43f5e', accent: '#fb923c' },
    tokens: {
      id: 'warm-editorial',
      name: 'Warm Editorial',
      bg: '#1c1017',
      surface: '#2c1824',
      primary: '#f43f5e',
      accent: '#fb923c',
      text: '#fff1f2',
      muted: '#fda4af'
    }
  }
];

function safeFileName(title?: string): string {
  if (!title) return 'mooscript';
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return cleaned || 'mooscript';
}

function triggerFileDownload(url: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (typeof document !== 'undefined' && document.body && document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 100);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

export const InspectorRack: React.FC<InspectorRackProps> = ({
  className = '',
  defaultTab = 'mograph',
  activeTab: controlledTab,
  onTabChange
}) => {
  const [internalTab, setInternalTab] = useState<InspectorTab>(defaultTab);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = (tab: InspectorTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const {
    project,
    settings,
    skills,
    activeSkillId,
    setActiveSkillId,
    isCompilingMograph,
    setIsCompilingMograph,
    updateThemeFont,
    updateThemeCaptionPosition,
    updateThemeCaptionStyle,
    toggleGlobalSubtitles,
    setThemeTokens,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    audioProgress,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio,
    updateResolution,
    isExporting,
    exportProgress,
    exportResult,
    startExport,
    addToast
  } = useMooStore();

  // Mograph Compilation States
  const [compilationProgress, setCompilationProgress] = useState<string>('');
  const [generationStats, setGenerationStats] = useState<{
    completed: number;
    total: number;
    sceneStatuses: Record<number, 'pending' | 'generating' | 'ok' | 'error'>;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active theme detection
  const isThemeActive = (theme: ThemePresetItem) => {
    const currentId = project.themeTokens?.id;
    const currentName = project.themeTokens?.name?.toLowerCase();
    if (currentId === theme.id) return true;
    if (currentName === theme.name.toLowerCase()) return true;
    if (theme.id === 'lime-cyber' && currentId === 'brutalist-lime') return true;
    if (theme.id === 'warm-editorial' && currentId === 'sunset-editorial') return true;
    if (theme.id === 'dark-minimal' && currentId === 'minimal-monochrome') return true;
    return false;
  };

  // Font options mapping
  const currentFont = project.theme?.fontFamily || 'Jakarta';
  const fontOptions: { value: 'Jakarta' | 'Mono' | 'Impact'; label: string }[] = [
    { value: 'Jakarta', label: 'Plus Jakarta' },
    { value: 'Mono', label: 'JetBrains Mono' },
    { value: 'Impact', label: 'Syne Bold' }
  ];

  // Text position options
  const currentPosition = project.theme?.captionPosition || 'center';
  const positionOptions: { value: CaptionPosition; label: string }[] = [
    { value: 'top', label: 'Atas' },
    { value: 'center', label: 'Tengah' },
    { value: 'bottom', label: 'Bawah' }
  ];

  // Text style options
  const currentStyle = project.theme?.captionStyle || 'boxed';
  const styleOptions: { value: CaptionStyle; label: string }[] = [
    { value: 'boxed', label: 'Kotak' },
    { value: 'karaoke', label: 'Highlight Kata' },
    { value: 'bold-pop', label: 'Bold Pop' },
    { value: 'minimal', label: 'Bersih' }
  ];

  // Voice provider mapping
  const currentVoiceProvider = useMemo(() => {
    const p = settings.selectedTTSProvider;
    if (p === 'openai') return 'openai';
    if (p === 'elevenlabs') return 'elevenlabs';
    if (p === 'local') return 'local';
    return 'gemini';
  }, [settings.selectedTTSProvider]);

  const voiceProviders = [
    { id: 'gemini', label: 'Gemini Flash' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'elevenlabs', label: 'ElevenLabs' },
    { id: 'local', label: 'Offline Lokal' }
  ];

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'gemini') {
      updateSettings({ selectedTTSProvider: 'fallback' });
    } else if (val === 'openai') {
      updateSettings({ selectedTTSProvider: 'openai' });
    } else if (val === 'elevenlabs') {
      updateSettings({ selectedTTSProvider: 'elevenlabs' });
    } else if (val === 'local') {
      updateSettings({ selectedTTSProvider: 'local' });
    }
  };

  // BGM Presets
  const currentBgmPreset = project.bgm?.preset || 'none';
  const bgmPresets: { value: BgmPreset; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'ambient', label: 'Ambient' },
    { value: 'lofi', label: 'Lofi' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'hiphop', label: 'Hiphop' }
  ];

  const bgmLevel = project.bgm?.level ?? 0.18;
  const duckRatio = project.bgm?.duckRatio ?? 0.15;

  // Resolution
  const currentResolution: '1080p' | '720p' =
    project.resolution ||
    (project.width === 1080 || project.height === 1080 ? '1080p' : '720p');

  // MP4 Export trigger
  const handleExportMp4 = async () => {
    if (isExporting) return;
    if (exportResult?.objectUrl) {
      triggerFileDownload(exportResult.objectUrl, `${safeFileName(project.title)}.mp4`);
      addToast('Mengunduh video MP4...', 'success');
      return;
    }
    await startExport();
    const result = useMooStore.getState().exportResult;
    if (result?.objectUrl) {
      triggerFileDownload(result.objectUrl, `${safeFileName(project.title)}.mp4`);
      addToast('Video MP4 berhasil diunduh.', 'success');
    }
  };

  // Standalone HTML Mograph Export trigger
  const handleExportHtml = async () => {
    let projectToExport = project;
    if (!projectToExport.composition) {
      projectToExport = syncComposition(projectToExport);
    }

    let audioDataUrl: string | undefined;
    if (project.audioBlob) {
      try {
        audioDataUrl = await blobToDataUrl(project.audioBlob);
      } catch {
        // Continue without audio if read fails
      }
    }

    const htmlContent = buildCompositionDocument(projectToExport, {
      standalone: true,
      audioDataUrl
    });
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerFileDownload(url, `${safeFileName(project.title)}.html`);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    addToast('HTML Standalone Mograph berhasil diunduh!', 'success');
  };

  // AI Mograph Generation Workflow
  const handleGenerateCustomMograph = async () => {
    const currentProject = useMooStore.getState().project;
    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';

    if (!apiKey) {
      addToast(
        `Silakan masukkan API Key untuk ${provider.toUpperCase()} di Pengaturan terlebih dahulu.`,
        'warning'
      );
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
    setCompilationProgress('Menyiapkan brief style dan instruksi motion director...');

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

      // Extract active skill system prompt as style advice
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

      // Initialize composition in store
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
          setCompilationProgress(
            `Mendesain adegan ${i + 1} dari ${total}... (${completedCount}/${total} selesai)`
          );

          const projectNow = useMooStore.getState().project;
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

            // True freeze watchdog: 180s silence cutoff
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

          // PROGRESSIVE STORE UPDATE: commit completed scene into the composition
          runningComp = {
            ...runningComp,
            scenes: runningComp.scenes.map((s, idx) =>
              idx === i && finalScenes[i] ? finalScenes[i] : s
            ),
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

          // Pacing delay to avoid burst rate limits
          await new Promise((r) => setTimeout(r, 1000));
        }
      };

      await worker();

      if (controller.signal.aborted) {
        addToast('Pembuatan mograph dibatalkan.', 'info');
        return;
      }

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
          `${failureCount} dari ${total} adegan mengalami kendala rendering. Anda dapat mengedit atau generate ulang di adegan.`,
          'warning'
        );
      } else {
        addToast('Mograph custom AI berhasil dihasilkan!', 'success');
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
    <div
      className={`w-full flex flex-col bg-surface-1 border border-border rounded-2xl overflow-hidden select-none ${className}`}
    >
      {/* 1. Header Tab Studio Minimalis (4 Tab) */}
      <div className="p-2 border-b border-border bg-surface-1/90 backdrop-blur-sm">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('mograph')}
            className={`py-2 px-1 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 active:scale-95 ${
              activeTab === 'mograph'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">movie_filter</span>
            <span className="truncate">Mograph</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gaya')}
            className={`py-2 px-1 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 active:scale-95 ${
              activeTab === 'gaya'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">palette</span>
            <span className="truncate">Gaya</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suara')}
            className={`py-2 px-1 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 active:scale-95 ${
              activeTab === 'suara'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
            <span className="truncate">Suara</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ekspor')}
            className={`py-2 px-1 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 active:scale-95 ${
              activeTab === 'ekspor'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span className="truncate">Ekspor</span>
          </button>
        </div>
      </div>

      {/* 2. Isi Panel Tab */}
      <div className="p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {/* ================= TAB MOGRAPH (AI GENERATOR & PACING) ================= */}
        {activeTab === 'mograph' && (
          <div className="flex flex-col gap-5">
            {/* Action Box Utama: Generator Mograph AI */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">auto_awesome</span>
                  Generator Mograph AI
                </span>
                <span className="text-[11px] font-mono text-text-muted px-2 py-0.5 rounded-full bg-surface-1 border border-border">
                  {project.scenes?.length || 0} Adegan
                </span>
              </div>

              {/* Status & Progress Watchdog saat generate */}
              {isCompilingMograph ? (
                <div className="p-3 rounded-xl bg-surface-1 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-accent flex items-center gap-1.5 font-medium truncate">
                      <span className="material-symbols-outlined animate-spin text-[16px] shrink-0">
                        sync
                      </span>
                      <span className="truncate">{compilationProgress || 'Menyiapkan...'}</span>
                    </span>
                    {generationStats && (
                      <span className="text-[11px] font-mono text-text-muted shrink-0 ml-1">
                        {Math.round((generationStats.completed / generationStats.total) * 100)}%
                      </span>
                    )}
                  </div>

                  {generationStats && (
                    <>
                      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-300 rounded-full"
                          style={{
                            width: `${(generationStats.completed / generationStats.total) * 100}%`
                          }}
                        />
                      </div>

                      {/* Scene Badges */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {project.scenes.map((b, idx) => {
                          const st = generationStats.sceneStatuses[idx] || 'pending';
                          return (
                            <span
                              key={b.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 border ${
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
                              #{idx + 1}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => abortControllerRef.current?.abort()}
                    className="w-full mt-1 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-rose-400 text-[12px] font-medium transition-colors"
                  >
                    Batalkan Pembuatan
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateCustomMograph}
                  disabled={isCompilingMograph || (project.scenes?.length || 0) === 0}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">movie_filter</span>
                  <span>Generate Mograph AI</span>
                </button>
              )}
            </div>

            {/* Persona & Pacing Motion (Skills) */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Persona Motion & Ritme
              </span>

              <div className="grid grid-cols-1 gap-2">
                {/* Opsi Bebas / Murni */}
                <button
                  type="button"
                  onClick={() => setActiveSkillId('')}
                  className={`p-2.5 rounded-xl border text-left transition-all select-none flex items-center gap-2.5 ${
                    !activeSkillId
                      ? 'bg-surface-3 border-accent text-on-surface ring-1 ring-accent/30 shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] text-accent shrink-0">
                    all_inclusive
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-semibold text-on-surface">Bebas / Murni</span>
                    <span className="text-[11px] text-text-muted truncate">
                      AI merancang komposisi kinetik bebas sesuai skrip
                    </span>
                  </div>
                </button>

                {skills.map((skill) => {
                  const isSelected = skill.id === activeSkillId;
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => setActiveSkillId(skill.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all select-none flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-surface-3 border-accent text-on-surface ring-1 ring-accent/30 shadow-sm'
                          : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px] text-accent shrink-0">
                        {resolveSkillIcon(skill.icon)}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-semibold text-on-surface">{skill.name}</span>
                        <span className="text-[11px] text-text-muted truncate">
                          {skill.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtitel Global & Resolusi */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Subtitel & Format
              </span>

              {/* Toggle Subtitel Global */}
              <button
                type="button"
                onClick={toggleGlobalSubtitles}
                className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between transition-all select-none ${
                  project.theme.showSubtitles
                    ? 'bg-surface-3 border-accent text-on-surface ring-1 ring-accent/30'
                    : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">
                    {project.theme.showSubtitles ? 'subtitles' : 'subtitles_off'}
                  </span>
                  <span className="text-[12px] font-medium">
                    {project.theme.showSubtitles ? 'Subtitel Aktif' : 'Subtitel Nonaktif'}
                  </span>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    project.theme.showSubtitles ? 'bg-accent' : 'bg-zinc-600'
                  }`}
                />
              </button>

              {/* Gaya & Posisi Subtitel */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted uppercase font-semibold">
                    Gaya
                  </label>
                  <select
                    value={currentStyle}
                    onChange={(e) => updateThemeCaptionStyle(e.target.value as CaptionStyle)}
                    className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[12px] rounded-lg h-8 px-2 focus:outline-none cursor-pointer"
                  >
                    {styleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-surface-1">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted uppercase font-semibold">
                    Posisi
                  </label>
                  <select
                    value={currentPosition}
                    onChange={(e) => updateThemeCaptionPosition(e.target.value as CaptionPosition)}
                    className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[12px] rounded-lg h-8 px-2 focus:outline-none cursor-pointer"
                  >
                    {positionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-surface-1">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Alokasi Token Output (Max Tokens) */}
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-text-muted uppercase tracking-wider">
                  Alokasi Token AI
                </span>
                <span className="font-mono text-accent font-semibold">
                  {settings.maxOutputTokens || 2048} tok
                </span>
              </div>

              <input
                type="range"
                min={512}
                max={8192}
                step={256}
                disabled={isCompilingMograph}
                value={settings.maxOutputTokens || 2048}
                onChange={(e) => updateSettings({ maxOutputTokens: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
              />

              <div className="flex gap-1 pt-0.5">
                {[1024, 2048, 4096, 8192].map((tok) => {
                  const isActive = (settings.maxOutputTokens || 2048) === tok;
                  return (
                    <button
                      key={tok}
                      type="button"
                      disabled={isCompilingMograph}
                      onClick={() => updateSettings({ maxOutputTokens: tok })}
                      className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                        isActive
                          ? 'bg-surface-3 border-accent text-accent font-bold'
                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                      }`}
                    >
                      {tok}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB GAYA ================= */}
        {activeTab === 'gaya' && (
          <div className="flex flex-col gap-5">
            {/* Tema Visual */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Tema
              </span>
              <div className="grid grid-cols-2 gap-2">
                {THEME_PRESETS.map((t) => {
                  const isActive = isThemeActive(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeTokens(t.tokens)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                        isActive
                          ? 'bg-surface-3 border-accent text-on-surface ring-1 ring-accent/30 shadow-sm'
                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: t.previewColors.bg }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: t.previewColors.primary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: t.previewColors.accent }}
                        />
                      </div>
                      <span className="text-[12px] font-medium truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipografi */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Tipografi
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
                {fontOptions.map((f) => {
                  const isSelected = currentFont === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => updateThemeFont(f.value)}
                      className={`py-2 px-1 rounded-lg text-[12px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Posisi Teks */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Posisi Teks
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
                {positionOptions.map((p) => {
                  const isSelected = currentPosition === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateThemeCaptionPosition(p.value)}
                      className={`py-2 px-1 rounded-lg text-[12px] font-medium text-center transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gaya Teks */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Gaya Teks
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
                {styleOptions.map((s) => {
                  const isSelected = currentStyle === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => updateThemeCaptionStyle(s.value)}
                      className={`py-2 px-1 rounded-lg text-[11px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB SUARA ================= */}
        {activeTab === 'suara' && (
          <div className="flex flex-col gap-5">
            {/* Vokal / Voiceover */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Vokal
              </span>
              <div className="relative">
                <select
                  value={currentVoiceProvider}
                  onChange={handleProviderChange}
                  className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                >
                  {voiceProviders.map((vp) => (
                    <option key={vp.id} value={vp.id} className="bg-surface-1 text-on-surface">
                      {vp.label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  expand_more
                </span>
              </div>

              <button
                type="button"
                onClick={() => generateAudio()}
                disabled={isGeneratingAudio}
                className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
              >
                {isGeneratingAudio ? (
                  <>
                    <span className="material-symbols-outlined text-[17px] animate-spin">
                      progress_activity
                    </span>
                    <span>
                      {audioProgress?.currentScene
                        ? `Memproses (${audioProgress.currentScene}/${audioProgress.totalScenes})`
                        : 'Menghasilkan Suara...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">record_voice_over</span>
                    <span>Generate Suara</span>
                  </>
                )}
              </button>
            </div>

            {/* Musik Latar (BGM) */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Musik Latar
              </span>

              {/* Preset Musik */}
              <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
                {bgmPresets.map((bp) => {
                  const isSelected = currentBgmPreset === bp.value;
                  return (
                    <button
                      key={bp.value}
                      type="button"
                      onClick={() => updateBgmPreset(bp.value)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {bp.label}
                    </button>
                  );
                })}
              </div>

              {/* Slider Volume */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted font-medium">Volume</span>
                  <span className="font-mono text-on-surface font-semibold">
                    {Math.round(bgmLevel * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bgmLevel}
                  onChange={(e) => updateBgmLevel(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>

              {/* Slider Ducking */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted font-medium">Sensitivitas Ducking</span>
                  <span className="font-mono text-on-surface font-semibold">
                    {Math.round(duckRatio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={duckRatio}
                  onChange={(e) => updateBgmDuckRatio(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB EKSPOR ================= */}
        {activeTab === 'ekspor' && (
          <div className="flex flex-col gap-5">
            {/* Resolusi Video */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Resolusi
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateResolution('1080p')}
                  className={`py-2.5 px-3 rounded-xl border text-[12px] font-semibold text-center transition-all active:scale-95 ${
                    currentResolution === '1080p'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent/30 shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                  }`}
                >
                  1080p (Full HD)
                </button>
                <button
                  type="button"
                  onClick={() => updateResolution('720p')}
                  className={`py-2.5 px-3 rounded-xl border text-[12px] font-semibold text-center transition-all active:scale-95 ${
                    currentResolution === '720p'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent/30 shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                  }`}
                >
                  720p (HD)
                </button>
              </div>
            </div>

            {/* Tombol Utama Download Video MP4 */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleExportMp4}
                disabled={isExporting}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isExporting ? 'sync' : 'download'}
                </span>
                <span>{isExporting ? 'Mengekspor Video...' : 'Download Video MP4'}</span>
              </button>

              {/* Progress Bar Ekspor Elegan */}
              {isExporting && exportProgress && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-2 border border-border">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-muted truncate">
                      {exportProgress.statusText || 'Sedang memproses...'}
                    </span>
                    <span className="font-mono text-accent font-bold">
                      {exportProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-150 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, exportProgress.percent))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Unduh Bundle Mograph Web HTML */}
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Bundle Web Mograph
              </span>
              <button
                type="button"
                onClick={handleExportHtml}
                className="py-2.5 px-3 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px] text-accent">html</span>
                <span>Unduh HTML Standalone Web</span>
              </button>
            </div>

            {/* Tombol Subtitle */}
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Subtitle
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadSubtitleFile(project, 'srt');
                    addToast('Mengunduh subtitle (.srt)...', 'success');
                  }}
                  className="py-2.5 px-2.5 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[11px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">
                    subtitles
                  </span>
                  <span className="truncate">Unduh Subtitle (.srt)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadSubtitleFile(project, 'vtt');
                    addToast('Mengunduh subtitle (.vtt)...', 'success');
                  }}
                  className="py-2.5 px-2.5 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[11px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">
                    subtitles
                  </span>
                  <span className="truncate">Unduh Subtitle (.vtt)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
