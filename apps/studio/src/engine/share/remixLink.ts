import type { MooProject } from '../../types';

/**
 * A link that opens someone's video script as a new instant video. Only text travels, in the URL
 * fragment (which browsers do not send to any server). Shot code is left out on purpose, so
 * opening a link never runs code written by a stranger.
 */

export interface RemixPayload {
  title: string;
  lines: string[];
}

const HASH_KEY = 'remix=';
const MAX_LINES = 30;
const MAX_LINE_CHARS = 300;
const MAX_TITLE_CHARS = 120;
/** Long URLs get cut off by chat apps. */
const MAX_ENCODED_CHARS = 6000;

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** The remix link for a project, or null when it has no script or the script is too long to share. */
export function buildRemixUrl(project: Pick<MooProject, 'title' | 'scenes'>, origin: string): string | null {
  const lines = project.scenes
    .filter((s) => !s.brandCard)
    .map((s) => (s.narrationText || '').trim())
    .filter(Boolean);
  if (lines.length === 0 || lines.length > MAX_LINES || lines.some((l) => l.length > MAX_LINE_CHARS)) return null;
  const encoded = toBase64Url(JSON.stringify({ v: 1, t: project.title.slice(0, MAX_TITLE_CHARS), l: lines }));
  return encoded.length > MAX_ENCODED_CHARS ? null : `${origin}/#${HASH_KEY}${encoded}`;
}

/** Reads a remix from a location hash. Links can be edited by anyone, so nothing is taken on trust. */
export function readRemixHash(hash: string): RemixPayload | null {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith(HASH_KEY) || raw.length > MAX_ENCODED_CHARS + HASH_KEY.length) return null;
  try {
    const data: unknown = JSON.parse(fromBase64Url(raw.slice(HASH_KEY.length)));
    if (typeof data !== 'object' || data === null) return null;
    const { t: title, l: lines } = data as { t?: unknown; l?: unknown };
    if (!Array.isArray(lines)) return null;
    const clean = lines
      .filter((l): l is string => typeof l === 'string')
      .map((l) => l.trim().slice(0, MAX_LINE_CHARS))
      .filter(Boolean)
      .slice(0, MAX_LINES);
    if (clean.length === 0) return null;
    return { title: typeof title === 'string' ? title.trim().slice(0, MAX_TITLE_CHARS) : '', lines: clean };
  } catch {
    return null;
  }
}

export function hasRemixHash(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(HASH_KEY);
}
