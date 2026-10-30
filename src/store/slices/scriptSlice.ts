import type { StateCreator } from 'zustand';
import type { Scene, MooProject, StyleBrief } from '../../types';
import type { WorldBible } from '../../engine/ai/llm';
import { generateStoryboard } from '../../engine/ai/llm';
import { planShots } from '../../engine/ai/brief';
import { withBrandCards } from '../../engine/brand/brandKit';
import { calculateFallbackSceneDuration, computeDeterministicWordAlignment } from '../../engine/ai/tts';
import { syncComposition } from '../../engine/composition/sync';
import { saveProjectToDb, saveVoiceTrackToDb } from '../../db/mooDb';
import { stopPlaybackAudio } from './playbackSlice';
import { flushPendingSave } from './projectSlice';
import type { MooStoreState, ScriptSlice } from '../types';

let scriptAbortController: AbortController | null = null;

/**
 * The whole project as it was before the last AI storyboard replaced it, so "Urungkan" brings
 * back the scenes together with their visuals, title, palette and audio.
 */
let projectBeforeStoryboard: { project: MooProject; rawVoiceBlob: Blob | null; bgmOnlyAudio: boolean } | null = null;

/** A shot list with a world bible needs more room than the old 3-6 scene storyboard; longer films more still. */
const STORYBOARD_MIN_TOKENS = 4096;

function storyboardMinTokens(targetSec: number | undefined): number {
  if (!targetSec) return STORYBOARD_MIN_TOKENS;
  return Math.min(16384, Math.max(STORYBOARD_MIN_TOKENS, planShots(targetSec).maxShots * 400 + 1200));
}

/**
 * Applies the storyboard's world bible: it becomes the project's style brief (motif, visual and
 * camera language, palette) and its palette drives the theme colors exposed as --moo-* variables.
 */
export function applyWorldBible(project: MooProject, world: WorldBible | undefined): MooProject {
  if (!world) return project;
  // A brand's palette wins over the one the AI picks for the topic.
  const palette = project.brand ? {} : world.palette || {};
  const theme = { ...project.theme };
  if (palette.bg) theme.bg = palette.bg;
  if (palette.accent) theme.textHighlight = palette.accent;
  if (palette.text) theme.textPrimary = palette.text;
  const styleBrief: StyleBrief = {
    ...(project.styleBrief || {
      adjectives: [],
      fontDisplay: '',
      fontBody: '',
      backgroundLanguage: '',
      motionSignature: ''
    }),
    palette: project.brand
      ? { ...project.brand.palette, source: 'brand-kit' }
      : {
          bg: palette.bg || theme.bg,
          primary: palette.primary || palette.accent || theme.textHighlight,
          accent: palette.accent || theme.textHighlight,
          text: palette.text || theme.textPrimary,
          source: 'world-bible'
        },
    motif: world.motif || undefined,
    backgroundLanguage: world.visualLanguage || project.styleBrief?.backgroundLanguage || '',
    motionSignature: world.cameraStyle || project.styleBrief?.motionSignature || ''
  };
  return { ...project, theme, styleBrief };
}

/** Releases the preview URL of the audio that is being dropped. */
function revokeUrl(url: string | null): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

