import type { StateCreator } from 'zustand';
import type { ExportOptions, ExportProgress } from '../../engine/export/mp4Exporter';
import type { MooStoreState, ExportSlice, ExportQueueItem } from '../types';
import { listAssetsFromDb } from '../../db/mooDb';

let exportAbortController: AbortController | null = null;

/** The video files of the B-roll the project's shots use, by asset id (loaded from the DB if needed). */
export async function brollSourcesFor(state: Pick<MooStoreState, 'project' | 'assets'>): Promise<Record<string, Blob> | undefined> {
  const ids = new Set(state.project.scenes.map((s) => s.broll?.assetId).filter((id): id is string => Boolean(id)));
  if (ids.size === 0) return undefined;
  let assets = state.assets;
  if ([...ids].some((id) => !assets.some((a) => a.id === id && a.blob))) {
    assets = await listAssetsFromDb(state.project.id);
  }
  return Object.fromEntries(assets.filter((a) => ids.has(a.id) && a.blob).map((a) => [a.id, a.blob as Blob]));
}

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
      const brollSources = await brollSourcesFor(get());
      const onProgress = (progress: ExportProgress) => set({ exportProgress: progress });
      // GIF has its own encoder; video goes through WebCodecs.
      const result =
        opts?.format === 'gif'
          ? await (await import('../../engine/export/gifExport')).exportGif(get().project, onProgress, localController.signal, {
              brollSources,
              reframe: opts.reframe
            })
          : await (await import('../../engine/export/mp4Exporter')).exportMooProjectToMP4(get().project, onProgress, localController.signal, {
              ...opts,
              brollSources
            });
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

  exportQueue: [],

  startExportQueue: async (aspects, mode, opts) => {
    if (get().isExporting || aspects.length === 0) return;
    get().pause();
    if (get().project.scenes.length === 0) {
      get().addToast('Gagal mengekspor: proyek belum memiliki adegan.', 'warning');
      return;
    }
    get().clearExportQueue();
    set({ exportQueue: aspects.map((aspect) => ({ aspect, status: 'waiting' })) });

    exportAbortController = new AbortController();
    const localController = exportAbortController;
    set({ isExporting: true, exportProgress: { percent: 0, currentFrame: 0, totalFrames: 0, statusText: 'Memulai ekspor...' } });
    const releaseGuard = await guardExportSession(() =>
      get().addToast('Tab dipindah ke latar belakang. Kembali ke tab ini agar ekspor tidak terhenti.', 'warning', 6000)
    );
    const patchItem = (i: number, patch: Partial<ExportQueueItem>) =>
      set({ exportQueue: get().exportQueue.map((item, j) => (j === i ? { ...item, ...patch } : item)) });

    try {
      const { exportMooProjectToMP4 } = await import('../../engine/export/mp4Exporter');
      const { exportGif } = await import('../../engine/export/gifExport');
      const brollSources = await brollSourcesFor(get());
      for (let i = 0; i < aspects.length; i++) {
        if (localController.signal.aborted) {
          patchItem(i, { status: 'cancelled' });
          continue;
        }
        patchItem(i, { status: 'rendering' });
        try {
          const onProgress = (progress: ExportProgress) =>
            set({ exportProgress: { ...progress, statusText: `${aspects[i]} (${i + 1}/${aspects.length}): ${progress.statusText}` } });
          const reframe = { aspect: aspects[i], mode };
          const result =
            opts?.format === 'gif'
              ? await exportGif(get().project, onProgress, localController.signal, { brollSources, reframe })
              : await exportMooProjectToMP4(get().project, onProgress, localController.signal, { ...opts, brollSources, reframe });
          patchItem(i, { status: 'done', result });
        } catch (err: unknown) {
          const aborted = localController.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
          patchItem(i, aborted ? { status: 'cancelled' } : { status: 'error', error: err instanceof Error ? err.message : String(err) });
        }
      }
      const done = get().exportQueue.filter((q) => q.status === 'done').length;
      if (done > 0) get().addToast(`${done} video selesai dirender.`, 'success');
    } finally {
      set({ isExporting: false });
      releaseGuard();
      if (exportAbortController === localController) exportAbortController = null;
    }
  },

  clearExportQueue: () => {
    for (const item of get().exportQueue) {
      if (item.result?.objectUrl) URL.revokeObjectURL(item.result.objectUrl);
    }
    set({ exportQueue: [] });
  },

  revokeExportResult: () => {
    const currentResult = get().exportResult;
    if (currentResult?.objectUrl) {
      URL.revokeObjectURL(currentResult.objectUrl);
    }
    set({ exportResult: null });
  }
});
