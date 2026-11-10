// Kept apart from mp4Exporter so the UI can import these without pulling mediabunny into the main bundle.

/** Scales the adaptive video bitrate: smaller files, the default, or higher fidelity. */
export type ExportQuality = 'compact' | 'standard' | 'high';

export const EXPORT_QUALITY_FACTOR: Record<ExportQuality, number> = {
  compact: 0.6,
  standard: 1,
  high: 1.6
};

/** Audio bitrate (AAC or Opus) for each quality. */
export const EXPORT_AUDIO_BITRATE: Record<ExportQuality, number> = {
  compact: 128_000,
  standard: 160_000,
  high: 192_000
};

export const EXPORT_FPS_CHOICES = [24, 30, 60] as const;

/** Motion blur: moments blended into one frame, and the share of the frame time they cover (a 180° shutter). */
export const MOTION_BLUR_SAMPLES = 4;
export const MOTION_BLUR_SHUTTER = 0.5;

/** Stage times blended into the frame at `frame`: one time without blur, evenly spread over the shutter with it. */
export function motionBlurTimes(frame: number, fps: number, samples = MOTION_BLUR_SAMPLES, shutter = MOTION_BLUR_SHUTTER): number[] {
  const count = Math.max(1, Math.floor(samples));
  const start = frame / fps;
  return Array.from({ length: count }, (_, k) => start + ((k / count) * shutter) / fps);
}
