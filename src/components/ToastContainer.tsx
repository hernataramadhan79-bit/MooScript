import React from 'react';
import { useMooStore } from '../store/useMooStore';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useMooStore();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        const borderColor = isError
          ? 'border-red-500/50 bg-red-950/90 text-red-200'
          : isSuccess
            ? 'border-primary/50 bg-zinc-900/95 text-zinc-100'
            : isWarning
              ? 'border-amber-500/50 bg-amber-950/90 text-amber-200'
              : 'border-zinc-700/80 bg-zinc-900/95 text-zinc-200';

        const iconName = isError ? 'error' : isSuccess ? 'check_circle' : isWarning ? 'warning' : 'info';

        const iconColor = isError
          ? 'text-red-400'
          : isSuccess
            ? 'text-primary'
            : isWarning
              ? 'text-amber-400'
              : 'text-zinc-400';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto p-3 rounded-xl border shadow-xl backdrop-blur-md flex items-start gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${borderColor}`}
          >
            <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${iconColor}`}>{iconName}</span>
            <div className="flex-1 text-xs leading-relaxed font-sans pr-1 break-words">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-400 hover:text-white shrink-0 p-0.5 rounded transition-colors"
              aria-label="Close notification"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </aside>
  );
};
