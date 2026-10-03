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
    <div className="fixed bottom-20 right-4 z-50 max-w-sm w-full p-4 rounded-xl bg-zinc-900 border border-primary/40 shadow-2xl animate-fadeIn text-white space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">
          {needRefresh ? 'system_update' : 'cloud_done'}
        </span>
        <div className="flex-1 text-xs">
          <h4 className="font-bold text-white mb-0.5">
            {needRefresh ? 'Update Available' : 'Offline Ready'}
          </h4>
          <p className="text-zinc-400 leading-relaxed text-[11px]">
            {needRefresh
              ? 'A new version of MooScript Studio is available. Reload to update.'
              : 'App content has been cached for offline use.'}
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
            Reload
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
