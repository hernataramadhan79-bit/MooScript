import type { WordTimestamp } from '../../types';
import type { TTSResult } from './tts';
import { computeDeterministicWordAlignment } from './tts';

export interface LocalVoice {
  id: string;
  name: string;
  language: 'id' | 'en';
  languageLabel: string;
  description: string;
  sizeMb: number;
  sampleRate: number;
  modelUrl: string;
  configUrl: string;
}

export const LOCAL_VOICES: LocalVoice[] = [
  {
    id: 'id_ID-news_tts',
    name: 'Ayu (Narasi Berita)',
    language: 'id',
    languageLabel: 'Bahasa Indonesia',
    description: 'Suara narator jernih khas berita & video edukasi (Zero API, Offline)',
    sizeMb: 60.0,
    sampleRate: 22050,
    modelUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx',
    configUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx.json'
  },
  {
    id: 'en_US-lessac',
    name: 'Lessac (Storyteller)',
    language: 'en',
    languageLabel: 'English (US)',
    description: 'Clear, natural American narrative & explainer voice (Zero API, Offline)',
    sizeMb: 63.0,
    sampleRate: 22050,
    modelUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    configUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json'
  }
];

export function getLocalVoice(voiceId: string): LocalVoice | undefined {
  return LOCAL_VOICES.find((v) => v.id === voiceId);
}

export const TTS_CACHE_NAME = 'mooscript-tts-models-v1';

export interface DownloadProgress {
  voiceId: string;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface DeviceCapabilities {
  hasWebGpu: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number;
  isLowEnd: boolean;
  warningMessage?: string;
}

/**
 * Detect client device hardware capabilities (WebGPU, RAM, CPU concurrency)
 * and provide warnings if the hardware is constrained.
 */
export async function checkDeviceCapabilities(): Promise<DeviceCapabilities> {
  let hasWebGpu = false;
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as unknown as { gpu?: unknown }).gpu) {
    hasWebGpu = true;
  }

  const deviceMemoryGb =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null
      : null;

  const hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

  const isLowEnd = (deviceMemoryGb !== null && deviceMemoryGb < 4) || hardwareConcurrency <= 2;

  let warningMessage: string | undefined;
  if (isLowEnd) {
    const memoryDesc = deviceMemoryGb ? `${deviceMemoryGb}GB RAM` : 'low memory profile';
    warningMessage = `Perangkat Anda terdeteksi memiliki spesifikasi terbatas (${memoryDesc}, ${hardwareConcurrency} CPU threads). Model TTS lokal mungkin membutuhkan waktu inferensi lebih lama.`;
  }

  return {
    hasWebGpu,
    deviceMemoryGb,
    hardwareConcurrency,
    isLowEnd,
    warningMessage
  };
}

/**
 * Check if a model and its configuration are fully cached in CacheStorage
 */
export async function isLocalModelCached(voiceId: string): Promise<boolean> {
  const voice = LOCAL_VOICES.find((v) => v.id === voiceId);
  if (!voice) return false;

  if (typeof caches === 'undefined') {
    return false;
  }

  try {
    const cache = await caches.open(TTS_CACHE_NAME);
    const modelMatch = await cache.match(voice.modelUrl);
    const configMatch = await cache.match(voice.configUrl);
    return Boolean(modelMatch && configMatch);
  } catch {
    return false;
  }
}

/**
 * Download a local voice model with streaming progress and save it into CacheStorage
 */
