// Kept apart from mp4Exporter so the UI can import these without pulling mediabunny into the main bundle.

/** Scales the adaptive video bitrate: smaller files, the default, or higher fidelity. */
export type ExportQuality = 'compact' | 'standard' | 'high';

export const EXPORT_QUALITY_FACTOR: Record<ExportQuality, number> = {
  compact: 0.6,
  standard: 1,
  high: 1.6
};

export const EXPORT_FPS_CHOICES = [24, 30, 60] as const;
