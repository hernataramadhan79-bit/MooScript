import { version } from '../../package.json';

export type Locale = 'en' | 'id';

export const SITE_URL = 'https://mooscript.web.id';
export const STUDIO_URL = 'https://app.mooscript.web.id';
// The studio opens its install dialog when it arrives with ?install=1; the install prompt only works on its own origin.
export const INSTALL_URL = `${STUDIO_URL}/?install=1`;
export const GITHUB_URL = 'https://github.com/hernataramadhan79-bit/MooScript';
// Search engine ownership tokens, set per deploy (PUBLIC_GOOGLE_SITE_VERIFICATION, PUBLIC_BING_SITE_VERIFICATION).
export const GOOGLE_SITE_VERIFICATION: string = import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '';
export const BING_SITE_VERIFICATION: string = import.meta.env.PUBLIC_BING_SITE_VERIFICATION ?? '';
// The packages are versioned in lockstep; the site shows the same number.
export const RELEASE_VERSION = `v${version}`;

export function buildStudioUrl(templateSlug?: string): string {
  if (!templateSlug) return STUDIO_URL;
  return `${STUDIO_URL}/?template=${encodeURIComponent(templateSlug)}`;
}

export function localizePath(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const stripped = clean === '/id' ? '/' : clean.startsWith('/id/') ? clean.slice(3) : clean;
  // Pages are built as directories, so every URL ends in a slash, matching the sitemap.
  const slashed = stripped.endsWith('/') ? stripped : `${stripped}/`;
  return locale === 'en' ? slashed : `/id${slashed}`;
}

export function alternatePaths(pathname: string): { en: string; id: string } {
  return {
    en: new URL(localizePath(pathname, 'en'), SITE_URL).toString(),
    id: new URL(localizePath(pathname, 'id'), SITE_URL).toString()
  };
}
