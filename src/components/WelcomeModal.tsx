import React, { useEffect, useState } from 'react';
import { useMooStore } from '../store/useMooStore';

export const WELCOME_KEY = 'mooscript_welcome_seen';

const hasWebCodecs = typeof VideoEncoder !== 'undefined';

function shouldShowWelcome(): boolean {
  if (!hasWebCodecs) return true;
  try {
    return localStorage.getItem(WELCOME_KEY) !== '1';
  } catch {
    return true;
  }
}

export const WelcomeModal: React.FC = () => {
  const setSettingsOpen = useMooStore((s) => s.setSettingsOpen);
  const [isOpen, setIsOpen] = useState(shouldShowWelcome);

  const close = React.useCallback(() => {
    // Without WebCodecs the warning must stay visible on every load.
    if (hasWebCodecs) {
      try {
        localStorage.setItem(WELCOME_KEY, '1');
      } catch {
        // ignore localStorage errors in private browsing
      }
    }
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="w-full max-w-lg bg-[#141416] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <span className="material-symbols-outlined text-primary text-[22px]">movie_filter</span>
          <h2 id="welcome-title" className="text-sm font-bold text-white">
            Selamat datang di MooScript Studio
          </h2>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto text-[13px] text-zinc-300 leading-relaxed">
          <ul className="space-y-3">
            <li className="flex gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">lock</span>
              <span>Semua proyek tersimpan di browser Anda. Tidak ada server atau akun MooScript.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">key</span>
              <span>
                API key Anda disimpan di perangkat ini dan hanya dikirim langsung ke provider yang Anda
                pilih. Tanpa key pun Anda bisa menulis adegan sendiri, membangun visual instan, memakai
                suara lokal, dan mengekspor.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                videocam
              </span>
              <span>Ekspor MP4 membutuhkan Chrome atau Edge terbaru.</span>
            </li>
          </ul>

          {!hasWebCodecs && (
            <div
              role="alert"
              className="flex gap-2.5 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
              <span>
                Browser ini tidak mendukung WebCodecs: ekspor MP4 tidak akan berfungsi. Gunakan Chrome atau
                Edge terbaru.
              </span>
            </div>
          )}

          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs underline text-zinc-400 hover:text-white"
          >
            Kebijakan Privasi
          </a>
        </div>

        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              close();
            }}
            className="px-3 h-8 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all"
          >
            Buka Pengaturan API
          </button>
          <button
            type="button"
            onClick={close}
            className="px-3 h-8 rounded-lg bg-primary hover:bg-lime-300 text-black text-xs font-bold transition-all active:scale-95"
          >
            Mulai
          </button>
        </div>
      </div>
    </div>
  );
};
