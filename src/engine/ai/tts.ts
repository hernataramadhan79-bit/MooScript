import type { WordTimestamp, Scene, MooProject, EngineSettings, TTSProvider } from '../../types';
import { getCachedSceneAudio, putCachedSceneAudio } from '../../db/mooDb';
import { synthesizeLocalTTS } from './localTts';

export interface TTSResult {
  audioBlob: Blob;
  duration: number;
  wordTimestamps: WordTimestamp[];
}

export const DEFAULT_SCENE_PADDING_SECONDS = 0.15;

/**
 * Deterministic word alignment algorithm:
 * Splits audio duration across words based on word character length and punctuation pauses.
 */
export function computeDeterministicWordAlignment(
  text: string,
  totalDurationSeconds: number,
  startTimeOffset: number = 0
): WordTimestamp[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return [];

  // Punctuation weight map:
  // commas / semicolons add slight breath pause
  // periods / exclamation / question marks add longer closure pause
  const weights = words.map((w) => {
    let weight = Math.max(1, w.length);
    if (/[,;:]$/.test(w)) weight += 4;
    if (/[.!?]$/.test(w)) weight += 7;
    return weight;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const result: WordTimestamp[] = [];
  let currentTime = startTimeOffset;

  for (let i = 0; i < words.length; i++) {
    const fraction = weights[i] / totalWeight;
    const wordDur = fraction * totalDurationSeconds;
    const start = Math.round(currentTime * 1000) / 1000;
    const end = Math.round((currentTime + wordDur) * 1000) / 1000;

    result.push({
      word: words[i],
      start,
      end
    });

    currentTime += wordDur;
  }

  return result;
}

/**
 * Fallback Scene duration calculator when no voiceover is used:
 * durationSeconds = (wordCount / 130) * 60 + 1.2
 */
export function calculateFallbackSceneDuration(text: string, readingSpeedWpm: number = 130): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 2.0;
  const speed = readingSpeedWpm > 0 ? readingSpeedWpm : 130;
  return Math.round(((wordCount / speed) * 60 + 1.2) * 100) / 100;
}

/**
 * Fetch wrapper with retry and exponential backoff for HTTP 429 (Rate Limits)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  signal?: AbortSignal
): Promise<Response> {
  let attempt = 0;
  let delay = 1000;

  while (attempt <= maxRetries) {
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }

    try {
      const res = await fetch(url, { ...options, signal });

      if (res.status === 429 && attempt < maxRetries) {
        attempt++;
        const retryAfterHeader = res.headers.get('Retry-After');
        let waitMs = delay;
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            waitMs = parsedSec * 1000;
          }
        }
        console.warn(`HTTP 429 received from ${url}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, waitMs);
          if (signal) {
            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new DOMException('Operation aborted', 'AbortError'));
              },
              { once: true }
            );
          }
        });

        delay *= 2;
        continue;
      }

      return res;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      if (attempt < maxRetries) {
        attempt++;
        console.warn(`Network error fetching ${url}. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (signal) {
            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new DOMException('Operation aborted', 'AbortError'));
              },
              { once: true }
            );
          }
        });
        delay *= 2;
        continue;
      }
      throw err;
    }
  }

  throw new Error(`fetchWithRetry: maximum retry attempts exceeded for ${url}`);
}

/**
 * Generate Audio via OpenAI TTS
 */
export async function generateOpenAITTS(params: {
  apiKey: string;
  text: string;
  voice?: string;
  speed?: number;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { apiKey, text, voice = 'alloy', speed = 1.05, signal } = params;

  const res = await fetchWithRetry(
    'https://api.openai.com/v1/audio/speech',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
        speed
      })
    },
    3,
    signal
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS Error (${res.status}): ${errText}`);
  }

  return await res.blob();
}

/**
 * Forced alignment for OpenAI TTS audio using Whisper transcription with word timestamps
 */
export async function alignOpenAIAudioWithWhisper(params: {
  apiKey: string;
  audioBlob: Blob;
  sceneText: string;
  signal?: AbortSignal;
}): Promise<WordTimestamp[]> {
  const { apiKey, audioBlob, signal } = params;

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const res = await fetchWithRetry(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      },
      2,
      signal
    );

    if (!res.ok) {
      console.warn(`Whisper alignment returned status ${res.status}, falling back to deterministic alignment.`);
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data.words) && data.words.length > 0) {
      return data.words.map((w: { word: string; start: number; end: number }) => ({
        word: w.word.trim(),
        start: Math.round(w.start * 1000) / 1000,
        end: Math.round(w.end * 1000) / 1000
      }));
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    console.warn('Whisper alignment failed, will fall back to deterministic alignment:', err);
  }

  return [];
}

/**
 * Generate Audio via ElevenLabs TTS with word timestamps
 */
export async function generateElevenLabsTTS(params: {
  apiKey: string;
  voiceId: string;
  text: string;
  stability?: number;
  signal?: AbortSignal;
}): Promise<{ audioBlob: Blob; wordTimestamps: WordTimestamp[] }> {
  const { apiKey, voiceId, text, stability = 85, signal } = params;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: (stability || 85) / 100,
          similarity_boost: 0.8
        }
      })
    },
    3,
    signal
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS Error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const binaryString = atob(json.audio_base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });

  const wordTimestamps: WordTimestamp[] = [];
  if (json.alignment && json.alignment.characters && json.alignment.character_start_times_seconds) {
    const chars: string[] = json.alignment.characters;
    const starts: number[] = json.alignment.character_start_times_seconds;
    const ends: number[] = json.alignment.character_end_times_seconds;

    let currentWord = '';
    let wordStart = 0;

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (/\s/.test(c)) {
        if (currentWord.length > 0) {
          wordTimestamps.push({
            word: currentWord,
            start: Math.round(wordStart * 1000) / 1000,
            end: Math.round(ends[i - 1] * 1000) / 1000
          });
          currentWord = '';
        }
      } else {
        if (currentWord.length === 0) {
          wordStart = starts[i];
        }
        currentWord += c;
      }
    }
    if (currentWord.length > 0) {
      wordTimestamps.push({
        word: currentWord,
        start: Math.round(wordStart * 1000) / 1000,
        end: Math.round(ends[ends.length - 1] * 1000) / 1000
      });
    }
  }

  return { audioBlob, wordTimestamps };
}

/**
 * Generate synthetic ambient BGM / rhythm track using Web Audio API
 */
export async function generateSyntheticAmbientAudio(durationSeconds: number): Promise<Blob> {
  const sampleRate = 44100;
  const length = Math.ceil(sampleRate * durationSeconds);
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  const freqs = [174.61, 220.0, 261.63, 329.63];
  freqs.forEach((freq, idx) => {
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, 0);

    gain.gain.setValueAtTime(0.04, 0);
    gain.gain.exponentialRampToValueAtTime(0.02, durationSeconds * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, durationSeconds);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start();
    osc.stop(durationSeconds);
  });

  const pulseInterval = 1.5;
  for (let t = 0; t < durationSeconds; t += pulseInterval) {
    const kick = offlineCtx.createOscillator();
    const kickGain = offlineCtx.createGain();

    kick.frequency.setValueAtTime(120, t);
    kick.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    kickGain.gain.setValueAtTime(0.08, t);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    kick.connect(kickGain);
    kickGain.connect(offlineCtx.destination);
    kick.start(t);
    kick.stop(t + 0.2);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Decode Audio Blob into an AudioBuffer using the browser AudioContext
 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    (typeof window !== 'undefined'
      ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : null) || (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AudioCtx) {
    throw new Error('AudioContext is not available in the current environment');
  }
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Resample an AudioBuffer to a target sample rate and ensure 2 channels
 */
export async function resampleAudioBuffer(source: AudioBuffer, targetSampleRate: number = 48000): Promise<AudioBuffer> {
  if (source.sampleRate === targetSampleRate && source.numberOfChannels === 2) {
    return source;
  }
  const targetLength = Math.max(1, Math.ceil(source.duration * targetSampleRate));
  const offlineCtx = new OfflineAudioContext(2, targetLength, targetSampleRate);

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = source;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Convert AudioBuffer to standard WAV Blob (16-bit PCM)
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numSamples = buffer.length * numChannels;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

export interface SceneAudioSegment {
  sceneId: string;
  audioBlob: Blob;
  audioBuffer: AudioBuffer;
  audioDuration: number;
  paddedDuration: number;
  wordTimestamps: WordTimestamp[];
  fromCache: boolean;
}

/**
 * Generate audio for a single scene with cache check and word alignment clamping
 */
export async function generateSceneAudio(params: {
  scene: Scene;
  provider: TTSProvider;
  apiKeys: { openai?: string; elevenlabs?: string };
  voiceId: string;
  speed?: number;
  stability?: number;
  paddingSeconds?: number;
  signal?: AbortSignal;
}): Promise<SceneAudioSegment> {
  const {
    scene,
    provider,
    apiKeys,
    voiceId,
    speed = 1.05,
    stability = 85,
    paddingSeconds = DEFAULT_SCENE_PADDING_SECONDS,
    signal
  } = params;

  const rawText = scene.text.trim();
  const cacheKey = `${provider}:${voiceId}:${speed}:${stability}:${rawText}`;

  // 1. Check IndexedDB cache first
  const cached = await getCachedSceneAudio(cacheKey);
  if (cached && cached.blob) {
    const audioBuffer = await decodeAudioBlob(cached.blob);
    const audioDuration = Math.round(audioBuffer.duration * 100) / 100;
    const paddedDuration = Math.round((audioDuration + paddingSeconds) * 100) / 100;

    const clampedWords = (cached.wordTimestamps || []).map((w) => ({
      ...w,
      start: Math.max(0, Math.min(w.start, audioDuration)),
      end: Math.max(0, Math.min(w.end, audioDuration))
    }));

    return {
      sceneId: scene.id,
      audioBlob: cached.blob,
      audioBuffer,
      audioDuration,
      paddedDuration,
      wordTimestamps: clampedWords,
      fromCache: true
    };
  }

  // 2. Cache miss -> generate fresh audio per provider
  let audioBlob: Blob;
  let wordTimestamps: WordTimestamp[] = [];

  if (provider === 'openai') {
    const key = apiKeys.openai;
    if (!key) throw new Error('OpenAI API Key is missing. Please configure it in Settings.');
    audioBlob = await generateOpenAITTS({
      apiKey: key,
      text: rawText,
      voice: voiceId || 'alloy',
      speed,
      signal
    });

    const audioBuffer = await decodeAudioBlob(audioBlob);
    const audioDuration = Math.round(audioBuffer.duration * 100) / 100;

    // Forced alignment via Whisper transcription
    const whisperWords = await alignOpenAIAudioWithWhisper({
      apiKey: key,
      audioBlob,
      sceneText: rawText,
      signal
    });

    if (whisperWords.length > 0) {
      wordTimestamps = whisperWords.map((w) => ({
        ...w,
        start: Math.max(0, Math.min(w.start, audioDuration)),
        end: Math.max(0, Math.min(w.end, audioDuration))
      }));
    } else {
      wordTimestamps = computeDeterministicWordAlignment(rawText, audioDuration, 0);
    }

    const paddedDuration = Math.round((audioDuration + paddingSeconds) * 100) / 100;

    await putCachedSceneAudio({
      cacheKey,
      blob: audioBlob,
      wordTimestamps,
      duration: audioDuration,
      updatedAt: Date.now()
    });

    return {
      sceneId: scene.id,
      audioBlob,
      audioBuffer,
      audioDuration,
      paddedDuration,
      wordTimestamps,
      fromCache: false
    };
  } else if (provider === 'elevenlabs') {
    const key = apiKeys.elevenlabs;
    if (!key) throw new Error('ElevenLabs API Key is missing. Please configure it in Settings.');
    const result = await generateElevenLabsTTS({
      apiKey: key,
      voiceId: voiceId || '21m00Tcm4TlvDq8ikWAM',
      text: rawText,
      stability,
      signal
    });

    audioBlob = result.audioBlob;
    const audioBuffer = await decodeAudioBlob(audioBlob);
    const audioDuration = Math.round(audioBuffer.duration * 100) / 100;

    const clampedWords = (
      result.wordTimestamps.length > 0
        ? result.wordTimestamps
        : computeDeterministicWordAlignment(rawText, audioDuration, 0)
    ).map((w) => ({
      ...w,
      start: Math.max(0, Math.min(w.start, audioDuration)),
      end: Math.max(0, Math.min(w.end, audioDuration))
    }));

    const paddedDuration = Math.round((audioDuration + paddingSeconds) * 100) / 100;

    await putCachedSceneAudio({
      cacheKey,
      blob: audioBlob,
      wordTimestamps: clampedWords,
      duration: audioDuration,
      updatedAt: Date.now()
    });

    return {
      sceneId: scene.id,
      audioBlob,
      audioBuffer,
      audioDuration,
      paddedDuration,
      wordTimestamps: clampedWords,
      fromCache: false
    };
  } else if (provider === 'local') {
    const result = await synthesizeLocalTTS({
      text: rawText,
      voiceId: voiceId || 'id_ID-news_tts',
      speed,
      signal
    });

    audioBlob = result.audioBlob;
    const audioBuffer = await decodeAudioBlob(audioBlob);
    const audioDuration = Math.round(audioBuffer.duration * 100) / 100;
    const paddedDuration = Math.round((audioDuration + paddingSeconds) * 100) / 100;

    const clampedWords = (
      result.wordTimestamps.length > 0
        ? result.wordTimestamps
        : computeDeterministicWordAlignment(rawText, audioDuration, 0)
    ).map((w) => ({
      ...w,
      start: Math.max(0, Math.min(w.start, audioDuration)),
      end: Math.max(0, Math.min(w.end, audioDuration))
    }));

    await putCachedSceneAudio({
      cacheKey,
      blob: audioBlob,
      wordTimestamps: clampedWords,
      duration: audioDuration,
      updatedAt: Date.now()
    });

    return {
      sceneId: scene.id,
      audioBlob,
      audioBuffer,
      audioDuration,
      paddedDuration,
      wordTimestamps: clampedWords,
      fromCache: false
    };
  } else {
    // Fallback: procedural ambient synth per scene
    const estimatedDuration = calculateFallbackSceneDuration(rawText);
    audioBlob = await generateSyntheticAmbientAudio(estimatedDuration);
    const audioBuffer = await decodeAudioBlob(audioBlob);
    const audioDuration = Math.round(audioBuffer.duration * 100) / 100;
    const paddedDuration = Math.round((audioDuration + paddingSeconds) * 100) / 100;
    const words = computeDeterministicWordAlignment(rawText, audioDuration, 0);

    return {
      sceneId: scene.id,
      audioBlob,
      audioBuffer,
      audioDuration,
      paddedDuration,
      wordTimestamps: words,
      fromCache: false
    };
  }
}

/**
 * Concat all scene AudioBuffers into a single unified track at 48000Hz stereo
 */
export async function concatenateSceneAudios(
  segments: SceneAudioSegment[],
  targetSampleRate: number = 48000
): Promise<{
  combinedBuffer: AudioBuffer;
  combinedBlob: Blob;
  totalDuration: number;
  sceneOffsets: Array<{ sceneId: string; startTime: number; duration: number }>;
}> {
  if (segments.length === 0) {
    const offlineCtx = new OfflineAudioContext(2, 48000, targetSampleRate);
    const emptyBuffer = offlineCtx.createBuffer(2, 48000, targetSampleRate);
    const blob = audioBufferToWavBlob(emptyBuffer);
    return {
      combinedBuffer: emptyBuffer,
      combinedBlob: blob,
      totalDuration: 1.0,
      sceneOffsets: []
    };
  }

  const totalDuration = segments.reduce((acc, s) => acc + s.paddedDuration, 0);
  const totalLengthSamples = Math.max(1, Math.ceil(totalDuration * targetSampleRate));
  const offlineCtx = new OfflineAudioContext(2, totalLengthSamples, targetSampleRate);
  const outputBuffer = offlineCtx.createBuffer(2, totalLengthSamples, targetSampleRate);

  const sceneOffsets: Array<{ sceneId: string; startTime: number; duration: number }> = [];
  let currentOffsetSec = 0;

  for (const seg of segments) {
    sceneOffsets.push({
      sceneId: seg.sceneId,
      startTime: currentOffsetSec,
      duration: seg.paddedDuration
    });

    const resampled = await resampleAudioBuffer(seg.audioBuffer, targetSampleRate);
    const startSample = Math.round(currentOffsetSec * targetSampleRate);
    const samplesToCopy = Math.min(
      resampled.length,
      Math.round(seg.audioDuration * targetSampleRate),
      totalLengthSamples - startSample
    );

    for (let ch = 0; ch < 2; ch++) {
      const srcCh = resampled.numberOfChannels > ch ? resampled.getChannelData(ch) : resampled.getChannelData(0);
      const destCh = outputBuffer.getChannelData(ch);
      for (let i = 0; i < samplesToCopy; i++) {
        destCh[startSample + i] = srcCh[i];
      }
    }

    currentOffsetSec += seg.paddedDuration;
  }

  const combinedBlob = audioBufferToWavBlob(outputBuffer);
  return {
    combinedBuffer: outputBuffer,
    combinedBlob,
    totalDuration,
    sceneOffsets
  };
}

export interface AudioProgressInfo {
  currentScene: number;
  totalScenes: number;
  sceneId: string;
  statusText: string;
  fromCache?: boolean;
}

/**
 * Orchestrate per-scene TTS with bounded concurrency (default 2), caching, and cancellation
 */
export async function generateProjectAudioPerScene(params: {
  project: MooProject;
  settings: EngineSettings;
  concurrency?: number;
  paddingSeconds?: number;
  onProgress?: (progress: AudioProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<{
  updatedProject: MooProject;
  audioBlob: Blob;
  totalDuration: number;
  cacheHitCount: number;
  apiCallCount: number;
}> {
  const {
    project,
    settings,
    concurrency = 2,
    paddingSeconds = DEFAULT_SCENE_PADDING_SECONDS,
    onProgress,
    signal
  } = params;

  if (project.scenes.length === 0) {
    throw new Error('Cannot generate audio for a project with 0 scenes.');
  }

  const provider = settings.selectedTTSProvider;
  const voiceId =
    provider === 'local'
      ? settings.voiceIds?.local || 'id_ID-news_tts'
      : provider === 'elevenlabs'
      ? settings.voiceIds?.elevenlabs || '21m00Tcm4TlvDq8ikWAM'
      : settings.voiceIds?.openai || 'alloy';

  const segments: SceneAudioSegment[] = new Array(project.scenes.length);
  let currentIndex = 0;
  let completedCount = 0;
  let cacheHitCount = 0;
  let apiCallCount = 0;

  async function worker() {
    while (currentIndex < project.scenes.length) {
      if (signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }

      const idx = currentIndex++;
      const scene = project.scenes[idx];

      onProgress?.({
        currentScene: idx + 1,
        totalScenes: project.scenes.length,
        sceneId: scene.id,
        statusText: `Synthesizing scene ${idx + 1} of ${project.scenes.length}...`
      });

      const seg = await generateSceneAudio({
        scene,
        provider,
        apiKeys: settings.apiKeys,
        voiceId,
        speed: settings.speed,
        stability: settings.stability,
        paddingSeconds,
        signal
      });

      segments[idx] = seg;
      if (seg.fromCache) {
        cacheHitCount++;
      } else {
        apiCallCount++;
      }

      completedCount++;
      onProgress?.({
        currentScene: completedCount,
        totalScenes: project.scenes.length,
        sceneId: scene.id,
        statusText: `Completed scene ${completedCount} of ${project.scenes.length}`,
        fromCache: seg.fromCache
      });
    }
  }

  const workerCount = Math.min(concurrency, project.scenes.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  if (signal?.aborted) {
    throw new DOMException('Operation aborted', 'AbortError');
  }

  onProgress?.({
    currentScene: project.scenes.length,
    totalScenes: project.scenes.length,
    sceneId: 'final',
    statusText: 'Concatenating scene audio tracks...'
  });

  const { combinedBlob, totalDuration } = await concatenateSceneAudios(segments);

  // Update scenes with exact padded durations and word timestamps
  const updatedScenes: Scene[] = project.scenes.map((s, idx) => {
    const seg = segments[idx];
    return {
      ...s,
      durationInSeconds: seg.paddedDuration,
      wordTimestamps: seg.wordTimestamps
    };
  });

  const updatedProject: MooProject = {
    ...project,
    scenes: updatedScenes,
    audioBlob: combinedBlob,
    audioDuration: Math.round(totalDuration * 100) / 100
  };

  return {
    updatedProject,
    audioBlob: combinedBlob,
    totalDuration: Math.round(totalDuration * 100) / 100,
    cacheHitCount,
    apiCallCount
  };
}
