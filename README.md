# MooScript Studio — Zero-Server Motion Graphics Generator

> **Pure Client-Side, Hardware-Accelerated MP4 Video Generator** compiling text, audio, and kinetic motion graphics directly inside your browser tabs using **WebCodecs** (`VideoEncoder`), **HTML/CSS/GSAP Layered Composition Engine**, and **Mediabunny**.

---

## 🌟 Architectural Principles

1. **100% Client-Side & Zero-Server**:
   - Runs completely on the user's device in modern web browsers.
   - **4-Step Production Wizard**: Structured flow guiding creators from Concept (`Idea`), Theme (`Style`), Directing (`Visual Editor`), to Delivery (`Export`).
   - Bring-Your-Own-Key (BYOK) for Gemini, OpenAI, Groq, and ElevenLabs. API keys are stored only locally in IndexedDB or sessionStorage (memory-safe mode).
   - **Local Offline TTS Engine**: Synthesizes speech locally in the browser via Piper ONNX Web Worker without external network requests.
   - **Decoupled Procedural BGM Engine**: Standalone or sidechained BGM generation using Web Audio API with automatic dynamic speech ducking. Modifying BGM presets re-mixes audio instantly without re-calling TTS APIs.
   - **SubRip (.srt) & WebVTT (.vtt) Export**: Instant subtitle track generation directly from word timestamps.
   - **Multi-Project Management**: Create, switch, duplicate, and delete multiple video projects stored locally in IndexedDB.
   - **Installable Progressive Web App (PWA)**: Precaches assets, self-hosted typography (`Plus Jakarta Sans`, `JetBrains Mono`), and local TTS models for instant offline startup.

2. **Dual-Engine Architecture (GSAP Layers + Canvas Fallback)**:
   - **Primary Engine (v2)**: Sandboxed HTML/CSS/GSAP Layer Composition (`mooRuntime.ts`). Provides fluid kinetic typography, SVG graphics, responsive aspect ratios (9:16, 16:9, 1:1), and non-destructive layer overrides.
   - **Legacy Engine**: 2D HTML5 Canvas renderer (`canvasRenderer.ts`) retained as a lightweight fallback.
   - Evaluated deterministically during video compilation via GSAP timeline scrubbing (`tl.seek(t)`).
   - 100% reproducible video renders with zero dropped frames or audio desynchronization.

3. **Hardware Acceleration via WebCodecs & Canvas Pooling**:
   - Uses browser-native `VideoEncoder` with dynamic fallback (`avc1.4d002a`, `avc1.640028`, `avc1.42001f`).
   - **Canvas Pooling & Zero-Copy Rasterization**: Reuses a single shared canvas buffer during export to prevent memory leaks and browser tab termination on mobile and Safari iOS devices.
   - Adaptive bitrates derived automatically from resolution, fps, and screen aspect ratio.
   - Avoids heavy WASM FFmpeg binaries to guarantee lightweight, instant renders without crashing browser tabs.

4. **Memory Safety & Backpressure Control**:
   - Explicitly calls `videoFrame.close()` and `audioData.close()` immediately after each frame/chunk is submitted to the encoder.
   - Enforces backpressure queue monitoring (`encodeQueueSize <= MAX_QUEUE`) and yields the event loop with `scheduler.yield()` / micro-yields to prevent memory bloat and thermal throttling.
   - IndexedDB caching for scene audio blobs via Dexie prevents duplicate synthesis calls and RAM spikes.

---

## 📱 Progressive Web App (PWA) & Offline Capabilities

MooScript Studio is a full-fledged Progressive Web App powered by `vite-plugin-pwa`:

- **Installation**:
  - **Android (Chrome)**: Tap the browser menu `⋮` → **Install app** or tap the prompt banner.
  - **iOS / iPadOS (Safari)**: Tap the Share button `⎋` → **Add to Home Screen**.
  - **Desktop (Chrome / Edge)**: Click the Install icon in the browser address bar.
- **Offline Reliability**:
  - All web application assets, self-hosted fonts (`Plus Jakarta Sans`, `JetBrains Mono`, `Material Symbols`), and ONNX inference runtimes are precached by the Service Worker.
  - Local TTS Piper voice models are cached via Workbox `CacheFirst` runtime caching.
  - Zero server dependencies. Even without an internet connection, you can compose storyboards, synthesize procedural or local voiceovers, and compile hardware-accelerated MP4 videos.
- **Version Updates**:
  - When an updated release is deployed, the app displays a non-intrusive notification toast offering a 1-click reload to update without losing active IndexedDB project data.

---

## 🌐 Browser Compatibility Matrix

| Browser                      | OS / Platform                  |  Video Export   | Audio Encoding  | PWA Install | Status & Notes                                                                                                                            |
| :--------------------------- | :----------------------------- | :-------------: | :-------------: | :---------: | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Chrome / Chromium** | Windows, macOS, Linux, Android |     ✅ Full     |     ✅ Full     |   ✅ Full   | **Recommended**. Hardware-accelerated H.264/AAC.                                                                                          |
| **Microsoft Edge**           | Windows, macOS, Linux          |     ✅ Full     |     ✅ Full     |   ✅ Full   | **Recommended**. Hardware-accelerated H.264/AAC.                                                                                          |
| **Brave / Opera / Vivaldi**  | Desktop & Android              |     ✅ Full     |     ✅ Full     |   ✅ Full   | Fully supported on Chromium 94+.                                                                                                          |
| **Apple Safari**             | macOS 14.4+, iOS 17.4+         |   ⚠️ Partial    |   ⚠️ Partial    |   ✅ Full   | Supported with hardware AVC baseline. If `AudioEncoder` is unavailable in older builds, automatically exports video-only with UI warning. |
| **Mozilla Firefox**          | Desktop & Android              | ⚠️ Experimental | ⚠️ Experimental |   ✅ Full   | WebCodecs is partially behind flags (`dom.media.webcodecs.enabled`). If unavailable, UI presents explicit guidance.                       |

