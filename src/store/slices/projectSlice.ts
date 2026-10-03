import type { StateCreator } from 'zustand';
import type { MooProject, Scene, CaptionStyle, CaptionPosition } from '../../types';
import { cleanWord } from '../../utils/textUtils';
import {
  saveProjectToDb,
  loadProjectFromDb,
  listProjectsFromDb,
  deleteProjectFromDb
} from '../../db/mooDb';
import { computeDeterministicWordAlignment, calculateFallbackSceneDuration } from '../../engine/ai/tts';
import type { MooStoreState, ProjectSlice } from '../types';

export const DEFAULT_PROJECT_ID = 'moo-default-project';

export const INITIAL_PROJECT: MooProject = {
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
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center'
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
  audioDuration: 10.0,
  bgm: {
    preset: 'none',
    level: 0.18,
    duckRatio: 0.15
  }
};


// Debounced Persistence & Lifecycle Handlers
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProjectToSave: MooProject | null = null;
let toastErrorCallback: ((msg: string) => void) | null = null;

export async function flushPendingSave(): Promise<void> {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingProjectToSave) {
    const p = pendingProjectToSave;
    pendingProjectToSave = null;
    try {
      await saveProjectToDb(p);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (toastErrorCallback) {
        toastErrorCallback(`Failed to save project to storage: ${msg}`);
      }
    }
  }
}

export function scheduleSave(project: MooProject, onError?: (msg: string) => void): void {
  pendingProjectToSave = project;
  if (onError) {
    toastErrorCallback = onError;
  }
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushPendingSave();
  }, 500);
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSave();
    }
  });
  window.addEventListener('pagehide', () => {
    flushPendingSave();
  });
}