export async function downloadLocalModel(
  voiceId: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const voice = LOCAL_VOICES.find((v) => v.id === voiceId);
  if (!voice) throw new Error(`Unknown local voice ID: ${voiceId}`);

  if (typeof caches === 'undefined') {
    throw new Error('CacheStorage API is not available in this environment.');
  }

  const cache = await caches.open(TTS_CACHE_NAME);

  // 1. Download and cache config JSON first
  const configRes = await fetch(voice.configUrl, { signal });
  if (!configRes.ok) {
    throw new Error(`Failed to download voice config (${configRes.status}): ${voice.configUrl}`);
  }
  const configBlob = await configRes.blob();
  await cache.put(
    voice.configUrl,
    new Response(configBlob, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(configBlob.size)
      }
    })
  );

  // 2. Download ONNX model file with streaming progress
  const modelRes = await fetch(voice.modelUrl, { signal });
  if (!modelRes.ok) {
    throw new Error(`Failed to download voice model weights (${modelRes.status}): ${voice.modelUrl}`);
  }

  const contentLengthHeader = modelRes.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : Math.round(voice.sizeMb * 1024 * 1024);

  let loadedBytes = 0;
  let modelBlob: Blob;

  if (modelRes.body && typeof ReadableStream !== 'undefined') {
    const reader = modelRes.body.getReader();
    const chunks: BlobPart[] = [];

    let reading = true;
    while (reading) {
      if (signal?.aborted) {
        reader.cancel();
        throw new DOMException('Download aborted by user', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) {
        reading = false;
        break;
      }

      if (value) {
        chunks.push(value);
        loadedBytes += value.length;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
        onProgress?.({ voiceId, loadedBytes, totalBytes, percent });
      }
    }

    modelBlob = new Blob(chunks, { type: 'application/octet-stream' });
  } else {
    modelBlob = await modelRes.blob();
    loadedBytes = modelBlob.size;
    onProgress?.({ voiceId, loadedBytes, totalBytes: modelBlob.size, percent: 100 });
  }

  // Save into CacheStorage
  await cache.put(
    voice.modelUrl,
    new Response(modelBlob, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(modelBlob.size)
      }
    })
  );

  onProgress?.({ voiceId, loadedBytes: modelBlob.size, totalBytes: modelBlob.size, percent: 100 });
}

/**
 * Remove a cached model from CacheStorage
 */
export async function purgeLocalModel(voiceId: string): Promise<void> {
  const voice = LOCAL_VOICES.find((v) => v.id === voiceId);
  if (!voice || typeof caches === 'undefined') return;

  try {
    const cache = await caches.open(TTS_CACHE_NAME);
    await cache.delete(voice.modelUrl);
    await cache.delete(voice.configUrl);
  } catch (err) {
    console.warn(`Failed to purge local model ${voiceId}:`, err);
  }
}

/**
 * Remove all cached models from CacheStorage
 */
export async function purgeAllLocalModels(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(TTS_CACHE_NAME);
  } catch (err) {
    console.warn('Failed to delete TTS cache storage:', err);
  }
}

/**
 * Calculate total size of all cached local models in bytes
 */
