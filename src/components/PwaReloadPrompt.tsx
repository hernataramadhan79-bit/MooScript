import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PwaReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates periodically every hour
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('PWA service worker registration error:', error);
    }
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed bottom-24 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-full z-40 sm:max-w-sm p-4 rounded-xl bg-zinc-900 border border-primary/40 shadow-2xl animate-fadeIn text-white space-y-2.5"
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">
          {needRefresh ? 'system_update' : 'cloud_done'}
        </span>
        <div className="flex-1 text-xs">
          <h4 className="font-bold text-white mb-0.5">
            {needRefresh ? 'Versi baru tersedia' : 'Siap dipakai offline'}
          </h4>
          <p className="text-zinc-400 leading-relaxed text-[11px]">
            {needRefresh
              ? 'MooScript Studio punya versi baru. Muat ulang untuk memperbarui; proyek Anda tetap tersimpan.'
              : 'Aplikasi sudah tersimpan di perangkat dan bisa dibuka tanpa internet.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
        {needRefresh && (
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-lime-300 text-black text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            Muat Ulang
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
