import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  AudioBufferSource,
  EncodedVideoPacketSource,
  EncodedPacket,
  canEncodeAudio,
  canEncodeVideo
} from 'mediabunny';
import type { MooProject, ThemeTokens } from '../../types';
import { resolveTheme } from '../../types';
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
  useAudioDuration?: boolean;
  useWorker?: boolean;
}

export async function runWorkerRenderPipeline(
  project: MooProject,
  width: number,
  height: number,
  fps: number,
  totalFrames: number,
  bitrate: number,
  opts?: ExportOptions,
  onProgress?: (progress: ExportProgress) => void,
  abortSignal?: AbortSignal,
  themeTokens?: ThemeTokens,
  audioData?: {
    channelData: Float32Array[];
    sampleRate: number;
    numberOfChannels: number;
    duration: number;
  }
): Promise<Array<{ type: 'key' | 'delta'; timestamp: number; duration?: number; data: ArrayBuffer; meta?: any }>> {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not supported in this environment.');
  }

  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../../workers/renderWorker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    };

    if (abortSignal) {
      abortSignal.addEventListener(
        'abort',
        () => {
          if (worker) {
            worker.postMessage({ type: 'CANCEL' });
            cleanup();
          }
          reject(new DOMException('Export was cancelled by user', 'AbortError'));
        },
        { once: true }
      );
    }

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;

      if (data.type === 'PROGRESS') {
        onProgress?.({
          percent: data.percent,
          currentFrame: data.currentFrame,
          totalFrames: data.totalFrames,
          statusText: data.statusText
        });
      } else if (data.type === 'SUCCESS') {
        cleanup();
        resolve(data.chunks);
      } else if (data.type === 'ERROR') {
        cleanup();
        reject(new Error(data.error || 'Worker render error'));
      } else if (data.type === 'CANCELLED') {
        cleanup();
        reject(new DOMException('Export was cancelled by user', 'AbortError'));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(`Worker error: ${err.message || String(err)}`));
    };

    worker.postMessage({
      type: 'START_RENDER',
      project,
      themeTokens,
      audioData,
      fps,
      width,
      height,
      totalFrames,
      bitrate,
      opts: {
        hud: opts?.hud ?? false,
        watermark: opts?.watermark ?? false
      }
    });
  });
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
  if (!isVideoSupported || typeof VideoEncoder === 'undefined') {
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
  let audioDuration = 0;
  let totalDuration = 0;

  const scenesDurationSum = project.scenes.reduce(
    (acc, s) => acc + (s.durationInSeconds > 0 ? s.durationInSeconds : 3),
    0
  );

  const isAudioStale = (project as { audioStale?: boolean }).audioStale;
  const useAudioDuration = opts?.useAudioDuration ?? (isAudioStale !== undefined ? !isAudioStale : true);

  if (project.audioBlob && project.audioBlob.size > 0) {
    try {
      let audioCtx: AudioContext | null = null;
      try {
        audioCtx = new (
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
        const arrayBuffer = await project.audioBlob.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioDuration = audioBuffer.duration;
      } finally {
        if (audioCtx) {
          await audioCtx.close().catch(() => {});
        }
      }

      if (Math.abs(audioDuration - scenesDurationSum) > 0.5) {
        warnings.push(
          `Durasi audio (${audioDuration.toFixed(2)}s) berbeda dari total durasi scene (${scenesDurationSum.toFixed(2)}s) lebih dari 0.5s.`
        );
      }
    } catch {
      warnings.push('Audio file gagal didecode, durasi ditentukan berdasarkan durasi scene.');
    }
  }

  if (useAudioDuration && audioDuration > 0) {
    totalDuration = audioDuration;
  } else if (scenesDurationSum > 0) {
    totalDuration = scenesDurationSum;
  } else {
    totalDuration = 5; // Default 5 seconds if completely empty
  }

  const totalFrames = Math.max(1, Math.ceil(totalDuration * fps));

  onProgress({ percent: 5, currentFrame: 0, totalFrames, statusText: 'Setting up Mediabunny MP4 muxer & codecs...' });

  // 3. Test AudioEncoder capability & Resample if necessary
  let hasAudioTrack = false;
  let targetAudioBuffer = audioBuffer;

  if (audioBuffer) {
    const isAudioSupported = await canEncodeAudio('aac');
    if (!isAudioSupported || typeof AudioEncoder === 'undefined') {
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

  const hasGeneratedCompositionScenes = Boolean(
    project.composition?.scenes?.some(
      (s) => s.status === 'ok' && Boolean(s.html && s.html.trim().length > 0)
    )
  );

  const isCompositionMode =
    (project.renderMode || 'composition') === 'composition' &&
    hasGeneratedCompositionScenes;

  // 5. Worker-driven rendering pipeline (OffscreenCanvas) with seamless main-thread fallback
  let workerChunks: Array<{
    type: 'key' | 'delta';
    timestamp: number;
    duration?: number;
    data: ArrayBuffer;
    meta?: any;
  }> | null = null;

  const canAttemptWorker =
    opts?.useWorker !== false &&
    !isCompositionMode &&
    typeof Worker !== 'undefined';

  if (canAttemptWorker) {
    try {
      onProgress({ percent: 3, currentFrame: 0, totalFrames, statusText: 'Starting background render worker...' });

      let audioData: { channelData: Float32Array[]; sampleRate: number; numberOfChannels: number; duration: number } | undefined = undefined;
      if (targetAudioBuffer) {
        const channels: Float32Array[] = [];
        for (let ch = 0; ch < targetAudioBuffer.numberOfChannels; ch++) {
          channels.push(targetAudioBuffer.getChannelData(ch));
        }
        audioData = {
          channelData: channels,
          sampleRate: targetAudioBuffer.sampleRate,
          numberOfChannels: targetAudioBuffer.numberOfChannels,
          duration: targetAudioBuffer.duration
        };
      }

      const activeScene = project.scenes[0] || null;
      const themeTokens = resolveTheme(project, activeScene);

      workerChunks = await runWorkerRenderPipeline(
        project,
        width,
        height,
        fps,
        totalFrames,
        bitrate,
        opts,
        onProgress,
        abortSignal,
        themeTokens,
        audioData
      );
    } catch (workerErr) {
      if (abortSignal?.aborted || (workerErr instanceof DOMException && workerErr.name === 'AbortError')) {
        throw workerErr;
      }
      console.warn('Worker render pipeline fell back to main-thread renderer:', workerErr);
      warnings.push('Render worker dialihkan ke main-thread rendering loop.');
      workerChunks = null;
    }
  }

  // If worker pipeline succeeded, mux encoded worker packets into MP4
  if (workerChunks && workerChunks.length > 0) {
    const videoPacketSource = new EncodedVideoPacketSource('avc');
    output.addVideoTrack(videoPacketSource);

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

      // Ensure chunk 0 or first packet has valid metadata containing decoderConfig
      const firstValidMeta = workerChunks.find((c) => c.meta?.decoderConfig)?.meta;
      const defaultMeta = {
        decoderConfig: {
          codec: 'avc1.4d002a',
          codedWidth: width,
          codedHeight: height
        }
      };

      for (let i = 0; i < workerChunks.length; i++) {
        if (abortSignal?.aborted) {
          await output.cancel().catch(() => {});
          throw new DOMException('Export was cancelled by user', 'AbortError');
        }

        const chunk = workerChunks[i];
        const packet = new EncodedPacket(
          new Uint8Array(chunk.data),
          chunk.type,
          chunk.timestamp / 1_000_000,
          (chunk.duration || (1_000_000 / fps)) / 1_000_000
        );

        const packetMeta = i === 0
          ? (chunk.meta || firstValidMeta || defaultMeta)
          : chunk.meta;

        await videoPacketSource.add(packet, packetMeta);

        const percent = Math.min(99, Math.round(((i + 1) / workerChunks.length) * 95) + 5);
        onProgress({
          percent,
          currentFrame: i + 1,
          totalFrames,
          statusText: `Muxing video frame ${i + 1}/${workerChunks.length} (${percent}%)`
        });
      }

      videoPacketSource.close();

      onProgress({ percent: 98, currentFrame: totalFrames, totalFrames, statusText: 'Finalizing MP4 container...' });
      await output.finalize();

      const buffer = target.buffer;
      if (!buffer) {
        throw new Error('Mediabunny output buffer is empty.');
      }

      let objectUrl: string | null = null;
      try {
        const blob = new Blob([buffer], { type: 'video/mp4' });
        objectUrl = URL.createObjectURL(blob);

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
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        throw err;
      }
    } catch (err: unknown) {
      await output.cancel().catch(() => {});
      if (abortSignal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new DOMException('Export was cancelled by user', 'AbortError');
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`VideoEncoder error during export: ${message}`);
    }
  }

  // 6. Fallback: Main-thread offline Canvas Renderer
  const canvasRenderer = new CanvasRenderer(undefined, width, height);
  const rawCanvas = canvasRenderer.getCanvas();

  let compRenderer: FrameRenderer | null = null;
  if (isCompositionMode) {
    onProgress({ percent: 3, currentFrame: 0, totalFrames, statusText: 'Initializing composition headless sandbox...' });
    compRenderer = await createCompositionFrameRenderer(project, width, height);
    if (!compRenderer) {
      throw new Error('Composition renderer gagal diinisialisasi untuk mode komposisi.');
    }
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
    let consecutiveFrameFailures = 0;
    let failedFrameCount = 0;

    for (let frame = 0; frame < totalFrames; frame++) {
      if (abortSignal?.aborted) {
        await output.cancel().catch(() => {});
        throw new DOMException('Export was cancelled by user', 'AbortError');
      }

      // 1. Draw frame deterministically: RenderState = f(currentFrame, fps, project)
      if (compRenderer) {
        try {
          await compRenderer.renderFrame(frame, frame / fps, rawCanvas as HTMLCanvasElement);
          consecutiveFrameFailures = 0;
        } catch (frameErr) {
          consecutiveFrameFailures++;
          failedFrameCount++;
          if (consecutiveFrameFailures >= 3) {
            throw new Error(
              `Ekspor komposisi gagal: 3 kegagalan frame berturut-turut pada frame ${frame + 1} (${frameErr instanceof Error ? frameErr.message : String(frameErr)})`
            );
          }
        }
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

    if (failedFrameCount > 0) {
      warnings.push(`Terdapat ${failedFrameCount} frame yang gagal dirender saat ekspor komposisi.`);
    }

    onProgress({ percent: 98, currentFrame: totalFrames, totalFrames, statusText: 'Finalizing MP4 container...' });

    await output.finalize();

    const buffer = target.buffer;
    if (!buffer) {
      throw new Error('Mediabunny output buffer is empty.');
    }

    let objectUrl: string | null = null;
    try {
      const blob = new Blob([buffer], { type: 'video/mp4' });
      objectUrl = URL.createObjectURL(blob);

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
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      throw err;
    }
  } catch (err: unknown) {
    await output.cancel().catch(() => {});
    if (abortSignal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new DOMException('Export was cancelled by user', 'AbortError');
    }
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('Composition renderer') ||
      message.includes('kegagalan frame') ||
      message.includes('Ekspor komposisi')
    ) {
      throw err instanceof Error ? err : new Error(message);
    }
    throw new Error(`VideoEncoder error during export: ${message}`);
  } finally {
    if (compRenderer) {
      compRenderer.cleanup();
    }
  }
}
