# MooScript Studio

> Turn a topic or a script into a motion graphics video, entirely in the browser. An AI motion director writes each shot as SVG + CSS + GSAP, a sandboxed runtime plays it as one continuous film, and WebCodecs exports the MP4 on your own device. No server, no account, bring your own API key.

---

## What it does

1. **Write an idea or a script.** The AI turns it into a **shot list** (5–10 shots of 2–4.5 s), each with one hero object and a match cut into the next shot, plus a **world bible** for the whole film: palette, a recurring motif, illustration style and camera style.
2. **Generate the visuals.** Each shot is written as real motion graphics code (SVG-first stage, a moving camera, kinetic type) and checked by an anti-slide linter before it lands on the timeline.
3. **Add a voice-over and music.** Cloud or fully offline TTS, Whisper word alignment, procedural background music with speech ducking.
4. **Edit and export.** Drag layers on the canvas, tweak colors, edit the code of any shot, then export MP4 (plus SRT/VTT subtitles) locally.

Projects start empty. Everything is stored in your browser (IndexedDB).

---

## Features

### AI motion director

- **Shot-list storyboard + world bible** (`src/engine/ai/llm.ts`): structured output for Gemini, OpenAI, Groq, Anthropic and OpenRouter. The world bible palette becomes the project theme.
- **Stage contract & motion grammar** (`src/engine/ai/director/motionLaws.ts`): each shot is a fixed film frame (1080×1920, 1920×1080 or 1080×1080) composed in absolute coordinates inside a `.moo-camera` layer. Frame 0 must already show the subject, nothing holds still for long, accents land on spoken words, and every shot ends with a hand-off.
- **Shot continuity**: every shot prompt carries the world bible, its neighbouring shots and the incoming/outgoing match cut.
- **Anti-PPT linter** (`src/engine/composition/mographLint.ts`): scores generated code for slide/web-page patterns (no camera, card layouts, pasted narration, fade-up-only motion, empty first frame, …) and requests one rewrite when needed. The rewrite is kept only if it is valid and scores better.
- **Mograph kit** (`src/engine/composition/runtime/mographKit.ts`): helpers on `ctx` that generated code calls instead of hand-rolled tweens — `ctx.camera`, `ctx.hero`, `ctx.draw`, `ctx.pop`, `ctx.kinetic`, `ctx.count`, `ctx.reveal`, `ctx.punch`, `ctx.shake`, `ctx.flash`, `ctx.drift`, `ctx.orbit`, `ctx.particles`, `ctx.beat`. All stay inside the shot duration and are deterministic.
- **Instant visuals without AI** (`src/engine/composition/proceduralCompiler.ts`): eight procedural archetypes with camera moves, particles and hand-offs.

### Composition runtime

- Sandboxed iframe stage (`src/engine/composition/buildDocument.ts`, `runtime/mooRuntime.ts`) with a single GSAP master timeline scrubbed by frame, so preview and export are identical.
- **Flow transition** (default): the next shot is already underneath and lands with a short push while the current one hands off. Cut, fade, slide, zoom and wipe are also available.
- Per-scene CSS is scoped to its wrapper (`scopeCss.ts`), so shots never leak styles into each other.
- Poster frames: while the editor is paused at the start of a shot whose first frame is empty, the preview shows its first frame with content. Playback and export always render the real timeline.
- Non-destructive layer overrides (move, scale, rotate, opacity, color) and per-scene palettes.

### Audio

- TTS: OpenAI, ElevenLabs, or **offline Piper** voices running in a Web Worker (ONNX Runtime Web).
- Word timestamps from Whisper alignment or a deterministic estimate; generated shots sync accents to them.
- Procedural BGM presets or your own track, mixed with speech ducking via the Web Audio API.

### Export

