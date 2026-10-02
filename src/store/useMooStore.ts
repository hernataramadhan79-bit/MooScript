import { create } from 'zustand';
import type { MooProject, Scene, PersonaSkill, EngineSettings, MotionPreset } from '../types';
import { db, saveProjectToDb, loadProjectFromDb, getCacheSize, clearAllCache } from '../db/mooDb';
import { BUILTIN_SKILLS, getAllSkills, initializeSkills } from '../engine/skills/skillManager';
import { generateStoryboard } from '../engine/ai/llm';
import {
  generateOpenAITTS,
  generateElevenLabsTTS,
  generateSyntheticAmbientAudio,
  computeDeterministicWordAlignment,
  calculateFallbackSceneDuration
} from '../engine/ai/tts';
import { exportMooProjectToMP4, type ExportProgress, type ExportResult } from '../engine/export/mp4Exporter';

const DEFAULT_PROJECT_ID = 'moo-default-project';

const INITIAL_PROJECT: MooProject = {
  id: DEFAULT_PROJECT_ID,
  title: 'WebCodecs Architecture',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#131315',
    textPrimary: '#f4f4f5',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta'
  },
  scenes: [
    {
      id: 'sc-1',
      text: 'Zero server rendering directly inside your browser tabs',
      focusWords: ['zero', 'server', 'browser'],
      motionPreset: 'punch_zoom',
      icon: 'mascot',
      durationInSeconds: 3.2,
      wordTimestamps: [
        { word: 'Zero', start: 0.0, end: 0.4 },
        { word: 'server', start: 0.4, end: 0.9 },
        { word: 'rendering', start: 0.9, end: 1.5 },
        { word: 'directly', start: 1.5, end: 2.0 },
        { word: 'inside', start: 2.0, end: 2.4 },
        { word: 'your', start: 2.4, end: 2.6 },
        { word: 'browser', start: 2.6, end: 3.0 },
        { word: 'tabs', start: 3.0, end: 3.2 }
      ]
    },
    {
      id: 'sc-2',
      text: 'WebCodecs Hardware acceleration with deterministic canvas math',
      focusWords: ['webcodecs', 'hardware', 'deterministic'],
      motionPreset: 'slide_split',
      icon: 'zap',
      durationInSeconds: 3.6,
      wordTimestamps: [
        { word: 'WebCodecs', start: 0.0, end: 0.6 },
        { word: 'Hardware', start: 0.6, end: 1.2 },
        { word: 'acceleration', start: 1.2, end: 1.9 },
        { word: 'with', start: 1.9, end: 2.2 },
        { word: 'deterministic', start: 2.2, end: 2.9 },
        { word: 'canvas', start: 2.9, end: 3.3 },
        { word: 'math', start: 3.3, end: 3.6 }
      ]
    },
    {
      id: 'sc-3',
      text: 'Instant 1080p MP4 exports with zero memory leaks',
      focusWords: ['1080p', 'mp4', 'instant'],
      motionPreset: 'kinetic_shake',
      icon: 'sparkles',
      durationInSeconds: 3.2,
      wordTimestamps: [
        { word: 'Instant', start: 0.0, end: 0.5 },
        { word: '1080p', start: 0.5, end: 1.1 },
        { word: 'MP4', start: 1.1, end: 1.6 },
        { word: 'exports', start: 1.6, end: 2.1 },
        { word: 'with', start: 2.1, end: 2.4 },
        { word: 'zero', start: 2.4, end: 2.7 },
        { word: 'memory', start: 2.7, end: 3.0 },
        { word: 'leaks', start: 3.0, end: 3.2 }
      ]
    }
  ],
  audioDuration: 10.0
};

const DEFAULT_SETTINGS: EngineSettings = {
  apiKeys: {
    gemini: '',
    openai: '',
    groq: '',
    elevenlabs: ''
  },
  selectedLLMProvider: 'gemini',
  selectedTTSProvider: 'fallback',
  geminiModel: 'gemini-2.0-flash',
  openaiModel: 'gpt-4o-mini',
  groqModel: 'llama-3.3-70b-versatile',
  voiceId: 'alloy',
  speed: 1.05,
  stability: 85,
  duckingDb: -12,
  fps: 30
};

