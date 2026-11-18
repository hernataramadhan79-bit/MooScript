import type { Scene } from '../../types';
import { calculateFallbackSceneDuration, computeDeterministicWordAlignment } from './tts';
import { t } from '../../i18n';

/**
 * Turns a topic or a pasted script into scenes without any AI call, so a first video needs no
 * API key. A script keeps every word the user wrote. A topic gets a neutral outline that claims
 * no facts about it, because nothing here knows the subject: the user fills in the substance.
 */

export interface InstantStoryboard {
  title: string;
  /** True when the text is a generic outline for a topic, not the user's own script. */
  isOutline: boolean;
  scenes: Scene[];
}

/** More words than this, or more than one sentence, reads as a script instead of a topic. */
const MAX_TOPIC_WORDS = 10;
/** The instant layouts show at most 22 words of a line. */
const MAX_SCENE_WORDS = 18;
/** With few sentences, shorter pieces keep the video from being one or two long shots. */
const MAX_SCENE_WORDS_SPARSE = 9;
const MIN_SCENE_WORDS = 3;

const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Cuts words into even runs, so the last piece is never a stray word or two. */
function chunkWords(words: string[], maxWords: number): string[] {
  const pieces = Math.ceil(words.length / maxWords);
  const size = Math.ceil(words.length / pieces);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size).join(' '));
  return chunks;
}

/** Splits a long sentence, at its commas when they allow it. */
function splitSentence(sentence: string, maxWords: number): string[] {
  if (wordsOf(sentence).length <= maxWords) return [sentence];
  const pieces: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) pieces.push(current.join(' '));
    current = [];
  };
  for (const clause of sentence.split(/(?<=[,;:])\s+/)) {
    const words = wordsOf(clause);
    if (words.length > maxWords) {
      flush();
      pieces.push(...chunkWords(words, maxWords));
    } else {
      if (current.length + words.length > maxWords) flush();
      current.push(...words);
    }
  }
  flush();
  return pieces;
}

/** Folds fragments too short to carry a shot into the line before them, or after for the first. */
function mergeFragments(lines: string[], maxWords: number): string[] {
  const merged: string[] = [];
  let carry = '';
  for (const line of lines) {
    const text = carry ? `${carry} ${line}` : line;
    carry = '';
    const count = wordsOf(text).length;
    const previous = merged[merged.length - 1];
    if (count >= MIN_SCENE_WORDS) merged.push(text);
    else if (previous && wordsOf(previous).length + count <= maxWords) merged[merged.length - 1] = `${previous} ${text}`;
    else if (previous) merged.push(text);
    else carry = text;
  }
  if (carry) merged.push(carry);
  return merged;
}

function scriptLines(text: string): string[] {
  const sentences = splitSentences(text);
  const maxWords = sentences.length < 3 ? MAX_SCENE_WORDS_SPARSE : MAX_SCENE_WORDS;
  return mergeFragments(sentences.flatMap((s) => splitSentence(s, maxWords)), maxWords);
}

function topicLines(topic: string): string[] {
  return [
    t('Apa yang perlu kamu tahu tentang {0}?', topic),
    t('Pertama, pahami dulu dasar {0}.', topic),
    t('Kedua, cari contoh {0} di sekitarmu.', topic),
    t('Ketiga, bagikan pendapatmu tentang {0}.', topic),
    t('Simpan video ini, lalu ceritakan ke temanmu.')
  ];
}

function shotLabel(index: number, total: number): string {
  if (index === 0) return t('Pembuka');
  if (index === total - 1) return t('Penutup');
  return t('Bagian {0}', index + 1);
}

/** The longest word is the best cheap guess at what a line is about. */
function focusWord(line: string): string[] {
  const words = wordsOf(line)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length >= 4);
  if (words.length === 0) return [];
  return [words.reduce((best, w) => (w.length > best.length ? w : best))];
}

function titleFrom(text: string): string {
  const words = wordsOf(text);
  const head = words.slice(0, 6).join(' ').replace(/[.,;:!?…]+$/, '');
  const title = head.charAt(0).toUpperCase() + head.slice(1);
  return words.length > 6 ? `${title}…` : title;
}

/** True for text that is already a script, as opposed to a topic to write one about. */
export function looksLikeScript(text: string): boolean {
  return wordsOf(text).length > MAX_TOPIC_WORDS || splitSentences(text.trim()).length > 1;
}

/** The request a user pastes into a free AI chat to get a script for their topic. */
export function buildScriptRequest(topic: string): string {
  return t(
    'Tulis naskah video pendek vertikal tentang: {0}. Buat 5 sampai 7 kalimat pendek, maksimal 14 kata per kalimat. Kalimat pertama harus memancing rasa penasaran dan kalimat terakhir mengajak penonton berkomentar. Pakai hanya fakta yang kamu yakini benar. Tulis satu kalimat per baris. Jawab dengan naskahnya saja, tanpa judul, nomor, atau catatan.',
    topic.trim()
  );
}

/** Removes what AI chats wrap around a script: an intro line, list markers, bold marks, quotes. */
export function cleanPastedScript(input: string): string {
  const lines = input
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s+/, '')
        .replace(/^(?:[-*•]|\d+[.)])\s+/, '')
        .replace(/\*\*|__/g, '')
        .replace(/^["“”]+|["“”]+$/g, '')
        .trim()
    )
    .filter(Boolean);
  if (lines.length > 1 && lines[0].endsWith(':')) lines.shift();
  return lines.join('\n');
}

export function buildInstantStoryboard(input: string, now = Date.now()): InstantStoryboard | null {
  const text = cleanPastedScript(input);
  if (!text) return null;

  const isScript = looksLikeScript(text);
  const topic = text.replace(/\s+/g, ' ').replace(/[.,;:!?…]+$/, '');
  if (!isScript && !topic) return null;
  const lines = isScript ? scriptLines(text) : topicLines(topic);

  const scenes: Scene[] = lines.map((line, idx) => {
    const durationInSeconds = calculateFallbackSceneDuration(line);
    const focusWords = focusWord(line);
    return {
      id: `sc-instant-${now}-${idx}`,
      narrationText: line,
      text: line,
      // Instant layouts print this as the small label above the headline.
      visualIntent: shotLabel(idx, lines.length),
      largeType: true,
      emphasis: focusWords,
      focusWords,
      durationInSeconds,
      wordTimestamps: computeDeterministicWordAlignment(line, durationInSeconds)
    };
  });

  return { title: titleFrom(isScript ? text : topic), isOutline: !isScript, scenes };
}
