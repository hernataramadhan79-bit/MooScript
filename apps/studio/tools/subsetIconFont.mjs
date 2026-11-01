// Rebuilds public/fonts/material-symbols-outlined.woff2 with only the icons the Studio uses.
// Run after adding an icon: `node tools/subsetIconFont.mjs` (tests/iconFontSubset.test.ts fails until you do).
// Google Fonts subsets by `icon_names`; the axes match the .material-symbols-outlined rules (FILL 0..1, wght 400).
import fs from 'node:fs';
import path from 'node:path';
import { STUDIO_ROOT, SUBSET_LIST_FILE, collectUsedIconNames } from './iconNames.mjs';

const FONT_FILE = path.join(STUDIO_ROOT, 'public/fonts/material-symbols-outlined.woff2');
// Google Fonts picks the font format from the user agent; this one gets woff2.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const names = collectUsedIconNames();
const cssUrl =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0' +
  `&icon_names=${names.join(',')}&display=block`;

const css = await (await fetch(cssUrl, { headers: { 'User-Agent': USER_AGENT } })).text();
const fontUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) throw new Error(`No woff2 in the Google Fonts response:\n${css.slice(0, 400)}`);

const font = Buffer.from(await (await fetch(fontUrl, { headers: { 'User-Agent': USER_AGENT } })).arrayBuffer());
if (font.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('Downloaded font is not woff2.');

fs.writeFileSync(FONT_FILE, font);
fs.writeFileSync(SUBSET_LIST_FILE, `${names.join('\n')}\n`);
console.log(`Wrote ${names.length} icons, ${(font.length / 1024).toFixed(1)} KB.`);