export const createScriptSlice: StateCreator<MooStoreState, [], [], ScriptSlice> = (set, get) => ({
  isGeneratingScript: false,
  scriptPrompt: '',
  setScriptPrompt: (scriptPrompt) => set({ scriptPrompt }),

  cancelGenerateScript: () => {
    if (scriptAbortController) {
      scriptAbortController.abort(new DOMException('User cancelled script generation', 'AbortError'));
      scriptAbortController = null;
    }
    set({ isGeneratingScript: false });
  },

  previousScenesSnapshot: null,

  undoGenerateScript: async () => {
    const snapshot = get().previousScenesSnapshot;
    if (!snapshot) return;
    const before = projectBeforeStoryboard;
    projectBeforeStoryboard = null;
    const current = get().project;
    get().pause();
    stopPlaybackAudio();

    if (before && before.project.id === current.id) {
      revokeUrl(get().audioBlobUrl);
      const restored = before.project;
      get().setProject(restored, { preserveHistory: true });
      set({
        audioBlobUrl: restored.audioBlob ? URL.createObjectURL(restored.audioBlob) : null,
        rawVoiceBlob: before.rawVoiceBlob,
        bgmOnlyAudio: before.bgmOnlyAudio,
        waveformPeaks: null,
        previousScenesSnapshot: null,
        activeSceneId: null,
        currentFrame: 0
      });
      await flushPendingSave();
      await saveVoiceTrackToDb(
        restored.id,
        before.rawVoiceBlob ? { kind: 'voice', blob: before.rawVoiceBlob } : before.bgmOnlyAudio ? { kind: 'bgm' } : null
      );
      get().addToast('Naskah sebelumnya dikembalikan.', 'success');
      return;
    }

    const totalDur = snapshot.reduce((acc, s) => acc + (s.durationInSeconds > 0 ? s.durationInSeconds : 3), 0);
    const syncedProject = syncComposition({ ...current, scenes: snapshot, audioDuration: totalDur });
    set({
      project: syncedProject,
      previousScenesSnapshot: null,
      audioStale: !!current.audioBlob
    });
    await saveProjectToDb(syncedProject);
    get().addToast('Naskah sebelumnya dikembalikan.', 'success');
  },

  generateScript: async () => {
    const { settings, scriptPrompt, skills, activeSkillId, addToast } = get();
    if (get().isGeneratingScript) return;
    const activeSkill = skills.find((s) => s.id === activeSkillId) || skills[0];
    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';

    if (!apiKey || apiKey.trim() === '') {
      addToast(`Masukkan API Key ${provider.toUpperCase()} di Pengaturan terlebih dahulu.`, 'warning');
      return;
    }

    const startedProjectId = get().project.id;
    set({ isGeneratingScript: true });
    const controller = new AbortController();
    scriptAbortController = controller;

    try {
      const storyboard = await generateStoryboard({
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
        prompt: scriptPrompt,
        skill: activeSkill,
        language: settings.outputLanguage || 'id',
        signal: controller.signal,
        maxTokens: Math.max(settings.maxOutputTokens || 2048, storyboardMinTokens(get().project.brief?.targetDurationSec)),
        brief: get().project.brief
      });

      if (controller.signal.aborted) throw new DOMException('User cancelled script generation', 'AbortError');
      const latest = get().project;
      if (latest.id !== startedProjectId) {
        set({ isGeneratingScript: false });
        addToast('Proyek berganti, hasil naskah AI dibuang.', 'warning');
        return;
      }

      const now = Date.now();
      const newScenes: Scene[] = storyboard.scenes.map((s, idx) => {
        const text = s.narration || (s as any).narrationText || (s as any).text || '';
        const visualIntent = s.visualIntent || text || `Scene ${idx + 1}`;
        const dur = s.durationHint && s.durationHint > 0 ? s.durationHint : calculateFallbackSceneDuration(text);
        const focusWords = s.emphasis || (s as any).focusWords || [];
        return {
          id: `sc-ai-${now}-${idx}`,
          narrationText: text,
          text,
          visualIntent,
          visualConcept: s.visualConcept,
          visualElements: s.visualElements || [],
          motionIntent: s.motionIntent,
          cameraIntent: s.cameraIntent,
          transitionIntent: s.transitionIntent,
          heroObject: s.heroObject || undefined,
          matchCut: s.matchCut || undefined,
          emphasis: focusWords,
          focusWords,
          durationInSeconds: dur,
          wordTimestamps: computeDeterministicWordAlignment(text, dur)
        };
      });

      // The new storyboard has no voice-over yet: stop and release the old one.
      get().pause();
      stopPlaybackAudio();
      revokeUrl(get().audioBlobUrl);
      projectBeforeStoryboard = {
        project: latest,
        rawVoiceBlob: get().rawVoiceBlob ?? null,
        bgmOnlyAudio: get().bgmOnlyAudio
      };

      const totalDur = newScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updatedProject: MooProject = applyWorldBible(
        {
          ...latest,
          title: storyboard.title || latest.title,
          scenes: newScenes,
          audioBlob: undefined,
          audioDuration: totalDur
        },
        storyboard.worldBible
      );
      // A branded project keeps its intro / outro cards around the new shots.
      const syncedProject = withBrandCards(syncComposition(updatedProject));

      // One undo step for the whole storyboard.
      get().setProject(syncedProject, { preserveHistory: true });
      set({
        audioBlobUrl: null,
        rawVoiceBlob: null,
        bgmOnlyAudio: false,
        waveformPeaks: null,
        previousScenesSnapshot: latest.scenes,
        isGeneratingScript: false,
        audioStale: false,
        activeSceneId: null,
        selectedLayerId: null,
        currentFrame: 0
      });
      await flushPendingSave();
      await saveVoiceTrackToDb(syncedProject.id, null);
      addToast(`Storyboard AI siap: ${newScenes.length} adegan.`, 'success');
    } catch (err: unknown) {
      const isUserCancelled =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.toLowerCase().includes('user cancelled'));
      // A cancel already reset the flag; a newer run may own it by now.
      if (scriptAbortController === controller || !isUserCancelled) set({ isGeneratingScript: false });

      if (isUserCancelled) {
        addToast('Penyusunan naskah AI dibatalkan.', 'info');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        addToast(`Gagal menyusun naskah AI: ${message}`, 'error');
      }
    } finally {
      if (scriptAbortController === controller) scriptAbortController = null;
    }
  }
});
