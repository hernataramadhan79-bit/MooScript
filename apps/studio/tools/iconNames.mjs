// Collects the Material Symbols names the Studio UI can render, for the subset icon font.
// Icon names are often dynamic (data objects, ternaries), so every quoted string and JSX text
// token that is a real icon name counts. The result is a safe superset of what is shown.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const STUDIO_ROOT = path.resolve(here, '..');
export const CODEPOINTS_FILE = path.join(here, 'material-symbols.codepoints');
export const SUBSET_LIST_FILE = path.join(here, 'material-symbols-subset.txt');

/** Every icon name the font family knows, from Google's published codepoints file. */
export function readValidIconNames() {
  return new Set(
    fs
      .readFileSync(CODEPOINTS_FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.split(' ')[0])
      .filter(Boolean)
  );
}

function listSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

/** Icon names that appear in the Studio source, sorted. */
export function collectUsedIconNames(valid = readValidIconNames()) {
  const used = new Set();
  for (const file of listSourceFiles(path.join(STUDIO_ROOT, 'src'))) {
    const text = fs.readFileSync(file, 'utf8');
    // Quoted strings ('edit_note', "tune", `close`) and JSX text (>delete<).
    for (const match of text.matchAll(/['"`>]\s*([a-z0-9_]+)\s*['"`<]/g)) {
      if (valid.has(match[1])) used.add(match[1]);
    }
  }
  return [...used].sort();
}

/** The names baked into the committed subset font. */
export function readSubsetIconNames() {
  if (!fs.existsSync(SUBSET_LIST_FILE)) return [];
  return fs.readFileSync(SUBSET_LIST_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
}