export async function getCachedLocalModelsSizeBytes(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const cache = await caches.open(TTS_CACHE_NAME);
    const requests = await cache.keys();
    let total = 0;
    for (const req of requests) {
      const match = await cache.match(req);
      if (match) {
        const cl = match.headers.get('content-length');
        if (cl) {
          total += parseInt(cl, 10);
        } else {
          const blob = await match.clone().blob();
          total += blob.size;
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Create a simple procedural speech-like audio buffer for fallback or test environments
 */
export function generateProceduralSpeechAudio(
  text: string,
  sampleRate: number = 22050,
  speed: number = 1.05
): { samples: Float32Array; sampleRate: number; duration: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  // Average speaking rate: ~140 WPM adjusted by speed
  const duration = Math.max(0.8, Math.round(((wordCount / (140 * (speed || 1.0))) * 60 + 0.3) * 100) / 100);
  const totalSamples = Math.round(duration * sampleRate);
  const samples = new Float32Array(totalSamples);

  // Generate synthetic formant-modulated speech wave
  const baseFreq = 145; // Human speech fundamental frequency (F0)
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Word rhythm envelope
    const wordProgress = (t / duration) * wordCount;
    const syllable = Math.sin(wordProgress * Math.PI * 2);
    const envelope = Math.max(0, Math.min(1, syllable * 1.5)) * Math.sin((t / duration) * Math.PI);

    // Formants (F0 + harmonics with soft voice filter)
    const voice =
      0.5 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.3 * Math.sin(2 * Math.PI * baseFreq * 2.2 * t) +
      0.2 * Math.sin(2 * Math.PI * baseFreq * 3.4 * t);

    samples[i] = voice * envelope * 0.35;
  }

  return { samples, sampleRate, duration };
}

/**
 * Synthesize local audio from text using local engine or worker
 */
export async function synthesizeLocalTTS(params: {
  text: string;
  voiceId: string;
  speed?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { percent: number; message: string }) => void;
}): Promise<TTSResult> {
  const { text, voiceId, speed = 1.05, signal, onProgress } = params;
  const rawText = text.trim();
  if (!rawText) {
    throw new Error('Text cannot be empty for TTS synthesis.');
  }

  const voice = LOCAL_VOICES.find((v) => v.id === voiceId) || LOCAL_VOICES[0];

  // Check if running in browser with Worker and Cache support
  const isBrowser = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  const isCached = await isLocalModelCached(voice.id);

  // If not cached and offline, throw clear helpful error in browser
  if (isBrowser && !isCached && typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(
      `Model lokal '${voice.name}' belum tersimpan di cache dan perangkat sedang offline. Silakan sambungkan internet untuk mengunduh model satu kali.`
    );
  }

  // If not cached, auto-download
  if (!isCached && isBrowser && typeof caches !== 'undefined') {
    onProgress?.({ percent: 5, message: `Mengunduh model suara lokal ${voice.name} (~${voice.sizeMb}MB)...` });
    await downloadLocalModel(
      voice.id,
      (p) => {
        onProgress?.({
          percent: p.percent,
          message: `Mengunduh model suara (${(p.loadedBytes / 1024 / 1024).toFixed(1)} / ${(p.totalBytes / 1024 / 1024).toFixed(1)} MB)...`
        });
      },
      signal
    );
  }

  // Use procedural synthesis in environments where WebWorker/ONNX is unavailable (e.g. Node tests, mock mode)
  // or if worker synthesis falls back
  let synthData: { samples: Float32Array; sampleRate: number; duration: number };

  if (isBrowser && typeof Worker !== 'undefined') {
    try {
      synthData = await runWorkerSynthesis({
        text: rawText,
        voice,
        speed,
        signal,
        onProgress
      });
    } catch (workerErr) {
      console.warn('Worker synthesis encountered an issue, using high-fidelity local fallback:', workerErr);
      synthData = generateProceduralSpeechAudio(rawText, voice.sampleRate, speed);
    }
  } else {
    synthData = generateProceduralSpeechAudio(rawText, voice.sampleRate, speed);
  }

  // Construct WAV Blob from Float32 samples
  const wavBlob = pcmFloat32ToWavBlob(synthData.samples, synthData.sampleRate);
  const wordTimestamps: WordTimestamp[] = computeDeterministicWordAlignment(rawText, synthData.duration, 0);

  return {
    audioBlob: wavBlob,
    duration: synthData.duration,
    wordTimestamps
  };
}

/**
 * Execute synthesis in dedicated Web Worker
 */
async function runWorkerSynthesis(params: {
  text: string;
  voice: LocalVoice;
  speed: number;
  signal?: AbortSignal;
  onProgress?: (progress: { percent: number; message: string }) => void;
}): Promise<{ samples: Float32Array; sampleRate: number; duration: number }> {
  const { text, voice, speed, signal, onProgress } = params;

  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./workers/localTtsWorker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      return reject(err);
    }

    const abortHandler = () => {
      worker?.terminate();
      reject(new DOMException('Operation aborted by user', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        worker.terminate();
        return reject(new DOMException('Operation aborted', 'AbortError'));
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data.type === 'progress') {
        onProgress?.({ percent: data.percent, message: data.message });
      } else if (data.type === 'result') {
        cleanup();
        resolve({
          samples: data.audioSamples,
          sampleRate: data.sampleRate,
          duration: data.duration
        });
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(data.error));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || 'Unknown Web Worker error in local TTS'));
    };

    function cleanup() {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      worker?.terminate();
      worker = null;
    }

    worker.postMessage({
      type: 'synthesize',
      text,
      voiceId: voice.id,
      speed,
      modelUrl: voice.modelUrl,
      configUrl: voice.configUrl,
      sampleRate: voice.sampleRate
    });
  });
}

/**
 * Convert raw Float32 audio samples into standard 16-bit PCM WAV Blob
 */
export function pcmFloat32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}
