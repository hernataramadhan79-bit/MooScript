import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { MooProject } from '../../types';
import { CanvasRenderer } from '../renderer/canvasRenderer';

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
}

export async function exportMooProjectToMP4(
  project: MooProject,
  onProgress: (progress: ExportProgress) => void,
  abortSignal?: AbortSignal
): Promise<ExportResult> {
  const fps = project.fps || 30;
  const width = project.width || 1080;
  const height = project.height || 1920;

  // 1. Verify WebCodecs VideoEncoder availability
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not supported in this browser. Please use Chrome, Edge, or Safari 16.4+');
  }

  onProgress({ percent: 2, currentFrame: 0, totalFrames: 0, statusText: 'Initializing audio buffer...' });

  // 2. Decode Audio if present
  let audioBuffer: AudioBuffer | null = null;
  let totalDuration = 0;

  if (project.audioBlob && project.audioBlob.size > 0) {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await project.audioBlob.arrayBuffer();
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      totalDuration = audioBuffer.duration;
      await audioCtx.close();
    } catch (err) {
      console.warn('Failed to decode audioBlob, falling back to scene durations', err);
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

  onProgress({ percent: 5, currentFrame: 0, totalFrames, statusText: 'Setting up MP4 muxer & codecs...' });

  // 3. Test AudioEncoder capability
  let hasAudioTrack = false;
  let audioEncoder: AudioEncoder | null = null;

  if (audioBuffer && typeof AudioEncoder !== 'undefined') {
    try {
      const config = {
        codec: 'mp4a.40.2',
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
        bitrate: 128_000
      };
      const support = await AudioEncoder.isConfigSupported(config);
      if (support.supported) {
        hasAudioTrack = true;
      }
    } catch (e) {
      console.warn('AudioEncoder config test skipped or unsupported:', e);
    }
  }

  // 4. Initialize mp4-muxer
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc' as const,
      width,
      height
    },
    ...(hasAudioTrack && audioBuffer ? {
      audio: {
        codec: 'aac' as const,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: Math.min(2, audioBuffer.numberOfChannels)
      }
    } : {}),
    fastStart: 'in-memory'
  });

  // 5. Initialize VideoEncoder
  // Codec: 'avc1.4d002a' (H.264 Main Profile Level 4.2 at 1080p, supported across mobile Safari and Chromium)
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error('VideoEncoder error:', e);
    }
  });

  videoEncoder.configure({
    codec: 'avc1.4d002a',
    width,
    height,
    bitrate: 6_000_000, // 6 Mbps
    hardwareAcceleration: 'prefer-hardware'
  });

  // 6. Encode Audio Chunks if enabled
  if (hasAudioTrack && audioBuffer) {
    try {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          muxer.addAudioChunk(chunk, meta);
        },
        error: (e) => {
          console.error('AudioEncoder error:', e);
        }
      });

      audioEncoder.configure({
        codec: 'mp4a.40.2',
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
        bitrate: 128_000
      });

      // Feed AudioData in chunks (e.g. 1024 samples per frame)
      const numChannels = Math.min(2, audioBuffer.numberOfChannels);
      const sampleRate = audioBuffer.sampleRate;
      const totalSamples = audioBuffer.length;
      const chunkSize = 2048;

      for (let offset = 0; offset < totalSamples; offset += chunkSize) {
        if (abortSignal?.aborted) break;

        const currentChunkSize = Math.min(chunkSize, totalSamples - offset);
        const planarData = new Float32Array(currentChunkSize * numChannels);

        for (let ch = 0; ch < numChannels; ch++) {
          const chData = audioBuffer.getChannelData(ch);
          planarData.set(chData.subarray(offset, offset + currentChunkSize), ch * currentChunkSize);
        }

        const audioTimestampUs = Math.round((offset / sampleRate) * 1_000_000);
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: currentChunkSize,
          numberOfChannels: numChannels,
          timestamp: audioTimestampUs,
          data: planarData
        });

        audioEncoder.encode(audioData);
        audioData.close();
      }

      await audioEncoder.flush();
    } catch (audioErr) {
      console.warn('Audio encoding failed, falling back to video-only track', audioErr);
    }
  }

  // 7. Setup Dedicated Offline Canvas
  const canvasRenderer = new CanvasRenderer();
  const rawCanvas = canvasRenderer.getCanvas();

  // 8. Deterministic Render Loop
  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (abortSignal?.aborted) {
        throw new Error('Export was cancelled by user');
      }

      // 1. Draw frame deterministically: RenderState = f(currentFrame, fps)
      canvasRenderer.draw(frame, totalFrames, project);

      // 2. Create VideoFrame from Canvas
      const timestampMicroseconds = Math.round((frame / fps) * 1_000_000);
      const videoFrame = new VideoFrame(rawCanvas as CanvasImageSource, {
        timestamp: timestampMicroseconds,
        duration: Math.round((1 / fps) * 1_000_000)
      });

      // 3. Encode & Close immediately to guarantee ZERO memory leaks
      const isKeyFrame = frame % (fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close(); // MANDATORY: Prevent mobile out-of-memory crashes!

      // 4. Report Progress to UI
      const percent = Math.min(99, Math.round(((frame + 1) / totalFrames) * 95) + 5);
      onProgress({
        percent,
        currentFrame: frame + 1,
        totalFrames,
        statusText: `Encoding frame ${frame + 1}/${totalFrames} (${percent}%)`
      });

      // 5. Thermal & Backgrounding Yield:
      // Yield the thread briefly every 30 frames to prevent iOS WebKit from terminating worker/tab
      if (frame % 30 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress({ percent: 98, currentFrame: totalFrames, totalFrames, statusText: 'Finalizing MP4 container...' });

    await videoEncoder.flush();
    muxer.finalize();

    const buffer = target.buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);

    onProgress({ percent: 100, currentFrame: totalFrames, totalFrames, statusText: 'Export completed!' });

    return {
      blob,
      objectUrl,
      fileSizeBytes: blob.size,
      durationSeconds: totalDuration
    };
  } finally {
    // Memory cleanup
    try {
      videoEncoder.close();
      if (audioEncoder && audioEncoder.state !== 'closed') {
        audioEncoder.close();
      }
    } catch (e) {
      console.warn('Error during encoder closure cleanup', e);
    }
  }
}
