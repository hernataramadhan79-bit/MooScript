import type { StateCreator } from 'zustand';
import type { ExportOptions } from '../../engine/export/mp4Exporter';
import type { MooStoreState, ExportSlice } from '../types';

let exportAbortController: AbortController | null = null;

/**
 * Keeps the screen awake while exporting (phones suspend the tab, and the encode with it, when the
 * screen turns off) and warns once if the tab is backgrounded. Returns a release function; both
 * features are best-effort and silently skipped where the browser lacks them.
 */
async function guardExportSession(onBackgrounded: () => void): Promise<() => void> {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return () => {};
  let sentinel: WakeLockSentinel | null = null;
  try {
    sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    // Denied (e.g. low battery); the export still runs.
  }
  let warned = false;
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden' && !warned) {
      warned = true;
      onBackgrounded();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    sentinel?.release().catch(() => {});
  };
}

export const createExportSlice: StateCreator<MooStoreState, [], [], ExportSlice> = (set, get) => ({
  isExporting: false,
  exportProgress: null,
  exportResult: null,

  startExport: async (opts?: ExportOptions) => {
    // Re-entrancy guard: ignore double-triggered exports (double-click, strict-mode).
    if (get().isExporting) return;
    get().pause();

    const scenes = get().project.scenes;
    if (!scenes || scenes.length === 0) {
      get().addToast('Gagal mengekspor: proyek belum memiliki adegan.', 'warning');
      return;
    }

    // Revoke previous export URL if present to prevent memory leaks
    if (get().exportResult?.objectUrl) {
      URL.revokeObjectURL(get().exportResult!.objectUrl);
      set({ exportResult: null });
    }

    exportAbortController = new AbortController();
    // Capture the controller locally so the finally-block only clears it
    // when it still belongs to THIS export (a newer export may have started).
    const localController = exportAbortController;
    set({
      isExporting: true,
      exportProgress: { percent: 0, currentFrame: 0, totalFrames: 0, statusText: 'Memulai ekspor...' }
    });

    const releaseGuard = await guardExportSession(() =>
      get().addToast('Tab dipindah ke latar belakang. Kembali ke tab ini agar ekspor tidak terhenti.', 'warning', 6000)
    );

    try {
      // Dynamic import is deliberate: keeps mediabunny + the MP4 encoder out of the initial bundle.
      const { exportMooProjectToMP4 } = await import('../../engine/export/mp4Exporter');
      const result = await exportMooProjectToMP4(
        get().project,
        (progress) => set({ exportProgress: progress }),
        localController.signal,
        opts
      );
      set({ isExporting: false, exportResult: result });
    } catch (err: unknown) {
      set({ isExporting: false });
      const isAborted =
        localController.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.toLowerCase().includes('cancel'));

      if (!isAborted) {
        const message = err instanceof Error ? err.message : String(err);
        get().addToast(`Ekspor MP4 gagal: ${message}`, 'error');
      }
    } finally {
      releaseGuard();
      if (exportAbortController === localController) {
        exportAbortController = null;
      }
    }
  },

  cancelExport: () => {
    if (exportAbortController) {
      exportAbortController.abort();
      exportAbortController = null;
    }
    get().addToast('Ekspor dibatalkan.', 'info');
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
