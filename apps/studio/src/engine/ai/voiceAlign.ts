import type { WordTimestamp } from '../../types';

/** Whisper rejects uploads above 25 MB; stay under it. */
export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

export interface AlignedScene {
  durationInSeconds: number;
  /** Relative to the scene's own start. */
  wordTimestamps: WordTimestamp[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const splitWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** Whisper word-level transcription of a whole recording. Returns [] on any failure. */
export async function transcribeWords(params: {
  apiKey: string;
  audio: Blob;
  fileName?: string;
  signal?: AbortSignal;
}): Promise<WordTimestamp[]> {
  const { apiKey, audio, fileName = 'voiceover.mp3', signal } = params;
  if (audio.size > WHISPER_MAX_BYTES) return [];
  try {
    const form = new FormData();
    form.append('file', audio, fileName);
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.words)) return [];
    return data.words.map((w: { word: string; start: number; end: number }) => ({
      word: String(w.word).trim(),
      start: w.start,
      end: w.end
    }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return [];
  }
}

/**
 * Split an uploaded voice-over across scenes using the recording's own timing.
 *
 * The transcript rarely matches the script word for word, so script word i is mapped onto the
 * transcript proportionally (i * transcriptWords / scriptWords). Each scene starts where its first
 * script word is spoken; scene 1 starts at 0 and the last scene runs to `totalDuration`, so the
 * durations always add up to the recording length. Returns null when there is nothing to align.
 */
export function alignScenesToTranscript(
  sceneTexts: string[],
  transcript: WordTimestamp[],
  totalDuration: number
): AlignedScene[] | null {
  const scriptWords = sceneTexts.map(splitWords);
  const totalScript = scriptWords.reduce((sum, w) => sum + w.length, 0);
  if (totalScript === 0 || transcript.length === 0 || totalDuration <= 0) return null;

  const ratio = transcript.length / totalScript;
  const startOf = (globalIndex: number) =>
    Math.min(totalDuration, transcript[Math.min(transcript.length - 1, Math.floor(globalIndex * ratio))].start);

  // Absolute start time of every script word, in order.
  const starts: number[] = [];
  for (let i = 0; i < totalScript; i++) starts.push(startOf(i));

  let cursor = 0;
  const sceneStarts = scriptWords.map((words, idx) => {
    const start = idx === 0 ? 0 : (starts[cursor] ?? totalDuration);
    cursor += words.length;
    return start;
  });

  return scriptWords.map((words, idx) => {
    const start = sceneStarts[idx];
    const end = idx === scriptWords.length - 1 ? totalDuration : Math.max(start, sceneStarts[idx + 1]);
    const duration = Math.max(0.5, round3(end - start));
    const firstGlobal = scriptWords.slice(0, idx).reduce((sum, w) => sum + w.length, 0);
    const wordTimestamps = words.map((word, i) => {
      const wordStart = starts[firstGlobal + i] - start;
      const nextAbs = firstGlobal + i + 1 < totalScript ? starts[firstGlobal + i + 1] : totalDuration;
      const wordEnd = Math.min(duration, nextAbs - start);
      const s = Math.max(0, Math.min(duration, wordStart));
      return { word, start: round3(s), end: round3(Math.max(s, wordEnd)) };
    });
    return { durationInSeconds: duration, wordTimestamps };
  });
}
