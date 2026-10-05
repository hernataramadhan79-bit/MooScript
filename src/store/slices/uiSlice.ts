import type { StateCreator } from 'zustand';
import type { ToastNotification } from '../../types';
import type { MooStoreState, UiSlice } from '../types';

export const createUiSlice: StateCreator<MooStoreState, [], [], UiSlice> = (set, get) => ({
  activeTab: 'storyboard',
  deckTab: 'storyboard',
  setDeckTab: (deckTab) => set({ deckTab, activeTab: deckTab }),

  previewMode: 'compact',
  setPreviewMode: (previewMode) => set({ previewMode }),

  isSettingsOpen: false,
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),

  activeSceneId: null,
  setActiveSceneId: (activeSceneId) => set({ activeSceneId }),

  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  setActiveTab: (tab) => {
    if (tab === 'settings') {
      set({ isSettingsOpen: true });
    } else if (tab === 'script' || tab === 'storyboard') {
      set({ activeTab: tab, deckTab: 'storyboard' });
    } else if (tab === 'voice' || tab === 'audio') {
      set({ activeTab: tab, deckTab: 'audio' });
    } else if (tab === 'studio' || tab === 'style') {
      set({ activeTab: tab, deckTab: 'style' });
    } else if (tab === 'export') {
      set({ activeTab: tab, deckTab: 'export' });
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
