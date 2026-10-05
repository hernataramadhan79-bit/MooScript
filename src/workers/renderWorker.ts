/// <reference lib="webworker" />
import type { MooProject, ThemeTokens } from '../types';
import { CanvasRenderer } from '../engine/renderer/canvasRenderer';

export interface RenderWorkerInput {
  type: 'START_RENDER';
  project: MooProject;
  themeTokens?: ThemeTokens;
  audioData?: {
    channelData: Float32Array[];
    sampleRate: number;
    numberOfChannels: number;
    duration: number;
  };
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  bitrate?: number;
  opts?: {
    hud?: boolean;
    watermark?: boolean;
  };
}

export interface RenderWorkerProgress {
  type: 'PROGRESS';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  statusText: string;
}

export interface RenderWorkerSuccess {
  type: 'SUCCESS';
  chunks: Array<{
    type: 'key' | 'delta';
    timestamp: number;
    duration?: number;
    data: ArrayBuffer;
    meta?: any;
  }>;
  totalFrames: number;
}

export interface RenderWorkerError {
  type: 'ERROR';
  error: string;
}

export interface RenderWorkerCancelled {
  type: 'CANCELLED';
}

let isCancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'CANCEL') {
    isCancelled = true;
    return;
  }

  if (data.type === 'START_RENDER') {
    isCancelled = false;
    const {
      project,
      themeTokens,
      fps = 30,
      width = 1080,
      height = 1920,
      totalFrames,
      bitrate = 6_000_000,
      opts
    } = data as RenderWorkerInput;

    if (themeTokens && !project.themeTokens) {
      project.themeTokens = themeTokens;
    }

    try {
      if (typeof OffscreenCanvas === 'undefined') {
        throw new Error('OffscreenCanvas is not supported in this worker environment.');
      }

      const offscreen = new OffscreenCanvas(width, height);
      const renderer = new CanvasRenderer(offscreen as any, width, height);

      let encoder: VideoEncoder | null = null;
      const chunks: Array<{
        type: 'key' | 'delta';
        timestamp: number;
        duration?: number;
        data: ArrayBuffer;
        meta?: any;
      }> = [];

      const hasVideoEncoder = typeof VideoEncoder !== 'undefined';

      let lastMeta: any = undefined;

      if (hasVideoEncoder) {
        encoder = new VideoEncoder({
          output: (chunk, metadata) => {
            const buffer = new Uint8Array(chunk.byteLength);
            chunk.copyTo(buffer);

            let metaSerialized: any = undefined;
            if (metadata?.decoderConfig) {
              let descBuffer: ArrayBuffer | undefined = undefined;
              if (metadata.decoderConfig.description) {
                if (metadata.decoderConfig.description instanceof ArrayBuffer) {
                  descBuffer = metadata.decoderConfig.description;
                } else if (ArrayBuffer.isView(metadata.decoderConfig.description)) {
                  descBuffer = new Uint8Array(metadata.decoderConfig.description as any).buffer;
                }
              }
              metaSerialized = {
                decoderConfig: {
                  codec: metadata.decoderConfig.codec || 'avc1.4d002a',
                  codedWidth: metadata.decoderConfig.codedWidth ?? width,
                  codedHeight: metadata.decoderConfig.codedHeight ?? height,
                  description: descBuffer
                }
              };
              lastMeta = metaSerialized;
            }

            chunks.push({
              type: chunk.type,
              timestamp: chunk.timestamp,
              duration: chunk.duration ?? undefined,
              data: buffer.buffer,
              meta: metaSerialized
            });
          },
          error: (err) => {
            self.postMessage({ type: 'ERROR', error: String(err) });
          }
        });

        encoder.configure({
          codec: 'avc1.4d002a',
          width,
          height,
          bitrate,
          framerate: fps
        });
      }

      for (let f = 0; f < totalFrames; f++) {
        if (isCancelled) {
          if (encoder && encoder.state !== 'closed') {
            encoder.close();
          }
          renderer.clearCaches();
          self.postMessage({ type: 'CANCELLED' });
          return;
        }

        renderer.draw(f, totalFrames, project, {
          hud: opts?.hud ?? false,
          watermark: opts?.watermark ?? false
        });

        if (hasVideoEncoder && encoder) {
          const timestampMicros = Math.round((f / fps) * 1_000_000);
          const durationMicros = Math.round((1 / fps) * 1_000_000);

          const frame = new VideoFrame(offscreen, {
            timestamp: timestampMicros,
            duration: durationMicros
          });

          const isKeyFrame = f % (fps * 2) === 0;
          encoder.encode(frame, { keyFrame: isKeyFrame });

          // CRITICAL: Close VideoFrame immediately after submission to avoid GPU memory leaks
          frame.close();

          if (encoder.encodeQueueSize > 4) {
            await encoder.flush();
          }
        }

        const percent = Math.min(99, Math.round(((f + 1) / totalFrames) * 95) + 5);
        self.postMessage({
          type: 'PROGRESS',
          currentFrame: f + 1,
          totalFrames,
          percent,
          statusText: `Worker rendered frame ${f + 1}/${totalFrames} (${percent}%)`
        });
      }

      if (hasVideoEncoder && encoder) {
        await encoder.flush();
        encoder.close();
      }

      renderer.clearCaches();

      if (chunks.length > 0 && !chunks[0].meta && lastMeta) {
        chunks[0].meta = lastMeta;
      }

      self.postMessage({
        type: 'SUCCESS',
        chunks,
        totalFrames
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'ERROR', error: errMsg });
    }
  }
};

