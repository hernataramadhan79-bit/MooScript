import type { StateCreator } from 'zustand';
import type { ToastNotification } from '../../types';
import type { MooStoreState, UiSlice } from '../types';
import { getSceneStartSeconds, sceneSeconds } from '../../utils/projectDuration';

export const createUiSlice: StateCreator<MooStoreState, [], [], UiSlice> = (set, get) => ({
  activeTab: 'ide',

  previewMode: 'compact',
  setPreviewMode: (previewMode) => set({ previewMode }),

  isSettingsOpen: false,
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  isShortcutsOpen: false,
  setShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),

  activeSceneId: null,
  setActiveSceneId: (activeSceneId) => set({ activeSceneId }),
  focusScene: (sceneId) => {
    const { project, currentFrame, seekFrame } = get();
    const start = getSceneStartSeconds(project.scenes || [], sceneId);
    if (start === null) return;
    const fps = project.fps || 30;
    const startFrame = Math.round(start * fps);
    const scene = project.scenes.find((s) => s.id === sceneId)!;
    const endFrame = Math.round((start + sceneSeconds(scene)) * fps);
    // The timeline follows the playhead, so move it into the scene unless it is already there.
    if (currentFrame < startFrame || currentFrame >= endFrame) seekFrame(startFrame);
    set({ activeSceneId: sceneId });
  },

  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  selectedLayerId: null,
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId, extraSelectedLayerIds: [] }),
  extraSelectedLayerIds: [],
  stageAccents: [],
  setStageAccents: (stageAccents) => set({ stageAccents }),
  toggleLayerSelection: (layerId) => {
    const { selectedLayerId, extraSelectedLayerIds } = get();
    if (!selectedLayerId) {
      set({ selectedLayerId: layerId, extraSelectedLayerIds: [] });
    } else if (selectedLayerId === layerId) {
      // The next selected layer becomes the one the inspector edits.
      set({ selectedLayerId: extraSelectedLayerIds[0] ?? null, extraSelectedLayerIds: extraSelectedLayerIds.slice(1) });
    } else if (extraSelectedLayerIds.includes(layerId)) {
      set({ extraSelectedLayerIds: extraSelectedLayerIds.filter((id) => id !== layerId) });
    } else {
      set({ extraSelectedLayerIds: [...extraSelectedLayerIds, layerId] });
    }
  },

  setActiveTab: (tab) => {
    if (tab === 'settings') {
      set({ isSettingsOpen: true });
    } else {
      set({ activeTab: tab });
    }
  },

  toasts: [],
  addToast: (message, type = 'info', durationMs = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastNotification = { id, message, type, durationMs };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (durationMs > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, durationMs);
    }
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  isCompilingMograph: false,
  setIsCompilingMograph: (isCompilingMograph) => set({ isCompilingMograph })
});
