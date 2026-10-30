import { useEffect, useRef, useState } from 'react';

/** Subscribes to a CSS media query. Initial value is read synchronously to avoid a layout flash. */
export function useMediaQuery(query: string): boolean {
  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState<boolean>(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * True when a key event comes from inside a modal <dialog> (a confirm sheet, the shortcut list).
 * The dialog handles its own Escape, so a panel underneath must not close along with it.
 */
export function isFromModalDialog(e: KeyboardEvent): boolean {
  return e.target instanceof Element && Boolean(e.target.closest('dialog'));
}

/**
 * Trailing debounce. When `resetKey` changes (e.g. another project was opened) the new
 * value is returned immediately, so switching context never shows stale content.
 */
export function useDebouncedValue<T>(value: T, delayMs: number, resetKey?: unknown): T {
  const [debounced, setDebounced] = useState<T>(value);
  const keyRef = useRef(resetKey);

  useEffect(() => {
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey;
      setDebounced(value);
      return;
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs, resetKey]);

  return keyRef.current === resetKey ? debounced : value;
}
