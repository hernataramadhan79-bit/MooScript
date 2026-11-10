
import type { LayerMotion, SfxCue, SfxKind } from '../../../types';

/** Peaks sampled from the audio; enough for a zoomed-in track without hurting the compact one. */
export const WAVEFORM_PEAKS = 480;
export const LABEL_COL = 76;
export const MAX_ZOOM = 24;
/** Pixel distance within which a dragged edge snaps to the playhead, a marker or a shot edge. */
export const SNAP_PX = 6;

/** Format studio timecode: 00:02.1 */
export function formatTimecode(sec: number): string {
  const safeSec = Math.max(0, isNaN(sec) ? 0 : sec);
  const mins = Math.floor(safeSec / 60);
  const s = Math.floor(safeSec % 60);
  const tenths = Math.floor((safeSec % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

/** Ruler step (seconds between labels) so labels stay at least ~70 px apart. */
export function rulerStep(pxPerSec: number): number {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  return steps.find((s) => s * pxPerSec >= 70) ?? 120;
}

export function formatRulerLabel(sec: number, step: number): string {
  const mins = Math.floor(sec / 60);
  const rest = sec - mins * 60;
  const secText = step < 1 ? rest.toFixed(step < 0.5 ? 2 : 1) : String(Math.round(rest));
  return mins > 0 ? `${mins}:${secText.padStart(step < 1 ? 4 : 2, '0')}` : `${secText}s`;
}

/** SVG path of a mirrored waveform across `width` x `height`. */
export function waveformPath(peaks: number[], width: number, height: number): string {
  if (peaks.length === 0 || width <= 0) return '';
  const mid = height / 2;
  const step = width / peaks.length;
  const top: string[] = [];
  const bottom: string[] = [];
  peaks.forEach((p, i) => {
    const amp = Math.max(0.04, Math.min(1, p)) * mid;
    const x = (i + 0.5) * step;
    top.push(`${x.toFixed(1)},${(mid - amp).toFixed(1)}`);
    bottom.push(`${x.toFixed(1)},${(mid + amp).toFixed(1)}`);
  });
  return `M0,${mid} L${top.join(' L')} L${width},${mid} L${bottom.reverse().join(' L')} Z`;
}

export interface SceneBoundary {
  id: string;
  shotNumber: number;
  durationInSeconds: number;
  startSec: number;
  endSec: number;
  narrationText: string;
  wordTimestamps: { word: string; start: number; end: number }[];
}

export interface MultiTrackTimelineProps {
  totalDuration: number;
  fps: number;
  currentFrame: number;
  totalFrames: number;
  sceneBoundaries: SceneBoundary[];
  activeIndex: number;
  activeSceneId: string | null;
  isPlaying: boolean;
  isLooping: boolean;
  audioStale: boolean;
  isAudioActive: boolean;
  audioLabel: string;
  audioDuration: number;
  waveformPeaks: number[] | null;
  musicLabel: string | null;
  chunkSize: number;
  markers: { id: string; time: number; label: string }[];
  loopRange: { start: number; end: number } | null;
  onSeekFrame: (frame: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSelectScene: (id: string, startSec: number) => void;
  onSetDuration: (id: string, dur: number) => void;
  onSetBoundary: (id: string, timeSec: number) => void;
  onSplit: () => void;
  onSetLoopPoint: (edge: 'start' | 'end', t: number) => void;
  onClearLoop: () => void;
  onAddMarker: (t: number, label?: string) => string;
  onUpdateMarker: (id: string, update: { time?: number; label?: string }) => void;
  onRemoveMarker: (id: string) => void;
  onTheater: () => void;
  sfxCues: SfxCue[];
  beats: number[];
  beatsBpm: number | null;
  hasScenes: boolean;
  onAddSfx: (kind: SfxKind) => void;
  onUpdateSfx: (id: string, update: Partial<Omit<SfxCue, 'id'>>) => void;
  onRemoveSfx: (id: string) => void;
  onAutoSfx: () => void;
  onAnalyzeBeats: () => void;
  onSnapToBeats: () => void;
  layerTrack: {
    layerId: string;
    shotStart: number;
    shotDuration: number;
    motion: LayerMotion | undefined;
    onChange: (motion: LayerMotion | null) => void;
  } | null;
}

export const toolBtn =
  'h-7 min-w-[28px] px-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center gap-1 text-[10px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none';
