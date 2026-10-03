/**
 * Normalizes text and strips punctuation using Unicode-aware letters and numbers:
 * Preserves accented characters (e.g. café), non-Latin scripts, and Indonesian affixed words.
 */
export function cleanWord(word: string): string {
  if (!word) return '';
  return word
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}
