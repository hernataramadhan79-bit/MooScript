import type { WordTimestamp, Scene } from '../../types';

export interface TTSResult {
  audioBlob: Blob;
  duration: number;
  wordTimestamps: WordTimestamp[];
}

/**
 * Deterministic word alignment algorithm:
 * Splits audio duration across words based on word character length and punctuation pauses.
 */
export function computeDeterministicWordAlignment(
  text: string,
  totalDurationSeconds: number,
  startTimeOffset: number = 0
): WordTimestamp[] {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  // Punctuation weight map:
  // commas / semicolons add slight breath pause
  // periods / exclamation / question marks add longer closure pause
  const weights = words.map(w => {
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
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 2.0;
  const speed = readingSpeedWpm > 0 ? readingSpeedWpm : 130;
  return Math.round(((wordCount / speed) * 60 + 1.2) * 100) / 100;
}

/**
 * Generate Audio via OpenAI TTS
 */
export async function generateOpenAITTS(params: {
  apiKey: string;
  text: string;
  voice?: string;
  speed?: number;
}): Promise<Blob> {
  const { apiKey, text, voice = 'alloy', speed = 1.05 } = params;

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      speed
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS Error (${res.status}): ${errText}`);
  }

  return await res.blob();
}

/**
 * Generate Audio via ElevenLabs TTS with word timestamps
 */
export async function generateElevenLabsTTS(params: {
  apiKey: string;
  voiceId: string;
  text: string;
  stability?: number;
}): Promise<{ audioBlob: Blob; wordTimestamps: WordTimestamp[] }> {
  const { apiKey, voiceId, text, stability = 0.85 } = params;

  // ElevenLabs with-timestamps endpoint returns base64 audio and alignment details
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: stability / 100,
        similarity_boost: 0.8
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS Error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  // Decode base64 audio
  const binaryString = atob(json.audio_base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const audioBlob = new Blob([bytes.buffer], { type: 'audio/mpeg' });

  // Parse word timestamps from alignment
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
 * Runs completely offline on any browser without server or external API keys.
 */
export async function generateSyntheticAmbientAudio(durationSeconds: number): Promise<Blob> {
  const sampleRate = 44100;
  const length = Math.ceil(sampleRate * durationSeconds);
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  // Soft atmospheric chord (F minor / Ab major warm synth drone)
  const freqs = [174.61, 220.00, 261.63, 329.63]; // F3, A3, C4, E4
  freqs.forEach((freq, idx) => {
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();

    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, 0);

    // Warm subtle tremolo
    gain.gain.setValueAtTime(0.04, 0);
    gain.gain.exponentialRampToValueAtTime(0.02, durationSeconds * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, durationSeconds);

    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start();
    osc.stop(durationSeconds);
  });

  // Soft rhythmic kick pulses every 1.5 seconds
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
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
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