export const createProjectSlice: StateCreator<MooStoreState, [], [], ProjectSlice> = (set, get) => {
  const triggerSave = (project: MooProject) => {
    scheduleSave(project, (msg) => get().addToast(msg, 'error'));
  };

  return {
    project: INITIAL_PROJECT,
    projectsList: [INITIAL_PROJECT],

    setProject: (project) => {
      set({ project, audioStale: false });
      triggerSave(project);
    },

    refreshProjectsList: async () => {
      const list = await listProjectsFromDb();
      if (list.length > 0) {
        set({ projectsList: list });
      } else {
        set({ projectsList: [get().project] });
      }
    },

    createNewProject: async (title?: string) => {
      await flushPendingSave();
      const now = Date.now();
      const newId = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const existingCount = get().projectsList.length;
      const newProject: MooProject = {
        id: newId,
        title: title || `Untitled Project #${existingCount + 1}`,
        aspectRatio: '9:16',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#131315',
          textPrimary: '#f4f4f5',
          textHighlight: '#84cc16',
          fontFamily: 'Jakarta',
          captionStyle: 'boxed',
          captionPosition: 'center'
        },
        scenes: [
          {
            id: `sc-1-${now}`,
            text: 'New scene script text goes here.',
            focusWords: [],
            motionPreset: 'punch_zoom',
            durationInSeconds: 3.0,
            wordTimestamps: []
          }
        ],
        audioDuration: 3.0,
        bgm: {
          preset: 'none',
          level: 0.18,
          duckRatio: 0.15
        },
        createdAt: now,
        updatedAt: now
      };

      await saveProjectToDb(newProject);

      const oldUrl = get().audioBlobUrl;
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }

      set({
        project: newProject,
        audioBlobUrl: null,
        audioStale: false,
        currentFrame: 0,
        isPlaying: false
      });

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('mooscript_active_project_id', newId);
        }
      } catch {
        // ignore localStorage errors in private browsing
      }

      await get().refreshProjectsList();
      get().addToast(`Created "${newProject.title}"`, 'success');
      return newId;
    },

    switchProject: async (id: string) => {
      if (get().project.id === id) return;
      await flushPendingSave();

      const target = await loadProjectFromDb(id);
      if (!target) {
        get().addToast('Project not found in storage', 'error');
        return;
      }

      if (!target.theme?.captionStyle || !target.theme?.captionPosition) {
        target.theme = {
          ...target.theme,
          captionStyle: target.theme?.captionStyle || 'boxed',
          captionPosition: target.theme?.captionPosition || 'center'
        };
      }
      if (!target.bgm) {
        target.bgm = { preset: 'none', level: 0.18, duckRatio: 0.15 };
      }

      const oldUrl = get().audioBlobUrl;
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }

      let newBlobUrl: string | null = null;
      if (target.audioBlob) {
        newBlobUrl = URL.createObjectURL(target.audioBlob);
      }

      set({
        project: target,
        audioBlobUrl: newBlobUrl,
        audioStale: false,
        currentFrame: 0,
        isPlaying: false
      });

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('mooscript_active_project_id', id);
        }
      } catch {
        // ignore
      }

      await get().refreshProjectsList();
      get().addToast(`Switched to "${target.title}"`, 'info');
    },

    duplicateProject: async (id: string) => {
      await flushPendingSave();
      const source = id === get().project.id ? get().project : await loadProjectFromDb(id);
      if (!source) {
        get().addToast('Project to duplicate not found', 'error');
        return '';
      }

      const now = Date.now();
      const dupId = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const duplicated: MooProject = {
        ...JSON.parse(JSON.stringify({ ...source, audioBlob: undefined })),
        id: dupId,
        title: `${source.title} (Copy)`,
        createdAt: now,
        updatedAt: now
      };

      if (source.audioBlob) {
        duplicated.audioBlob = source.audioBlob;
      }

      await saveProjectToDb(duplicated);
      await get().refreshProjectsList();
      get().addToast(`Duplicated as "${duplicated.title}"`, 'success');
      return dupId;
    },

    deleteProject: async (id: string) => {
      await flushPendingSave();
      const list = get().projectsList;
      if (list.length <= 1) {
        get().addToast('Cannot delete the last remaining project.', 'warning');
        return;
      }

      await deleteProjectFromDb(id);

      if (get().project.id === id) {
        const remaining = list.filter((p) => p.id !== id);
        const nextProj = remaining[0];
        await get().switchProject(nextProj.id);
      } else {
        await get().refreshProjectsList();
      }

      get().addToast('Project deleted', 'info');
    },

    updateTitle: (title) => {
      const updated = { ...get().project, title };
      const updatedList = get().projectsList.map((p) =>
        p.id === updated.id ? { ...p, title } : p
      );
      set({ project: updated, projectsList: updatedList });
      triggerSave(updated);
    },

    updateThemeFont: (fontFamily) => {
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, fontFamily }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeHighlight: (textHighlight) => {
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, textHighlight }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeBg: (bg) => {
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, bg }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeCaptionStyle: (captionStyle: CaptionStyle) => {
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, captionStyle }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeCaptionPosition: (captionPosition: CaptionPosition) => {
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, captionPosition }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateSceneText: (id, text) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      const updatedScenes = current.scenes.map((s) => {
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
      const updated: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    toggleWordFocus: (sceneId, word) => {
      const cleanTarget = cleanWord(word);
      const updatedScenes = get().project.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const current = s.focusWords || [];
        const has = current.some((fw) => cleanWord(fw) === cleanTarget);
        const nextFocus = has ? current.filter((fw) => cleanWord(fw) !== cleanTarget) : [...current, word];
        return { ...s, focusWords: nextFocus };
      });
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    setSceneMotionPreset: (sceneId, motionPreset) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, motionPreset } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    setSceneTransition: (sceneId, transition) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, transition } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    setSceneIcon: (sceneId, icon) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, icon } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    setSceneDuration: (sceneId, durationInSeconds) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          durationInSeconds,
          wordTimestamps: computeDeterministicWordAlignment(s.text, durationInSeconds)
        };
      });
      const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updated: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    addScene: () => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
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
      const updatedScenes = [...current.scenes, newScene];
      const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updated: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    removeScene: (id) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      const updatedScenes = current.scenes.filter((s) => s.id !== id);
      const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updated: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    duplicateScene: (id: string) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      const idx = current.scenes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const source = current.scenes[idx];
      const newScene: Scene = {
        ...source,
        id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        focusWords: [...(source.focusWords || [])],
        wordTimestamps: source.wordTimestamps ? source.wordTimestamps.map((w) => ({ ...w })) : []
      };
      const list = [...current.scenes];
      list.splice(idx + 1, 0, newScene);
      const totalDur = list.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updated: MooProject = {
        ...current,
        scenes: list,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    reorderScenes: (fromIndex, toIndex) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      const list = [...current.scenes];
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      const updated: MooProject = { ...current, scenes: list };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    }
  };
};
