import type { StateCreator } from 'zustand';
import type { MooProject, Scene, CaptionStyle, CaptionPosition, SubtitleCustomization, CameraMovement, AspectRatio, Composition, SceneModule, LayerOverride, ScenePalette, ThemeTokens, MotionNode, SceneAssetAttachment } from '../../types';
import { CURRENT_SCHEMA_VERSION, BUILTIN_THEMES, migrateLegacyScene } from '../../types';
import { cleanWord } from '../../utils/textUtils';
import {
  saveProjectToDb,
  loadProjectFromDb,
  listProjectsFromDb,
  deleteProjectFromDb,
  saveAssetToDb,
  listAssetsFromDb,
  loadBgmFromDb,
  saveBgmToDb,
  db
} from '../../db/mooDb';
import { syncCustomBgmForProject } from '../../db/customBgm';
import { getProjectTemplate } from '../../engine/templates/projectTemplates';
import { computeDeterministicWordAlignment, calculateFallbackSceneDuration } from '../../engine/ai/tts';
import { stopPlaybackAudio } from './playbackSlice';
import { applySize, syncComposition } from '../../engine/composition/sync';
import {
  compileProceduralScene,
  compileProceduralProject,
  type ProceduralArchetype
} from '../../engine/composition/proceduralCompiler';
import type { MooStoreState, ProjectSlice } from '../types';

export const DEFAULT_PROJECT_ID = 'moo-default-project';

export const DEFAULT_COMPOSITION: Composition = {
  id: 'comp-default',
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 0,
  globalCss: '',
  scenes: [],
  createdAt: 1700000000000
};

/** A brand-new install starts with an empty project: no script, no scenes, no generated code. */
export const INITIAL_PROJECT: MooProject = {
  id: DEFAULT_PROJECT_ID,
  title: 'Proyek Tanpa Judul',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  aspectRatio: '9:16',
  resolution: '1080p',
  renderMode: 'composition',
  fps: 30,
  width: 1080,
  height: 1920,
  composition: DEFAULT_COMPOSITION,
  theme: {
    bg: '#09090b',
    textPrimary: '#f4f4f5',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center',
    showSubtitles: false
  },
  scenes: [],
  audioDuration: 0,
  bgm: {
    preset: 'none',
    level: 0.18,
    duckRatio: 0.15
  },
  themeTokens: BUILTIN_THEMES[0]
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

function updateNodeInTree(nodes: MotionNode[], nodeId: string, update: Partial<MotionNode>): MotionNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        ...update,
        transform: update.transform ? { ...node.transform, ...update.transform } : node.transform,
        style: update.style ? { ...node.style, ...update.style } : node.style,
        animation: update.animation ? { ...node.animation, ...update.animation } : node.animation,
        extraProps: update.extraProps ? { ...node.extraProps, ...update.extraProps } : node.extraProps,
        children: update.children !== undefined ? update.children : node.children
      };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeId, update)
      };
    }
    return node;
  });
}

let historyPast: MooProject[] = [];
let historyFuture: MooProject[] = [];
const MAX_HISTORY = 30;

function snapshotProject(project: MooProject): MooProject {
  const { audioBlob: _blob, ...rest } = project;
  return JSON.parse(JSON.stringify(rest));
}

