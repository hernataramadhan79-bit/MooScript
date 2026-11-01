import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error plain ESM tool module without type declarations
import { collectUsedIconNames, readSubsetIconNames } from '../tools/iconNames.mjs';

describe('Material Symbols subset font', () => {
  it('contains every icon name the Studio source uses (run `pnpm icons:subset` after adding one)', () => {
    const subset = new Set<string>(readSubsetIconNames());
    const missing = (collectUsedIconNames() as string[]).filter((name) => !subset.has(name));
    expect(missing).toEqual([]);
  });

  it('ships the subset, not the 4 MB full font', () => {
    const font = fs.readFileSync(path.resolve(__dirname, '../public/fonts/material-symbols-outlined.woff2'));
    expect(font.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(font.length).toBeLessThan(200 * 1024);
  });
});
