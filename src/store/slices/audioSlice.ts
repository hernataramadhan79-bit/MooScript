import type { StateCreator } from 'zustand';
import type { MooProject, Scene, TTSProvider } from '../../types';
import {
  generateOpenAITTS,
  generateElevenLabsTTS,
  generateProjectAudioPerScene,
  decodeAudioBlob,
  calculateFallbackSceneDuration,
  computeDeterministicWordAlignment
} from '../../engine/ai/tts';
import { mixProjectAudio } from '../../engine/audio/bgmMixer';
import { deleteCachedSceneAudio } from '../../db/mooDb';
import { sceneAudioCacheKey } from '../../engine/ai/tts';
import { synthesizeLocalTTS, isLocalModelCached } from '../../engine/ai/localTts';
import { WHISPER_MAX_BYTES, alignScenesToTranscript, transcribeWords } from '../../engine/ai/voiceAlign';
import { syncComposition } from '../../engine/composition/sync';
import { saveProjectToDb, saveVoiceTrackToDb } from '../../db/mooDb';
import { getProjectDuration } from '../../utils/projectDuration';
import type { MooStoreState, AudioSlice } from '../types';

let audioAbortController: AbortController | null = null;
/** Bumped by every remix or music render: only the newest one may write its result. */
let mixJobSeq = 0;

/** Word timings on the film's clock (scene offsets added), used to duck the music under the voice. */
function absoluteWordTimings(scenes: Scene[]): Array<{ start: number; end: number }> {
  const words: Array<{ start: number; end: number }> = [];
  let sceneOffset = 0;
  for (const scene of scenes) {
    for (const wt of scene.wordTimestamps || []) {
      words.push({ start: sceneOffset + wt.start, end: sceneOffset + wt.end });
    }
    sceneOffset += scene.durationInSeconds;
  }
  return words;
}

/** The film's soundtrack: voice-over (as edited), music and sound effects; null when silent. */
async function renderMix(project: MooProject, voice: Blob | AudioBuffer | null): Promise<Blob | null> {
  const voiceBuffer = voice instanceof Blob ? await decodeAudioBlob(voice) : voice;
  return mixProjectAudio({
    voice: voiceBuffer,
    voiceEdit: project.voiceEdit,
    bgmPreset: project.bgm?.preset || 'none',
    bgmLevel: project.bgm?.level ?? 0.18,
    duckRatio: project.bgm?.duckRatio ?? 0.15,
    wordTimestamps: absoluteWordTimings(project.scenes),
    sfxCues: project.sfxCues || [],
    sfxLevel: project.sfxLevel ?? DEFAULT_SFX_LEVEL,
    filmDuration: getProjectDuration(project)
  });
}

export const DEFAULT_SFX_LEVEL = 0.8;

const hasMusic = (bgm: MooProject['bgm'] | undefined): bgm is MooProject['bgm'] =>
  Boolean(bgm?.preset && bgm.preset !== 'none');

const hasVoiceEdit = (edit: MooProject['voiceEdit']) =>
  Boolean(edit && (edit.offset || edit.trimStart || edit.trimEnd || edit.fadeIn || edit.fadeOut || (edit.gain !== undefined && edit.gain !== 1)));

/** The plain recording is not enough: music, sound effects or a voice edit have to be mixed in. */
const needsMix = (p: MooProject) =>
  hasMusic(p.bgm) || (p.sfxCues?.length ?? 0) > 0 || hasVoiceEdit(p.voiceEdit);

/** Mix refreshes wait for a pause in edits (dragging a cue, a slider), then run once. */
let mixRefreshTimer: ReturnType<typeof setTimeout> | null = null;
export function queueMixRefresh(run: () => Promise<void>, delayMs = 450): void {
  if (mixRefreshTimer) clearTimeout(mixRefreshTimer);
  mixRefreshTimer = setTimeout(() => {
    mixRefreshTimer = null;
    run().catch(() => {});
  }, delayMs);
}

/** Same scenes in the same order: audio rendered for one list still lines up with the other. */
const sameSceneOrder = (a: Scene[], b: Scene[]) => a.length === b.length && a.every((s, i) => s.id === b[i].id);