---

## ⚠️ Known Limitations

- **Browser WebCodecs Support**: Browsers without WebCodecs cannot export MP4 files client-side. Use modern Chrome, Edge, or updated Safari.
- **Mobile Memory Constraints**: Very long videos (> 3 minutes at 1080p60) may encounter browser tab memory limits on low-memory mobile devices. We recommend 15–60 second formats (3–10 scenes), which is ideal for TikTok, Shorts, and Reels.
- **Safari Storage Eviction**: Safari may evict IndexedDB storage if unused for 7 days. You can click **"Enable Persistent Mode"** in Settings to request eviction protection via `navigator.storage.persist()`.
- **iOS Safari Backgrounding**: While encoding video on iOS Safari, keep the tab in the foreground. iOS may freeze Web Workers or canvas rasterization if the user switches apps during an active export run.

---

## 📁 Repository Structure

```
├── .github/workflows/
│   └── ci.yml                   # CI pipeline: TypeScript, ESLint, Vitest, and Vite build
├── docs/design/                 # Design assets and mockups from Stitch
├── tests/                       # Automated Vitest test suites
│   ├── exporter.test.ts         # WebCodecs mock tests, backpressure, error capture, cancellation
│   ├── renderer.test.ts         # Golden-frame deterministic pixel and command hash tests
│   ├── skillManager.test.ts     # Skills CRUD, protection, JSON import/export validation
│   ├── spring.test.ts           # Analytical harmonic oscillator spring physics & monotonic checks
│   └── tts.test.ts              # Deterministic word alignment & fallback duration calculations
├── src/
│   ├── db/
│   │   └── mooDb.ts             # Dexie IndexedDB persistence layer (projects, audio cache, settings, assets)
│   ├── engine/
│   │   ├── ai/
│   │   │   ├── llm.ts           # BYOK LLM wrapper (Gemini, OpenAI, Groq) with structured outputs
│   │   │   ├── tts.ts           # BYOK TTS wrapper (OpenAI, ElevenLabs, offline synthesizer)
│   │   │   └── localTts.ts      # Client-side Piper ONNX speech synthesizer (100% offline)
│   │   ├── audio/
│   │   │   └── bgmMixer.ts      # Standalone & ducking procedural BGM synthesis (Web Audio API)
│   │   ├── composition/         # GSAP Layered Composition Engine (v2)
│   │   │   ├── buildDocument.ts # Self-contained HTML/CSS sandboxed stage assembler
│   │   │   ├── layers.ts        # Layer metadata discovery, CSS overrides, palette tokens
│   │   │   └── runtime/
│   │   │       └── mooRuntime.ts # Iframe GSAP runtime, timeline scrubber, canvas pooling
│   │   ├── export/
│   │   │   └── mp4Exporter.ts   # WebCodecs VideoEncoder + Mediabunny hardware export pipeline
│   │   └── renderer/
│   │       └── canvasRenderer.ts # 2D Canvas fallback engine
│   ├── features/                # 4-Step Production Wizard
│   │   ├── idea/                # Step 0: Prompt, AI director & persona skills
│   │   ├── style/               # Step 1: Visual identity, palette & typography
│   │   ├── editor/              # Step 2: Interactive composition stage, timeline & audio controls
│   │   └── export/              # Step 3: Aspect ratio, bitrate & MP4/subtitle export
│   ├── store/
│   │   ├── slices/              # Modular Zustand store slices (project, audio, bgm, playback, settings)
│   │   ├── types.ts             # Central store slice interfaces
│   │   └── useMooStore.ts       # Unified backwards-compatible Zustand hook
│   ├── components/
│   │   ├── studio/
│   │   │   ├── CompositionStage.tsx # Responsive sandboxed iframe stage host
│   │   │   └── CanvasStage.tsx      # Legacy 2D canvas stage fallback
│   │   └── timeline/
│   │       └── TimelineBar.tsx      # Interactive audio scrubber & scene playhead
│   ├── types/
│   │   └── index.ts             # TypeScript data contracts
│   ├── App.tsx                  # Wizard stage orchestrator
│   └── main.tsx                 # Entrypoint with self-hosted fonts
├── LICENSE                      # MIT License
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 🛠️ Development & Quality Assurance

### 1. Install Dependencies

```bash
npm install
```

### 2. Development Server

```bash
npm run dev
```

### 3. Run Automated Tests

```bash
# Run unit & engine integration tests
npm test

# Run tests with v8 code coverage
npm run test:coverage
```

### 4. Code Quality & Formatting

```bash
# Type check with strict TypeScript
npx tsc -b

# Lint codebase (zero warnings enforced)
npm run lint

# Format code with Prettier
npm run format
```

### 5. Production Build

```bash
npm run build
```

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
