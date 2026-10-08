import type { StateCreator } from 'zustand';
import type { TTSProvider } from '../../types';
import {
  generateOpenAITTS,
  generateElevenLabsTTS,
  generateSyntheticAmbientAudio,
  generateProjectAudioPerScene,
  decodeAudioBlob,
  calculateFallbackSceneDuration,
  computeDeterministicWordAlignment
} from '../../engine/ai/tts';
import { mixVoiceAndBgm } from '../../engine/audio/bgmMixer';
import { synthesizeLocalTTS } from '../../engine/ai/localTts';
import { saveProjectToDb } from '../../db/mooDb';
import type { MooStoreState, AudioSlice } from '../types';

let audioAbortController: AbortController | null = null;

export const createAudioSlice: StateCreator<MooStoreState, [], [], AudioSlice> = (set, get) => ({
  isGeneratingAudio: false,
  audioBlobUrl: null,
  audioStale: false,
  audioProgress: null,

  generateAudio: async () => {
    const { settings, project, addToast } = get();
    if (project.scenes.length === 0) {
      addToast('Cannot generate audio without any scenes.', 'warning');
      return;
    }

    const startedProjectId = project.id;
    const startedSceneTexts = new Map(
      project.scenes.map((s) => [s.id, s.narrationText || s.text || ''])
    );

    if (settings.selectedTTSProvider === 'fallback') {
      if (get().audioBlobUrl) {
        URL.revokeObjectURL(get().audioBlobUrl!);
      }

      const latest = get().project;
      if (latest.id !== startedProjectId) {
        addToast('Project berganti, hasil audio dibuang.', 'warning');
        return;
      }

      let totalDur = 0;
      const mergedScenes = latest.scenes.map((s) => {
        const text = s.narrationText || s.text || '';
        const dur = calculateFallbackSceneDuration(text);
        const words = computeDeterministicWordAlignment(text, dur);
        totalDur += dur;
        return {
          ...s,
          durationInSeconds: dur,
          wordTimestamps: words
        };
      });

      const finalProject = {
        ...latest,
        scenes: mergedScenes,
        audioBlob: undefined,
        audioDuration: Math.round(totalDur * 100) / 100
      };

      set({
        project: finalProject,
        isGeneratingAudio: false,
        audioBlobUrl: null,
        audioStale: false,
        audioProgress: null
      });

      await saveProjectToDb(finalProject);
      await get().refreshCacheSize();
      addToast('Mode timer: durasi dihitung dari panjang teks (tanpa suara).', 'info');
      return;
    }

    audioAbortController = new AbortController();
    set({
      isGeneratingAudio: true,
      audioProgress: {
        currentScene: 0,
        totalScenes: project.scenes.length,
        sceneId: project.scenes[0]?.id || '',
        statusText: `Preparing TTS generation for ${project.scenes.length} scenes...`
      }
    });

    try {
      const result = await generateProjectAudioPerScene({
        project,
        settings,
        concurrency: 2,
        onProgress: (progress) => {
          set({ audioProgress: progress });
        },
        signal: audioAbortController.signal
      });

      // ── BGM Mix step ───────────────────────────────────────────────────────
      const bgmSettings = result.updatedProject.bgm;
      let finalAudioBlob = result.audioBlob;

      if (bgmSettings?.preset && bgmSettings.preset !== 'none') {
        set({
          audioProgress: {
            currentScene: result.updatedProject.scenes.length,
            totalScenes: result.updatedProject.scenes.length,
            sceneId: 'bgm',
            statusText: `Mixing BGM: ${bgmSettings.preset}…`
          }
        });

        // Collect absolute word timestamps across all scenes
        const absoluteWords: Array<{ start: number; end: number }> = [];
        let sceneOffset = 0;
        for (const scene of result.updatedProject.scenes) {
          for (const wt of scene.wordTimestamps || []) {
            absoluteWords.push({
              start: sceneOffset + wt.start,
              end: sceneOffset + wt.end
            });
          }
          sceneOffset += scene.durationInSeconds;
        }

        const voiceBuffer = await decodeAudioBlob(result.audioBlob);
        finalAudioBlob = await mixVoiceAndBgm(voiceBuffer, {
          bgmPreset: bgmSettings.preset,
          bgmLevel: bgmSettings.level ?? 0.18,
          voiceLevel: 1.0,
          duckRatio: bgmSettings.duckRatio ?? 0.15,
          duckAttackSec: 0.08,
          duckReleaseSec: 0.35,
          wordTimestamps: absoluteWords
        });
      }
      // ── End BGM Mix ────────────────────────────────────────────────────────

      const latest = get().project;
      if (latest.id !== startedProjectId) {
        set({ isGeneratingAudio: false, audioProgress: null });
        addToast('Project berganti, hasil audio dibuang.', 'warning');
        return;
      }

      let hasTextChangedDuringGen = false;
      const updatedDurationsBySceneId = new Map(
        result.updatedProject.scenes.map((s) => [
          s.id,
          { duration: s.durationInSeconds, words: s.wordTimestamps }
        ])
      );

      const mergedScenes = latest.scenes.map((s) => {
        const genData = updatedDurationsBySceneId.get(s.id);
        const currentText = s.narrationText || s.text || '';
        const initialText = startedSceneTexts.get(s.id);

        if (initialText !== undefined && currentText !== initialText) {
          hasTextChangedDuringGen = true;
        }

        if (genData) {
          return {
            ...s,
            durationInSeconds: genData.duration,
            wordTimestamps: genData.words
          };
        }
        return s;
      });

      const newBlobUrl = URL.createObjectURL(finalAudioBlob);
      if (get().audioBlobUrl) {
        URL.revokeObjectURL(get().audioBlobUrl!);
      }

      const finalProject = {
        ...latest,
        scenes: mergedScenes,
        audioBlob: finalAudioBlob,
        audioDuration: result.totalDuration
      };

      set({
        project: finalProject,
        isGeneratingAudio: false,
        audioBlobUrl: newBlobUrl,
        audioStale: hasTextChangedDuringGen,
        audioProgress: null
      });

      await saveProjectToDb(finalProject);
      await get().refreshCacheSize();

      const bgmLabel = bgmSettings?.preset && bgmSettings.preset !== 'none'
        ? ` + BGM (${bgmSettings.preset})`
        : '';
      addToast(
        `Audio generated! (${result.totalDuration.toFixed(1)}s, ${result.apiCallCount} synthesized, ${result.cacheHitCount} cached${bgmLabel})`,
        'success'
      );
    } catch (err: unknown) {
      set({ isGeneratingAudio: false, audioProgress: null });
      const isAborted =
        audioAbortController?.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.toLowerCase().includes('cancel'));

      if (isAborted) {
        addToast('Audio generation cancelled', 'info');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        addToast(`Audio generation failed: ${message}`, 'error');
      }
    } finally {
      audioAbortController = null;
    }
  },

  cancelAudioGeneration: () => {
    if (audioAbortController) {
      audioAbortController.abort();
      audioAbortController = null;
    }
    set({ isGeneratingAudio: false, audioProgress: null });
  },

  auditionVoice: async (providerOverride?: TTSProvider, voiceOverride?: string) => {
    const { settings, addToast } = get();
    const provider = providerOverride || settings.selectedTTSProvider;
    const voice =
      voiceOverride ||
      (provider === 'local'
        ? settings.voiceIds?.local
        : provider === 'elevenlabs'
        ? settings.voiceIds?.elevenlabs
        : settings.voiceIds?.openai);
    const sampleText =
      provider === 'local' && (voice?.startsWith('id_') || !voice)
        ? 'MooScript Studio generator motion graphics deterministik di browser.'
        : 'MooScript Studio client-side motion graphics engine.';

    try {
      let audioBlob: Blob;
      if (provider === 'local') {
        const res = await synthesizeLocalTTS({
          text: sampleText,
          voiceId: voice || 'id_ID-news_tts',
          speed: settings.speed || 1.05
        });
        audioBlob = res.audioBlob;
      } else if (provider === 'openai') {
        const key = settings.apiKeys.openai;
        if (!key) {
          addToast('OpenAI API key missing in Settings. Playing preview chime.', 'warning');
          audioBlob = await generateSyntheticAmbientAudio(1.5);
        } else {
          audioBlob = await generateOpenAITTS({
            apiKey: key,
            text: sampleText,
            voice: voice || 'alloy',
            speed: settings.speed || 1.05
          });
        }
      } else if (provider === 'elevenlabs') {
        const key = settings.apiKeys.elevenlabs;
        if (!key) {
          addToast('ElevenLabs API key missing in Settings. Playing preview chime.', 'warning');
          audioBlob = await generateSyntheticAmbientAudio(1.5);
        } else {
          const res = await generateElevenLabsTTS({
            apiKey: key.trim(),
            voiceId: voice || '21m00Tcm4TlvDq8ikWAM',
            modelId: settings.elevenLabsModel || 'eleven_flash_v2_5',
            text: sampleText,
            stability: settings.stability
          });
          audioBlob = res.audioBlob;
        }
      } else {
        audioBlob = await generateSyntheticAmbientAudio(2.0);
      }

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Audition failed: ${msg}`, 'error');
    }
  }
});
