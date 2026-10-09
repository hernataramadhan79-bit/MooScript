# MooScript — Zero-Server Motion Graphics Generator Specification

## 1. Architectural Philosophy & Constraints

- **Pure Client-Side Execution**: Zero proprietary backend. All LLM calls, TTS generation, audio decoding, canvas rasterization, and MP4 muxing must execute directly on the client device (desktop & mobile browsers).
- **Deterministic Frame Evaluation**: Rendering must NEVER rely on real-time playback (`requestAnimationFrame` or `setTimeout`). All animations must be computed strictly as a function of the discrete frame index: `RenderState = f(currentFrame, fps)`.
- **Hardware Video Acceleration**: Use browser native WebCodecs (`VideoEncoder`) paired with `mediabunny`. Strictly avoid heavy WASM FFmpeg binaries to ensure instant encoding without crashing low-memory mobile browser tabs.
- **Memory Safety & Zero Leaks**: Explicitly close every `VideoFrame` instance immediately after encoding. Clear all canvas buffers and release audio buffer references after rendering runs.

---

## 2. Tech Stack & Library Specifications

- **Framework**: React 18 / Vite / TypeScript with Tailwind CSS for high-performance reactive UI.
- **State Management**: `zustand` with persistence adapter via `dexie` (IndexedDB) for caching large audio Blobs and project state.
- **Video Muxing**: `mediabunny` (via `BufferTarget` and `Mp4OutputFormat`).
- **Motion Physics & Easing**: Custom spring interpolation helper functions and a headless timeline evaluator (interpolating position, scale, opacity, and blur per frame).
- **Iconography / Assets**: Lightweight SVG string parser for local static icons (no remote network fetching during frame loops).
- **Design System**: Tailored from Stitch design tokens with `#84cc16` lime accents, dark `#131315` surface, `Plus Jakarta Sans` & `JetBrains Mono` fonts, and Material Symbols.

---

## 3. Core Modules & Implementation Details

### Module 1: BYOK API Adapters (LLM & TTS)

1. **LLM Adapter (`src/engine/ai/llm.ts`)**:
   - Direct browser-compatible fetch wrapper for Gemini (`v1beta`), OpenAI (`v1/chat/completions`), and Groq.
   - Enforce Structured Outputs via native JSON Schema mode.
   - Merge user-customizable "Persona Skill" system prompts with an immutable engine schema to guarantee valid storyboard JSON.
2. **TTS Adapter (`src/engine/ai/tts.ts`)**:
   - Support OpenAI TTS (`v1/audio/speech`) and ElevenLabs (`/v1/text-to-speech/{id}/with-timestamps`).
   - For ElevenLabs: Extract word-level start/end timestamps directly from the API response.
   - For TTS engines lacking word timestamps: Implement a deterministic fallback alignment algorithm that splits the audio duration evenly across words based on character length and punctuation pauses.
   - Fallback (BGM / No Voiceover Mode): Calculate scene duration using an adjustable reading speed metric:
     `durationSeconds = (wordCount / 130) * 60 + 1.2`

### Module 2: State Store & Data Contracts (`src/store/useMooStore.ts`)

```typescript
export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number; // in seconds
}

export type LayoutType = 
  | 'KINETIC_QUOTE'     // Dynamic typography with focus word punch & bounce
  | 'METRIC_COUNTER'    // Animated rolling numbers + label + circular progress
  | 'TERMINAL_MOCKUP'   // macOS terminal card + syntax typewriter animation
  | 'VS_COMPARISON'     // Side-by-side battle card split
  | 'LIST_STAGGER';     // Staggered bullet points appearing sequentially

export interface VisualData {
  title?: string;
  metricValue?: string;      // e.g. "+400%", "99.9%"
  metricLabel?: string;      // e.g. "User Growth", "Uptime"
  codeSnippet?: string;      // Shell or JS code
  codeLanguage?: string;
  leftTitle?: string;        // For VS_COMPARISON
  leftDesc?: string;
  rightTitle?: string;
  rightDesc?: string;
  bulletItems?: string[];    // For LIST_STAGGER
  accentIcon?: string;
  focusWords?: string[];
}

export interface Scene {
  id: string;
  layout: LayoutType;
  narrationText: string;     // Text fed to TTS
  visualData: VisualData;
  durationInSeconds: number;
  wordTimestamps: WordTimestamp[];
  motionPreset: MotionPreset;
  camera?: 'push_in' | 'pull_out' | 'snap_zoom' | 'whip_pan' | 'steady_drift';
  showSubtitles?: boolean;
}

export interface MooProject {
  id: string;
  title: string;
  aspectRatio: '9:16';
  fps: number; // default 30
  width: number; // 1080
  height: number; // 1920
  theme: {
    bg: string;
    textPrimary: string;
    textHighlight: string;
    fontFamily: string;
    captionStyle: string;
    captionPosition: string;
    showSubtitles?: boolean;
  };
  scenes: Scene[];
  audioBlob?: Blob;
  audioDuration: number;
}
```

