import type { StateCreator } from 'zustand';
import type { Composition, EngineSettings, MooProject, SceneModule } from '../../types';
import type { MooStoreState, MographSlice, MographSceneStatus } from '../types';
import {
  generateCustomScene,
  repairGeneratedScene,
  sceneToStoryBeat,
  buildSceneGenerationContext
} from '../../engine/ai/director/directorPipeline';
import { callRawLLM } from '../../engine/ai/llm';
import { extractLayersFromHtml } from '../../engine/composition/layers';
import { sceneHasRenderableCode } from '../../engine/composition/legacyScenes';
import { syncComposition } from '../../engine/composition/sync';

/** Scene code (SVG + CSS + timeline) runs long; a 2048-token cap truncates it mid-block. */
const SCENE_CODEGEN_MIN_TOKENS = 4096;
/** A provider that sends nothing for this long is treated as hung. */
const SILENCE_CUTOFF_SEC = 180;
const CONCURRENCY = 2;

export const mapFontDisplay = (fontFamily?: string): string => {
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

function modelFor(settings: EngineSettings): string | undefined {
  switch (settings.selectedLLMProvider) {
    case 'gemini':
      return settings.geminiModel;
    case 'openai':
      return settings.openaiModel;
    case 'groq':
      return settings.groqModel;
    case 'anthropic':
      return settings.anthropicModel;
    default:
      return settings.openrouterModel;
  }
}

// Kept outside the store: they are not state the UI renders, and they must survive the
// components that started a job being unmounted (tab switches, layout changes).
let bulkController: AbortController | null = null;
let sceneController: AbortController | null = null;

const matchesScene = (mod: SceneModule, sceneId: string) => mod.beatId === sceneId || mod.id === sceneId;

type WriteOutcome = 'written' | 'project-changed' | 'scene-removed';

/** The scene's current module in the latest composition, if any. */
function currentModule(get: () => MooStoreState, sceneId: string): SceneModule | undefined {
  return get().project.composition?.scenes.find((m) => matchesScene(m, sceneId));
}

/** Writes one finished scene module into the latest composition of the project it was made for. */
function writeSceneModule(
  get: () => MooStoreState,
  projectId: string,
  sceneId: string,
  module: SceneModule,
  fallbackComp?: Composition,
  history: 'push' | 'skip' = 'push'
): WriteOutcome {
  const latest = get().project;
  if (latest.id !== projectId) return 'project-changed';
  // A scene deleted while its visual was made must not come back as an extra shot.
  if (!latest.scenes.some((s) => s.id === sceneId)) return 'scene-removed';
  const comp = latest.composition || fallbackComp;
  if (!comp) return 'project-changed';
  const exists = comp.scenes.some((m) => matchesScene(m, sceneId));
  const nextScenes = exists ? comp.scenes.map((m) => (matchesScene(m, sceneId) ? module : m)) : [...comp.scenes, module];
  get().setProject(
    {
      ...latest,
      renderMode: 'composition',
      composition: { ...comp, scenes: nextScenes, updatedAt: Date.now() }
    },
    history === 'push' ? { keepStale: true, preserveHistory: true } : { keepStale: true, skipHistory: true }
  );
  return 'written';
}

function llmExecutor(settings: EngineSettings, signal: AbortSignal, onActivity: (status: string) => void) {
  const provider = settings.selectedLLMProvider;
  const apiKey = settings.apiKeys[provider] || '';
  const model = modelFor(settings);
  return async ({ systemPrompt, userPrompt }: { systemPrompt: string; userPrompt: string }) =>
    callRawLLM({
      provider,
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      signal,
      maxTokens: Math.max(settings.maxOutputTokens || 2048, SCENE_CODEGEN_MIN_TOKENS),
      onActivity
    });
}

export const createMographSlice: StateCreator<MooStoreState, [], [], MographSlice> = (set, get) => {
  const requireApiKey = (): boolean => {
    const { settings, addToast } = get();
    const provider = settings.selectedLLMProvider;
    if ((settings.apiKeys[provider] || '').trim()) return true;
    addToast(`Masukkan API Key untuk ${provider.toUpperCase()} di Pengaturan terlebih dahulu.`, 'warning');
    return false;
  };

  return {
    mographProgress: '',
    mographStats: null,
    revisingSceneId: null,
    revisionProgress: '',

    generateAllScenesAi: async () => {
      if (get().isCompilingMograph || !requireApiKey()) return;
      const startProject = get().project;
      const beats = startProject.scenes;
      const total = beats.length;
      if (total === 0) return;

      const settings = get().settings;
      const controller = new AbortController();
      bulkController = controller;

      const statuses: Record<string, MographSceneStatus> = {};
      beats.forEach((b) => (statuses[b.id] = 'pending'));
      const setStatus = (sceneId: string, status: MographSceneStatus, completed?: number) =>
        set((s) =>
          s.mographStats
            ? {
                mographStats: {
                  ...s.mographStats,
                  completed: completed ?? s.mographStats.completed,
                  sceneStatuses: { ...s.mographStats.sceneStatuses, [sceneId]: status }
                }
              }
            : {}
        );

      get().setIsCompilingMograph(true);
      set({
        mographProgress: 'Menyiapkan brief style dan instruksi motion director...',
        mographStats: { completed: 0, total, sceneStatuses: statuses }
      });

      const fallbackComp = syncComposition(startProject).composition;

      let failureCount = 0;
      let completedCount = 0;
      /** Failed shots that kept the visual they had before this run. */
      const keptShots: number[] = [];
      // The whole run is one undo step: only the first scene to land records it.
      let historyRecorded = false;
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < total && !controller.signal.aborted) {
          const i = nextIndex++;
          const beat = beats[i];
          setStatus(beat.id, 'generating');

          const sceneAbort = new AbortController();
          const onParentAbort = () => sceneAbort.abort(controller.signal.reason);
          controller.signal.addEventListener('abort', onParentAbort, { once: true });

          let lastActivity = Date.now();
          let activityDetail = 'Menghubungkan ke AI...';
          const startedAt = Date.now();
          const recordActivity = (detail: string) => {
            lastActivity = Date.now();
            activityDetail = detail;
          };
          set({ mographProgress: `Mendesain adegan ${i + 1} dari ${total}... (${completedCount}/${total} selesai)` });

          const ticker = setInterval(() => {
            if (sceneAbort.signal.aborted) {
              clearInterval(ticker);
              return;
            }
            const silence = Math.floor((Date.now() - lastActivity) / 1000);
            if (silence >= SILENCE_CUTOFF_SEC) {
              clearInterval(ticker);
              sceneAbort.abort(
                new Error(
                  `Koneksi tidak merespons: server AI tidak mengirim data selama ${silence} detik. Periksa koneksi internet atau ganti model.`
                )
              );
              return;
            }
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            set({ mographProgress: `Mendesain adegan ${i + 1} dari ${total}... (${elapsed}s) • ${activityDetail}` });
          }, 1000);

          let module: SceneModule;
          try {
            const projectNow = get().project;
            module = await generateCustomScene({
              beat: sceneToStoryBeat(beat),
              index: i,
              total,
              aspectRatio: projectNow.aspectRatio || '9:16',
              wordTimestamps: beat.wordTimestamps,
              ...buildSceneGenerationContext(
                { ...projectNow, scenes: beats },
                i,
                mapFontDisplay(projectNow.theme.fontFamily)
              ),
              provider: settings.selectedLLMProvider,
              apiKey: settings.apiKeys[settings.selectedLLMProvider] || '',
              model: modelFor(settings),
              onProgress: recordActivity,
              executeLlm: llmExecutor(settings, sceneAbort.signal, recordActivity)
            });
          } catch (err: unknown) {
            console.error(`[MooScript] Error generating scene #${i + 1}:`, err);
            module = {
              id: beat.id,
              beatId: beat.id,
              duration: beat.durationInSeconds || 3.5,
              html: '',
              css: '',
              buildJs: '',
              status: 'error',
              errors: [err instanceof Error ? err.message : String(err)],
              version: 1,
              userEdited: false
            };
          } finally {
            clearInterval(ticker);
            controller.signal.removeEventListener('abort', onParentAbort);
          }

          if (controller.signal.aborted) break;
          if (module.status !== 'ok') failureCount++;
          completedCount++;
          setStatus(beat.id, module.status === 'ok' ? 'ok' : 'error', completedCount);
          // A failed shot never replaces a visual the scene already had.
          if (module.status !== 'ok' && sceneHasRenderableCode(currentModule(get, beat.id))) {
            keptShots.push(i + 1);
          } else {
            // Land each shot as soon as it is ready, so the stage fills in while the rest render.
            const outcome = writeSceneModule(
              get,
              startProject.id,
              beat.id,
              module,
              fallbackComp,
              historyRecorded ? 'skip' : 'push'
            );
            if (outcome === 'written') historyRecorded = true;
          }
          await new Promise((r) => setTimeout(r, 50));
        }
      };

      try {
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
        if (controller.signal.aborted) {
          get().addToast('Pembuatan mograph dibatalkan.', 'info');
        } else if (get().project.id !== startProject.id) {
          get().addToast('Proyek berganti, hasil visual yang tersisa dibuang.', 'warning');
        } else if (failureCount > 0) {
          const kept = keptShots.sort((a, b) => a - b);
          get().addToast(
            kept.length > 0
              ? `${failureCount} dari ${total} adegan gagal dibuat. Adegan #${kept.join(', #')} memakai visual sebelumnya; coba lagi dari kartunya.`
              : `${failureCount} dari ${total} adegan mengalami kendala rendering. Buat ulang adegan itu dari kartunya.`,
            'warning',
            6000
          );
        } else {
          get().addToast('Mograph AI berhasil dibuat untuk semua adegan!', 'success');
        }
      } catch (err: unknown) {
        get().addToast(`Gagal membuat mograph: ${err instanceof Error ? err.message : String(err)}`, 'error');
      } finally {
        if (bulkController === controller) bulkController = null;
        get().setIsCompilingMograph(false);
        set({ mographProgress: '', mographStats: null });
      }
    },

    regenerateSceneAi: async (sceneId, instruction) => {
      if (get().revisingSceneId || get().isCompilingMograph || !requireApiKey()) return;
      const project: MooProject = get().project;
      const index = project.scenes.findIndex((s) => s.id === sceneId);
      if (index === -1) return;
      const scene = project.scenes[index];
      const settings = get().settings;
      const controller = new AbortController();
      sceneController = controller;
      set({ revisingSceneId: sceneId, revisionProgress: 'Menghubungi AI...' });
      const onActivity = (status: string) => set({ revisionProgress: status });

      try {
        const baseIntent = scene.visualIntent || scene.narrationText || 'Adegan mograph dinamis';
        // The instruction only steers this generation; it is not saved into visualIntent.
        const visualIntent = instruction?.trim() ? `${baseIntent}. Instruksi perubahan: ${instruction.trim()}` : baseIntent;
        const module = await generateCustomScene({
          beat: { ...sceneToStoryBeat(scene), visualIntent },
          index,
          total: project.scenes.length,
          aspectRatio: project.aspectRatio || '9:16',
          wordTimestamps: scene.wordTimestamps,
          ...buildSceneGenerationContext(project, index, mapFontDisplay(project.theme.fontFamily)),
          provider: settings.selectedLLMProvider,
          apiKey: settings.apiKeys[settings.selectedLLMProvider] || '',
          model: modelFor(settings),
          onProgress: onActivity,
          executeLlm: llmExecutor(settings, controller.signal, onActivity)
        });

        if (controller.signal.aborted) {
          get().addToast('Pembuatan ulang adegan dibatalkan.', 'info');
          return;
        }
        // A failed attempt keeps the visual the scene already had.
        if (module.status === 'error' && sceneHasRenderableCode(currentModule(get, sceneId))) {
          const reason = module.errors?.[0];
          get().addToast(
            `Adegan #${index + 1} gagal dibuat ulang, visual sebelumnya dipertahankan.${reason ? ` ${reason}` : ''}`,
            'error',
            7000
          );
          return;
        }
        const outcome = writeSceneModule(
          get,
          project.id,
          sceneId,
          { ...module, userEdited: true },
          syncComposition(project).composition
        );
        if (outcome !== 'written') {
          get().addToast(
            outcome === 'scene-removed' ? 'Adegan sudah dihapus, hasil AI dibuang.' : 'Proyek berganti, hasil adegan dibuang.',
            'warning'
          );
          return;
        }
        if (module.status === 'error') {
          get().addToast(`Adegan #${index + 1} gagal dibuat ulang. Lihat detail error di tab Gaya.`, 'error');
        } else {
          get().addToast(`Adegan #${index + 1} berhasil dibuat ulang.`, 'success');
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          get().addToast('Pembuatan ulang adegan dibatalkan.', 'info');
        } else {
          get().addToast(`Error membuat ulang adegan: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      } finally {
        if (sceneController === controller) sceneController = null;
        set({ revisingSceneId: null, revisionProgress: '' });
      }
    },

    repairSceneAi: async (sceneId) => {
      if (get().revisingSceneId || get().isCompilingMograph || !requireApiKey()) return;
      const project = get().project;
      const index = project.scenes.findIndex((s) => s.id === sceneId);
      const scene = project.scenes[index];
      const target = project.composition?.scenes.find((m) => matchesScene(m, sceneId));
      if (!scene || !target || target.status !== 'needs-repair') return;
      const settings = get().settings;
      const controller = new AbortController();
      sceneController = controller;
      set({ revisingSceneId: sceneId, revisionProgress: 'Menghubungi AI...' });
      const onActivity = (status: string) => set({ revisionProgress: status });

      try {
        const result = await repairGeneratedScene({
          originalCode: { html: target.html, css: target.css, buildJs: target.buildJs },
          errors: target.errors || [],
          visualIntent: scene.visualIntent || scene.narrationText || 'Adegan mograph dinamis',
          narration: scene.narrationText,
          durationSec: scene.durationInSeconds,
          onProgress: onActivity,
          executeLlm: llmExecutor(settings, controller.signal, onActivity)
        });
        if (controller.signal.aborted) {
          get().addToast('Perbaikan adegan dibatalkan.', 'info');
          return;
        }
        if (!result.valid) {
          get().addToast(
            `Perbaikan AI belum lolos validasi, kode lama dipertahankan: ${result.errors[0] || 'tidak diketahui'}`,
            'error'
          );
          return;
        }
        const outcome = writeSceneModule(get, project.id, sceneId, {
          ...target,
          html: result.html,
          css: result.css,
          buildJs: result.buildJs,
          editableLayers: extractLayersFromHtml(result.html),
          status: 'ok',
          errors: undefined,
          version: (target.version || 1) + 1,
          userEdited: true
        });
        if (outcome === 'written') get().addToast(`Adegan #${index + 1} diperbaiki untuk MooTween.`, 'success');
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          get().addToast('Perbaikan adegan dibatalkan.', 'info');
        } else {
          get().addToast(`Error memperbaiki adegan: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      } finally {
        if (sceneController === controller) sceneController = null;
        set({ revisingSceneId: null, revisionProgress: '' });
      }
    },

    cancelMographGeneration: () => {
      bulkController?.abort();
      sceneController?.abort();
    }
  };
};
