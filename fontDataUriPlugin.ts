import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';

const SUFFIX = '?datauri';

/**
 * `import uri from '<file>.woff2?datauri'` always yields a `data:font/woff2;base64,...` string.
 * Vite's own `?inline` does not inline woff2 in production builds (it emits /assets/*.woff2),
 * which breaks the sandboxed stage iframe (origin null, CSP `font-src data:`) and SVG
 * foreignObject export frames.
 */
export function fontDataUri(): Plugin {
  return {
    name: 'moo-font-data-uri',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith(SUFFIX)) return null;
      const buf = await readFile(id.slice(0, -SUFFIX.length));
      return `export default ${JSON.stringify(`data:font/woff2;base64,${buf.toString('base64')}`)};`;
    }
  };
}