export const createAudioSlice: StateCreator<MooStoreState, [], [], AudioSlice> = (set, get) => {
  /** Points the preview player at a new track and releases the old URL. Playback is paused first. */
  const swapAudioUrl = (blob: Blob | undefined): string | null => {
    get().pause();
    const oldUrl = get().audioBlobUrl;
    if (oldUrl) {
      try {
        URL.revokeObjectURL(oldUrl);
      } catch {
        // ignore
      }
    }
    return blob ? URL.createObjectURL(blob) : null;
  };

  return {
    isGeneratingAudio: false,
    audioBlobUrl: null,
    audioStale: false,
    audioProgress: null,
    rawVoiceBlob: null,
    bgmOnlyAudio: false,
    waveformPeaks: null,
    setWaveformPeaks: (waveformPeaks) => set({ waveformPeaks }),

    generateAudio: async () => {
      const { settings, project, addToast } = get();
      if (get().isGeneratingAudio) return;
      if (project.scenes.length === 0) {
        addToast('Tambahkan adegan dulu sebelum membuat audio.', 'warning');
        return;
      }

      const startedProjectId = project.id;
      const startedScenes = project.scenes;
      const startedSceneTexts = new Map(project.scenes.map((s) => [s.id, s.narrationText || s.text || '']));

      if (settings.selectedTTSProvider === 'fallback' || settings.selectedTTSProvider === 'timer') {
        /** Reading-speed timing for every scene: no voice, so the text alone sets each length. */
        const timeByText = (scenes: Scene[]) => {
          let total = 0;
          const timed = scenes.map((s) => {
            const text = s.narrationText || s.text || '';
            const dur = calculateFallbackSceneDuration(text);
            total += dur;
            return { ...s, durationInSeconds: dur, wordTimestamps: computeDeterministicWordAlignment(text, dur) };
          });
          return { timed, total: Math.round(total * 100) / 100 };
        };
        const roundedDuration = timeByText(project.scenes).total;

        let musicBlob: Blob | undefined;
        if ((hasMusic(project.bgm) || (project.sfxCues?.length ?? 0) > 0) && roundedDuration > 0) {
          set({ isGeneratingAudio: true });
          try {
            musicBlob = (await renderMix({ ...project, scenes: timeByText(project.scenes).timed }, null)) ?? undefined;
          } catch (err: unknown) {
            set({ isGeneratingAudio: false });
            addToast(`Gagal membuat BGM audio: ${err instanceof Error ? err.message : String(err)}`, 'error');
            return;
          }
        }

        const latest = get().project;
        if (latest.id !== startedProjectId) {
          set({ isGeneratingAudio: false });
          addToast('Project berganti, hasil audio dibuang.', 'warning');
          return;
        }
        // Retimed from the latest scenes, so edits made while the music rendered are kept.
        const { timed, total } = timeByText(latest.scenes);
        mixJobSeq++;
        const finalProject = syncComposition({
          ...latest,
          scenes: timed,
          audioBlob: musicBlob,
          audioDuration: musicBlob ? roundedDuration : total
        });

        set({
          project: finalProject,
          isGeneratingAudio: false,
          audioBlobUrl: swapAudioUrl(musicBlob),
          audioStale: Boolean(musicBlob) && total !== roundedDuration,
          audioProgress: null,
          rawVoiceBlob: null,
          bgmOnlyAudio: Boolean(musicBlob),
          waveformPeaks: null
        });

        await saveProjectToDb(finalProject);
        await saveVoiceTrackToDb(finalProject.id, musicBlob ? { kind: 'bgm' } : null);
        await get().refreshCacheSize();
        if (musicBlob) {
          addToast(`Mode timer dengan BGM (${project.bgm.preset}): durasi ${roundedDuration}s.`, 'info');
        } else {
          addToast('Mode timer: durasi dihitung dari panjang teks (tanpa suara).', 'info');
        }
        return;
      }

      const controller = new AbortController();
      audioAbortController = controller;
      set({
        isGeneratingAudio: true,
        audioProgress: {
          currentScene: 0,
          totalScenes: project.scenes.length,
          sceneId: project.scenes[0]?.id || '',
          statusText: `Menyiapkan suara untuk ${project.scenes.length} adegan...`
        }
      });

      try {
        const result = await generateProjectAudioPerScene({
          project,
          settings,
          concurrency: 2,
          onProgress: (progress) => {
            if (!controller.signal.aborted) set({ audioProgress: progress });
          },
          signal: controller.signal
        });

        const bgmSettings = result.updatedProject.bgm;
        let finalAudioBlob = result.audioBlob;
        if (needsMix(result.updatedProject)) {
          set({
            audioProgress: {
              currentScene: result.updatedProject.scenes.length,
              totalScenes: result.updatedProject.scenes.length,
              sceneId: 'bgm',
              statusText: 'Mencampur musik dan efek suara…'
            }
          });
          finalAudioBlob = (await renderMix(result.updatedProject, result.audioBlob)) ?? result.audioBlob;
        }

        if (controller.signal.aborted) throw new DOMException('Audio generation cancelled', 'AbortError');

        const latest = get().project;
        if (latest.id !== startedProjectId) {
          set({ isGeneratingAudio: false, audioProgress: null });
          addToast('Project berganti, hasil audio dibuang.', 'warning');
          return;
        }

        const generatedById = new Map(
          result.updatedProject.scenes.map((s) => [s.id, { duration: s.durationInSeconds, words: s.wordTimestamps }])
        );
        let hasTextChangedDuringGen = false;
        const mergedScenes = latest.scenes.map((s) => {
          const initialText = startedSceneTexts.get(s.id);
          if (initialText !== undefined && (s.narrationText || s.text || '') !== initialText) {
            hasTextChangedDuringGen = true;
          }
          const generated = generatedById.get(s.id);
          return generated ? { ...s, durationInSeconds: generated.duration, wordTimestamps: generated.words } : s;
        });
        // Scenes added, removed or reordered meanwhile no longer line up with the rendered track.
        const sceneListChanged = !sameSceneOrder(startedScenes, latest.scenes);

        mixJobSeq++;
        const finalProject = syncComposition({
          ...latest,
          scenes: mergedScenes,
          audioBlob: finalAudioBlob,
          audioDuration: result.totalDuration
        });

        set({
          project: finalProject,
          isGeneratingAudio: false,
          audioBlobUrl: swapAudioUrl(finalAudioBlob),
          audioStale: hasTextChangedDuringGen || sceneListChanged,
          audioProgress: null,
          rawVoiceBlob: result.audioBlob,
          bgmOnlyAudio: false,
          waveformPeaks: null
        });

        await saveProjectToDb(finalProject);
        await saveVoiceTrackToDb(finalProject.id, { kind: 'voice', blob: result.audioBlob });
        await get().refreshCacheSize();

        const bgmLabel = hasMusic(bgmSettings) ? ` + BGM (${bgmSettings.preset})` : '';
        addToast(
          `Suara siap! (${result.totalDuration.toFixed(1)} detik, ${result.apiCallCount} disintesis, ${result.cacheHitCount} dari cache${bgmLabel})`,
          'success'
        );
      } catch (err: unknown) {
        const isAborted =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.message.toLowerCase().includes('cancel'));
        // A cancel already reset the state; a newer run may own it by now.
        if (audioAbortController === controller || !isAborted) {
          set({ isGeneratingAudio: false, audioProgress: null });
        }
        if (isAborted) {
          addToast('Pembuatan suara dibatalkan.', 'info');
        } else {
          const message = err instanceof Error ? err.message : String(err);
          addToast(`Gagal membuat suara: ${message}`, 'error');
        }
      } finally {
        if (audioAbortController === controller) audioAbortController = null;
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
      const { project, addToast } = get();
      mixJobSeq++;
      const updatedProject = syncComposition({
        ...project,
        audioBlob: undefined,
        audioDuration: 0,
        scenes: project.scenes.map((s) => ({ ...s, wordTimestamps: [] }))
      });
      set({
        project: updatedProject,
        audioBlobUrl: swapAudioUrl(undefined),
        rawVoiceBlob: null,
        bgmOnlyAudio: false,
        waveformPeaks: null,
        audioStale: false,
        audioProgress: null
      });
      await saveProjectToDb(updatedProject);
      await saveVoiceTrackToDb(updatedProject.id, null);
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

      const speakWithBrowser = (lang: string): boolean => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = lang;
        utterance.rate = Math.max(0.5, Math.min(2.0, settings.speed || 1.0));
        window.speechSynthesis.speak(utterance);
        return true;
      };

      // WebSpeech / Browser native speech support
      if (provider === 'fallback' || voice === 'fallback') {
        if (speakWithBrowser(sampleText.includes('deterministik') ? 'id-ID' : 'en-US')) {
          addToast('Memutar suara menggunakan WebSpeech browser.', 'info');
        } else {
          addToast('Browser ini tidak mendukung WebSpeech.', 'warning');
        }
        return;
      }

      try {
        let audioBlob: Blob;
        if (provider === 'local') {
          const targetVoiceId = voice || 'id_ID-news_tts';
          const cached = await isLocalModelCached(targetVoiceId);
          // Preview with the browser voice instead of downloading a large model unexpectedly.
          if (!cached && speakWithBrowser(targetVoiceId.startsWith('id_') ? 'id-ID' : 'en-US')) {
            addToast(
              'Model lokal belum diunduh. Memutar contoh dengan WebSpeech browser. Silakan klik Unduh Model untuk suara Piper offline.',
              'info'
            );
            return;
          }
          const res = await synthesizeLocalTTS({
            text: sampleText,
            voiceId: targetVoiceId,
            speed: settings.speed || 1.05,
            noiseScale: settings.piperNoiseScale,
            noiseW: settings.piperNoiseW
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
          if (!speakWithBrowser('en-US')) addToast('Penyedia suara tidak valid.', 'warning');
          return;
        }

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`Audisi gagal: ${msg}`, 'error');
      }
    },

    uploadCustomAudio: async (file: File) => {
      const { project, addToast } = get();
      if (!file || get().isGeneratingAudio) return;
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name);
      if (!isAudio) {
        addToast('Format berkas tidak didukung. Unggah berkas audio (MP3, WAV, M4A, OGG).', 'error');
        return;
      }

      const startedProjectId = project.id;
      const startedScenes = project.scenes;
      // The upload is cancelled the same way as a TTS run.
      const controller = new AbortController();
      audioAbortController = controller;
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

        // With an OpenAI key, use the recording's real timing (Whisper); otherwise, or if that fails,
        // distribute the total duration proportionally across scenes based on narration length.
        const sceneTexts = startedScenes.map((s) => s.narrationText || s.text || '');
        let whisperAligned: ReturnType<typeof alignScenesToTranscript> = null;
        const openaiKey = get().settings.apiKeys.openai?.trim();
        if (openaiKey && file.size <= WHISPER_MAX_BYTES && startedScenes.length > 0) {
          set({
            audioProgress: {
              currentScene: 0,
              totalScenes: startedScenes.length,
              sceneId: 'upload',
              statusText: 'Menyelaraskan naskah dengan suara (Whisper)...'
            }
          });
          try {
            const transcript = await transcribeWords({ apiKey: openaiKey, audio: file, fileName: file.name });
            whisperAligned = alignScenesToTranscript(sceneTexts, transcript, totalAudioDur);
          } catch (err) {
            console.warn('Whisper alignment failed, spreading the recording by narration length:', err);
          }
        }

        const rawWeights = sceneTexts.map((t) => Math.max(1, t.trim().length));
        const weightSum = rawWeights.reduce((a, b) => a + b, 0) || 1;
        let accumulated = 0;
        const timedScenes = startedScenes.map((s, idx) => {
          if (whisperAligned) return { ...s, ...whisperAligned[idx] };
          const isLast = idx === startedScenes.length - 1;
          const dur = isLast
            ? Math.max(0.5, Math.round((totalAudioDur - accumulated) * 100) / 100)
            : Math.max(0.5, Math.round(totalAudioDur * (rawWeights[idx] / weightSum) * 100) / 100);
          accumulated += dur;
          return { ...s, durationInSeconds: dur, wordTimestamps: computeDeterministicWordAlignment(sceneTexts[idx], dur) };
        });

        let finalAudioBlob: Blob = file;
        if (needsMix(project)) {
          finalAudioBlob = (await renderMix({ ...project, scenes: timedScenes }, voiceBuffer)) ?? file;
        }

        if (controller.signal.aborted) return;
        const latest = get().project;
        if (latest.id !== startedProjectId) {
          addToast('Project berganti, hasil audio dibuang.', 'warning');
          set({ isGeneratingAudio: false, audioProgress: null });
          return;
        }

        // Timing is computed for the scenes as they were; edits made meanwhile are kept.
        const timingById = new Map(timedScenes.map((s) => [s.id, s]));
        const mergedScenes = latest.scenes.map((s) => {
          const timed = timingById.get(s.id);
          return timed ? { ...s, durationInSeconds: timed.durationInSeconds, wordTimestamps: timed.wordTimestamps } : s;
        });

        mixJobSeq++;
        const finalProject = syncComposition({
          ...latest,
          scenes: mergedScenes,
          audioBlob: finalAudioBlob,
          audioDuration: totalAudioDur
        });

        set({
          project: finalProject,
          isGeneratingAudio: false,
          audioBlobUrl: swapAudioUrl(finalAudioBlob),
          audioStale: !sameSceneOrder(startedScenes, latest.scenes),
          audioProgress: null,
          rawVoiceBlob: file,
          bgmOnlyAudio: false,
          waveformPeaks: null
        });

        await saveProjectToDb(finalProject);
        await saveVoiceTrackToDb(finalProject.id, { kind: 'voice', blob: file });
        addToast(`Audio "${file.name}" (${totalAudioDur.toFixed(1)}s) berhasil diterapkan & disinkronkan!`, 'success');
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        set({ isGeneratingAudio: false, audioProgress: null });
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`Gagal memuat berkas audio: ${msg}`, 'error');
      } finally {
        if (audioAbortController === controller) audioAbortController = null;
      }
    },

    remixAudio: async () => {
      const { rawVoiceBlob, project, addToast } = get();
      if (!rawVoiceBlob) return;
      const seq = ++mixJobSeq;

      try {
        let finalAudioBlob: Blob = rawVoiceBlob;
        if (needsMix(project)) {
          finalAudioBlob = (await renderMix(project, rawVoiceBlob)) ?? rawVoiceBlob;
        }

        // A newer remix, another project or a new voice-over makes this result obsolete.
        const latest = get().project;
        if (seq !== mixJobSeq || latest.id !== project.id || get().rawVoiceBlob !== rawVoiceBlob) return;

        const updatedProject = { ...latest, audioBlob: finalAudioBlob };
        set({
          project: updatedProject,
          audioBlobUrl: swapAudioUrl(finalAudioBlob),
          bgmOnlyAudio: false,
          waveformPeaks: null
        });
        await saveProjectToDb(updatedProject);
        await saveVoiceTrackToDb(updatedProject.id, { kind: 'voice', blob: rawVoiceBlob });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`Gagal me-remix audio: ${msg}`, 'error');
      }
    },

    refreshMix: async () => {
      const { rawVoiceBlob, project, bgmOnlyAudio, audioStale, addToast } = get();
      if (get().isGeneratingAudio) return;
      if (rawVoiceBlob) return get().remixAudio();
      if (!project.audioBlob || bgmOnlyAudio) return get().generateBgmOnlyAudio();
      // An older track without its voice kept apart cannot be mixed again.
      if (!audioStale) addToast('Buat ulang suara supaya perubahan audio kedengaran.', 'info');
      set({ audioStale: true });
    },

    regenerateSceneVoice: async (sceneId) => {
      const { project, settings, addToast } = get();
      const scene = project.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      if (settings.selectedTTSProvider === 'fallback' || settings.selectedTTSProvider === 'timer') {
        addToast('Pilih penyedia suara (lokal, OpenAI atau ElevenLabs) untuk membuat suara.', 'info');
        return;
      }
      if (!(scene.narrationText || scene.text || '').trim()) {
        addToast('Adegan ini belum punya narasi.', 'info');
        return;
      }
      // Only this scene's take is dropped; the others come straight from the cache.
      await deleteCachedSceneAudio(sceneAudioCacheKey(scene, settings));
      await get().generateAudio();
    },

    generateBgmOnlyAudio: async () => {
      const { project, addToast } = get();
      const seq = ++mixJobSeq;

      if (!hasMusic(project.bgm) && !(project.sfxCues?.length ?? 0)) {
        // Music and sound effects off: a track without a voice has nothing left to play.
        if (get().bgmOnlyAudio && project.audioBlob) {
          const cleared = { ...project, audioBlob: undefined };
          set({ project: cleared, audioBlobUrl: swapAudioUrl(undefined), bgmOnlyAudio: false, waveformPeaks: null });
          await saveProjectToDb(cleared);
          await saveVoiceTrackToDb(cleared.id, null);
        }
        return;
      }
      if (project.scenes.length === 0) return;

      const totalDuration = Math.round(getProjectDuration(project) * 100) / 100;

      try {
        const bgmBlob = await renderMix(project, null);
        if (!bgmBlob) return;

        const latest = get().project;
        if (seq !== mixJobSeq || latest.id !== project.id || get().rawVoiceBlob) return;

        const updatedProject = { ...latest, audioBlob: bgmBlob, audioDuration: totalDuration };
        set({
          project: updatedProject,
          audioBlobUrl: swapAudioUrl(bgmBlob),
          audioStale: false,
          bgmOnlyAudio: true,
          waveformPeaks: null
        });
        await saveProjectToDb(updatedProject);
        await saveVoiceTrackToDb(updatedProject.id, { kind: 'bgm' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`Gagal membuat BGM audio: ${msg}`, 'error');
      }
    }
  };
};
