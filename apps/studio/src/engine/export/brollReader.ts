import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import type { Scene, SceneBroll } from '../../types';
import { activeBrollAt } from '../composition/broll';
import { placeFrame } from './reframe';

type FrameCanvas = HTMLCanvasElement | OffscreenCanvas;

interface OpenVideo {
  input: Input;
  sink: CanvasSink;
  duration: number;
}

export interface BrollReader {
  /** The footage frame at a film time, ready to draw, or null when no B-roll plays there. */
  frameAt: (timeSec: number) => Promise<{ canvas: FrameCanvas; broll: SceneBroll } | null>;
  dispose: () => void;
}

/**
 * Decodes the B-roll videos of a film frame by frame for export, through the browser's video
 * decoder (Mediabunny). Returns null when the film has no B-roll it can read.
 */
export async function createBrollReader(scenes: Scene[], sources: Record<string, Blob> | undefined): Promise<BrollReader | null> {
  const ids = Array.from(new Set(scenes.map((s) => s.broll?.assetId).filter((id): id is string => Boolean(id))));
  if (!sources || ids.length === 0) return null;
  const videos = new Map<string, OpenVideo>();
  for (const id of ids) {
    const blob = sources[id];
    if (!blob) continue;
    try {
      const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) {
        input.dispose?.();
        continue;
      }
      videos.set(id, { input, sink: new CanvasSink(track, { poolSize: 2 }), duration: await track.computeDuration() });
    } catch (err) {
      console.warn('B-roll video could not be opened', err);
    }
  }
  if (videos.size === 0) return null;

  return {
    frameAt: async (timeSec) => {
      const active = activeBrollAt(scenes, timeSec);
      const video = active && videos.get(active.broll.assetId);
      if (!active || !video) return null;
      // Footage shorter than its shot loops.
      const t = video.duration > 0 ? active.videoTime % video.duration : active.videoTime;
      const wrapped = await video.sink.getCanvas(t);
      return wrapped ? { canvas: wrapped.canvas, broll: active.broll } : null;
    },
    dispose: () => {
      for (const v of videos.values()) v.input.dispose?.();
      videos.clear();
    }
  };
}

/** Draws a footage frame over the whole target (cover or contain), then the darkening. */
export function drawBrollFrame(ctx: CanvasRenderingContext2D, frame: FrameCanvas, broll: SceneBroll, width: number, height: number): void {
  const at = placeFrame({ width: frame.width, height: frame.height }, { width, height }, broll.fit === 'contain' ? 'fit' : 'crop');
  ctx.drawImage(frame as CanvasImageSource, at.x, at.y, at.width, at.height);
  if (broll.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, broll.dim)})`;
    ctx.fillRect(0, 0, width, height);
  }
}
