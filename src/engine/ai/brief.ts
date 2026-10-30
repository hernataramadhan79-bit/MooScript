import type { AspectRatio, BriefPlatform, CreativeBrief } from '../../types';

export interface BriefPlatformInfo {
  id: BriefPlatform;
  label: string;
  /** null keeps whatever frame the project already has. */
  aspectRatio: AspectRatio | null;
  durations: number[];
  defaultDuration: number;
}

export const BRIEF_PLATFORMS: BriefPlatformInfo[] = [
  { id: 'tiktok', label: 'TikTok', aspectRatio: '9:16', durations: [15, 30, 45, 60, 90], defaultDuration: 30 },
  { id: 'reels', label: 'Instagram Reels', aspectRatio: '9:16', durations: [15, 30, 45, 60, 90], defaultDuration: 30 },
  { id: 'shorts', label: 'YouTube Shorts', aspectRatio: '9:16', durations: [15, 30, 45, 60], defaultDuration: 30 },
  { id: 'youtube', label: 'YouTube', aspectRatio: '16:9', durations: [30, 60, 90, 120, 180], defaultDuration: 60 },
  { id: 'feed', label: 'Feed (IG / LinkedIn)', aspectRatio: '1:1', durations: [15, 30, 45, 60], defaultDuration: 30 },
  { id: 'other', label: 'Lainnya', aspectRatio: null, durations: [15, 30, 45, 60, 90, 120], defaultDuration: 30 }
];

export const BRIEF_TONES = ['Santai', 'Edukatif', 'Energik', 'Serius', 'Lucu', 'Inspiratif', 'Dramatis'];

export const MIN_TARGET_SECONDS = 10;
export const MAX_TARGET_SECONDS = 300;

export function getBriefPlatform(id: BriefPlatform | undefined): BriefPlatformInfo | undefined {
  return BRIEF_PLATFORMS.find((p) => p.id === id);
}

export interface ShotPlan {
  targetSec: number;
  minShots: number;
  maxShots: number;
  minShotSec: number;
  maxShotSec: number;
  minWords: number;
  maxWords: number;
}

/**
 * How many shots, how long each, and how many spoken words fit a target length. Short videos keep
 * the fast 2-4.5 s cutting; longer ones get longer shots so the shot count (one AI call each) stays sane.
 */
export function planShots(targetSec: number): ShotPlan {
  const target = Math.min(MAX_TARGET_SECONDS, Math.max(MIN_TARGET_SECONDS, Math.round(targetSec)));
  const [minShotSec, maxShotSec] = target <= 45 ? [2, 4.5] : target <= 90 ? [3, 6] : [4, 8];
  const center = Math.round(target / ((minShotSec + maxShotSec) / 2));
  const minShots = Math.max(3, Math.round(center * 0.75));
  const maxShots = Math.max(minShots + 1, Math.round(center * 1.25));
  return {
    targetSec: target,
    minShots,
    maxShots,
    minShotSec,
    maxShotSec,
    minWords: Math.round(minShotSec * 2),
    maxWords: Math.round(maxShotSec * 2.7)
  };
}

/** One line of creator text, safe to place inside a prompt. */
function promptField(value: string | undefined, max = 200): string {
  return (value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

/** The brief as prompt lines; empty when the creator left everything open. */
export function briefPromptLines(brief: CreativeBrief | undefined): string[] {
  if (!brief) return [];
  const platform = getBriefPlatform(brief.platform);
  const lines: string[] = [];
  if (platform && platform.id !== 'other') {
    lines.push(`Platform: ${platform.label}${platform.aspectRatio ? ` (${platform.aspectRatio} frame)` : ''}`);
  }
  if (brief.targetDurationSec) {
    lines.push(`Target length: about ${planShots(brief.targetDurationSec).targetSec} seconds in total (stay within 15%)`);
  }
  const tone = promptField(brief.tone, 60);
  if (tone) lines.push(`Tone: ${tone}`);
  const audience = promptField(brief.audience);
  if (audience) lines.push(`Audience: ${audience}`);
  const goal = promptField(brief.goal);
  if (goal) lines.push(`Goal / call to action: ${goal}`);
  return lines;
}

/** Short summary for the collapsed brief row, e.g. "TikTok · 30 dtk · Santai". */
export function briefSummary(brief: CreativeBrief | undefined): string {
  if (!brief) return '';
  const parts: string[] = [];
  const platform = getBriefPlatform(brief.platform);
  if (platform && platform.id !== 'other') parts.push(platform.label);
  if (brief.targetDurationSec) parts.push(`${brief.targetDurationSec} dtk`);
  if (brief.tone) parts.push(brief.tone);
  if (brief.audience) parts.push(brief.audience);
  return parts.join(' · ');
}
