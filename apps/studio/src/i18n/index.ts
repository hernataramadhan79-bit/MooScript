import { useSyncExternalStore } from 'react';
import { EN } from './en';

export type Locale = 'id' | 'en';

export const LOCALES: { id: Locale; label: string; native: string }[] = [
  { id: 'id', label: 'ID', native: 'Bahasa Indonesia' },
  { id: 'en', label: 'EN', native: 'English' }
];

const STORAGE_KEY = 'mooscript_locale';

/** IANA zones that cover Indonesia (WIB, WITA, WIT). */
const INDONESIA_ZONES = new Set([
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Makassar',
  'Asia/Jayapura',
  // Legacy aliases some browsers still report.
  'Asia/Ujung_Pandang'
]);

function isLocale(value: unknown): value is Locale {
  return value === 'id' || value === 'en';
}

function readStored(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Default language for a first visit: Indonesian for visitors in Indonesia (timezone) or whose
 * browser prefers Indonesian, English for everyone else. No network lookup, so it is instant
 * and works offline.
 */
export function detectLocale(): Locale {
  // Tests, workers and other non-browser contexts keep the source language.
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'id';
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && INDONESIA_ZONES.has(zone)) return 'id';
  } catch {
    // Intl unavailable: fall through to the language preference.
  }
  const preferred = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  // "in" is the legacy ISO code for Indonesian.
  if (preferred === 'id' || preferred.startsWith('id-') || preferred === 'in' || preferred.startsWith('in-')) return 'id';
  return 'en';
}

let current: Locale = readStored() ?? detectLocale();
const listeners = new Set<() => void>();

function applyDocumentLang(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
applyDocumentLang(current);

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Private browsing: the choice lasts for this session only.
    }
  }
  applyDocumentLang(locale);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the caller when the language changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/**
 * Translates a UI string. The Indonesian source text is the key, so Indonesian needs no lookup
 * and a missing English entry falls back to the source text. `{0}`, `{1}` are filled from `args`.
 */
export function t(source: string, ...args: ReadonlyArray<string | number>): string {
  return fill(current === 'en' ? EN[source] ?? source : source, args);
}

function fill(text: string, args: ReadonlyArray<string | number>): string {
  if (args.length === 0) return text;
  return text.replace(/\{(\d+)\}/g, (match, i) => (args[Number(i)] !== undefined ? String(args[Number(i)]) : match));
}

/**
 * Formats a source-language message without translating it. For text that also goes to the AI
 * (validation feedback) and stays Indonesian; the interface shows it through `tr()`.
 */
export function lf(source: string, ...args: ReadonlyArray<string | number>): string {
  return fill(source, args);
}

interface MessagePattern {
  re: RegExp;
  slots: number[];
  template: string;
}

let messagePatterns: MessagePattern[] | null = null;

function getMessagePatterns(): MessagePattern[] {
  if (messagePatterns) return messagePatterns;
  messagePatterns = Object.entries(EN)
    .filter(([key]) => /\{\d+\}/.test(key))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([key, template]) => {
      const slots: number[] = [];
      const source = key
        .split(/(\{\d+\})/)
        .map((part) => {
          const slot = /^\{(\d+)\}$/.exec(part);
          if (slot) {
            slots.push(Number(slot[1]));
            return '([\\s\\S]*?)';
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('');
      return { re: new RegExp(`^${source}$`), slots, template };
    });
  return messagePatterns;
}

/**
 * Translates a message that was already formatted in Indonesian, such as a validation error
 * built with `lf()`. Matches the dictionary's `{n}` templates and translates each captured part too.
 */
export function tr(message: string): string {
  if (current !== 'en') return message;
  const exact = EN[message];
  if (exact !== undefined) return exact;
  for (const { re, slots, template } of getMessagePatterns()) {
    const match = re.exec(message);
    if (!match) continue;
    const args: string[] = [];
    slots.forEach((slot, i) => {
      args[slot] = tr(match[i + 1]);
    });
    return fill(template, args);
  }
  return message;
}

/**
 * Marks a module-level label for translation without translating it at import time:
 * `const TABS = [{ label: L('Gaya') }]`, then render with `t(tab.label)`.
 */
export const L = (source: string): string => source;
