import * as ort from 'onnxruntime-web';
import { phonemize } from 'phonemizer';

const CACHE_NAME = 'mooscript-tts-models-v1';

// Cache active inference sessions in memory in worker
const sessionCache = new Map<string, { session: ort.InferenceSession; config: any }>();

self.onmessage = async (e: MessageEvent) => {
  const {
    type,
    text,
    voiceId,
    speed = 1.0,
    noiseScale = 0.667,
    noiseW = 0.8,
    modelUrl,
    configUrl,
    sampleRate = 22050
  } = e.data;

  if (type === 'synthesize') {
    try {
      self.postMessage({ type: 'progress', percent: 10, message: 'Menyiapkan engine model suara lokal...' });

      let cachedEntry = sessionCache.get(voiceId);

      if (!cachedEntry) {
        // 1. Fetch config and model from CacheStorage or network
        self.postMessage({ type: 'progress', percent: 25, message: 'Memuat bobot model dari cache browser...' });

        let modelBuffer: ArrayBuffer | null = null;
        let configJson: any = null;

        if (typeof caches !== 'undefined') {
          try {
            const cache = await caches.open(CACHE_NAME);
            const configMatch = await cache.match(configUrl);
            const modelMatch = await cache.match(modelUrl);

            if (configMatch && modelMatch) {
              configJson = await configMatch.json();
              modelBuffer = await modelMatch.arrayBuffer();
            }
          } catch (cacheErr) {
            console.warn('Cache read error in worker:', cacheErr);
          }
        }

        if (!modelBuffer || !configJson) {
          self.postMessage({ type: 'progress', percent: 40, message: 'Mengunduh bobot model Piper ONNX...' });
          const [cfgRes, mdlRes] = await Promise.all([fetch(configUrl), fetch(modelUrl)]);
          configJson = await cfgRes.json();
          modelBuffer = await mdlRes.arrayBuffer();
        }

        self.postMessage({ type: 'progress', percent: 60, message: 'Menginisialisasi session ONNX WASM...' });

        // Configure onnxruntime-web execution providers & WASM paths
        try {
          ort.env.wasm.numThreads = 1;
          const origin = typeof location !== 'undefined' ? location.origin : '';
          ort.env.wasm.wasmPaths = origin ? `${origin}/onnx/` : 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
        } catch (wasmConfigErr) {
          console.warn('Configuring ort wasm env:', wasmConfigErr);
        }

        // Piper VITS requires WASM execution provider (WebGPU lacks support for dynamic slice/gather ops)
        const executionProviders = ['wasm'];
        const session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders
        });

        cachedEntry = { session, config: configJson };
        sessionCache.set(voiceId, cachedEntry);
      }

      self.postMessage({ type: 'progress', percent: 75, message: 'Melakukan tokenisasi dan fonemisasi teks...' });

      // 2. Tokenize text to phoneme IDs
      const config = cachedEntry.config;
      const phonemeIdMap = config.phoneme_id_map || {};
      const phonemeIds = await textToPhonemeIds(text, voiceId, phonemeIdMap);

      if (phonemeIds.length === 0) {
        throw new Error('Gagal menghasilkan fonem untuk teks yang diberikan.');
      }

      self.postMessage({ type: 'progress', percent: 85, message: 'Inference model suara berlangsung...' });

      // 3. Prepare ONNX input tensors
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
      const lengthTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
      const lengthScale = 1.0 / Math.max(0.5, Math.min(2.0, speed || 1.0));
      const safeNoiseScale = Math.max(0.1, Math.min(1.2, noiseScale || 0.667));
      const safeNoiseW = Math.max(0.1, Math.min(1.2, noiseW || 0.8));
      const scalesTensor = new ort.Tensor('float32', Float32Array.from([safeNoiseScale, lengthScale, safeNoiseW]), [3]);

      const feeds: Record<string, ort.Tensor> = {
        input: inputTensor,
        input_lengths: lengthTensor,
        scales: scalesTensor
      };

      if (config.num_speakers && config.num_speakers > 1) {
        feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
      }

      // 4. Run inference
      const results = await cachedEntry.session.run(feeds);
      const outputTensor = results['output'];
      if (!outputTensor || !outputTensor.data) {
        throw new Error('Model ONNX tidak mengembalikan data audio output.');
      }

      const rawSamples = outputTensor.data as Float32Array;
      const targetRate = config.audio?.sample_rate || sampleRate;
      const duration = Math.round((rawSamples.length / targetRate) * 100) / 100;

      (self as unknown as Worker).postMessage(
        {
          type: 'result',
          audioSamples: rawSamples,
          sampleRate: targetRate,
          duration
        },
        [rawSamples.buffer as ArrayBuffer]
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Local TTS worker error:', err);
      self.postMessage({ type: 'error', error: errMsg });
    }
  }
};