export interface MooStoreState {
  // Navigation
  activeTab: 'script' | 'voice' | 'studio' | 'settings';
  setActiveTab: (tab: 'script' | 'voice' | 'studio' | 'settings') => void;

  // Project state
  project: MooProject;
  setProject: (project: MooProject) => void;
  updateTitle: (title: string) => void;
  updateThemeFont: (font: 'Jakarta' | 'Mono' | 'Impact') => void;
  updateThemeHighlight: (color: string) => void;
  updateThemeBg: (color: string) => void;

  // Scenes
  updateSceneText: (id: string, text: string) => void;
  toggleWordFocus: (sceneId: string, word: string) => void;
  setSceneMotionPreset: (sceneId: string, preset: MotionPreset) => void;
  setSceneIcon: (sceneId: string, icon: string) => void;
  setSceneDuration: (sceneId: string, duration: number) => void;
  addScene: () => void;
  removeScene: (id: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;

  // Settings & BYOK
  settings: EngineSettings;
  updateSettings: (newSettings: Partial<EngineSettings>) => Promise<void>;
  updateApiKey: (provider: keyof EngineSettings['apiKeys'], key: string) => Promise<void>;

  // Skills
  skills: PersonaSkill[];
  activeSkillId: string;
  setActiveSkillId: (id: string) => void;
  refreshSkills: () => Promise<void>;

  // AI Script Generation
  isGeneratingScript: boolean;
  scriptPrompt: string;
  setScriptPrompt: (p: string) => void;
  generateScript: () => Promise<void>;

  // Voice & Audio
  isGeneratingAudio: boolean;
  audioBlobUrl: string | null;
  generateAudio: () => Promise<void>;
  auditionVoice: (voiceId: string) => Promise<void>;

  // Playback Clock (for Studio Canvas preview)
  currentFrame: number;
  isPlaying: boolean;
  seekFrame: (frame: number) => void;
  seekTime: (timeSec: number) => void;
  togglePlay: () => void;
  pause: () => void;
  play: () => void;

  // Export
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportResult: ExportResult | null;
  startExport: () => Promise<void>;
  cancelExport: () => void;

  // Cache & DB
  cacheSizeBytes: number;
  refreshCacheSize: () => Promise<void>;
  clearCache: () => Promise<void>;
  initStore: () => Promise<void>;
}

let exportAbortController: AbortController | null = null;
let playbackAudioElement: HTMLAudioElement | null = null;

export const useMooStore = create<MooStoreState>((set, get) => ({
  activeTab: 'script',
  setActiveTab: (activeTab) => set({ activeTab }),

  project: INITIAL_PROJECT,
  setProject: (project) => {
    set({ project });
    saveProjectToDb(project);
  },

  updateTitle: (title) => {
    const updated = { ...get().project, title };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  updateThemeFont: (fontFamily) => {
    const updated = {
      ...get().project,
      theme: { ...get().project.theme, fontFamily }
    };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  updateThemeHighlight: (textHighlight) => {
    const updated = {
      ...get().project,
      theme: { ...get().project.theme, textHighlight }
    };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  updateThemeBg: (bg) => {
    const updated = {
      ...get().project,
      theme: { ...get().project.theme, bg }
    };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  updateSceneText: (id, text) => {
    const updatedScenes = get().project.scenes.map((s) => {
      if (s.id !== id) return s;
      const readingDuration = calculateFallbackSceneDuration(text);
      const alignedWords = computeDeterministicWordAlignment(text, readingDuration);
      return {
        ...s,
        text,
        durationInSeconds: readingDuration,
        wordTimestamps: alignedWords
      };
    });

    const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
    const updated = { ...get().project, scenes: updatedScenes, audioDuration: totalDur };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  toggleWordFocus: (sceneId, word) => {
    const cleanTarget = word.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const updatedScenes = get().project.scenes.map((s) => {
      if (s.id !== sceneId) return s;
      const current = s.focusWords || [];
      const has = current.some((fw) => fw.toLowerCase().replace(/[^a-z0-9]/gi, '') === cleanTarget);
      const nextFocus = has
        ? current.filter((fw) => fw.toLowerCase().replace(/[^a-z0-9]/gi, '') !== cleanTarget)
        : [...current, word];
      return { ...s, focusWords: nextFocus };
    });
    const updated = { ...get().project, scenes: updatedScenes };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  setSceneMotionPreset: (sceneId, motionPreset) => {
    const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, motionPreset } : s));
    const updated = { ...get().project, scenes: updatedScenes };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  setSceneIcon: (sceneId, icon) => {
    const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, icon } : s));
    const updated = { ...get().project, scenes: updatedScenes };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  setSceneDuration: (sceneId, durationInSeconds) => {
    const updatedScenes = get().project.scenes.map((s) => {
      if (s.id !== sceneId) return s;
      return {
        ...s,
        durationInSeconds,
        wordTimestamps: computeDeterministicWordAlignment(s.text, durationInSeconds)
      };
    });
    const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
    const updated = { ...get().project, scenes: updatedScenes, audioDuration: totalDur };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  addScene: () => {
    const newId = `sc-${Date.now()}`;
    const defaultText = 'New kinetic visual scene';
    const dur = calculateFallbackSceneDuration(defaultText);
    const newScene: Scene = {
      id: newId,
      text: defaultText,
      focusWords: ['kinetic', 'scene'],
      motionPreset: 'punch_zoom',
      icon: 'sparkles',
      durationInSeconds: dur,
      wordTimestamps: computeDeterministicWordAlignment(defaultText, dur)
    };
    const updatedScenes = [...get().project.scenes, newScene];
    const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
    const updated = { ...get().project, scenes: updatedScenes, audioDuration: totalDur };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  removeScene: (id) => {
    const updatedScenes = get().project.scenes.filter((s) => s.id !== id);
    const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
    const updated = { ...get().project, scenes: updatedScenes, audioDuration: totalDur };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  reorderScenes: (fromIndex, toIndex) => {
    const list = [...get().project.scenes];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    const updated = { ...get().project, scenes: list };
    set({ project: updated });
    saveProjectToDb(updated);
  },

  settings: DEFAULT_SETTINGS,
  updateSettings: async (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    set({ settings: merged });
    await db.settings.put({ id: 'current', data: merged });
  },

  updateApiKey: async (provider, key) => {
    const updatedKeys = { ...get().settings.apiKeys, [provider]: key };
    const merged = { ...get().settings, apiKeys: updatedKeys };
    set({ settings: merged });
    await db.settings.put({ id: 'current', data: merged });
  },

  skills: BUILTIN_SKILLS,
  activeSkillId: BUILTIN_SKILLS[0].id,
  setActiveSkillId: (activeSkillId) => set({ activeSkillId }),
  refreshSkills: async () => {
    const all = await getAllSkills();
    set({ skills: all });
  },

  isGeneratingScript: false,
  scriptPrompt: 'How zero-server motion graphics compiles MP4 videos in the browser using WebCodecs',
  setScriptPrompt: (scriptPrompt) => set({ scriptPrompt }),

  generateScript: async () => {
    const { settings, scriptPrompt, skills, activeSkillId } = get();
    const activeSkill = skills.find((s) => s.id === activeSkillId) || skills[0];
    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';

    set({ isGeneratingScript: true });

    try {
      const storyboard = await generateStoryboard({
        provider,
        apiKey,
        model:
          provider === 'gemini'
            ? settings.geminiModel
            : provider === 'openai'
            ? settings.openaiModel
            : settings.groqModel,
        prompt: scriptPrompt,
        skill: activeSkill
      });

      const newScenes: Scene[] = storyboard.scenes.map((s, idx) => {
        const dur = calculateFallbackSceneDuration(s.text);
        return {
          id: `sc-ai-${Date.now()}-${idx}`,
          text: s.text,
          focusWords: s.focusWords || [],
          motionPreset: s.motionPreset || 'punch_zoom',
          icon: s.icon || 'zap',
          durationInSeconds: dur,
          wordTimestamps: computeDeterministicWordAlignment(s.text, dur)
        };
      });

      const totalDur = newScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updatedProject: MooProject = {
        ...get().project,
        title: storyboard.title || get().project.title,
        scenes: newScenes,
        audioDuration: totalDur
      };

      set({ project: updatedProject, isGeneratingScript: false });
      await saveProjectToDb(updatedProject);
    } catch (err: unknown) {
      set({ isGeneratingScript: false });
      const message = err instanceof Error ? err.message : String(err);
      alert(`AI Script Generation failed: ${message}`);
    }
  },

  isGeneratingAudio: false,
  audioBlobUrl: null,

  generateAudio: async () => {
    const { settings, project } = get();
    const ttsProvider = settings.selectedTTSProvider;
    set({ isGeneratingAudio: true });

    try {
      const fullScript = project.scenes.map((s) => s.text).join('. ');
      let generatedBlob: Blob;
      let globalWordTimestamps: { word: string; start: number; end: number }[] = [];

      if (ttsProvider === 'openai') {
        const key = settings.apiKeys.openai;
        if (!key) throw new Error('OpenAI API Key is missing. Please configure it in Settings.');
        generatedBlob = await generateOpenAITTS({
          apiKey: key,
          text: fullScript,
          voice: settings.voiceId || 'alloy',
          speed: settings.speed || 1.05
        });
      } else if (ttsProvider === 'elevenlabs') {
        const key = settings.apiKeys.elevenlabs;
        if (!key) throw new Error('ElevenLabs API Key is missing. Please configure it in Settings.');
        const elevenResult = await generateElevenLabsTTS({
          apiKey: key,
          voiceId: settings.voiceId || '21m00Tcm4TlvDq8ikWAM',
          text: fullScript,
          stability: settings.stability
        });
        generatedBlob = elevenResult.audioBlob;
        globalWordTimestamps = elevenResult.wordTimestamps;
      } else {
        // Fallback / BGM Ambient Mode: Zero API keys needed!
        const totalEstimatedDuration = project.scenes.reduce(
          (acc, s) => acc + (s.durationInSeconds > 0 ? s.durationInSeconds : calculateFallbackSceneDuration(s.text)),
          0
        );
        generatedBlob = await generateSyntheticAmbientAudio(totalEstimatedDuration);
      }

      // Decode audio to extract exact duration
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await generatedBlob.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const exactDuration = decodedBuffer.duration;
      await audioCtx.close();

      // Distribute duration and word timestamps proportionally across scenes
      const totalTextLength = project.scenes.reduce((acc, s) => acc + s.text.length, 0);
      let timeOffset = 0;

      const updatedScenes = project.scenes.map((s) => {
        const proportion = totalTextLength > 0 ? s.text.length / totalTextLength : 1 / project.scenes.length;
        const sceneDur = Math.round(exactDuration * proportion * 100) / 100;

        // If ElevenLabs returned word timestamps, slice them, else use deterministic fallback
        let alignedWords = globalWordTimestamps.filter(
          (wt) => wt.start >= timeOffset && wt.start < timeOffset + sceneDur
        );
        if (alignedWords.length === 0) {
          alignedWords = computeDeterministicWordAlignment(s.text, sceneDur, 0);
        } else {
          // normalize relative to scene start
          alignedWords = alignedWords.map((w) => ({
            ...w,
            start: Math.max(0, w.start - timeOffset),
            end: Math.max(0, w.end - timeOffset)
          }));
        }

        timeOffset += sceneDur;
        return {
          ...s,
          durationInSeconds: sceneDur,
          wordTimestamps: alignedWords
        };
      });

      const updatedProject: MooProject = {
        ...project,
        scenes: updatedScenes,
        audioBlob: generatedBlob,
        audioDuration: exactDuration
      };

      const newBlobUrl = URL.createObjectURL(generatedBlob);
      if (get().audioBlobUrl) {
        URL.revokeObjectURL(get().audioBlobUrl!);
      }

      set({
        project: updatedProject,
        isGeneratingAudio: false,
        audioBlobUrl: newBlobUrl
      });

      await saveProjectToDb(updatedProject);
      await get().refreshCacheSize();
    } catch (err: unknown) {
      set({ isGeneratingAudio: false });
      const message = err instanceof Error ? err.message : String(err);
      alert(`Audio generation failed: ${message}`);
    }
  },

  auditionVoice: async (voiceName: string) => {
    // Generate a quick 2.5s sample audition audio
    try {
      const sample = await generateSyntheticAmbientAudio(2.5);
      const url = URL.createObjectURL(sample);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.warn('Audition error', e);
    }
  },

  // Playback Clock
  currentFrame: 0,
  isPlaying: false,

  seekFrame: (currentFrame) => {
    const fps = get().project.fps || 30;
    const totalDuration = get().project.audioDuration || 10;
    const maxFrames = Math.max(1, Math.round(totalDuration * fps));
    const clamped = Math.max(0, Math.min(currentFrame, maxFrames));
    set({ currentFrame: clamped });

    if (playbackAudioElement) {
      playbackAudioElement.currentTime = clamped / fps;
    }
  },

  seekTime: (timeSec) => {
    const fps = get().project.fps || 30;
    get().seekFrame(Math.round(timeSec * fps));
  },

  play: () => {
    if (get().isPlaying) return;
    set({ isPlaying: true });

    // Sync audio if available
    const blobUrl = get().audioBlobUrl;
    if (blobUrl) {
      if (!playbackAudioElement) {
        playbackAudioElement = new Audio(blobUrl);
      } else if (playbackAudioElement.src !== blobUrl) {
        playbackAudioElement.src = blobUrl;
      }
      playbackAudioElement.currentTime = get().currentFrame / (get().project.fps || 30);
      playbackAudioElement.play().catch((e) => console.warn('Audio play restricted', e));
    }

    let lastTimestamp = performance.now();
    const fps = get().project.fps || 30;

    const tick = (now: number) => {
      if (!get().isPlaying) return;

      const delta = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      const totalDuration = get().project.audioDuration || 10;
      const maxFrames = Math.round(totalDuration * fps);
      const nextFrame = get().currentFrame + Math.max(1, Math.round(delta * fps));

      if (nextFrame >= maxFrames) {
        set({ currentFrame: 0, isPlaying: false });
        if (playbackAudioElement) {
          playbackAudioElement.pause();
          playbackAudioElement.currentTime = 0;
        }
      } else {
        set({ currentFrame: nextFrame });
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  },

  pause: () => {
    set({ isPlaying: false });
    if (playbackAudioElement) {
      playbackAudioElement.pause();
    }
  },

  togglePlay: () => {
    if (get().isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  // WebCodecs MP4 Export
  isExporting: false,
  exportProgress: null,
  exportResult: null,

  startExport: async () => {
    get().pause();
    exportAbortController = new AbortController();
    set({ isExporting: true, exportProgress: { percent: 0, currentFrame: 0, totalFrames: 0, statusText: 'Starting export...' } });

    try {
      const result = await exportMooProjectToMP4(
        get().project,
        (progress) => set({ exportProgress: progress }),
        exportAbortController.signal
      );
      set({ isExporting: false, exportResult: result });
    } catch (err: unknown) {
      set({ isExporting: false });
      const message = err instanceof Error ? err.message : String(err);
      if (!exportAbortController?.signal.aborted) {
        alert(`MP4 Export failed: ${message}`);
      }
    } finally {
      exportAbortController = null;
    }
  },

  cancelExport: () => {
    if (exportAbortController) {
      exportAbortController.abort();
      exportAbortController = null;
    }
    set({ isExporting: false, exportProgress: null });
  },

  cacheSizeBytes: 0,
  refreshCacheSize: async () => {
    const size = await getCacheSize();
    set({ cacheSizeBytes: size });
  },

  clearCache: async () => {
    await clearAllCache();
    await get().refreshCacheSize();
  },

  initStore: async () => {
    await initializeSkills();
    const skills = await getAllSkills();

    // Load persisted settings
    const storedSettings = await db.settings.get('current');
    const settings = storedSettings ? { ...DEFAULT_SETTINGS, ...storedSettings.data } : DEFAULT_SETTINGS;

    // Load persisted project if any
    const storedProject = await loadProjectFromDb(DEFAULT_PROJECT_ID);
    const project = storedProject || INITIAL_PROJECT;

    let blobUrl: string | null = null;
    if (project.audioBlob) {
      blobUrl = URL.createObjectURL(project.audioBlob);
    }

    const cacheSize = await getCacheSize();

    set({
      skills,
      settings,
      project,
      audioBlobUrl: blobUrl,
      cacheSizeBytes: cacheSize
    });
  }
}));
