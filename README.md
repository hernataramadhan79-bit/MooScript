# MooScript Studio — Zero-Server Motion Graphics Generator

> **Pure Client-Side, Hardware-Accelerated 1080×1920 MP4 Video Generator** compiling text, audio, and kinetic motion graphics directly inside the browser using **WebCodecs** (`VideoEncoder`), **HTML5 Canvas**, and **mp4-muxer**.

---

## 🌟 Architectural Highlights

1. **Zero-Server Execution**:
   - 100% runs on client devices (desktop & mobile browsers).
   - BYOK (Bring Your Own Key) for Gemini, OpenAI, Groq, and ElevenLabs.
   - Built-in **Smart Fallback / Offline BGM Mode** that generates synthetic ambient music via Web Audio API, enabling offline video creation with zero external API keys!

2. **Deterministic Frame Evaluation (`RenderState = f(currentFrame, fps)`)**:
   - Never relies on `requestAnimationFrame` or `setTimeout` during video compilation.
   - Animations and spring curves (`spring(t)`, `easeOutExpo`, `easeInOutQuad`) are evaluated as analytical, closed-form functions of the discrete frame index.
   - 100% reproducible video renders with no dropped frames or audio desynchronization.

3. **Hardware Acceleration via WebCodecs + `mp4-muxer`**:
   - Uses browser-native `VideoEncoder` (`avc1.4d002a`, H.264 Main Profile level 4.2 at 1080p, 6 Mbps).
   - Universally compatible across iOS Safari, Chromium, and desktop browsers.
   - Completely avoids heavy WASM FFmpeg binaries to guarantee lightning-fast renders without crashing mobile browser tabs.

4. **Memory Safety & Zero Leaks**:
   - Explicitly calls `videoFrame.close()` immediately after each frame is submitted to the encoder.
   - Yields the event loop every 30 frames (`await new Promise(r => setTimeout(r, 0))`) to prevent mobile WebKit thermal throttling or worker termination.
   - IndexedDB caching for audio blobs via Dexie prevents browser memory spikes.

---

## 📁 Core Engine Architecture

```
src/
├── db/
│   └── mooDb.ts                 # Dexie IndexedDB persistence layer (projects, audio blobs, settings)
├── engine/
│   ├── ai/
│   │   ├── llm.ts               # BYOK LLM wrapper (Gemini, OpenAI, Groq) with structured outputs
│   │   └── tts.ts               # BYOK TTS wrapper (OpenAI, ElevenLabs with word timestamps, offline synthesizer)
│   ├── assets/
│   │   └── icons.ts             # Pre-compiled static vector Path2D icons (mascot, zap, brain, sparkles, etc.)
│   ├── export/
│   │   └── mp4Exporter.ts       # WebCodecs VideoEncoder + mp4-muxer deterministic export pipeline
│   ├── physics/
│   │   └── spring.ts            # Analytical harmonic oscillator spring physics & motion easing curves
│   ├── renderer/
│   │   └── canvasRenderer.ts    # 1080x1920 dynamic kinetic typography & mograph canvas renderer
│   └── skills/
│       └── skillManager.ts      # Persona Skills CRUD engine (Tech Explainer, Viral Hook, Chill Lofi, JSON export/import)
├── store/
│   └── useMooStore.ts           # Central Zustand store binding UI, engine, and playback transport clock
├── components/
│   ├── Header.tsx               # Brand header with Mascot, version, and API status indicator
│   ├── BottomNav.tsx            # Mobile-friendly safe bottom tab bar (Script, Voice, Studio, Settings)
│   └── tabs/
│       ├── ScriptTab.tsx        # Storyboard directing, AI generation, and kinetic word chips
│       ├── VoiceTab.tsx         # Voice persona auditioning, pacing sliders, and word timestamp timeline
│       ├── StudioTab.tsx        # Real-time 9:16 canvas preview, scrubbing controls, and 1080p MP4 exporter
│       └── SettingsTab.tsx      # BYOK API keys, engine defaults, custom skills CRUD, and Dexie cache
├── types/
│   └── index.ts                 # TypeScript data contracts (MooProject, Scene, WordTimestamp, etc.)
├── App.tsx                      # Root reactive layout
└── main.tsx                     # React 18 client entry
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
npm run build
```
Generates an optimized client-side bundle in `dist/`.

---

## 🎨 Stitch Design Integration
The user interface is adapted from the Stitch project *MooScript Studio Web App* (Project ID: `15632033472520422620`):
- **Screen 1**: Script & Concept (Mobile)
- **Screen 2**: Voice & Alignment (Mobile)
- **Screen 3**: BYOK Settings (Mobile)
- **Screen 4**: Studio & Export (Mobile)
- **Screen 5**: MooScript Modern DevTool Mascot Logo (SVG)

All assets and code were downloaded directly into `stitch_assets/` and integrated into the reactive state store and canvas rendering engine.
