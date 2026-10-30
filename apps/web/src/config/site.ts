export type Locale = 'en' | 'id';

export const SITE_URL = 'https://mooscript.web.id';
export const STUDIO_URL = 'https://app.mooscript.web.id';
export const GITHUB_URL = 'https://github.com/hernataramadhan79-bit/MooScript';
export const RELEASE_VERSION = 'v0.2.0';

export function buildStudioUrl(templateSlug?: string): string {
  if (!templateSlug) return STUDIO_URL;
  return `${STUDIO_URL}/?template=${encodeURIComponent(templateSlug)}`;
}

export function localizePath(path: string, locale: Locale): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const stripped = clean === '/id' ? '/' : clean.startsWith('/id/') ? clean.slice(3) : clean;
  if (locale === 'en') {
    return stripped || '/';
  }
  return stripped === '/' ? '/id/' : `/id${stripped}`;
}

export function alternatePaths(pathname: string): { en: string; id: string } {
  return {
    en: new URL(localizePath(pathname, 'en'), SITE_URL).toString(),
    id: new URL(localizePath(pathname, 'id'), SITE_URL).toString()
  };
}
