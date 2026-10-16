import type { StateCreator } from 'zustand';
import type { TTSProvider } from '../../types';
import {
  generateOpenAITTS,
  generateElevenLabsTTS,
  generateProjectAudioPerScene,
  decodeAudioBlob,
  calculateFallbackSceneDuration,
  computeDeterministicWordAlignment
} from '../../engine/ai/tts';
import { mixVoiceAndBgm, renderStandaloneBgm } from '../../engine/audio/bgmMixer';
import { synthesizeLocalTTS, isLocalModelCached } from '../../engine/ai/localTts';
import { syncComposition } from '../../engine/composition/sync';
import { saveProjectToDb } from '../../db/mooDb';
import { extractWaveformPeaks } from '../../engine/audio/waveform';
import type { MooStoreState, AudioSlice } from '../types';

let audioAbortController: AbortController | null = null;

export const createAudioSlice: StateCreator<MooStoreState, [], [], AudioSlice> = (set, get) => ({
  isGeneratingAudio: false,
  audioBlobUrl: null,
  audioStale: false,
  audioProgress: null,
  rawVoiceBlob: null,
  waveformPeaks: null,
  setWaveformPeaks: (waveformPeaks) => set({ waveformPeaks }),

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

    if (settings.selectedTTSProvider === 'fallback' || settings.selectedTTSProvider === 'timer') {
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

      const roundedDuration = Math.round(totalDur * 100) / 100;
      const bgmSettings = latest.bgm;
      let finalAudioBlob: Blob | undefined = undefined;
      let newBlobUrl: string | null = null;

      if (bgmSettings?.preset && bgmSettings.preset !== 'none' && roundedDuration > 0) {
        const bgmBlob = await renderStandaloneBgm(
          bgmSettings.preset,
          roundedDuration,
          bgmSettings.level ?? 0.18
        );
        if (bgmBlob) {
          finalAudioBlob = bgmBlob;
          newBlobUrl = URL.createObjectURL(bgmBlob);
        }
      }

      const finalProject = syncComposition({
        ...latest,
        scenes: mergedScenes,
        audioBlob: finalAudioBlob,
        audioDuration: roundedDuration
      });

      set({
        project: finalProject,
        isGeneratingAudio: false,
        audioBlobUrl: newBlobUrl,
        audioStale: false,
        audioProgress: null,
        rawVoiceBlob: null
      });
      if (finalAudioBlob) {
        extractWaveformPeaks(finalAudioBlob).then((peaks) => set({ waveformPeaks: peaks })).catch(() => {});
      } else {
        set({ waveformPeaks: null });
      }

      await saveProjectToDb(finalProject);
      await get().refreshCacheSize();
      if (finalAudioBlob) {
        addToast(`Mode timer dengan BGM (${bgmSettings?.preset}): durasi ${roundedDuration}s.`, 'info');
      } else {
        addToast('Mode timer: durasi dihitung dari panjang teks (tanpa suara).', 'info');
      }
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

      const finalProject = syncComposition({
        ...latest,
        scenes: mergedScenes,
        audioBlob: finalAudioBlob,
        audioDuration: result.totalDuration
      });

      set({
        project: finalProject,
        isGeneratingAudio: false,
        audioBlobUrl: newBlobUrl,
        audioStale: hasTextChangedDuringGen,
        audioProgress: null,
        rawVoiceBlob: result.audioBlob
      });
      if (finalAudioBlob) {
        extractWaveformPeaks(finalAudioBlob).then((peaks) => set({ waveformPeaks: peaks })).catch(() => {});
      }

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

  deleteAudio: async () => {
    const { project, audioBlobUrl, addToast } = get();
    if (audioBlobUrl) {
      try {
        URL.revokeObjectURL(audioBlobUrl);
      } catch {
        // ignore
      }
    }
    const updatedProject = syncComposition({
      ...project,
      audioBlob: undefined,
      audioDuration: 0,
      scenes: project.scenes.map((s) => ({
        ...s,
        wordTimestamps: []
      }))
    });
    set({
      project: updatedProject,
      audioBlobUrl: null,
      rawVoiceBlob: null,
      waveformPeaks: null,
      audioStale: false,
      audioProgress: null
    });
    await saveProjectToDb(updatedProject);
    await get().refreshCacheSize();
    addToast('Audio proyek berhasil dihapus.', 'info');
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

    if (provider === 'timer') {
      addToast('Mode Tanpa Suara (Timer) menghitung durasi adegan tanpa narasi suara.', 'info');
      return;
    }

    const sampleText =
      (provider === 'local' && (voice?.startsWith('id_') || !voice)) || provider === 'fallback'
        ? 'MooScript Studio generator motion graphics deterministik di browser.'
        : 'MooScript Studio client-side motion graphics engine.';

    // WebSpeech / Browser native speech support
    if (provider === 'fallback' || voice === 'fallback') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = sampleText.includes('MooScript') && sampleText.includes('deterministik') ? 'id-ID' : 'en-US';
        utterance.rate = Math.max(0.5, Math.min(2.0, settings.speed || 1.0));
        window.speechSynthesis.speak(utterance);
        addToast('Memutar suara menggunakan WebSpeech browser.', 'info');
        return;
      }
    }

    try {
      let audioBlob: Blob;
      if (provider === 'local') {
        const targetVoiceId = voice || 'id_ID-news_tts';
        const cached = await isLocalModelCached(targetVoiceId);
        if (!cached) {
          // Play browser speech as sample preview instead of downloading 60MB unexpectedly
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(sampleText);
            utterance.lang = targetVoiceId.startsWith('id_') ? 'id-ID' : 'en-US';
            utterance.rate = Math.max(0.5, Math.min(2.0, settings.speed || 1.0));
            window.speechSynthesis.speak(utterance);
            addToast(`Model lokal belum diunduh. Memutar contoh dengan WebSpeech browser. Silakan klik Unduh Model untuk suara Piper offline.`, 'info');
            return;
          }
        }
        const res = await synthesizeLocalTTS({
          text: sampleText,
          voiceId: targetVoiceId,
          speed: settings.speed || 1.05
        });
        audioBlob = res.audioBlob;
      } else if (provider === 'openai') {
        const key = settings.apiKeys.openai;
        if (!key) {
          addToast('OpenAI API key belum diisi di Pengaturan.', 'warning');
          return;
        }
        audioBlob = await generateOpenAITTS({
          apiKey: key,
          text: sampleText,
          voice: voice || 'alloy',
          speed: settings.speed || 1.05
        });
      } else if (provider === 'elevenlabs') {
        const key = settings.apiKeys.elevenlabs;
        if (!key) {
          addToast('ElevenLabs API key belum diisi di Pengaturan.', 'warning');
          return;
        }
        const res = await generateElevenLabsTTS({
          apiKey: key.trim(),
          voiceId: voice || '21m00Tcm4TlvDq8ikWAM',
          modelId: settings.elevenLabsModel || 'eleven_flash_v2_5',
          text: sampleText,
          stability: settings.stability
        });
        audioBlob = res.audioBlob;
      } else {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(sampleText);
          window.speechSynthesis.speak(utterance);
          return;
        }
        addToast('Penyedia suara tidak valid.', 'warning');
        return;
      }

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Audisi gagal: ${msg}`, 'error');
    }
  },

  uploadCustomAudio: async (file: File) => {
    const { project, audioBlobUrl, addToast } = get();
    if (!file) return;
    const isAudio =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name);
    if (!isAudio) {
      addToast('Format berkas tidak didukung. Unggah berkas audio (MP3, WAV, M4A, OGG).', 'error');
      return;
    }

    set({
      isGeneratingAudio: true,
      audioProgress: {
        currentScene: 0,
        totalScenes: project.scenes.length,
        sceneId: 'upload',
        statusText: `Memproses berkas audio "${file.name}"...`
      }
    });

    try {
      const voiceBuffer = await decodeAudioBlob(file);
      const totalAudioDur = Math.max(0.5, Math.round(voiceBuffer.duration * 100) / 100);

      // Distribute total audio duration proportionally across scenes based on narration length
      const rawWeights = project.scenes.map((s) =>
        Math.max(1, (s.narrationText || s.text || '').trim().length)
      );
      const weightSum = rawWeights.reduce((a, b) => a + b, 0) || 1;

      let accumulated = 0;
      const updatedScenes = project.scenes.map((s, idx) => {
        const isLast = idx === project.scenes.length - 1;
        const dur = isLast
          ? Math.max(0.5, Math.round((totalAudioDur - accumulated) * 100) / 100)
          : Math.max(0.5, Math.round((totalAudioDur * (rawWeights[idx] / weightSum)) * 100) / 100);
        accumulated += dur;
        const text = s.narrationText || s.text || '';
        return {
          ...s,
          durationInSeconds: dur,
          wordTimestamps: computeDeterministicWordAlignment(text, dur)
        };
      });

      let finalAudioBlob: Blob = file;
      const bgmSettings = project.bgm;
      if (bgmSettings?.preset && bgmSettings.preset !== 'none') {
        const absoluteWords: Array<{ start: number; end: number }> = [];
        let sceneOffset = 0;
        for (const scene of updatedScenes) {
          for (const wt of scene.wordTimestamps || []) {
            absoluteWords.push({
              start: sceneOffset + wt.start,
              end: sceneOffset + wt.end
            });
          }
          sceneOffset += scene.durationInSeconds;
        }
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

      if (audioBlobUrl) {
        try {
          URL.revokeObjectURL(audioBlobUrl);
        } catch {
          // ignore
        }
      }
      const newBlobUrl = URL.createObjectURL(finalAudioBlob);
      const finalProject = syncComposition({
        ...project,
        scenes: updatedScenes,
        audioBlob: finalAudioBlob,
        audioDuration: totalAudioDur
      });

      set({
        project: finalProject,
        isGeneratingAudio: false,
        audioBlobUrl: newBlobUrl,
        audioStale: false,
        audioProgress: null,
        rawVoiceBlob: file
      });

      extractWaveformPeaks(finalAudioBlob)
        .then((peaks) => set({ waveformPeaks: peaks }))
        .catch(() => {});

      await saveProjectToDb(finalProject);
      addToast(`Audio "${file.name}" (${totalAudioDur.toFixed(1)}s) berhasil diterapkan & disinkronkan!`, 'success');
    } catch (err: unknown) {
      set({ isGeneratingAudio: false, audioProgress: null });
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal memuat berkas audio: ${msg}`, 'error');
    }
  },

  remixAudio: async () => {
    const { rawVoiceBlob, project, audioBlobUrl, addToast } = get();
    const sourceVoiceBlob = rawVoiceBlob || project.audioBlob;
    if (!sourceVoiceBlob) return;

    const bgmSettings = project.bgm;
    let finalAudioBlob = sourceVoiceBlob;

    try {
      if (bgmSettings?.preset && bgmSettings.preset !== 'none') {
        const absoluteWords: Array<{ start: number; end: number }> = [];
        let sceneOffset = 0;
        for (const scene of project.scenes) {
          for (const wt of scene.wordTimestamps || []) {
            absoluteWords.push({
              start: sceneOffset + wt.start,
              end: sceneOffset + wt.end
            });
          }
          sceneOffset += scene.durationInSeconds;
        }

        const voiceBuffer = await decodeAudioBlob(sourceVoiceBlob);
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

      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(finalAudioBlob);

      const updatedProject = {
        ...project,
        audioBlob: finalAudioBlob
      };

      set({
        project: updatedProject,
        audioBlobUrl: newBlobUrl,
        audioStale: false
      });
      extractWaveformPeaks(finalAudioBlob).then((peaks) => set({ waveformPeaks: peaks })).catch(() => {});

      await saveProjectToDb(updatedProject);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal me-remix audio: ${msg}`, 'error');
    }
  },

  generateBgmOnlyAudio: async () => {
    const { project, audioBlobUrl, addToast } = get();
    const bgmSettings = project.bgm;
    if (!bgmSettings?.preset || bgmSettings.preset === 'none') {
      return;
    }

    let totalDuration = project.scenes.reduce(
      (acc, s) => acc + (s.durationInSeconds || 0),
      0
    );
    if (totalDuration <= 0) {
      totalDuration = project.audioDuration > 0 ? project.audioDuration : 5.0;
    }
    totalDuration = Math.round(totalDuration * 100) / 100;

    try {
      const bgmBlob = await renderStandaloneBgm(
        bgmSettings.preset,
        totalDuration,
        bgmSettings.level ?? 0.18
      );
      if (!bgmBlob) return;

      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
      }
      const newBlobUrl = URL.createObjectURL(bgmBlob);

      const updatedProject = {
        ...project,
        audioBlob: bgmBlob,
        audioDuration: totalDuration
      };

      set({
        project: updatedProject,
        audioBlobUrl: newBlobUrl,
        audioStale: false
      });
      extractWaveformPeaks(bgmBlob).then((peaks) => set({ waveformPeaks: peaks })).catch(() => {});

      await saveProjectToDb(updatedProject);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal membuat BGM audio: ${msg}`, 'error');
    }
  }
});