export const createProjectSlice: StateCreator<MooStoreState, [], [], ProjectSlice> = (set, get) => {
  const triggerSave = (project: MooProject) => {
    scheduleSave(project, (msg) => get().addToast(msg, 'error'));
  };
  const pushSnapshot = (project: MooProject) => {
    historyPast.push(snapshotProject(project));
    if (historyPast.length > MAX_HISTORY) {
      historyPast.shift();
    }
    historyFuture = [];
    set({ canUndo: true, canRedo: false });
  };

  const clearHistory = () => {
    historyPast = [];
    historyFuture = [];
    set({ canUndo: false, canRedo: false });
  };


  return {
    project: INITIAL_PROJECT,
    projectsList: [INITIAL_PROJECT],
    canUndo: false,
    canRedo: false,

    undo: () => {
      if (historyPast.length === 0) return;
      const current = get().project;
      const prev = historyPast.pop();
      if (!prev) return;
      historyFuture.push(snapshotProject(current));
      const restored: MooProject = {
        ...prev,
        audioBlob: current.audioBlob
      };
      set({
        project: restored,
        canUndo: historyPast.length > 0,
        canRedo: true
      });
      triggerSave(restored);
      get().addToast('Perubahan dibatalkan (Undo)', 'info');
    },

    redo: () => {
      if (historyFuture.length === 0) return;
      const current = get().project;
      const next = historyFuture.pop();
      if (!next) return;
      historyPast.push(snapshotProject(current));
      const restored: MooProject = {
        ...next,
        audioBlob: current.audioBlob
      };
      set({
        project: restored,
        canUndo: true,
        canRedo: historyFuture.length > 0
      });
      triggerSave(restored);
      get().addToast('Perubahan dikembalikan (Redo)', 'info');
    },


    setProject: (project, options) => {
      if (options?.preserveHistory) {
        pushSnapshot(get().project);
      } else {
        clearHistory();
      }
      set({
        project,
        audioStale: options?.keepStale ? get().audioStale : false
      });
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
      get().pause();
      stopPlaybackAudio();
      await flushPendingSave();
      clearHistory();
      const now = Date.now();
      const newId = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const existingCount = get().projectsList.length;
      const newProject: MooProject = {
        id: newId,
        title: title || `Proyek Tanpa Judul #${existingCount + 1}`,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        aspectRatio: '9:16',
        renderMode: 'composition',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#09090b',
          textPrimary: '#f4f4f5',
          textHighlight: '#84cc16',
          fontFamily: 'Jakarta',
          captionStyle: 'boxed',
          captionPosition: 'center',
          showSubtitles: false
        },
        // A new project starts empty: the user writes or generates the script first.
        scenes: [],
        themeTokens: BUILTIN_THEMES[0],
        audioDuration: 0,
        bgm: {
          preset: 'none',
          level: 0.18,
          duckRatio: 0.15
        },
        createdAt: now,
        updatedAt: now
      };
      const syncedProject = syncComposition(newProject);

      await saveProjectToDb(syncedProject);

      const oldUrl = get().audioBlobUrl;
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }

      set({
        project: syncedProject,
        audioBlobUrl: null,
        audioStale: false,
        currentFrame: 0,
        isPlaying: false,
        previousScenesSnapshot: null,
        activeSceneId: null,
        assets: []
      });
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('mooscript_active_project_id', newId);
        }
      } catch {
        // ignore localStorage errors in private browsing
      }

      await syncCustomBgmForProject(newId);
      await get().refreshProjectsList();
      get().addToast(`Created "${syncedProject.title}"`, 'success');
      return newId;
    },

    createProjectFromTemplate: async (templateId: string) => {
      const template = getProjectTemplate(templateId);
      if (!template) {
        get().addToast('Template tidak ditemukan.', 'error');
        return '';
      }
      const newId = await get().createNewProject(template.title);
      const base = get().project;
      const now = Date.now();
      const scenes: Scene[] = template.scenes.map((t, i) => {
        const dur = calculateFallbackSceneDuration(t.narration);
        return {
          id: `sc-${now}-${i}`,
          narrationText: t.narration,
          text: t.narration,
          visualIntent: t.visualIntent,
          visualConcept: t.visualIntent,
          visualElements: ['headline', 'supporting-detail'],
          focusWords: t.focusWords,
          motionPreset: 'punch_zoom',
          camera: 'push_in',
          icon: 'sparkles',
          durationInSeconds: dur,
          wordTimestamps: computeDeterministicWordAlignment(t.narration, dur),
          showSubtitles: false
        };
      });
      const totalDur = scenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const sized = applySize({ ...base, scenes, audioDuration: totalDur }, template.aspectRatio, '1080p');
      const updated = syncComposition(sized);
      clearHistory();
      set({ project: updated, activeSceneId: null });
      await saveProjectToDb(updated);
      await get().refreshProjectsList();
      // Give every scene a ready-made visual right away; no API key needed.
      get().compileAllScenesProcedural();
      return newId;
    },

    switchProject: async (id: string) => {
      get().pause();
      stopPlaybackAudio();
      await flushPendingSave();

      clearHistory();
      let target = await loadProjectFromDb(id);
      if (!target) {
        get().addToast('Project not found in storage', 'error');
        return;
      }

      if (!target.composition) {
        target = syncComposition(target);
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
        isPlaying: false,
        previousScenesSnapshot: null,
        activeSceneId: null
      });

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('mooscript_active_project_id', id);
        }
      } catch {
        // ignore
      }

      await get().refreshProjectsList();
      await get().loadAssets(target.id);
      await syncCustomBgmForProject(target.id);
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
      try {
        const sourceAssets = await listAssetsFromDb(source.id);
        for (const ast of sourceAssets) {
          const newAstId = `asset-${now}-${Math.random().toString(36).slice(2, 7)}`;
          await saveAssetToDb({
            ...ast,
            id: newAstId,
            projectId: dupId,
            createdAt: now
          });
        }
      } catch (err) {
        console.error('Failed to duplicate project assets:', err);
      }
      const sourceBgm = await loadBgmFromDb(source.id);
      if (sourceBgm) {
        await saveBgmToDb(dupId, sourceBgm.blob, sourceBgm.name);
      }
      await get().refreshProjectsList();
      get().addToast(`Duplicated as "${duplicated.title}"`, 'success');
      return dupId;
    },

    importProject: async (project: MooProject) => {
      await flushPendingSave();
      const now = Date.now();
      const id = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const imported: MooProject = { ...project, id, createdAt: now, updatedAt: now, audioBlob: undefined };
      // Backups never carry audio, so an uploaded BGM track does not survive the trip.
      const lostCustomBgm = imported.bgm?.preset === 'custom';
      if (lostCustomBgm) {
        const { customName: _lost, ...restBgm } = imported.bgm;
        imported.bgm = { ...restBgm, preset: 'none' };
      }
      await saveProjectToDb(imported);
      await get().refreshProjectsList();
      get().addToast(`Diimpor sebagai "${imported.title}"`, 'success');
      if (lostCustomBgm) {
        get().addToast('Musik sendiri tidak ikut dalam cadangan. Unggah ulang di tab Audio.', 'info', 6000);
      }
      return id;
    },

    deleteProject: async (id: string) => {
      get().pause();
      stopPlaybackAudio();
      await flushPendingSave();
      const list = get().projectsList;
      if (list.length <= 1) {
        get().addToast('Cannot delete the last remaining project.', 'warning');
        return;
      }
      await deleteProjectFromDb(id);
      try {
        await db.assets.where('projectId').equals(id).delete();
      } catch (err) {
        console.error('Failed to cleanup project assets:', err);
      }

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

    renameProject: async (id: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      const now = Date.now();
      const current = get().project;
      if (current.id === id) {
        let audioBlob = current.audioBlob;
        if (!audioBlob) {
          const fromDb = await db.audioBlobs.get(id);
          if (fromDb?.blob) {
            audioBlob = fromDb.blob;
          }
        }
        const updated = { ...current, title: trimmed, audioBlob, updatedAt: now };
        const updatedList = get().projectsList.map((p) =>
          p.id === id ? { ...p, title: trimmed, updatedAt: now } : p
        );
        set({ project: updated, projectsList: updatedList });
        await saveProjectToDb(updated);
      } else {
        const updatedList = get().projectsList.map((p) =>
          p.id === id ? { ...p, title: trimmed, updatedAt: now } : p
        );
        set({ projectsList: updatedList });
        const target = await loadProjectFromDb(id);
        if (target) {
          target.title = trimmed;
          target.updatedAt = now;
          await saveProjectToDb(target);
        }
      }
    },

    updateThemeFont: (fontFamily) => {
      pushSnapshot(get().project);
      const updated = syncComposition({
        ...get().project,
        theme: { ...get().project.theme, fontFamily }
      });
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeHighlight: (textHighlight) => {
      pushSnapshot(get().project);
      const updated = syncComposition({
        ...get().project,
        theme: { ...get().project.theme, textHighlight }
      });
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeBg: (bg) => {
      pushSnapshot(get().project);
      const updated = syncComposition({
        ...get().project,
        theme: { ...get().project.theme, bg }
      });
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemePrimary: (textPrimary) => {
      pushSnapshot(get().project);
      const updated = syncComposition({
        ...get().project,
        theme: { ...get().project.theme, textPrimary }
      });
      set({ project: updated });
      triggerSave(updated);
    },

    updateProjectAspectRatio: (aspectRatio: AspectRatio) => {
      pushSnapshot(get().project);
      const currentTier = get().project.resolution || '1080p';
      const sized = applySize(get().project, aspectRatio, currentTier);
      const updated = syncComposition(sized);
      const updatedList = get().projectsList.map((p) =>
        p.id === updated.id ? { ...p, aspectRatio, width: updated.width, height: updated.height } : p
      );
      set({ project: updated, projectsList: updatedList });
      triggerSave(updated);
    },

    updateThemeCaptionStyle: (captionStyle: CaptionStyle) => {
      pushSnapshot(get().project);
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, captionStyle }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeCaptionPosition: (captionPosition: CaptionPosition) => {
      pushSnapshot(get().project);
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, captionPosition }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateSubtitleCustomization: (customization: Partial<SubtitleCustomization>) => {
      pushSnapshot(get().project);
      const current = get().project.theme.subtitleCustomization || {};
      const updatedTheme = {
        ...get().project.theme,
        subtitleCustomization: {
          ...current,
          ...customization
        }
      };
      const updated = {
        ...get().project,
        theme: updatedTheme
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateResolution: (res: '1080p' | '720p') => {
      pushSnapshot(get().project);
      const aspect = get().project.aspectRatio;
      const sized = applySize(get().project, aspect, res);
      const updated = syncComposition(sized);
      const updatedList = get().projectsList.map((p) =>
        p.id === updated.id ? { ...p, width: updated.width, height: updated.height } : p
      );
      set({ project: updated, projectsList: updatedList });
      triggerSave(updated);
      get().addToast(`Resolution set to ${res} (${updated.width}×${updated.height})`, 'info');
    },

    toggleGlobalSubtitles: () => {
      pushSnapshot(get().project);
      const currentVal = Boolean(get().project.theme.showSubtitles);
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, showSubtitles: !currentVal }
      };
      set({ project: updated });
      triggerSave(updated);
      get().addToast(`Subtitles ${!currentVal ? 'enabled' : 'disabled'}`, 'info');
    },

    updateSceneText: (id, text) => {
      const current = get().project;
      pushSnapshot(current);
      const hasAudio = !!current.audioBlob;
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== id) return s;
        if (hasAudio) {
          return {
            ...s,
            narrationText: text,
            text
          };
        }
        const readingDuration = calculateFallbackSceneDuration(text);
        const alignedWords = computeDeterministicWordAlignment(text, readingDuration);
        return {
          ...s,
          narrationText: text,
          text,
          durationInSeconds: readingDuration,
          wordTimestamps: alignedWords
        };
      });

      const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);
      const updatedProject: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      const updated = syncComposition(updatedProject);
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    updateSceneVisualIntent: (sceneId: string, visualIntent: string) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, visualIntent } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    updateSceneVisualConcept: (sceneId: string, visualConcept: string) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, visualConcept } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    updateLayerOverride: (sceneId: string, layerId: string, override: Partial<LayerOverride>) => {
      const currentProj = get().project;
      const comp = currentProj.composition || syncComposition(currentProj).composition;
      if (!comp) return;
      pushSnapshot(currentProj);
      const updatedScenes = comp.scenes.map((mod) => {
        if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
        const currentOverrides = mod.overrides || {};
        const existingLayerOverride = currentOverrides[layerId] || {};
        const mergedOverride = { ...existingLayerOverride, ...override };
        return {
          ...mod,
          userEdited: true,
          overrides: {
            ...currentOverrides,
            [layerId]: mergedOverride
          }
        };
      });
      const updatedComp: Composition = {
        ...comp,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      const updatedProject: MooProject = {
        ...currentProj,
        composition: updatedComp
      };
      set({ project: updatedProject });
      triggerSave(updatedProject);
    },

    resetLayerOverride: (sceneId: string, layerId?: string) => {
      const currentProj = get().project;
      const comp = currentProj.composition;
      if (!comp) return;
      pushSnapshot(currentProj);
      const updatedScenes = comp.scenes.map((mod) => {
        if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
        if (!layerId) {
          return {
            ...mod,
            overrides: {}
          };
        }
        const nextOverrides = { ...(mod.overrides || {}) };
        delete nextOverrides[layerId];
        return {
          ...mod,
          overrides: nextOverrides
        };
      });
      const updatedProject: MooProject = {
        ...currentProj,
        composition: {
          ...comp,
          scenes: updatedScenes,
          updatedAt: Date.now()
        }
      };
      set({ project: updatedProject });
      triggerSave(updatedProject);
    },

    updateScenePalette: (sceneId: string, palette: Partial<ScenePalette>) => {
      const currentProj = get().project;
      const comp = currentProj.composition || syncComposition(currentProj).composition;
      if (!comp) return;
      pushSnapshot(currentProj);
      const updatedScenes = comp.scenes.map((mod) => {
        if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
        return {
          ...mod,
          userEdited: true,
          palette: {
            ...(mod.palette || {}),
            ...palette
          }
        };
      });
      const updatedComp: Composition = {
        ...comp,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      const updatedProject: MooProject = {
        ...currentProj,
        composition: updatedComp
      };
      set({ project: updatedProject });
      triggerSave(updatedProject);
    },

    compileSceneProcedural: (sceneId: string, archetype: ProceduralArchetype = 'auto') => {
      const current = get().project;
      const idx = current.scenes.findIndex((s) => s.id === sceneId);
      if (idx === -1) return;
      pushSnapshot(current);
      const synced = current.composition ? current : syncComposition(current);
      const comp = synced.composition!;
      const existingMod = comp.scenes.find((m) => m.beatId === sceneId);
      const generated = compileProceduralScene(
        current.scenes[idx],
        idx,
        current.scenes.length,
        existingMod?.palette,
        archetype
      );
      const nextScenes = comp.scenes.map((m) => (m.beatId === sceneId ? generated : m));
      if (!nextScenes.some((m) => m.beatId === sceneId)) {
        nextScenes.push(generated);
      }
      const updatedProject: MooProject = {
        ...synced,
        renderMode: 'composition',
        composition: {
          ...comp,
          scenes: nextScenes,
          updatedAt: Date.now()
        },
        updatedAt: Date.now()
      };
      set({ project: updatedProject });
      triggerSave(updatedProject);
      get().addToast(`Visual adegan #${idx + 1} berhasil dibangun secara instan!`, 'success');
    },

    compileAllScenesProcedural: (archetype: ProceduralArchetype = 'auto', overwriteExisting = true) => {
      const current = get().project;
      if (current.scenes.length === 0) return;
      pushSnapshot(current);
      const updatedProject = compileProceduralProject(current, archetype, overwriteExisting);
      set({ project: updatedProject });
      triggerSave(updatedProject);
      get().addToast(`Seluruh ${current.scenes.length} adegan berhasil dibangun secara instan!`, 'success');
    },

    updateSceneCamera: (sceneId: string, camera: CameraMovement) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, camera } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    toggleSceneSubtitles: (sceneId: string) => {
      const updatedScenes = get().project.scenes.map((s) =>
        s.id === sceneId ? { ...s, showSubtitles: !s.showSubtitles } : s
      );
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
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
      const updated = syncComposition({ ...get().project, scenes: updatedScenes });
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
      const updated = syncComposition({ ...get().project, scenes: updatedScenes });
      set({ project: updated });
      triggerSave(updated);
    },

    setSceneDuration: (sceneId, durationInSeconds, allowWithAudio = false) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      if (hasAudio && !allowWithAudio) {
        set({ audioStale: true });
        return;
      }
      pushSnapshot(current);
      const clampedDuration = Math.max(0.5, Math.min(60, Math.round(durationInSeconds * 10) / 10));
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          durationInSeconds: clampedDuration,
          wordTimestamps: computeDeterministicWordAlignment(s.narrationText || s.text || '', clampedDuration)
        };
      });
      const totalDur = Math.round(updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0) * 100) / 100;
      const updated: MooProject = syncComposition({
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      });
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    addScene: () => {
      const current = get().project;
      pushSnapshot(current);
      const hasAudio = !!current.audioBlob;
      const newId = `sc-${Date.now()}`;
      const defaultText = 'New kinetic motion scene';
      const dur = calculateFallbackSceneDuration(defaultText);
      const newScene: Scene = {
        id: newId,
        narrationText: defaultText,
        text: defaultText,
        visualIntent: 'Kinetic motion scene with bold visual emphasis',
        visualConcept: 'Dynamic layout with fluid text animation',
        visualElements: ['headline', 'supporting-detail'],
        focusWords: ['kinetic', 'scene'],
        motionPreset: 'punch_zoom',
        camera: 'push_in',
        icon: 'sparkles',
        durationInSeconds: dur,
        wordTimestamps: computeDeterministicWordAlignment(defaultText, dur),
        showSubtitles: false
      };
      const updatedScenes = [...current.scenes, newScene];
      const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);

      const updatedProject: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      const updated = syncComposition(updatedProject);
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    removeScene: (id) => {
      const current = get().project;
      pushSnapshot(current);
      const hasAudio = !!current.audioBlob;
      const updatedScenes = current.scenes.filter((s) => s.id !== id);
      const totalDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);

      const updatedProject: MooProject = {
        ...current,
        scenes: updatedScenes,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      const updated = syncComposition(updatedProject);
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    duplicateScene: (id: string) => {
      const current = get().project;
      const hasAudio = !!current.audioBlob;
      pushSnapshot(current);
      const idx = current.scenes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const source = current.scenes[idx];
      const newId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newScene: Scene = {
        ...source,
        id: newId,
        visualElements: source.visualElements ? [...source.visualElements] : undefined,
        focusWords: [...(source.focusWords || [])],
        wordTimestamps: source.wordTimestamps ? source.wordTimestamps.map((w) => ({ ...w })) : []
      };
      const list = [...current.scenes];
      list.splice(idx + 1, 0, newScene);
      const totalDur = list.reduce((acc, s) => acc + s.durationInSeconds, 0);

      let updatedComposition = current.composition;
      if (current.composition) {
        const sourceModule = current.composition.scenes.find((s) => s.beatId === id);
        if (sourceModule?.userEdited) {
          const duplicatedModule: SceneModule = {
            ...sourceModule,
            beatId: newId,
            userEdited: true,
            version: 1
          };
          const compScenes = [...current.composition.scenes];
          const compIdx = compScenes.findIndex((s) => s.beatId === id);
          if (compIdx >= 0) {
            compScenes.splice(compIdx + 1, 0, duplicatedModule);
          } else {
            compScenes.push(duplicatedModule);
          }
          updatedComposition = { ...current.composition, scenes: compScenes };
        }
      }

      const updatedProject: MooProject = {
        ...current,
        scenes: list,
        composition: updatedComposition,
        audioDuration: hasAudio ? current.audioDuration : totalDur
      };
      const updated = syncComposition(updatedProject);
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

      const updatedProject: MooProject = {
        ...current,
        scenes: list
      };
      const updated = syncComposition(updatedProject);
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    },

    shufflePalette: (sceneId?: string) => {
      const current = get().project;
      const defaultTheme = current.themeTokens || BUILTIN_THEMES[0];
      const sceneTokens = sceneId ? current.scenes.find((s) => s.id === sceneId)?.themeTokens : undefined;
      const currentId = sceneTokens?.id || defaultTheme.id;

      const currentIndex = BUILTIN_THEMES.findIndex((t) => t.id === currentId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % BUILTIN_THEMES.length : 0;
      const nextTheme = BUILTIN_THEMES[nextIndex];

      if (sceneId) {
        const updatedScenes = current.scenes.map((s) =>
          s.id === sceneId ? { ...s, themeTokens: nextTheme } : s
        );
        const updatedProject: MooProject = { ...current, scenes: updatedScenes };
        set({ project: updatedProject });
        triggerSave(updatedProject);
      } else {
        const updatedProject: MooProject = {
          ...current,
          themeTokens: nextTheme,
          theme: {
            ...current.theme,
            bg: nextTheme.bg,
            textPrimary: nextTheme.text,
            textHighlight: nextTheme.primary
          }
        };
        set({ project: updatedProject });
        triggerSave(updatedProject);
      }
    },

    setThemeTokens: (tokens: ThemeTokens, sceneId?: string) => {
      const current = get().project;
      if (sceneId) {
        const updatedScenes = current.scenes.map((s) =>
          s.id === sceneId ? { ...s, themeTokens: tokens } : s
        );
        const updatedProject: MooProject = { ...current, scenes: updatedScenes };
        set({ project: updatedProject });
        triggerSave(updatedProject);
      } else {
        const updatedProject: MooProject = {
          ...current,
          themeTokens: tokens,
          theme: {
            ...current.theme,
            bg: tokens.bg,
            textPrimary: tokens.text,
            textHighlight: tokens.primary
          }
        };
        set({ project: updatedProject });
        triggerSave(updatedProject);
      }
    },

    updateThemeToken: (key: keyof ThemeTokens, value: string, sceneId?: string) => {
      const current = get().project;
      if (sceneId) {
        const scene = current.scenes.find((s) => s.id === sceneId);
        const defaultTheme = current.themeTokens || BUILTIN_THEMES[0];
        const baseTheme: ThemeTokens = {
          ...defaultTheme,
          ...(scene?.themeTokens || {})
        };
        const newTokens: ThemeTokens = {
          ...baseTheme,
          [key]: value
        };
        const updatedScenes = current.scenes.map((s) =>
          s.id === sceneId ? { ...s, themeTokens: newTokens } : s
        );
        const updatedProject: MooProject = { ...current, scenes: updatedScenes };
        set({ project: updatedProject });
        triggerSave(updatedProject);
      } else {
        const baseTheme = current.themeTokens || BUILTIN_THEMES[0];
        const newTokens: ThemeTokens = {
          ...baseTheme,
          [key]: value
        };
        const updatedProject: MooProject = {
          ...current,
          themeTokens: newTokens,
          theme: {
            ...current.theme,
            ...(key === 'bg' ? { bg: value } : {}),
            ...(key === 'text' ? { textPrimary: value } : {}),
            ...(key === 'primary' ? { textHighlight: value } : {})
          }
        };
        set({ project: updatedProject });
        triggerSave(updatedProject);
      }
    },

    updateSceneNode: (sceneId: string, nodeId: string, update: Partial<MotionNode>) => {
      const current = get().project;
      const sceneIndex = current.scenes.findIndex((s) => s.id === sceneId);
      if (sceneIndex < 0) return;

      let scene = current.scenes[sceneIndex];
      if (!scene.nodes || scene.nodes.length === 0) {
        scene = migrateLegacyScene(scene as any);
      }

      const updatedNodes = updateNodeInTree(scene.nodes || [], nodeId, update);
      const updatedScenes = current.scenes.map((s, idx) =>
        idx === sceneIndex ? { ...scene, nodes: updatedNodes } : s
      );
      const updatedProject: MooProject = { ...current, scenes: updatedScenes };
      set({ project: updatedProject });
      triggerSave(updatedProject);
    },

    selectedNodeId: null,
    setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),
    assignAssetToScene: (sceneId: string, attachment: SceneAssetAttachment) => {
      const current = get().project;
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const existing = s.assignedAssets || [];
        const filtered = existing.filter((a) => a.assetId !== attachment.assetId);
        return {
          ...s,
          assignedAssets: [...filtered, attachment]
        };
      });
      const updated = { ...current, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    removeAssetFromSceneBeat: (sceneId: string, assetId: string) => {
      const current = get().project;
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          assignedAssets: (s.assignedAssets || []).filter((a) => a.assetId !== assetId)
        };
      });
      const updated = { ...current, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    updateSceneAssetRole: (sceneId: string, assetId: string, role: SceneAssetAttachment['role'], guidance?: string) => {
      const current = get().project;
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const updatedAssets = (s.assignedAssets || []).map((a) => {
          if (a.assetId !== assetId) return a;
          return {
            ...a,
            role,
            ...(guidance !== undefined ? { motionGuidance: guidance } : {})
          };
        });
        return {
          ...s,
          assignedAssets: updatedAssets
        };
      });
      const updated = { ...current, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },
  };
};
