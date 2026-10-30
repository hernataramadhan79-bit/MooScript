import type { MooProject } from '../../types';
import { createCompositionFrameRenderer } from '../composition/compositionFrameRenderer';
import { getProjectDuration } from '../../utils/projectDuration';
import { createBrollReader, drawBrollFrame } from './brollReader';
import { GifEncoder } from './gifEncoder';
import { drawReframed, frameSize, type ReframeOptions } from './reframe';
import type { ExportProgress, ExportResult } from './mp4Exporter';

export interface GifOptions {
  /** Longest side in pixels (GIF files grow fast; 480 keeps a 15 s loop shareable). */
  maxSide?: number;
  fps?: number;
  reframe?: ReframeOptions;
  brollSources?: Record<string, Blob>;
}

/** The film as an endlessly looping, silent animated GIF, rendered by the same stage as the video. */
export async function exportGif(
  project: MooProject,
  onProgress: (p: ExportProgress) => void,
  signal?: AbortSignal,
  opts: GifOptions = {}
): Promise<ExportResult> {
  const width = project.width || 1080;
  const height = project.height || 1920;
  const fps = Math.max(5, Math.min(20, opts.fps || 12));
  const duration = getProjectDuration(project) || 1;
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const warnings: string[] = [];
  if (duration > 20) warnings.push('GIF lebih dari 20 detik biasanya terlalu besar untuk dibagikan; pertimbangkan MP4.');

  const reframe = opts.reframe && opts.reframe.aspect !== project.aspectRatio ? opts.reframe : null;
  const shape = reframe ? frameSize(reframe.aspect, '1080p') : { width, height };
  const maxSide = opts.maxSide || 480;
  const scale = Math.min(1, maxSide / Math.max(shape.width, shape.height));
  const outW = Math.max(2, Math.round(shape.width * scale));
  const outH = Math.max(2, Math.round(shape.height * scale));

  onProgress({ percent: 2, currentFrame: 0, totalFrames, statusText: 'Menyiapkan panggung render...' });
  const renderer = await createCompositionFrameRenderer(project, width, height);
  if (!renderer) throw new Error('Panggung render tidak bisa dimuat.');
  const reader = await createBrollReader(project.scenes, opts.brollSources);

  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const shaped = document.createElement('canvas');
  shaped.width = shape.width;
  shaped.height = shape.height;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext('2d', { willReadFrequently: true })!;
  outCtx.imageSmoothingQuality = 'high';
  const encoder = new GifEncoder(outW, outH);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) throw new DOMException('Export was cancelled by user', 'AbortError');
      const t = i / fps;
      const footage = reader ? await reader.frameAt(t) : null;
      await renderer.renderFrame(Math.round(t * (project.fps || 30)), t, frame, {
        underlay: footage ? (ctx) => drawBrollFrame(ctx, footage.canvas, footage.broll, width, height) : undefined
      });
      let source: HTMLCanvasElement = frame;
      if (reframe) {
        drawReframed(frame, shaped, reframe.mode);
        source = shaped;
      }
      outCtx.drawImage(source, 0, 0, outW, outH);
      encoder.addFrame(outCtx.getImageData(0, 0, outW, outH).data, 100 / fps);
      const percent = Math.min(99, Math.round(((i + 1) / totalFrames) * 97) + 2);
      onProgress({ percent, currentFrame: i + 1, totalFrames, statusText: `Membuat GIF ${i + 1}/${totalFrames}` });
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    renderer.cleanup();
    reader?.dispose();
  }

  const blob = encoder.finish();
  onProgress({ percent: 100, currentFrame: totalFrames, totalFrames, statusText: 'GIF selesai!' });
  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
    fileSizeBytes: blob.size,
    durationSeconds: totalFrames / fps,
    hasAudio: false,
    warnings,
    aspectRatio: reframe ? reframe.aspect : project.aspectRatio,
    width: outW,
    height: outH
  };
}
