import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../store/useMooStore';
import { L, t } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { FreeAiHelper } from './studio/FreeAiHelper';
import { hasRemixHash } from '../engine/share/remixLink';

export const WELCOME_KEY = 'mooscript_welcome_seen';

const hasWebCodecs = typeof VideoEncoder !== 'undefined';

// Lowercase because a topic lands mid-sentence in the outline.
const EXAMPLE_TOPICS = [L('cara menabung untuk pemula'), L('sejarah kopi'), L('tips tidur nyenyak')];

function hasTemplateDeepLink(): boolean {
  if (typeof window === 'undefined' || !window.location?.search) return false;
  try {
    return new URLSearchParams(window.location.search).has('template');
  } catch {
    return false;
  }
}

function hasInstallDeepLink(): boolean {
  if (typeof window === 'undefined' || !window.location?.search) return false;
  try {
    return new URLSearchParams(window.location.search).has('install');
  } catch {
    return false;
  }
}

function shouldShowWelcome(): boolean {
  // Arriving from the website's install button: the install dialog is the only thing to show.
  if (hasInstallDeepLink()) return false;
  if (!hasWebCodecs) return true;
  if (hasTemplateDeepLink() || (typeof window !== 'undefined' && hasRemixHash(window.location?.hash || ''))) {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // ignore localStorage errors in private browsing
    }
    return false;
  }
  try {
    return localStorage.getItem(WELCOME_KEY) !== '1';
  } catch {
    return true;
  }
}

/** First-run screen: one field that leads straight to a playing video, with no key or account. */
export const WelcomeModal: React.FC = () => {
  const setSettingsOpen = useMooStore((s) => s.setSettingsOpen);
  // Shared with the script panel, so the text survives a language switch and stays usable for AI.
  const scriptPrompt = useMooStore((s) => s.scriptPrompt);
  const setScriptPrompt = useMooStore((s) => s.setScriptPrompt);
  const createInstantVideo = useMooStore((s) => s.createInstantVideo);
  const [isOpen, setIsOpen] = useState(shouldShowWelcome);
  const [isBuilding, setIsBuilding] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Focus only with a mouse: on a phone it would throw the keyboard over the examples.
  useEffect(() => {
    if (isOpen && window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const canBuild = scriptPrompt.trim().length > 0 && !isBuilding;

  const build = async () => {
    if (!canBuild) return;
    setIsBuilding(true);
    try {
      if (await createInstantVideo(scriptPrompt, { firstRun: true })) close();
    } finally {
      setIsBuilding(false);
    }
  };

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
          <h2 id="welcome-title" className="text-sm font-bold text-white flex-1">
            {t('Buat video pertamamu')}
          </h2>
          <LanguageSwitcher />
        </div>

        <form
          className="flex flex-col min-h-0"
          onSubmit={(e) => {
            e.preventDefault();
            void build();
          }}
        >
          <div className="p-5 space-y-3 overflow-y-auto text-[13px] text-zinc-300 leading-relaxed">
            <label htmlFor="welcome-topic" className="block text-zinc-200 font-semibold">
              {t('Mau bikin video tentang apa?')}
            </label>
            <textarea
              id="welcome-topic"
              ref={inputRef}
              value={scriptPrompt}
              onChange={(e) => setScriptPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void build();
                }
              }}
              rows={3}
              placeholder={t('Tulis topik, atau tempel naskahmu di sini')}
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary rounded-lg px-3 py-2 text-[14px] text-white placeholder:text-zinc-500 resize-y min-h-[76px] max-h-48 focus:outline-none transition-colors"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-400">{t('Contoh:')}</span>
              {EXAMPLE_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setScriptPrompt(t(topic))}
                  className="min-h-[32px] px-2.5 rounded-full border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  {t(topic)}
                </button>
              ))}
            </div>

            <FreeAiHelper topic={scriptPrompt} onCopied={() => inputRef.current?.select()} />

            <p className="flex gap-2 text-xs text-zinc-400">
              <span className="material-symbols-outlined text-primary text-[16px] shrink-0">lock</span>
              <span>
                {t('Gratis, tanpa akun dan tanpa API key. Video dibuat dan disimpan di browser ini.')}{' '}
                <a
                  href="/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  {t('Kebijakan Privasi')}
                </a>
              </span>
            </p>

            {!hasWebCodecs && (
              <div
                role="alert"
                className="flex gap-2.5 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300"
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
                <span>
                  {t('Browser ini tidak mendukung WebCodecs: ekspor MP4 tidak akan berfungsi. Gunakan Chrome atau Edge terbaru.')}
                </span>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                close();
              }}
              className="min-h-[36px] px-1 text-xs text-zinc-400 hover:text-white underline-offset-2 hover:underline transition-colors"
            >
              {t('Punya API key? Pakai AI')}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="px-3 h-9 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all"
              >
                {t('Lewati')}
              </button>
              <button
                type="submit"
                disabled={!canBuild}
                className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-primary hover:bg-lime-300 disabled:opacity-40 disabled:hover:bg-primary disabled:cursor-not-allowed text-black text-xs font-bold transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                {isBuilding ? t('Membuat…') : t('Buat Video')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
