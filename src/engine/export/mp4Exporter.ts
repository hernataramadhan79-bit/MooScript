import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  AudioBufferSource,
  canEncodeAudio,
  canEncodeVideo
} from 'mediabunny';
import type { MooProject } from '../../types';
import { CanvasRenderer } from '../renderer/canvasRenderer';
import { createCompositionFrameRenderer, type FrameRenderer } from '../composition/compositionFrameRenderer';

export interface ExportProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  statusText: string;
}

export interface ExportResult {
  blob: Blob;
  objectUrl: string;
  fileSizeBytes: number;
  durationSeconds: number;
  hasAudio: boolean;
  warnings: string[];
}

export interface ExportOptions {
  hud?: boolean;
  watermark?: boolean;
}

async function yieldOrSleep(ms = 4): Promise<void> {
  const scheduler = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === 'function') {
    await scheduler.yield();
  } else {
    await new Promise((r) => setTimeout(r, ms));
  }
}

async function resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate = 48000): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) return audioBuffer;
  const numChannels = Math.min(2, audioBuffer.numberOfChannels);
  const targetLength = Math.ceil(audioBuffer.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(numChannels, targetLength, targetSampleRate);
  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);
  return await offlineCtx.startRendering();
}

export async function exportMooProjectToMP4(
  project: MooProject,
  onProgress: (progress: ExportProgress) => void,
  abortSignal?: AbortSignal,
  opts?: ExportOptions
): Promise<ExportResult> {
  const fps = project.fps || 30;
  const width = project.width || 1080;
  const height = project.height || 1920;
  const warnings: string[] = [];
  let hasAudio = false;

  // 1. Verify WebCodecs VideoEncoder availability via mediabunny
  const isVideoSupported = await canEncodeVideo('avc');
  if (!isVideoSupported && typeof VideoEncoder === 'undefined') {
    throw new Error(
      'WebCodecs VideoEncoder tidak didukung pada browser ini. Silakan gunakan Google Chrome, Microsoft Edge, atau browser modern lainnya.'
    );
  }

  // Calculate adaptive bitrate based on resolution and fps
  const basePixels = 1080 * 1920 * 30;
  const currentPixels = width * height * fps;
  const calculatedBitrate = Math.round((currentPixels / basePixels) * 6_000_000);
  const bitrate = Math.max(2_000_000, Math.min(12_000_000, calculatedBitrate));

  // Pre-load fonts and check availability
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
      await Promise.allSettled([
        document.fonts.load('800 74px "Plus Jakarta Sans"'),
        document.fonts.load('600 32px "JetBrains Mono"')
      ]);
      const hasJakarta = document.fonts.check('800 74px "Plus Jakarta Sans"');
      if (!hasJakarta) {
        warnings.push('Font "Plus Jakarta Sans" tidak dapat dimuat; rendering menggunakan font fallback sistem.');
      }
    } catch {
      warnings.push('Pemeriksaan kesiapan font sistem dilewati.');
    }
  }

  onProgress({ percent: 2, currentFrame: 0, totalFrames: 0, statusText: 'Initializing audio buffer...' });

  // 2. Decode Audio if present
  let audioBuffer: AudioBuffer | null = null;
  let totalDuration = 0;

  if (project.audioBlob && project.audioBlob.size > 0) {
    try {
      const audioCtx = new (
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const arrayBuffer = await project.audioBlob.arrayBuffer();
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      totalDuration = audioBuffer.duration;
      await audioCtx.close();
    } catch {
      warnings.push('Audio file gagal didecode, durasi ditentukan berdasarkan durasi scene.');
    }
  }

  // Fallback duration based on scene durations
  if (totalDuration <= 0) {
    totalDuration = project.scenes.reduce((acc, s) => acc + (s.durationInSeconds > 0 ? s.durationInSeconds : 3), 0);
  }
  if (totalDuration <= 0) {
    totalDuration = 5; // Default 5 seconds if completely empty
  }

  const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));

  onProgress({ percent: 5, currentFrame: 0, totalFrames, statusText: 'Setting up Mediabunny MP4 muxer & codecs...' });

  // 3. Test AudioEncoder capability & Resample if necessary
  let hasAudioTrack = false;
  let targetAudioBuffer = audioBuffer;

  if (audioBuffer) {
    const isAudioSupported = await canEncodeAudio('aac');
    if (!isAudioSupported && typeof AudioEncoder === 'undefined') {
      warnings.push('AudioEncoder tidak didukung oleh browser Anda. Video diekspor tanpa audio.');
    } else {
      // Ensure 48kHz for broad compatibility
      if (audioBuffer.sampleRate !== 48000) {
        try {
          targetAudioBuffer = await resampleAudioBuffer(audioBuffer, 48000);
        } catch (e) {
          console.warn('Audio resampling failed, proceeding with original buffer:', e);
          targetAudioBuffer = audioBuffer;
        }
      }
      hasAudioTrack = true;
    }
  }

  // 4. Initialize Mediabunny Output with in-memory fastStart
  const target = new BufferTarget();
  const output = new Output({
    target,
    format: new Mp4OutputFormat({ fastStart: 'in-memory' })
  });

  // 5. Setup Dedicated Offline Canvas Renderer
  const canvasRenderer = new CanvasRenderer(undefined, width, height);
  const rawCanvas = canvasRenderer.getCanvas();

  const isCompositionMode =
    (project.renderMode || 'composition') === 'composition' &&
    !!project.composition?.scenes?.length;

  let compRenderer: FrameRenderer | null = null;
  if (isCompositionMode) {
    onProgress({ percent: 3, currentFrame: 0, totalFrames, statusText: 'Initializing composition headless sandbox...' });
    compRenderer = await createCompositionFrameRenderer(project, width, height);
  }

  const videoSource = new CanvasSource(rawCanvas as HTMLCanvasElement, {
    codec: 'avc',
    bitrate
  });
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  if (hasAudioTrack && targetAudioBuffer) {
    audioSource = new AudioBufferSource({
      codec: 'aac',
      bitrate: 128_000
    });
    output.addAudioTrack(audioSource);
  }

  try {
    await output.start();

    // 6. Encode Audio Track if enabled
    if (audioSource && targetAudioBuffer) {
      try {
        await audioSource.add(targetAudioBuffer);
        hasAudio = true;
      } catch (audioErr) {
        if (abortSignal?.aborted || (audioErr instanceof DOMException && audioErr.name === 'AbortError')) {
          throw audioErr;
        }
        warnings.push(
          `Encoding audio gagal (${audioErr instanceof Error ? audioErr.message : String(audioErr)}). Video diekspor tanpa audio.`
        );
        hasAudio = false;
      }
    }

    // 7. Deterministic Render Loop
    for (let frame = 0; frame < totalFrames; frame++) {
      if (abortSignal?.aborted) {
        await output.cancel().catch(() => {});
        throw new DOMException('Export was cancelled by user', 'AbortError');
      }

      // 1. Draw frame deterministically: RenderState = f(currentFrame, fps, project)
      if (compRenderer) {
        await compRenderer.renderFrame(frame, frame / fps, rawCanvas as HTMLCanvasElement);
      } else {
        canvasRenderer.draw(frame, totalFrames, project, {
          hud: opts?.hud ?? false,
          watermark: opts?.watermark ?? false
        });
      }

      // 2. Add canvas frame to Mediabunny (auto-encodes, respects dequeue backpressure, and closes frame)
      await videoSource.add(frame / fps, 1 / fps);

      // 3. Report Progress to UI
      const percent = Math.min(99, Math.round(((frame + 1) / totalFrames) * 95) + 5);
      onProgress({
        percent,
        currentFrame: frame + 1,
        totalFrames,
        statusText: `Encoding frame ${frame + 1}/${totalFrames} (${percent}%)`
      });

      // 4. Yield periodically
      if (frame % 30 === 0) {
        await yieldOrSleep(0);
      }
    }

    onProgress({ percent: 98, currentFrame: totalFrames, totalFrames, statusText: 'Finalizing MP4 container...' });

    await output.finalize();

    const buffer = target.buffer;
    if (!buffer) {
      throw new Error('Mediabunny output buffer is empty.');
    }

    const blob = new Blob([buffer], { type: 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);

    onProgress({ percent: 100, currentFrame: totalFrames, totalFrames, statusText: 'Export completed!' });

    return {
      blob,
      objectUrl,
      fileSizeBytes: blob.size,
      durationSeconds: totalDuration,
      hasAudio,
      warnings
    };
  } catch (err: unknown) {
    await output.cancel().catch(() => {});
    if (abortSignal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new DOMException('Export was cancelled by user', 'AbortError');
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`VideoEncoder error during export: ${message}`);
  } finally {
    if (compRenderer) {
      compRenderer.cleanup();
    }
  }
}