### Module 3: Composition & Rendering Architecture

MooScript operates a dual-engine rendering pipeline:

#### Primary Engine (v2): HTML/CSS/GSAP Layer Composition (`src/engine/composition/`)
- **Sandboxed Stage**: Executed inside an isolated iframe (`sandbox="allow-scripts"`).
- **GSAP Timeline Driver (`mooRuntime.ts`)**: Evaluates scenes deterministically by scrubbing a synchronized GSAP Master Timeline (`tl.seek(t)`).
- **Editable Layers (`layers.ts`)**: Generates and inspects elements with `data-moo-layer` attributes, allowing non-destructive visual adjustments (text, color, scale, translate, rotate, opacity) without altering base templates.
- **Canvas Pooling (`resetSharedCanvas`)**: Employs a pooled offscreen canvas buffer for SVG frame rasterization, preventing memory bloat during WebCodecs frame-by-frame export runs.
- **Offline Fonts**: Self-contained `@fontsource` WOFF2 data-URIs (`Plus Jakarta Sans`, `JetBrains Mono`) ensuring pixel-perfect layout and rendering even without internet connectivity.

#### Fallback Engine: Deterministic 2D Canvas Renderer (`src/engine/renderer/canvasRenderer.ts`)
- **Canvas Context**: OffscreenCanvas / `<canvas>` configured for responsive dimensions.
- **Kinetic Layout Presets**: Legacy 5 layouts (`KINETIC_QUOTE`, `METRIC_COUNTER`, `TERMINAL_MOCKUP`, `VS_COMPARISON`, `LIST_STAGGER`) retained for lightweight fallback mode.

### Module 4: WebCodecs + MP4 Muxer Pipeline (`src/engine/export/mp4Exporter.ts`)

- **Decode Audio**: Decode `audioBlob` into `AudioBuffer` via browser `AudioContext`.
- **Muxer Setup**: `mediabunny` `Output` targeting `BufferTarget` with `Mp4OutputFormat({ fastStart: 'in-memory' })`.
  - Video Track: `CanvasSource` `{ codec: 'avc', bitrate }`.
  - Audio Track: `AudioBufferSource` `{ codec: 'aac', bitrate: 128_000 }`.
- **VideoEncoder Setup**:
  - Codec: `'avc1.4d002a'` (H.264 Baseline/Main profile at 1080p, supported across mobile Safari and Chromium).
  - Bitrate: 6,000,000 bps (6 Mbps), Hardware Acceleration: `'prefer-hardware'`.
- **Deterministic Render Loop**:
  ```typescript
  for (let frame = 0; frame < totalFrames; frame++) {
    // 1. Draw frame to Canvas
    canvasRenderer.draw(frame, totalFrames, project);

    // 2. Create VideoFrame from Canvas
    const timestampMicroseconds = Math.round((frame / fps) * 1_000_000);
    const videoFrame = new VideoFrame(canvasElement, {
      timestamp: timestampMicroseconds,
      duration: Math.round((1 / fps) * 1_000_000)
    });

    // 3. Encode & Close immediately
    const isKeyFrame = frame % (fps * 2) === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
    videoFrame.close(); // MANDATORY: Prevent mobile out-of-memory crashes

    // 4. Report progress to UI
    onProgress(Math.round((frame / totalFrames) * 100));

    // 5. Thermal & background yield
    if (frame % 30 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await videoEncoder.flush();
  muxer.finalize();
  ```
- **Emit Output**: Wrap ArrayBuffer into `Blob(['video/mp4'])` and create Object URL for instant mobile/desktop download.

### Module 5: Persona Skills Engine (`src/engine/skills/skillManager.ts`)

- CRUD manager persisted in IndexedDB.
- 3 built-in default presets:
  1. `⚡ Tech Explainer`: Fast tempo, punchy words, concise logic.
  2. `🧠 Viral Hook`: Aggressive first 3 seconds, curiosity gap phrasing.
  3. `☕ Chill Lofi Story`: Relaxed cadence, poetic sentences, subtle kinetic transitions.
- Export/Import utility (.json serialization).

---

## 4. Edge Cases & Resilience

- **Mobile Thermal & Backgrounding**: Yield the main thread every 30 frames with `setTimeout(0)`.
- **Safari MP4 Profile Compatibility**: Strict AVC level parameter `avc1.4d002a` (H.264 Main Profile level 4.2).
- **Fallback Audio Muxing**: Gracefully handles lack of native `AudioEncoder` by muxing AAC data or synthesizing audio frames safely.
