import type { StateCreator } from 'zustand';
import { exportMooProjectToMP4, type ExportOptions } from '../../engine/export/mp4Exporter';
import type { MooStoreState, ExportSlice } from '../types';

let exportAbortController: AbortController | null = null;

export const createExportSlice: StateCreator<MooStoreState, [], [], ExportSlice> = (set, get) => ({
  isExporting: false,
  exportProgress: null,
  exportResult: null,

  startExport: async (opts?: ExportOptions) => {
    get().pause();

    const scenes = get().project.scenes;
    if (!scenes || scenes.length === 0) {
      get().addToast('Cannot export: project has no scenes.', 'warning');
      return;
    }

    // Revoke previous export URL if present to prevent memory leaks
    if (get().exportResult?.objectUrl) {
      URL.revokeObjectURL(get().exportResult!.objectUrl);
      set({ exportResult: null });
    }

    exportAbortController = new AbortController();
    set({
      isExporting: true,
      exportProgress: { percent: 0, currentFrame: 0, totalFrames: 0, statusText: 'Starting export...' }
    });

    try {
      const result = await exportMooProjectToMP4(
        get().project,
        (progress) => set({ exportProgress: progress }),
        exportAbortController.signal,
        opts
      );
      set({ isExporting: false, exportResult: result });
    } catch (err: unknown) {
      set({ isExporting: false });
      const isAborted =
        exportAbortController?.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.toLowerCase().includes('cancel'));

      if (!isAborted) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(`MP4 Export failed: ${message}`, 'error');
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

  revokeExportResult: () => {
    const currentResult = get().exportResult;
    if (currentResult?.objectUrl) {
      URL.revokeObjectURL(currentResult.objectUrl);
    }
    set({ exportResult: null });
  }
});
