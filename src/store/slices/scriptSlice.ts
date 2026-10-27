import type { StateCreator } from 'zustand';
import type { Scene, MooProject, StyleBrief } from '../../types';
import type { WorldBible } from '../../engine/ai/llm';
import { generateStoryboard } from '../../engine/ai/llm';
import { calculateFallbackSceneDuration, computeDeterministicWordAlignment } from '../../engine/ai/tts';
import { syncComposition } from '../../engine/composition/sync';
import { saveProjectToDb } from '../../db/mooDb';
import type { MooStoreState, ScriptSlice } from '../types';

let scriptAbortController: AbortController | null = null;

/** A shot list with a world bible needs more room than the old 3-6 scene storyboard. */
const STORYBOARD_MIN_TOKENS = 4096;

/**
 * Applies the storyboard's world bible: it becomes the project's style brief (motif, visual and
 * camera language, palette) and its palette drives the theme colors exposed as --moo-* variables.
 */
export function applyWorldBible(project: MooProject, world: WorldBible | undefined): MooProject {
  if (!world) return project;
  const palette = world.palette || {};
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
    palette: {
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

    const totalDur = snapshot.reduce((acc, s) => acc + (s.durationInSeconds > 0 ? s.durationInSeconds : 3), 0);
    const updatedProject: MooProject = {
      ...get().project,
      scenes: snapshot,
      audioDuration: totalDur
    };
    const syncedProject = syncComposition(updatedProject);

    set({
      project: syncedProject,
      previousScenesSnapshot: null,
      audioStale: !!get().project.audioBlob
    });

    await saveProjectToDb(syncedProject);
    get().addToast('Restored previous storyboard scenes!', 'success');
  },

  generateScript: async () => {
    const { settings, scriptPrompt, skills, activeSkillId, addToast } = get();
    const activeSkill = skills.find((s) => s.id === activeSkillId) || skills[0];
    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';

    if (!apiKey || apiKey.trim() === '') {
      addToast(`Please configure your ${provider.toUpperCase()} API Key in Settings first.`, 'warning');
      return;
    }

    // Save previous snapshot for undo upon success
    const currentScenes = [...get().project.scenes];
    set({
      isGeneratingScript: true
    });

    scriptAbortController = new AbortController();

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
        signal: scriptAbortController.signal,
        maxTokens: Math.max(settings.maxOutputTokens || 2048, STORYBOARD_MIN_TOKENS)
      });

      const newScenes: Scene[] = storyboard.scenes.map((s, idx) => {
        const text = s.narration || (s as any).narrationText || (s as any).text || '';
        const visualIntent = s.visualIntent || text || `Scene ${idx + 1}`;
        const dur = s.durationHint && s.durationHint > 0 ? s.durationHint : calculateFallbackSceneDuration(text);
        const focusWords = s.emphasis || (s as any).focusWords || [];
        return {
          id: `sc-ai-${Date.now()}-${idx}`,
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
          wordTimestamps: computeDeterministicWordAlignment(text, dur),
          showSubtitles: false
        };
      });

      const totalDur = newScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const oldUrl = get().audioBlobUrl;
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch {
          // ignore
        }
      }
      const updatedProject: MooProject = applyWorldBible(
        {
          ...get().project,
          title: storyboard.title || get().project.title,
          scenes: newScenes,
          audioBlob: undefined,
          audioDuration: totalDur
        },
        storyboard.worldBible
      );
      const syncedProject = syncComposition(updatedProject);

      set({
        project: syncedProject,
        audioBlobUrl: null,
        rawVoiceBlob: null,
        waveformPeaks: null,
        previousScenesSnapshot: currentScenes,
        isGeneratingScript: false,
        audioStale: false
      });
      await saveProjectToDb(syncedProject);
      addToast('AI Storyboard generated successfully!', 'success');
    } catch (err: unknown) {
      set({ isGeneratingScript: false });
      const isUserCancelled =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.toLowerCase().includes('user cancelled'));

      if (isUserCancelled) {
        addToast('AI Script generation cancelled', 'info');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        addToast(`AI Script Generation failed: ${message}`, 'error');
      }
    } finally {
      scriptAbortController = null;
    }
  }
});
