import type { StateCreator } from 'zustand';
import type { MooProject, Scene, CaptionStyle, CaptionPosition, SubtitleCustomization, CameraMovement, AspectRatio, Composition, SceneModule, LayerOverride, ScenePalette, ThemeTokens, MotionNode, SceneAssetAttachment, CreativeBrief, CustomFont } from '../../types';
import {
  CURRENT_SCHEMA_VERSION,
  BUILTIN_THEMES,
  TRANSITION_CURVES,
  TRANSITION_DURATION_RANGE,
  migrateLegacyScene
} from '../../types';
import { cleanWord } from '../../utils/textUtils';
import { getBriefPlatform } from '../../engine/ai/brief';
import {
  saveProjectToDb,
  loadProjectFromDb,
  listProjectsFromDb,
  deleteProjectFromDb,
  saveAssetToDb,
  listAssetsFromDb,
  loadBgmFromDb,
  saveBgmToDb,
  loadVoiceTrackFromDb,
  saveVoiceTrackToDb,
  db
} from '../../db/mooDb';
import { syncCustomBgmForProject } from '../../db/customBgm';
import { loadProjectVoice, NO_VOICE } from '../../db/voiceTrack';
import { getProjectTemplate } from '../../engine/templates/projectTemplates';
import { computeDeterministicWordAlignment, calculateFallbackSceneDuration } from '../../engine/ai/tts';
import { DEFAULT_SCENE_SECONDS, MAX_SCENE_SECONDS, getSceneStartSeconds, sceneSeconds } from '../../utils/projectDuration';
import { stopPlaybackAudio } from './playbackSlice';
import { applySize, syncComposition } from '../../engine/composition/sync';
import {
  compileProceduralScene,
  compileProceduralProject,
  resolveProceduralArchetype,
  PROCEDURAL_ARCHETYPES,
  type ProceduralArchetype
} from '../../engine/composition/proceduralCompiler';
import type { InsertElementKind, MooStoreState, ProjectSlice } from '../types';
import { extractLayersFromHtml } from '../../engine/composition/layers';

export const DEFAULT_PROJECT_ID = 'moo-default-project';
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const FONT_FORMATS: Record<string, CustomFont['format']> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype'
};

/**
 * Markup of a layer added from the editor. It sits above the shot, centred; the inspector moves,
 * styles and animates it like any generated layer.
 */
function newElementHtml(kind: InsertElementKind, layerId: string): string {
  const base = 'position:absolute;left:50%;top:50%;z-index:30;';
  if (kind === 'text') {
    return `<p data-moo-layer="${layerId}" class="moo-added-text" style="${base}transform:translate(-50%,-50%);margin:0;max-width:86%;width:max-content;text-align:center;white-space:pre-wrap;font-family:var(--moo-font-display, sans-serif);font-weight:800;font-size:72px;line-height:1.1;color:var(--moo-text, #ffffff);">Teks baru</p>`;
  }
  const shape: Record<Exclude<InsertElementKind, 'text'>, string> = {
    rect: 'width:320px;height:320px;margin:-160px 0 0 -160px;border-radius:24px;',
    circle: 'width:280px;height:280px;margin:-140px 0 0 -140px;border-radius:9999px;',
    line: 'width:520px;height:12px;margin:-6px 0 0 -260px;border-radius:9999px;',
    pill: 'width:420px;height:120px;margin:-60px 0 0 -210px;border-radius:9999px;'
  };
  return `<div data-moo-layer="${layerId}" class="moo-added-shape" style="${base}${shape[kind]}background:var(--moo-accent, #84cc16);"></div>`;
}

/** Shortest piece a split or a moved cut may leave. */
const MIN_PIECE_SECONDS = 0.3;

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

/**
 * An undo step. Every store update replaces the objects it changes instead of editing them, so a
 * step can share everything it did not change with the steps around it; a deep copy here used to
 * duplicate every scene (and every embedded image) on each edit.
 */
function snapshotProject(project: MooProject): MooProject {
  const { audioBlob: _blob, ...rest } = project;
  return rest as MooProject;
}