- WebCodecs `VideoEncoder` + [Mediabunny](https://mediabunny.dev) MP4 muxing, with codec fallbacks, backpressure control and frame cleanup.
- Quality presets (compact / standard / high) at 24, 30 or 60 fps; captions burned in or exported as SRT / WebVTT.
- Standalone HTML export of the composition.

### App

- Multi-project management, project templates, undo/redo, keyboard shortcuts.
- Installable PWA with self-hosted fonts and offline caching of app assets, the ONNX runtime and downloaded voices.
- API keys stay on the device (IndexedDB, or session-only mode) and are sent only to the provider you choose.

---

## Browser support

| Browser | Video export | Audio encoding | PWA | Notes |
| :-- | :-: | :-: | :-: | :-- |
| Chrome / Chromium, Edge | ✅ | ✅ | ✅ | Recommended. Hardware-accelerated H.264/AAC. |
| Brave / Opera / Vivaldi | ✅ | ✅ | ✅ | Chromium 94+. |
| Safari (macOS 14.4+, iOS 17.4+) | ⚠️ | ⚠️ | ✅ | Falls back to video-only export when `AudioEncoder` is missing. |
| Firefox | ⚠️ | ⚠️ | ✅ | WebCodecs support is still partial. |

### Known limitations

- Exporting needs WebCodecs. Use a recent Chrome, Edge or Safari.
- Long 1080p60 videos can hit memory limits on low-end phones. 15–60 s formats work best.
- Safari may evict IndexedDB after 7 days of inactivity. Enable **persistent storage** in Settings.
- Keep the tab in the foreground while exporting on iOS.
- Generation quality depends on the model you pick. Each shot is one AI call (sometimes two when the linter asks for a rewrite).

---

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the app, add an API key under **Settings** (or use offline voices and instant visuals without one), type an idea and press **Susun Adegan**.

### Quality gates

CI runs all of these on every push and pull request to `main`:

```bash
npx tsc -b        # type check
npm run lint      # ESLint, zero warnings
npm test          # Vitest
npm run build     # production build
```

`npm run test:coverage` writes a v8 coverage report; `npm run format` runs Prettier.

---

## Repository structure

```
src/
├── components/            # Workstation UI: SceneDeck, CompositionStage, TimelineBar, InspectorRack, settings, modals
├── db/                    # Dexie (IndexedDB) persistence, asset and BGM storage, legacy demo cleanup
├── engine/
│   ├── ai/
│   │   ├── llm.ts         # BYOK LLM providers, shot-list storyboard + world bible schemas
│   │   ├── director/      # Motion director prompts, scene generation, lint-driven rewrites
│   │   ├── tts.ts         # Cloud TTS and word alignment
│   │   ├── localTts.ts    # Offline Piper TTS (Web Worker)
│   │   └── voiceAlign.ts  # Whisper word-level alignment
│   ├── audio/             # BGM mixer and waveform peaks
│   ├── composition/       # Document builder, runtime, mograph kit, linter, CSS scoping, procedural archetypes
│   ├── export/            # MP4 exporter, export options, subtitle export
│   └── renderer/          # Legacy canvas renderer (old projects only)
├── features/scene/        # Per-shot code editor
├── store/                 # Zustand slices (project, script, audio, bgm, playback, export, settings, ui)
└── types/                 # Shared data contracts
tests/                     # Vitest suites and fixtures
docs/design/               # Early design mockups
public/                    # PWA icons, icon font, privacy page
```

---

## License

Copyright (C) 2026 hernataramadhan79-bit and MooScript Studio contributors.

Starting with this version, MooScript Studio is free software released under the [GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later). You may use, study, modify and share it, but if you distribute a modified version **or run it for other people over a network** (for example as a hosted website), you must make the complete source code of your version available to them under the same license.

Versions published before this change remain available under the MIT License they were released with.

### Additional permission for GSAP (AGPL section 7)

The stage runtime currently relies on GSAP, which is distributed under its own non-free [GSAP Standard "No Charge" License](https://gsap.com/standard-license). As the copyright holders, we grant this additional permission:

> If you modify this Program, or any covered work, by linking or combining it with GSAP (or a modified version of that library), containing parts covered by the terms of the GSAP Standard "No Charge" License, the licensors of this Program grant you additional permission to convey the resulting work. Corresponding Source for a non-source form of such a combination shall include the source code for the parts of GSAP used as well as that of the covered work.

This permission covers GSAP only. Your use of GSAP itself stays subject to its own license. The permission will no longer be needed once the stage moves to its own animation engine.

### Third-party components

Third-party components keep their own licenses, including:

- **GSAP** — [GSAP Standard "No Charge" License](https://gsap.com/standard-license) (not open source). It is bundled into the stage and into exported HTML.
- **Mediabunny** — MPL-2.0. **ONNX Runtime Web**, React, Zustand, Zod — MIT. **Dexie**, Phonemizer — Apache-2.0.
- **Fonts** (Plus Jakarta Sans, JetBrains Mono, Syne, Material Symbols) — SIL Open Font License 1.1.
- **Piper voices** are downloaded at runtime from Hugging Face; each voice has its own model card and license.
