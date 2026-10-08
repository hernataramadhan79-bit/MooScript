/**
 * subtitleExporter.ts — 100% client-side SRT & WebVTT subtitle generator and exporter.
 *
 * Generates standards-compliant .srt (SubRip) and .vtt (WebVTT) subtitle tracks
 * directly from MooProject scenes and word-level timestamps.
 *
 * Zero-server, runs entirely in the browser.
 */

import type { MooProject, WordTimestamp } from '../../types';

export type SubtitleFormat = 'srt' | 'vtt';
export type SubtitleCueMode = 'phrase' | 'scene' | 'word';

export interface SubtitleCue {
  index: number;
  startTime: number; // in seconds (absolute video timeline)
  endTime: number;   // in seconds (absolute video timeline)
  text: string;
}

export interface SubtitleExportOptions {
  /**
   * Cue segmentation mode:
   * - 'phrase' (default): groups words into readable chunks (3-6 words, or punctuation breaks)
   * - 'scene': 1 cue per scene covering the whole scene duration
   * - 'word': 1 cue per spoken word (for karaoke / animated subtitle workflows)
   */
  mode?: SubtitleCueMode;
  /** Maximum words per cue in 'phrase' mode. Default: 5 */
  maxWordsPerCue?: number;
}

/**
 * Format seconds into SubRip (SRT) timecode: HH:MM:SS,mmm
 * Example: 65.42 -> 00:01:05,420
 */
export function formatSrtTimecode(seconds: number): string {
  const clamped = Math.max(0, isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(clamped * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hrs = Math.floor(totalSecs / 3600);

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds into WebVTT timecode: HH:MM:SS.mmm
 * Example: 65.42 -> 00:01:05.420
 */
export function formatVttTimecode(seconds: number): string {
  const clamped = Math.max(0, isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(clamped * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hrs = Math.floor(totalSecs / 3600);

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Chunk scene words into natural phrase cues.
 * Splits on punctuation (, . ! ? ; :) or when maxWordsPerCue is reached.
 */
function chunkWordsIntoPhrases(
  words: WordTimestamp[],
  sceneOffset: number,
  maxWords: number,
  sceneDuration: number
): Array<{ startTime: number; endTime: number; text: string }> {
  if (words.length === 0) return [];

  const sceneEnd = sceneOffset + sceneDuration;
  const chunks: Array<{ startTime: number; endTime: number; text: string }> = [];
  let currentGroup: WordTimestamp[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentGroup.push(w);

    const hasPunctuation = /[,.!?;:]$/.test(w.word.trim());
    const isAtLimit = currentGroup.length >= maxWords;
    const isLastWord = i === words.length - 1;

    if (hasPunctuation || isAtLimit || isLastWord) {
      const startTime = Math.min(sceneOffset + currentGroup[0].start, sceneEnd);
      const endTime = Math.min(
        sceneEnd,
        Math.max(startTime + 0.1, sceneOffset + currentGroup[currentGroup.length - 1].end)
      );
      const text = currentGroup.map((cw) => cw.word).join(' ').trim();

      if (text.length > 0) {
        chunks.push({ startTime, endTime, text });
      }
      currentGroup = [];
    }
  }

  return chunks;
}

/**
 * Extract structured subtitle cues from a MooProject based on chosen cue mode.
 */
export function generateSubtitleCues(
  project: MooProject,
  opts: SubtitleExportOptions = {}
): SubtitleCue[] {
  const mode = opts.mode || 'phrase';
  const maxWords = Math.max(1, opts.maxWordsPerCue || 5);
  const cues: SubtitleCue[] = [];
  let cueIndex = 1;
  let sceneOffset = 0;

  for (const scene of project.scenes || []) {
    const sceneDuration = Math.max(0.1, scene.durationInSeconds || 2.0);
    const hasWordTimestamps = Array.isArray(scene.wordTimestamps) && scene.wordTimestamps.length > 0;

    const sceneText = (scene.narrationText || scene.text || '').trim();

    if (mode === 'scene' || !hasWordTimestamps) {
      // Scene mode: 1 cue covering the scene duration
      if (sceneText.length > 0) {
        cues.push({
          index: cueIndex++,
          startTime: sceneOffset,
          endTime: sceneOffset + sceneDuration,
          text: sceneText
        });
      }
    } else if (mode === 'word') {
      // Word mode: 1 cue per spoken word (clamped to scene bounds)
      const sceneEnd = sceneOffset + sceneDuration;
      for (const wt of scene.wordTimestamps) {
        const text = wt.word.trim();
        if (text.length > 0) {
          const startTime = Math.min(sceneOffset + wt.start, sceneEnd);
          const endTime = Math.min(sceneEnd, Math.max(startTime + 0.05, sceneOffset + wt.end));
          cues.push({
            index: cueIndex++,
            startTime,
            endTime,
            text
          });
        }
      }
    } else {
      // Phrase mode: chunk words into bite-sized phrases
      const phrases = chunkWordsIntoPhrases(scene.wordTimestamps, sceneOffset, maxWords, sceneDuration);
      if (phrases.length > 0) {
        for (const p of phrases) {
          cues.push({
            index: cueIndex++,
            startTime: p.startTime,
            endTime: p.endTime,
            text: p.text
          });
        }
      } else if (sceneText.length > 0) {
        // Fallback if phrase chunking produced nothing
        cues.push({
          index: cueIndex++,
          startTime: sceneOffset,
          endTime: sceneOffset + sceneDuration,
          text: sceneText
        });
      }
    }

    sceneOffset += sceneDuration;
  }

  return cues;
}

/**
 * Generate standard SubRip (.srt) subtitle string from a MooProject.
 */
export function generateSrt(
  project: MooProject,
  opts: SubtitleExportOptions = {}
): string {
  const cues = generateSubtitleCues(project, opts);
  if (cues.length === 0) return '';

  const blocks = cues.map((cue) => {
    const timeRange = `${formatSrtTimecode(cue.startTime)} --> ${formatSrtTimecode(cue.endTime)}`;
    return `${cue.index}\n${timeRange}\n${cue.text}`;
  });

  return `${blocks.join('\n\n')}\n`;
}

/**
 * Generate standard WebVTT (.vtt) subtitle string from a MooProject.
 */
export function generateVtt(
  project: MooProject,
  opts: SubtitleExportOptions = {}
): string {
  const cues = generateSubtitleCues(project, opts);
  if (cues.length === 0) return 'WEBVTT\n';

  const blocks = cues.map((cue) => {
    const timeRange = `${formatVttTimecode(cue.startTime)} --> ${formatVttTimecode(cue.endTime)}`;
    return `${cue.index}\n${timeRange}\n${cue.text}`;
  });

  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

/**
 * Trigger client-side download of a subtitle file (.srt or .vtt).
 */
export function downloadSubtitleFile(
  project: MooProject,
  format: SubtitleFormat,
  opts: SubtitleExportOptions = {}
): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  const content = format === 'srt' ? generateSrt(project, opts) : generateVtt(project, opts);
  const cleanTitle = (project.title || 'mooscript').toLowerCase().replace(/[^a-z0-9]/gi, '_');
  const filename = `${cleanTitle}.${format}`;
  const mimeType = format === 'srt' ? 'application/x-subrip' : 'text/vtt';

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