/** Editor state that only makes sense for the project it was created in. */
const PROJECT_SCOPED_RESET = {
  currentFrame: 0,
  isPlaying: false,
  audioStale: false,
  audioProgress: null,
  previousScenesSnapshot: null,
  activeSceneId: null,
  selectedLayerId: null,
  extraSelectedLayerIds: [],
  waveformPeaks: null,
  loopRange: null
};

export const createProjectSlice: StateCreator<MooStoreState, [], [], ProjectSlice> = (set, get) => {
  const triggerSave = (project: MooProject) => {
    scheduleSave(project, (msg) => get().addToast(msg, 'error'));
  };
  // Edits sent in a quick burst to the same field (typing, dragging a slider or a trim handle)
  // share one undo step instead of filling the history with one step per keystroke.
  let lastCoalesceKey: string | null = null;
  let lastSnapshotAt = 0;
  const COALESCE_WINDOW_MS = 1200;

  const pushSnapshot = (project: MooProject, coalesceKey?: string) => {
    const now = Date.now();
    const isBurst =
      coalesceKey !== undefined &&
      coalesceKey === lastCoalesceKey &&
      now - lastSnapshotAt < COALESCE_WINDOW_MS &&
      historyPast.length > 0;
    lastCoalesceKey = coalesceKey ?? null;
    lastSnapshotAt = now;
    if (isBurst) {
      historyFuture = [];
      set({ canRedo: false });
      return;
    }
    historyPast.push(snapshotProject(project));
    if (historyPast.length > MAX_HISTORY) {
      historyPast.shift();
    }
    historyFuture = [];
    set({ canUndo: true, canRedo: false });
  };

  const clearHistory = () => {
    lastCoalesceKey = null;
    historyPast = [];
    historyFuture = [];
    set({ canUndo: false, canRedo: false });
  };

  /**
   * Stops work that belongs to the project being left. Its results would be thrown away (or
   * worse, land in the next project), so there is no point spending API quota or CPU on them.
   */
  const cancelProjectJobs = () => {
    const s = get();
    if (s.isExporting) s.cancelExport();
    if (s.isGeneratingScript) s.cancelGenerateScript();
    if (s.isGeneratingAudio) s.cancelAudioGeneration();
    if (s.isCompilingMograph || s.revisingSceneId) s.cancelMographGeneration();
    if (s.exportResult) s.revokeExportResult();
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
      } else if (!options?.skipHistory) {
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
      cancelProjectJobs();
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
        ...PROJECT_SCOPED_RESET,
        ...NO_VOICE,
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
      get().addToast(`Proyek "${syncedProject.title}" dibuat.`, 'success');
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
          wordTimestamps: computeDeterministicWordAlignment(t.narration, dur)
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

      let target = await loadProjectFromDb(id);
      if (!target) {
        get().addToast('Proyek tidak ditemukan di penyimpanan.', 'error');
        return;
      }
      cancelProjectJobs();
      clearHistory();

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
      const voice = await loadProjectVoice(target);

      set({
        project: target,
        audioBlobUrl: newBlobUrl,
        ...PROJECT_SCOPED_RESET,
        ...voice
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
      get().addToast(`Membuka "${target.title}"`, 'info');
    },
    duplicateProject: async (id: string) => {
      await flushPendingSave();
      const source = id === get().project.id ? get().project : await loadProjectFromDb(id);
      if (!source) {
        get().addToast('Proyek yang akan diduplikat tidak ditemukan.', 'error');
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
      const sourceVoice = await loadVoiceTrackFromDb(source.id);
      if (sourceVoice && duplicated.audioBlob) {
        await saveVoiceTrackToDb(
          dupId,
          sourceVoice.kind === 'voice' && sourceVoice.blob ? { kind: 'voice', blob: sourceVoice.blob } : { kind: 'bgm' }
        );
      }
      await get().refreshProjectsList();
      get().addToast(`Diduplikat sebagai "${duplicated.title}"`, 'success');
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
        get().addToast('Proyek terakhir tidak bisa dihapus.', 'warning');
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

      get().addToast('Proyek dihapus.', 'info');
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
      pushSnapshot(get().project, 'theme:highlight');
      const updated = syncComposition({
        ...get().project,
        theme: { ...get().project.theme, textHighlight }
      });
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemeBg: (bg) => {
      pushSnapshot(get().project, 'theme:bg');
      const updated = syncComposition({
        ...get().project,
        theme: { ...get().project.theme, bg }
      });
      set({ project: updated });
      triggerSave(updated);
    },

    updateThemePrimary: (textPrimary) => {
      pushSnapshot(get().project, 'theme:primary');
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
      pushSnapshot(get().project, `subtitle:${Object.keys(customization).sort().join(',')}`);
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
      get().addToast(`Resolusi ${res} (${updated.width}×${updated.height})`, 'info');
    },

    addMarker: (time, label) => {
      const current = get().project;
      pushSnapshot(current);
      const id = `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const markers = [...(current.markers || []), { id, time: Math.max(0, Math.round(time * 100) / 100), label: label || '' }]
        .sort((a, b) => a.time - b.time);
      const updated = { ...current, markers };
      set({ project: updated });
      triggerSave(updated);
      return id;
    },

    updateMarker: (id, update) => {
      const current = get().project;
      pushSnapshot(current, `marker:${id}`);
      const markers = (current.markers || [])
        .map((m) => (m.id === id ? { ...m, ...update, time: Math.max(0, update.time ?? m.time) } : m))
        .sort((a, b) => a.time - b.time);
      const updated = { ...current, markers };
      set({ project: updated });
      triggerSave(updated);
    },

    removeMarker: (id) => {
      const current = get().project;
      if (!(current.markers || []).some((m) => m.id === id)) return;
      pushSnapshot(current);
      const updated = { ...current, markers: (current.markers || []).filter((m) => m.id !== id) };
      set({ project: updated });
      triggerSave(updated);
    },

    updateBrief: (brief) => {
      const current = get().project;
      const nextBrief: CreativeBrief = { ...current.brief, ...brief };
      // Picking a platform also picks its frame and, when no length is set yet, its usual length.
      const platform = brief.platform ? getBriefPlatform(brief.platform) : undefined;
      if (platform && !current.brief?.targetDurationSec && brief.targetDurationSec === undefined) {
        nextBrief.targetDurationSec = platform.defaultDuration;
      }
      set({ project: { ...current, brief: nextBrief } });
      if (platform?.aspectRatio && platform.aspectRatio !== current.aspectRatio) {
        get().updateProjectAspectRatio(platform.aspectRatio);
        set({ project: { ...get().project, brief: nextBrief } });
      }
      triggerSave(get().project);
    },

    updateExportSettings: (settings) => {
      const current = get().project;
      const updated: MooProject = {
        ...current,
        exportSettings: { ...current.exportSettings, ...settings }
      };
      set({ project: updated });
      triggerSave(updated);
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
      get().addToast(`Subtitel ${!currentVal ? 'diaktifkan' : 'dinonaktifkan'}`, 'info');
    },

    updateSceneText: (id, text) => {
      const current = get().project;
      pushSnapshot(current, `text:${id}`);
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
      pushSnapshot(get().project, `intent:${sceneId}`);
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, visualIntent } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    updateSceneVisualConcept: (sceneId: string, visualConcept: string) => {
      pushSnapshot(get().project, `concept:${sceneId}`);
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, visualConcept } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    updateLayerOverride: (sceneId: string, layerId: string, override: Partial<LayerOverride>) => {
      const currentProj = get().project;
      const comp = currentProj.composition || syncComposition(currentProj).composition;
      if (!comp) return;
      pushSnapshot(currentProj, `layer:${sceneId}:${layerId}:${Object.keys(override).sort().join(',')}`);
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

    updateLayerOverrides: (sceneId, patches, coalesceKey) => {
      const currentProj = get().project;
      const comp = currentProj.composition || syncComposition(currentProj).composition;
      if (!comp || Object.keys(patches).length === 0) return;
      pushSnapshot(currentProj, coalesceKey);
      const scenes = comp.scenes.map((mod) => {
        if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
        const overrides = { ...(mod.overrides || {}) };
        for (const [layerId, patch] of Object.entries(patches)) {
          overrides[layerId] = { ...overrides[layerId], ...patch };
        }
        return { ...mod, userEdited: true, overrides };
      });
      const updatedProject: MooProject = { ...currentProj, composition: { ...comp, scenes, updatedAt: Date.now() } };
      set({ project: updatedProject });
      triggerSave(updatedProject);
    },

    addCustomFont: async (file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const format = FONT_FORMATS[ext];
      if (!format) {
        get().addToast('Format font belum didukung. Pakai .woff2, .woff, .ttf atau .otf.', 'error');
        return null;
      }
      if (file.size > MAX_FONT_BYTES) {
        get().addToast('Ukuran font melebihi 2 MB.', 'error');
        return null;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const current = get().project;
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Font';
      const taken = new Set((current.customFonts || []).map((f) => f.family));
      let family = base;
      for (let n = 2; taken.has(family); n++) family = `${base} ${n}`;
      pushSnapshot(current);
      const font: CustomFont = {
        id: `font-${Date.now().toString(36)}`,
        family,
        // The MIME type is set from the extension; browsers often leave it empty for font files.
        dataUrl: `data:font/${ext === 'otf' ? 'otf' : ext === 'ttf' ? 'ttf' : ext};base64,${base64}`,
        format
      };
      const updated = { ...current, customFonts: [...(current.customFonts || []), font] };
      set({ project: updated });
      triggerSave(updated);
      get().addToast(`Font "${family}" siap dipakai.`, 'success');
      return family;
    },

    removeCustomFont: (id) => {
      const current = get().project;
      if (!(current.customFonts || []).some((f) => f.id === id)) return;
      pushSnapshot(current);
      const updated = { ...current, customFonts: (current.customFonts || []).filter((f) => f.id !== id) };
      set({ project: updated });
      triggerSave(updated);
    },

    insertElementIntoScene: (sceneId, kind) => {
      const current = get().project;
      const idx = current.scenes.findIndex((s) => s.id === sceneId);
      if (idx === -1) return null;
      const synced = current.composition ? current : syncComposition(current);
      const comp = synced.composition!;
      let mod = comp.scenes.find((m) => m.beatId === sceneId);
      if (!mod) return null;
      // A shot without a visual of its own first gets the instant one, so the new layer sits on a real picture.
      if (!mod.html.trim()) {
        mod = compileProceduralScene(current.scenes[idx], idx, current.scenes.length, mod.palette, 'auto');
      }
      pushSnapshot(current);
      const prefix = kind === 'text' ? 'text' : 'shape';
      const taken = new Set((mod.html.match(/data-moo-layer="([^"]+)"/g) || []).map((m) => m.slice(16, -1)));
      let n = 1;
      while (taken.has(`${prefix}-${n}`)) n++;
      const layerId = `${prefix}-${n}`;
      const html = `${mod.html}\n${newElementHtml(kind, layerId)}`;
      const updatedMod: SceneModule = {
        ...mod,
        html,
        editableLayers: extractLayersFromHtml(html),
        status: 'ok',
        userEdited: true,
        version: (mod.version || 1) + 1,
        layerMotions: {
          ...(mod.layerMotions || {}),
          [layerId]: { enter: { preset: kind === 'text' ? 'slide-up' : 'pop', at: 0.15, dur: 0.5 } }
        }
      };
      const updated = syncComposition({
        ...synced,
        composition: { ...comp, scenes: comp.scenes.map((m) => (m.beatId === sceneId ? updatedMod : m)) }
      });
      set({ project: updated, selectedLayerId: layerId });
      triggerSave(updated);
      return layerId;
    },

    updateLayerMotion: (sceneId, layerId, motion) => {
      const currentProj = get().project;
      const comp = currentProj.composition || syncComposition(currentProj).composition;
      if (!comp) return;
      pushSnapshot(currentProj, `motion:${sceneId}:${layerId}`);
      const empty = !motion || !(motion.enter || motion.move || motion.exit);
      const updatedScenes = comp.scenes.map((mod) => {
        if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
        const motions = { ...(mod.layerMotions || {}) };
        if (empty) delete motions[layerId];
        else motions[layerId] = motion!;
        return { ...mod, userEdited: true, layerMotions: Object.keys(motions).length ? motions : undefined };
      });
      const updatedProject: MooProject = {
        ...currentProj,
        composition: { ...comp, scenes: updatedScenes, updatedAt: Date.now() }
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
      pushSnapshot(currentProj, `palette:${sceneId}:${Object.keys(palette).sort().join(',')}`);
      const updatedScenes = comp.scenes.map((mod) => {
        if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
        // An undefined color resets that slot to the project palette.
        const merged = Object.fromEntries(
          Object.entries({ ...(mod.palette || {}), ...palette }).filter(([, v]) => v !== undefined && v !== '')
        ) as Partial<ScenePalette>;
        const { palette: _old, ...rest } = mod;
        return Object.keys(merged).length > 0 ? { ...rest, userEdited: true, palette: merged } : rest;
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
      const chosen = resolveProceduralArchetype(current.scenes[idx], idx, archetype);
      const generated = compileProceduralScene(
        current.scenes[idx],
        idx,
        current.scenes.length,
        existingMod?.palette,
        chosen
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
      const replacedCustomWork =
        existingMod?.userEdited || existingMod?.generatorVersion?.startsWith('generative');
      const fellBack = archetype !== 'auto' && chosen !== archetype;
      if (fellBack) {
        const label = (id: ProceduralArchetype) => PROCEDURAL_ARCHETYPES.find((a) => a.id === id)?.label || id;
        get().addToast(
          `Naskah adegan #${idx + 1} belum punya data untuk ${label(archetype)} (angka, poin, atau tren), jadi dipakai ${label(chosen)}.`,
          'info',
          6000
        );
      }
      if (replacedCustomWork) {
        get().addToast(
          `Visual AI/editan adegan #${idx + 1} diganti visual instan. Tekan Urungkan (Ctrl+Z) untuk mengembalikan.`,
          'warning',
          6000
        );
      } else if (!fellBack) {
        get().addToast(`Visual adegan #${idx + 1} berhasil dibangun secara instan!`, 'success');
      }
    },

    compileAllScenesProcedural: (archetype: ProceduralArchetype = 'auto', overwriteExisting = true) => {
      const current = get().project;
      if (current.scenes.length === 0) return;
      pushSnapshot(current);
      const replacedCustomWork =
        overwriteExisting &&
        (current.composition?.scenes || []).some(
          (m) => m.userEdited || m.generatorVersion?.startsWith('generative')
        );
      const updatedProject = compileProceduralProject(current, archetype, overwriteExisting);
      set({ project: updatedProject });
      triggerSave(updatedProject);
      if (replacedCustomWork) {
        get().addToast(
          `Seluruh ${current.scenes.length} adegan diganti visual instan, termasuk visual AI/editan. Tekan Urungkan (Ctrl+Z) untuk mengembalikan.`,
          'warning',
          6000
        );
      } else {
        get().addToast(`Seluruh ${current.scenes.length} adegan berhasil dibangun secara instan!`, 'success');
      }
    },

    updateSceneCamera: (sceneId: string, camera: CameraMovement) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, camera } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    toggleSceneSubtitles: (sceneId: string) => {
      pushSnapshot(get().project);
      const updatedScenes = get().project.scenes.map((s) =>
        s.id === sceneId ? { ...s, hideSubtitles: !s.hideSubtitles } : s
      );
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    toggleWordFocus: (sceneId, word) => {
      pushSnapshot(get().project);
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
      pushSnapshot(get().project);
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, transition } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    setSceneTransitionTiming: (sceneId, timing) => {
      pushSnapshot(get().project, `transition:${sceneId}`);
      const updatedScenes = get().project.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const next = { ...s };
        if (timing.duration !== undefined) {
          if (timing.duration === null || !Number.isFinite(timing.duration)) delete next.transitionDuration;
          else
            next.transitionDuration = Math.min(
              TRANSITION_DURATION_RANGE.max,
              Math.max(TRANSITION_DURATION_RANGE.min, Math.round(timing.duration * 100) / 100)
            );
        }
        if (timing.curve !== undefined) {
          if (timing.curve === null || !TRANSITION_CURVES.includes(timing.curve)) delete next.transitionCurve;
          else next.transitionCurve = timing.curve;
        }
        return next;
      });
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
      pushSnapshot(current, `duration:${sceneId}`);
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

    splitSceneAt: (sceneId, timeSec) => {
      const current = get().project;
      const idx = current.scenes.findIndex((s) => s.id === sceneId);
      const start = getSceneStartSeconds(current.scenes, sceneId);
      if (idx === -1 || start === null) return null;
      const scene = current.scenes[idx];
      const dur = sceneSeconds(scene);
      const cut = Math.round((timeSec - start) * 100) / 100;
      if (cut < MIN_PIECE_SECONDS || dur - cut < MIN_PIECE_SECONDS) {
        get().addToast('Playhead terlalu dekat dengan tepi shot untuk dipotong.', 'warning');
        return null;
      }
      pushSnapshot(current);

      // Narration follows its word timing; without timing, words are shared by length.
      const words = scene.wordTimestamps || [];
      // A word that starts right at the playhead belongs to the second piece.
      const local = timeSec - start;
      let firstWords = words.filter((w) => w.start < local - 1e-6);
      let secondWords = words
        .filter((w) => w.start >= local - 1e-6)
        .map((w) => ({ word: w.word, start: Math.max(0, w.start - cut), end: Math.max(0, w.end - cut) }));
      const narration = (scene.narrationText ?? scene.text ?? '').trim();
      let firstText = firstWords.map((w) => w.word).join(' ');
      let secondText = secondWords.map((w) => w.word).join(' ');
      if (!words.length && narration) {
        const all = narration.split(/\s+/);
        const n = Math.round(all.length * (cut / dur));
        firstText = all.slice(0, n).join(' ');
        secondText = all.slice(n).join(' ');
        firstWords = computeDeterministicWordAlignment(firstText, cut);
        secondWords = computeDeterministicWordAlignment(secondText, dur - cut);
      }

      const newId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const { transitionDuration: _d, transitionCurve: _c, ...withoutTiming } = scene;
      const first: Scene = {
        ...withoutTiming,
        durationInSeconds: cut,
        durationLocked: true,
        narrationText: firstText,
        text: firstText,
        wordTimestamps: firstWords,
        // The two pieces are one continuous animation, so nothing should happen at the cut.
        transition: 'cut'
      };
      const second: Scene = {
        ...scene,
        id: newId,
        durationInSeconds: Math.round((dur - cut) * 100) / 100,
        durationLocked: true,
        narrationText: secondText,
        text: secondText,
        wordTimestamps: secondWords,
        visualElements: scene.visualElements ? [...scene.visualElements] : undefined,
        focusWords: [...(scene.focusWords || [])]
      };
      const scenes = [...current.scenes];
      scenes.splice(idx, 1, first, second);

      const synced = current.composition ? current : syncComposition(current);
      let modules = synced.composition!.scenes;
      const mod = modules.find((m) => m.beatId === sceneId);
      if (mod && (mod.html.trim() || mod.buildJs.trim())) {
        const inPoint = mod.inPoint || 0;
        const sourceDuration = mod.sourceDuration || dur + inPoint;
        const seed = mod.seed || idx + 1;
        const firstMod: SceneModule = { ...mod, duration: cut, sourceDuration, seed };
        const secondMod: SceneModule = {
          ...mod,
          id: newId,
          beatId: newId,
          duration: dur - cut,
          inPoint: Math.round((inPoint + cut) * 100) / 100,
          sourceDuration,
          seed,
          version: 1
        };
        modules = modules.flatMap((m) => (m.beatId === sceneId ? [firstMod, secondMod] : [m]));
      }
      const updated = syncComposition({
        ...synced,
        scenes,
        composition: { ...synced.composition!, scenes: modules }
      });
      set({ project: updated, activeSceneId: newId });
      triggerSave(updated);
      return newId;
    },

    setSceneBoundary: (sceneId, timeSec) => {
      const current = get().project;
      const idx = current.scenes.findIndex((s) => s.id === sceneId);
      if (idx <= 0) return;
      const prev = current.scenes[idx - 1];
      const scene = current.scenes[idx];
      const prevStart = getSceneStartSeconds(current.scenes, prev.id) || 0;
      const end = prevStart + sceneSeconds(prev) + sceneSeconds(scene);
      const lo = prevStart + MIN_PIECE_SECONDS;
      const hi = end - MIN_PIECE_SECONDS;
      const cut = Math.round(Math.min(hi, Math.max(lo, timeSec)) * 100) / 100;
      const prevDur = Math.min(MAX_SCENE_SECONDS, Math.round((cut - prevStart) * 100) / 100);
      const sceneDur = Math.min(MAX_SCENE_SECONDS, Math.round((end - cut) * 100) / 100);
      const shift = Math.round((prevDur - sceneSeconds(prev)) * 100) / 100;
      if (Math.abs(shift) < 0.01) return;
      pushSnapshot(current, `boundary:${sceneId}`);
      const hasAudio = !!current.audioBlob;
      // Without a voice-over the word timing follows the new lengths; with one, the words keep the
      // timing they were spoken at.
      const retime = (s: Scene, d: number): Scene => ({
        ...s,
        durationInSeconds: d,
        durationLocked: true,
        wordTimestamps: hasAudio ? s.wordTimestamps : computeDeterministicWordAlignment(s.narrationText || s.text || '', d)
      });
      const scenes = current.scenes.map((s) => (s.id === prev.id ? retime(s, prevDur) : s.id === sceneId ? retime(s, sceneDur) : s));
      // A split piece keeps its picture in place: its code starts further in (or earlier) by the shift.
      const modules = (current.composition?.scenes || []).map((m) =>
        m.beatId === sceneId && m.sourceDuration
          ? { ...m, inPoint: Math.max(0, Math.round(((m.inPoint || 0) + shift) * 100) / 100) }
          : m
      );
      const updated = syncComposition({
        ...current,
        scenes,
        composition: current.composition ? { ...current.composition, scenes: modules } : current.composition
      });
      set({ project: updated });
      triggerSave(updated);
    },

    addScene: () => {
      const current = get().project;
      pushSnapshot(current);
      const hasAudio = !!current.audioBlob;
      const newId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Starts without narration: the card shows the writing prompt, and the scene holds its
      // default length until text (or a voice-over) times it.
      const newScene: Scene = {
        id: newId,
        narrationText: '',
        text: '',
        visualIntent: '',
        visualElements: ['headline', 'supporting-detail'],
        focusWords: [],
        motionPreset: 'punch_zoom',
        camera: 'push_in',
        icon: 'sparkles',
        durationInSeconds: DEFAULT_SCENE_SECONDS,
        wordTimestamps: []
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
      const { activeSceneId, selectedLayerId } = get();
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale,
        activeSceneId: activeSceneId === id ? null : activeSceneId,
        selectedLayerId: activeSceneId === id ? null : selectedLayerId
      });
      triggerSave(updated);
      // The film got shorter: keep the playhead inside it.
      get().seekFrame(get().currentFrame);
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
      const count = current.scenes.length;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= count || toIndex >= count) return;
      pushSnapshot(current);
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
      pushSnapshot(current);
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
      pushSnapshot(current);
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
      pushSnapshot(current, `asset-role:${sceneId}:${assetId}`);
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
