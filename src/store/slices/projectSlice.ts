import type { StateCreator } from 'zustand';
import type { MooProject, Scene, CaptionStyle, CaptionPosition, LayoutType, VisualData, CameraMovement, AspectRatio, Composition, SceneModule } from '../../types';
import { cleanWord } from '../../utils/textUtils';
import {
  saveProjectToDb,
  loadProjectFromDb,
  listProjectsFromDb,
  deleteProjectFromDb
} from '../../db/mooDb';
import { computeDeterministicWordAlignment, calculateFallbackSceneDuration } from '../../engine/ai/tts';
import { stopPlaybackAudio } from './playbackSlice';
import type { MooStoreState, ProjectSlice } from '../types';

export const DEFAULT_PROJECT_ID = 'moo-default-project';

export const DEFAULT_COMPOSITION: Composition = {
  id: 'comp-default',
  width: 1080,
  height: 1920,
  fps: 30,
  globalCss: `
    @keyframes pulseGlow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
  `,
  scenes: [
    {
      beatId: 'sc-1',
      html: `<div class="sc1-container">
  <div class="sc1-grid-bg"></div>
  <div class="sc1-badge">MOOSCRIPT ZERO-SERVER</div>
  <h1 class="sc1-headline">
    <span class="sc1-word w1">ZERO</span>
    <span class="sc1-word w2">SERVER</span>
    <span class="sc1-word w3 accent">RENDERING</span>
  </h1>
  <p class="sc1-sub">Directly inside your browser tabs</p>
</div>`,
      css: `.sc1-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #181824 0%, #09090b 100%);
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #f4f4f5; text-align: center; padding: 60px;
}
.sc1-grid-bg {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(132,204,22,0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(132,204,22,0.08) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(circle, black 40%, transparent 80%);
}
.sc1-badge {
  position: relative; z-index: 2;
  font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 700;
  color: #84cc16; background: rgba(132,204,22,0.12);
  border: 1px solid rgba(132,204,22,0.3); padding: 10px 28px;
  border-radius: 9999px; letter-spacing: 0.15em; margin-bottom: 40px;
}
.sc1-headline {
  position: relative; z-index: 2;
  font-size: 92px; font-weight: 800; line-height: 1.05;
  display: flex; flex-direction: column; gap: 12px;
}
.sc1-word.accent {
  color: #84cc16; text-shadow: 0 0 35px rgba(132,204,22,0.45);
}
.sc1-sub {
  position: relative; z-index: 2;
  margin-top: 40px; font-size: 32px; color: #a1a1aa; max-width: 800px; font-weight: 500;
}`,
      buildJs: `tl.from(root.querySelector(".sc1-badge"), { y: -30, opacity: 0, duration: 0.6, ease: "back.out(1.7)" })
  .from(root.querySelectorAll(".sc1-word"), { y: 60, opacity: 0, scale: 0.9, stagger: 0.18, duration: 0.7, ease: "power3.out" }, "-=0.3")
  .from(root.querySelector(".sc1-sub"), { opacity: 0, y: 20, duration: 0.6 }, "-=0.2");`,
      status: 'ok',
      version: 1
    },
    {
      beatId: 'sc-2',
      html: `<div class="sc2-container">
  <div class="sc2-terminal">
    <div class="sc2-bar">
      <span class="sc2-dot red"></span>
      <span class="sc2-dot yellow"></span>
      <span class="sc2-dot green"></span>
      <span class="sc2-title">engine.ts — WebCodecs</span>
    </div>
    <div class="sc2-body">
      <div class="sc2-line line1"><span class="sc2-kw">const</span> encoder = <span class="sc2-fn">new</span> VideoEncoder({</div>
      <div class="sc2-line line2">&nbsp;&nbsp;output: chunk =&gt; muxer.add(chunk),</div>
      <div class="sc2-line line3">&nbsp;&nbsp;error: e =&gt; console.error(e)</div>
      <div class="sc2-line line4">});</div>
      <div class="sc2-line line5 accent"><span class="sc2-comment">// Deterministic hardware acceleration</span></div>
    </div>
  </div>
</div>`,
      css: `.sc2-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: #09090b; padding: 50px;
  font-family: 'JetBrains Mono', monospace;
}
.sc2-terminal {
  width: 100%; max-width: 960px;
  background: #121215; border: 1px solid #27272a;
  border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.6);
  overflow: hidden;
}
.sc2-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 24px; background: #18181c; border-bottom: 1px solid #27272a;
}
.sc2-dot { width: 16px; height: 16px; border-radius: 50%; }
.sc2-dot.red { background: #ef4444; }
.sc2-dot.yellow { background: #f59e0b; }
.sc2-dot.green { background: #10b981; }
.sc2-title { margin-left: 12px; font-size: 20px; color: #71717a; }
.sc2-body { padding: 36px; font-size: 26px; line-height: 1.6; color: #e4e4e7; }
.sc2-kw { color: #84cc16; font-weight: 700; }
.sc2-fn { color: #38bdf8; }
.sc2-comment { color: #71717a; font-style: italic; }
.sc2-line.accent { margin-top: 20px; color: #84cc16; }`,
      buildJs: `tl.from(root.querySelector(".sc2-terminal"), { scale: 0.85, opacity: 0, y: 50, duration: 0.8, ease: "power3.out" })
  .from(root.querySelectorAll(".sc2-line"), { opacity: 0, x: -20, stagger: 0.15, duration: 0.5, ease: "power2.out" }, "-=0.3");`,
      status: 'ok',
      version: 1
    },
    {
      beatId: 'sc-3',
      html: `<div class="sc3-container">
  <div class="sc3-card">
    <div class="sc3-metric-val">60 FPS</div>
    <div class="sc3-metric-lbl">Hardware Export Throughput</div>
    <div class="sc3-badge">ZERO MEMORY LEAKS</div>
  </div>
</div>`,
      css: `.sc3-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, #1a1e12 0%, #09090b 100%);
  font-family: 'Plus Jakarta Sans', sans-serif; padding: 50px;
}
.sc3-card {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 60px 50px; border-radius: 36px;
  background: rgba(24, 24, 27, 0.7); border: 2px solid rgba(132, 204, 22, 0.3);
  backdrop-filter: blur(20px); box-shadow: 0 0 80px rgba(132, 204, 22, 0.15);
}
.sc3-metric-val {
  font-size: 130px; font-weight: 800; color: #84cc16;
  letter-spacing: -0.04em; text-shadow: 0 0 50px rgba(132, 204, 22, 0.4);
}
.sc3-metric-lbl {
  font-size: 32px; font-weight: 600; color: #f4f4f5; margin-top: 10px;
}
.sc3-badge {
  margin-top: 36px; font-family: 'JetBrains Mono', monospace; font-size: 20px;
  font-weight: 700; color: #a1a1aa; letter-spacing: 0.12em;
  background: rgba(255,255,255,0.06); padding: 10px 24px; border-radius: 9999px;
}`,
      buildJs: `tl.from(root.querySelector(".sc3-card"), { scale: 0.7, opacity: 0, duration: 0.8, ease: "back.out(1.8)" })
  .from(root.querySelector(".sc3-metric-val"), { scale: 1.3, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.4")
  .from(root.querySelector(".sc3-metric-lbl"), { y: 20, opacity: 0, duration: 0.5 }, "-=0.2");`,
      status: 'ok',
      version: 1
    }
  ],
  createdAt: 1700000000000
};