/**
 * Tokenize input text into phoneme IDs according to the Piper model configuration
 */
async function textToPhonemeIds(
  text: string,
  voiceId: string,
  phonemeIdMap: Record<string, number[]>
): Promise<number[]> {
  const startId = phonemeIdMap['^'] ? phonemeIdMap['^'][0] : 1;
  const endId = phonemeIdMap['$'] ? phonemeIdMap['$'][0] : 2;
  const padId = phonemeIdMap['_'] ? phonemeIdMap['_'][0] : 0;
  const spaceId = phonemeIdMap[' '] ? phonemeIdMap[' '][0] : 3;

  // Raw token stream first (no framing yet)
  const rawIds: number[] = [];
  const pushMapped = (char: string) => {
    if (phonemeIdMap[char]) {
      rawIds.push(...phonemeIdMap[char]);
    } else if (char === ' ') {
      rawIds.push(spaceId);
    } else {
      rawIds.push(padId);
    }
  };

  if (voiceId.startsWith('id_ID') || voiceId.includes('indotts')) {
    // Indonesian: Normalize text, substitute standard Indonesian digraphs to Piper phoneme symbols
    let cleaned = text
      .toLowerCase()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Map Indonesian digraphs to phonetic IPA tokens present in id_ID-news_tts phoneme_id_map
    // ng -> ŋ (U+014B), ny -> ɲ (U+0272), sy -> ʃ (U+0283), kh -> x (U+0078)
    cleaned = cleaned
      .replace(/ng/g, 'ŋ')
      .replace(/ny/g, 'ɲ')
      .replace(/sy/g, 'ʃ')
      .replace(/kh/g, 'x');

    for (const char of cleaned) {
      if (phonemeIdMap[char]) {
        rawIds.push(...phonemeIdMap[char]);
      } else if (char === 'g' && (phonemeIdMap['g'] || phonemeIdMap['ɡ'])) {
        const gIds = phonemeIdMap['g'] || phonemeIdMap['ɡ'];
        if (gIds) rawIds.push(...gIds);
      } else if (char === ' ') {
        rawIds.push(spaceId);
      }
    }
  } else {
    // English or other languages: Use phonemizer for eSpeak IPA conversion
    try {
      const phones = await phonemize(text, 'en-us');
      const fullPhones = phones.join(' ');
      for (const char of fullPhones) {
        if (phonemeIdMap[char]) {
          rawIds.push(...phonemeIdMap[char]);
        } else if (char === ' ') {
          rawIds.push(spaceId);
        }
      }
    } catch (phonemizeErr) {
      console.warn('Phonemizer failed, falling back to direct character mapping:', phonemizeErr);
      const cleaned = text.toLowerCase();
      for (const char of cleaned) {
        if (phonemeIdMap[char]) {
          rawIds.push(...phonemeIdMap[char]);
        } else if (char === ' ') {
          rawIds.push(spaceId);
        }
      }
    }
  }

  // Piper VITS requires blank/PAD (_) interspersed between every token:
  // [^, 0, p1, 0, p2, 0, ..., $]. Without interspersion the duration
  // predictor collapses and synthesis degrades into garbled/robotic audio.
  const ids: number[] = [startId, padId];
  for (const pid of rawIds) {
    ids.push(pid, padId);
  }
  ids.push(endId);
  return ids;
}
