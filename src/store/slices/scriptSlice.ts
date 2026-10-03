import type { StateCreator } from 'zustand';
import type { Scene, MooProject, LayoutType, VisualData } from '../../types';
import { generateStoryboard } from '../../engine/ai/llm';
import { calculateFallbackSceneDuration, computeDeterministicWordAlignment } from '../../engine/ai/tts';
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

    set({
      project: updatedProject,
      previousScenesSnapshot: null,
      audioStale: !!get().project.audioBlob
    });

    await saveProjectToDb(updatedProject);
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

    // Save previous snapshot for undo
    const currentScenes = [...get().project.scenes];
    set({
      isGeneratingScript: true,
      previousScenesSnapshot: currentScenes
    });

    scriptAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      if (scriptAbortController) {
        scriptAbortController.abort(new DOMException('LLM generation timed out after 30s', 'TimeoutError'));
      }
    }, 30000);

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

      set({
        project: updatedProject,
        isGeneratingScript: false,
        audioStale: !!get().project.audioBlob
      });
      await saveProjectToDb(updatedProject);
      addToast('AI Storyboard generated successfully!', 'success');
    } catch (err: unknown) {
      set({ isGeneratingScript: false });
      const isAborted =
        scriptAbortController?.signal.aborted ||
        (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
        (err instanceof Error && err.message.toLowerCase().includes('cancel'));

      if (isAborted) {
        addToast('AI Script generation cancelled', 'info');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        addToast(`AI Script Generation failed: ${message}`, 'error');
      }
    } finally {
      clearTimeout(timeoutId);
      scriptAbortController = null;
    }
  }
});