export const INITIAL_PROJECT: MooProject = {
  id: DEFAULT_PROJECT_ID,
  title: 'WebCodecs Architecture',
  aspectRatio: '9:16',
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
  scenes: [
    {
      id: 'sc-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Zero server rendering directly inside your browser tabs',
      text: 'Zero server rendering directly inside your browser tabs',
      visualData: {
        title: 'Zero-Server Architecture',
        focusWords: ['zero', 'server', 'browser'],
        accentIcon: 'mascot'
      },
      focusWords: ['zero', 'server', 'browser'],
      motionPreset: 'punch_zoom',
      camera: 'snap_zoom',
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
      layout: 'TERMINAL_MOCKUP',
      narrationText: 'WebCodecs Hardware acceleration with deterministic canvas math',
      text: 'WebCodecs Hardware acceleration with deterministic canvas math',
      visualData: {
        title: 'engine.ts',
        codeSnippet: 'const encoder = new VideoEncoder({\n  output: (chunk) => muxer.add(chunk),\n  error: (e) => console.error(e)\n});\nencoder.configure({ codec: "avc1.4d002a", width: 1080, height: 1920 });',
        codeLanguage: 'typescript',
        focusWords: ['webcodecs', 'hardware', 'deterministic'],
        accentIcon: 'zap'
      },
      focusWords: ['webcodecs', 'hardware', 'deterministic'],
      motionPreset: 'slide_split',
      camera: 'push_in',
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
      layout: 'METRIC_COUNTER',
      narrationText: 'Instant 1080p MP4 exports with zero memory leaks',
      text: 'Instant 1080p MP4 exports with zero memory leaks',
      visualData: {
        title: 'Render Performance',
        metricValue: '60 FPS',
        metricLabel: 'Hardware Export Throughput',
        focusWords: ['1080p', 'mp4', 'instant'],
        accentIcon: 'sparkles'
      },
      focusWords: ['1080p', 'mp4', 'instant'],
      motionPreset: 'kinetic_shake',
      camera: 'pull_out',
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

    setProject: (project, options) => {
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
          bg: '#09090b',
          textPrimary: '#f4f4f5',
          textHighlight: '#84cc16',
          fontFamily: 'Jakarta',
          captionStyle: 'boxed',
          captionPosition: 'center',
          showSubtitles: false
        },
        scenes: [
          {
            id: `sc-1-${now}`,
            layout: 'KINETIC_QUOTE',
            narrationText: 'New kinetic visual scene.',
            text: 'New kinetic visual scene.',
            visualData: {
              title: 'Kinetic Scene',
              focusWords: ['kinetic', 'scene']
            },
            focusWords: ['kinetic', 'scene'],
            motionPreset: 'punch_zoom',
            camera: 'push_in',
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
        isPlaying: false,
        previousScenesSnapshot: null,
        activeSceneId: null
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
      get().pause();
      stopPlaybackAudio();
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
      get().pause();
      stopPlaybackAudio();
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

    updateThemePrimary: (textPrimary) => {
      const updated = {
        ...get().project,
        theme: { ...get().project.theme, textPrimary }
      };
      set({ project: updated });
      triggerSave(updated);
    },

    updateProjectAspectRatio: (aspectRatio: AspectRatio) => {
      let width = 1080;
      let height = 1920;
      if (aspectRatio === '16:9') {
        width = 1920;
        height = 1080;
      } else if (aspectRatio === '1:1') {
        width = 1080;
        height = 1080;
      }
      const currentComp = get().project.composition;
      const updated: MooProject = {
        ...get().project,
        aspectRatio,
        width,
        height,
        composition: currentComp
          ? {
              ...currentComp,
              width,
              height
            }
          : undefined
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

    updateResolution: (res: '1080p' | '720p') => {
      const is1080p = res === '1080p';
      const width = is1080p ? 1080 : 720;
      const height = is1080p ? 1920 : 1280;
      const updated = { ...get().project, width, height };
      const updatedList = get().projectsList.map((p) =>
        p.id === updated.id ? { ...p, width, height } : p
      );
      set({ project: updated, projectsList: updatedList });
      triggerSave(updated);
      get().addToast(`Resolution set to ${res} (${width}×${height})`, 'info');
    },

    toggleGlobalSubtitles: () => {
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
      const hasAudio = !!current.audioBlob;
      const updatedScenes = current.scenes.map((s) => {
        if (s.id !== id) return s;
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

    updateSceneLayout: (sceneId: string, layout: LayoutType) => {
      const updatedScenes = get().project.scenes.map((s) => (s.id === sceneId ? { ...s, layout } : s));
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
    },

    updateSceneVisualData: (sceneId: string, visualData: Partial<VisualData>) => {
      const updatedScenes = get().project.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const mergedVisual = { ...(s.visualData || {}), ...visualData };
        return {
          ...s,
          visualData: mergedVisual,
          focusWords: mergedVisual.focusWords || s.focusWords || [],
          icon: mergedVisual.accentIcon || s.icon
        };
      });
      const updated = { ...get().project, scenes: updatedScenes };
      set({ project: updated });
      triggerSave(updated);
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
          wordTimestamps: computeDeterministicWordAlignment(s.narrationText || s.text || '', durationInSeconds)
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
      const defaultText = 'New kinetic motion scene';
      const dur = calculateFallbackSceneDuration(defaultText);
      const newScene: Scene = {
        id: newId,
        layout: 'KINETIC_QUOTE',
        narrationText: defaultText,
        text: defaultText,
        visualData: {
          title: 'Kinetic Scene',
          focusWords: ['kinetic', 'scene']
        },
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

      const newModule: SceneModule = {
        beatId: newId,
        html: `<div class="scene-box"><h1 class="headline">Kinetic Scene</h1><p class="caption">${defaultText}</p></div>`,
        css: `.scene-box { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${current.theme.bg || '#09090b'}; color: ${current.theme.textPrimary || '#f4f4f5'}; text-align: center; padding: 48px; } .headline { font-size: 72px; font-weight: 800; color: ${current.theme.textHighlight || '#84cc16'}; } .caption { margin-top: 24px; font-size: 28px; color: #a1a1aa; }`,
        buildJs: `tl.from(root.querySelector(".headline"), { y: 40, opacity: 0, scale: 0.9, duration: 0.7, ease: "back.out(1.7)" })
  .from(root.querySelector(".caption"), { y: 20, opacity: 0, duration: 0.5 }, "-=0.2");`,
        status: 'ok',
        version: 1
      };

      const updatedComposition = current.composition
        ? {
            ...current.composition,
            scenes: [...current.composition.scenes, newModule]
          }
        : undefined;

      const updated: MooProject = {
        ...current,
        scenes: updatedScenes,
        composition: updatedComposition,
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

      const updatedComposition = current.composition
        ? {
            ...current.composition,
            scenes: current.composition.scenes.filter((s) => s.beatId !== id)
          }
        : undefined;

      const updated: MooProject = {
        ...current,
        scenes: updatedScenes,
        composition: updatedComposition,
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
      const newId = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newScene: Scene = {
        ...source,
        id: newId,
        visualData: JSON.parse(JSON.stringify(source.visualData || {})),
        focusWords: [...(source.focusWords || [])],
        wordTimestamps: source.wordTimestamps ? source.wordTimestamps.map((w) => ({ ...w })) : []
      };
      const list = [...current.scenes];
      list.splice(idx + 1, 0, newScene);
      const totalDur = list.reduce((acc, s) => acc + s.durationInSeconds, 0);

      let updatedComposition = current.composition;
      if (current.composition) {
        const sourceModule = current.composition.scenes.find((s) => s.beatId === id);
        const newModule: SceneModule = sourceModule
          ? { ...sourceModule, beatId: newId, version: 1 }
          : {
              beatId: newId,
              html: `<div class="scene-box"><h1 class="headline">${source.visualData?.title || 'Scene'}</h1></div>`,
              css: `.scene-box { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; } .headline { font-size: 72px; color: #84cc16; }`,
              buildJs: `tl.from(root.querySelector(".headline"), { scale: 0.8, opacity: 0, duration: 0.6 });`,
              status: 'ok',
              version: 1
            };
        const compScenes = [...current.composition.scenes];
        const compIdx = compScenes.findIndex((s) => s.beatId === id);
        if (compIdx >= 0) {
          compScenes.splice(compIdx + 1, 0, newModule);
        } else {
          compScenes.push(newModule);
        }
        updatedComposition = { ...current.composition, scenes: compScenes };
      }

      const updated: MooProject = {
        ...current,
        scenes: list,
        composition: updatedComposition,
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

      let updatedComposition = current.composition;
      if (current.composition) {
        // Reorder composition modules to match the new scenes order
        const moduleMap = new Map(current.composition.scenes.map((m) => [m.beatId, m]));
        const reorderedModules: SceneModule[] = [];
        for (const s of list) {
          const mod = moduleMap.get(s.id);
          if (mod) reorderedModules.push(mod);
        }
        // Include any remaining modules not in scenes list
        for (const m of current.composition.scenes) {
          if (!reorderedModules.some((rm) => rm.beatId === m.beatId)) {
            reorderedModules.push(m);
          }
        }
        updatedComposition = { ...current.composition, scenes: reorderedModules };
      }

      const updated: MooProject = {
        ...current,
        scenes: list,
        composition: updatedComposition
      };
      set({
        project: updated,
        audioStale: hasAudio ? true : get().audioStale
      });
      triggerSave(updated);
    }
  };
};
