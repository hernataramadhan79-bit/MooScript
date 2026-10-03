import type { StateCreator } from 'zustand';
import type { Scene, MooProject, LayoutType, VisualData } from '../../types';
import { generateStoryboard } from '../../engine/ai/llm';
import { calculateFallbackSceneDuration, computeDeterministicWordAlignment } from '../../engine/ai/tts';
import { syncComposition } from '../../engine/composition/sync';
import { saveProjectToDb } from '../../db/mooDb';
import type { MooStoreState, ScriptSlice } from '../types';

let scriptAbortController: AbortController | null = null;

export const createScriptSlice: StateCreator<MooStoreState, [], [], ScriptSlice> = (set, get) => ({
  isGeneratingScript: false,
  scriptPrompt: 'How zero-server motion graphics compiles MP4 videos in the browser using WebCodecs',
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

    let timedOut = false;
    scriptAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      if (scriptAbortController) {
        timedOut = true;
        scriptAbortController.abort(new DOMException('LLM generation timed out after 60s', 'TimeoutError'));
      }
    }, 60000);

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
        signal: scriptAbortController.signal
      });

      const newScenes: Scene[] = storyboard.scenes.map((s, idx) => {
        const text = (s as any).narrationText || s.text || '';
        const dur = calculateFallbackSceneDuration(text);
        const layout: LayoutType = (s as any).layout || 'KINETIC_QUOTE';
        const visualData: VisualData = (s as any).visualData || {
          title: `Scene #${idx + 1}`,
          focusWords: s.focusWords || [],
          accentIcon: s.icon || 'zap'
        };
        return {
          id: `sc-ai-${Date.now()}-${idx}`,
          layout,
          narrationText: text,
          text,
          visualData,
          focusWords: s.focusWords || [],
          motionPreset: s.motionPreset || 'punch_zoom',
          camera: 'push_in',
          icon: s.icon || 'zap',
          durationInSeconds: dur,
          wordTimestamps: computeDeterministicWordAlignment(text, dur),
          showSubtitles: false
        };
      });

      const totalDur = newScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updatedProject: MooProject = {
        ...get().project,
        title: storyboard.title || get().project.title,
        scenes: newScenes,
        audioDuration: totalDur
      };
      const syncedProject = syncComposition(updatedProject);

      set({
        project: syncedProject,
        previousScenesSnapshot: currentScenes,
        isGeneratingScript: false,
        audioStale: !!get().project.audioBlob
      });
      await saveProjectToDb(syncedProject);
      addToast('AI Storyboard generated successfully!', 'success');
    } catch (err: unknown) {
      set({ isGeneratingScript: false });
      if (timedOut) {
        addToast('AI Script Generation timeout (60s). Coba model lebih cepat.', 'error');
      } else {
        const isUserCancelled =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.message.toLowerCase().includes('user cancelled'));

        if (isUserCancelled) {
          addToast('AI Script generation cancelled', 'info');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          addToast(`AI Script Generation failed: ${message}`, 'error');
        }
      }
    } finally {
      clearTimeout(timeoutId);
      scriptAbortController = null;
    }
  }
});
