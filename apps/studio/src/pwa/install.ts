import { useSyncExternalStore } from 'react';

/**
 * The browser fires `beforeinstallprompt` once, early, and only Chromium browsers do. It is captured at
 * import time (main.tsx imports this first) so the install button can use it whenever the user asks.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPlatform = 'ios-device' | 'android-device' | 'desktop-chromium' | 'desktop-other';

export interface InstallState {
  /** The browser handed over its native install prompt. */
  canPrompt: boolean;
  /** Already running as an installed app (or just installed). */
  isInstalled: boolean;
  dialogOpen: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { canPrompt: false, isInstalled: detectInstalled(), dialogOpen: false };
const listeners = new Set<() => void>();

function detectInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      window.matchMedia?.('(display-mode: window-controls-overlay)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function update(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    update({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    update({ canPrompt: false, isInstalled: true, dialogOpen: false });
  });
}

export function getInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop-other';
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac with touch support.
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios-device';
  if (/Android/.test(ua)) return 'android-device';
  return /Chrome|Chromium|Edg\/|OPR\//.test(ua) ? 'desktop-chromium' : 'desktop-other';
}

/** Opens the browser's own install prompt. Returns false when the browser has none to offer. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  // The event can be used once; a dismissed prompt is re-offered by the browser later.
  deferred = null;
  update({ canPrompt: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') update({ isInstalled: true, dialogOpen: false });
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

export function openInstallDialog() {
  update({ dialogOpen: true });
}

export function closeInstallDialog() {
  update({ dialogOpen: false });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}
