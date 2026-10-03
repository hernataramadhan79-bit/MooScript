import type { StateCreator } from 'zustand';
import type { ToastNotification } from '../../types';
import type { MooStoreState, UiSlice } from '../types';

export const createUiSlice: StateCreator<MooStoreState, [], [], UiSlice> = (set, get) => ({
  activeTab: 'script',
  setActiveTab: (activeTab) => set({ activeTab }),

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
  }
});
