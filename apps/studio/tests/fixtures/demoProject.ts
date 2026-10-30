/**
 * The built-in "WebCodecs Architecture" demo project that the app used to ship with.
 * New installs now start empty; this copy keeps the tests that exercise a populated project.
 */
import type { Composition, MooProject } from '../../src/types';
import { CURRENT_SCHEMA_VERSION, BUILTIN_THEMES, migrateLegacyScene } from '../../src/types';
import { DEFAULT_PROJECT_ID } from '../../src/store/slices/projectSlice';

export const DEMO_COMPOSITION: Composition = {
  id: 'comp-default',
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 10.0,
  globalCss: `
    @keyframes pulseGlow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
  `,
  scenes: [
    {
      id: 'sc-1',
      beatId: 'sc-1',
      duration: 3.2,
      html: `<div class="sc1-container">
  <div class="sc1-grid-bg"></div>
  <div class="sc1-badge" data-moo-layer="badge">MOOSCRIPT ZERO-SERVER</div>
  <h1 class="sc1-headline" data-moo-layer="headline">
    <span class="sc1-word w1">ZERO</span>
    <span class="sc1-word w2">SERVER</span>
    <span class="sc1-word w3 accent">RENDERING</span>
  </h1>
  <p class="sc1-sub" data-moo-layer="subtitle">Directly inside your browser tabs</p>
</div>`,
      css: `.sc1-container {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #181824 0%, var(--moo-bg, #09090b) 100%);
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: var(--moo-text, #f4f4f5); text-align: center; padding: 60px;
}
.sc1-grid-bg {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(132,204,22,0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(132,204,22,0.08) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(circle, black 40%, transparent 80%);
}
.sc1-badge {
  position: relative; z-index: 2;
  font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 700;
  color: var(--moo-accent, #84cc16); background: rgba(132,204,22,0.12);
  border: 1px solid rgba(132,204,22,0.3); padding: 10px 28px;
  border-radius: 9999px; letter-spacing: 0.15em; margin-bottom: 40px;
}
.sc1-headline {
  position: relative; z-index: 2;
  font-size: 92px; font-weight: 800; line-height: 1.05;
  display: flex; flex-direction: column; gap: 12px;
}
.sc1-word.accent {
  color: var(--moo-accent, #84cc16); text-shadow: 0 0 35px rgba(132,204,22,0.45);
}
.sc1-sub {
  position: relative; z-index: 2;
  margin-top: 40px; font-size: 32px; color: var(--moo-text, #a1a1aa); max-width: 800px; font-weight: 500;
}`,
      buildJs: `tl.from(root.querySelector(".sc1-badge"), { y: -30, opacity: 0, duration: 0.6, ease: "back.out(1.7)" })
  .from(root.querySelectorAll(".sc1-word"), { y: 60, opacity: 0, scale: 0.9, stagger: 0.18, duration: 0.7, ease: "power3.out" }, "-=0.3")
  .from(root.querySelector(".sc1-sub"), { opacity: 0, y: 20, duration: 0.6 }, "-=0.2");`,
      status: 'ok',
      version: 1,
      userEdited: true
    },
    {
      id: 'sc-2',
      beatId: 'sc-2',
      duration: 3.6,
      html: `<div class="sc2-container">
  <div class="sc2-terminal" data-moo-layer="terminal">
    <div class="sc2-bar">
      <span class="sc2-dot red"></span>
      <span class="sc2-dot yellow"></span>
      <span class="sc2-dot green"></span>
      <span class="sc2-title">engine.ts — WebCodecs</span>
    </div>
    <div class="sc2-body">
      <div class="sc2-line line1"><span class="sc2-kw">const</span> encoder = <span class="sc2-fn">new</span> VideoEncoder({</div>
      <div class="sc2-line line2">&nbsp;&nbsp;output: chunk =&gt; muxer.add(chunk),</div>
      <div class="sc2-line line3">&nbsp;&nbsp;error: e =&gt; console.error(e)</div>
      <div class="sc2-line line4">});</div>
      <div class="sc2-line line5 accent" data-moo-layer="metric"><span class="sc2-comment">// Deterministic hardware acceleration</span></div>
    </div>
  </div>
</div>`,
      css: `.sc2-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: var(--moo-bg, #09090b); padding: 50px;
  font-family: 'JetBrains Mono', monospace;
}
.sc2-terminal {
  width: 100%; max-width: 960px;
  background: #121215; border: 1px solid #27272a;
  border-radius: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.6);
  overflow: hidden;
}
.sc2-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 24px; background: #18181c; border-bottom: 1px solid #27272a;
}
.sc2-dot { width: 16px; height: 16px; border-radius: 50%; }
.sc2-dot.red { background: #ef4444; }
.sc2-dot.yellow { background: #f59e0b; }
.sc2-dot.green { background: #10b981; }
.sc2-title { margin-left: 12px; font-size: 20px; color: #71717a; }
.sc2-body { padding: 36px; font-size: 26px; line-height: 1.6; color: #e4e4e7; }
  color: var(--moo-accent, #84cc16); font-weight: 700;
.sc2-fn { color: #38bdf8; }
.sc2-comment { color: #71717a; font-style: italic; }
  margin-top: 20px; color: var(--moo-accent, #84cc16); }`,
      buildJs: `tl.from(root.querySelector(".sc2-terminal"), { scale: 0.85, opacity: 0, y: 50, duration: 0.8, ease: "power3.out" })
  .from(root.querySelectorAll(".sc2-line"), { opacity: 0, x: -20, stagger: 0.15, duration: 0.5, ease: "power2.out" }, "-=0.3");`,
      status: 'ok',
      version: 1,
      userEdited: true
    },
    {
      id: 'sc-3',
      beatId: 'sc-3',
      duration: 3.2,
      html: `<div class="sc3-container">
  <div class="sc3-card" data-moo-layer="card">
    <div class="sc3-metric-val" data-moo-layer="metric">60 FPS</div>
    <div class="sc3-metric-lbl" data-moo-layer="metric-label">Hardware Export Throughput</div>
    <div class="sc3-badge" data-moo-layer="badge">ZERO MEMORY LEAKS</div>
  </div>
</div>`,
      css: `.sc3-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 50%, #1a1e12 0%, var(--moo-bg, #09090b) 100%);
  font-family: 'Plus Jakarta Sans', sans-serif; padding: 50px;
}
.sc3-card {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 60px 50px; border-radius: 36px;
  background: rgba(24, 24, 27, 0.7); border: 2px solid var(--moo-accent, rgba(132, 204, 22, 0.3));
  backdrop-filter: blur(20px); box-shadow: 0 0 80px rgba(132, 204, 22, 0.15);
}
.sc3-metric-val {
  font-size: 130px; font-weight: 800; color: var(--moo-accent, #84cc16);
  letter-spacing: -0.04em; text-shadow: 0 0 50px rgba(132, 204, 22, 0.4);
}
.sc3-metric-lbl {
  font-size: 32px; font-weight: 600; color: var(--moo-text, #f4f4f5); margin-top: 10px;
}
.sc3-badge {
  margin-top: 36px; font-family: 'JetBrains Mono', monospace; font-size: 20px;
  font-weight: 700; color: #a1a1aa; letter-spacing: 0.12em;
  background: rgba(255,255,255,0.06); padding: 10px 24px; border-radius: 9999px;
} `,
      buildJs: `tl.from(root.querySelector(".sc3-card"), { scale: 0.7, opacity: 0, duration: 0.8, ease: "back.out(1.8)" })
  .from(root.querySelector(".sc3-metric-val"), { scale: 1.3, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.4")
  .from(root.querySelector(".sc3-metric-lbl"), { y: 20, opacity: 0, duration: 0.5 }, "-=0.2");`,
      status: 'ok',
      version: 1,
      userEdited: true
    }
  ],
  createdAt: 1700000000000
};

export const DEMO_PROJECT: MooProject = {
  id: DEFAULT_PROJECT_ID,
  title: 'WebCodecs Architecture',
  schemaVersion: CURRENT_SCHEMA_VERSION,
  aspectRatio: '9:16',
  resolution: '1080p',
  renderMode: 'composition',
  fps: 30,
  width: 1080,
  height: 1920,
  composition: DEMO_COMPOSITION,
  theme: {
    bg: '#09090b',
    textPrimary: '#f4f4f5',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center',
    showSubtitles: false
  },
  scenes: [
    {
      id: 'sc-1',
      narrationText: 'Zero server rendering directly inside your browser tabs',
      text: 'Zero server rendering directly inside your browser tabs',
      visualIntent: 'Demonstrate zero-server web architecture with pulsating grid and high-tech typography',
      visualConcept: 'Dark background with neon grid and floating badges',
      visualElements: ['badge', 'headline', 'grid-lines', 'sub-label'],
      motionIntent: 'Badge drops with elastic bounce, typography scales up sequentially',
      focusWords: ['zero', 'server', 'browser'],
      motionPreset: 'punch_zoom',
      camera: 'snap_zoom',
      icon: 'mascot',
      durationInSeconds: 3.2,
      wordTimestamps: [
        { word: 'Zero', start: 0.0, end: 0.4 },
        { word: 'server', start: 0.4, end: 0.9 },
        { word: 'rendering', start: 0.9, end: 1.5 },
        { word: 'directly', start: 1.5, end: 2.0 },
        { word: 'inside', start: 2.0, end: 2.4 },
        { word: 'your', start: 2.4, end: 2.6 },
        { word: 'browser', start: 2.6, end: 3.0 },
        { word: 'tabs', start: 3.0, end: 3.2 }
      ]
    },
    {
      id: 'sc-2',
      narrationText: 'WebCodecs Hardware acceleration with deterministic canvas math',
      text: 'WebCodecs Hardware acceleration with deterministic canvas math',
      visualIntent: 'Display raw hardware encoding loop in a developer terminal environment',
      visualConcept: 'Floating IDE window with syntax highlighting and glowing status bar',
      visualElements: ['terminal-window', 'code-lines', 'traffic-dots'],
      motionIntent: 'Terminal scales in with spring physics, code lines slide in with stagger',
      focusWords: ['webcodecs', 'hardware', 'deterministic'],
      motionPreset: 'slide_split',
      camera: 'push_in',
      icon: 'zap',
      durationInSeconds: 3.6,
      wordTimestamps: [
        { word: 'WebCodecs', start: 0.0, end: 0.6 },
        { word: 'Hardware', start: 0.6, end: 1.2 },
        { word: 'acceleration', start: 1.2, end: 1.9 },
        { word: 'with', start: 1.9, end: 2.2 },
        { word: 'deterministic', start: 2.2, end: 2.9 },
        { word: 'canvas', start: 2.9, end: 3.3 },
        { word: 'math', start: 3.3, end: 3.6 }
      ]
    },
    {
      id: 'sc-3',
      narrationText: 'Instant 1080p MP4 exports with zero memory leaks',
      text: 'Instant 1080p MP4 exports with zero memory leaks',
      visualIntent: 'Highlight the massive 60 FPS performance benchmark in glassmorphism HUD card',
      visualConcept: 'Translucent glass card floating in a radial glow with giant counter',
      visualElements: ['stat-card', 'fps-counter', 'assurance-badge'],
      motionIntent: 'Glass card zooms into focus with back.out spring, metric scales dramatically',
      focusWords: ['1080p', 'mp4', 'instant'],
      motionPreset: 'kinetic_shake',
      camera: 'pull_out',
      icon: 'sparkles',
      durationInSeconds: 3.2,
      wordTimestamps: [
        { word: 'Instant', start: 0.0, end: 0.5 },
        { word: '1080p', start: 0.5, end: 1.1 },
        { word: 'MP4', start: 1.1, end: 1.6 },
        { word: 'exports', start: 1.6, end: 2.1 },
        { word: 'with', start: 2.1, end: 2.4 },
        { word: 'zero', start: 2.4, end: 2.7 },
        { word: 'memory', start: 2.7, end: 3.0 },
        { word: 'leaks', start: 3.0, end: 3.2 }
      ]
    }
  ],
  audioDuration: 10.0,
  bgm: {
    preset: 'none',
    level: 0.18,
    duckRatio: 0.15
  },
  themeTokens: BUILTIN_THEMES[0]
};

DEMO_PROJECT.scenes = DEMO_PROJECT.scenes.map((s) => migrateLegacyScene(s as any));

/**
 * The shipped demo above keeps the GSAP-style code that past builds stored, so the legacy demo
 * detection and the needs-repair scan see real old data. This is the same demo in the MooScript API.
 */
const DEMO_SCENE_JS: Record<string, string> = {
  'sc-1': `shot.arrive(root.querySelector(".sc1-badge"), { y: -30, opacity: 0, dur: 0.6, curve: "overshoot-out(1.7)" })
  .arrive(root.querySelectorAll(".sc1-word"), { y: 60, opacity: 0, scale: 0.9, cascade: 0.18, dur: 0.7, curve: "strong-out" }, "end-0.3")
  .arrive(root.querySelector(".sc1-sub"), { opacity: 0, y: 20, dur: 0.6 }, "end-0.2");`,
  'sc-2': `shot.arrive(root.querySelector(".sc2-terminal"), { scale: 0.85, opacity: 0, y: 50, dur: 0.8, curve: "strong-out" })
  .arrive(root.querySelectorAll(".sc2-line"), { opacity: 0, x: -20, cascade: 0.15, dur: 0.5, curve: "smooth-out" }, "end-0.3");`,
  'sc-3': `shot.arrive(root.querySelector(".sc3-card"), { scale: 0.7, opacity: 0, dur: 0.8, curve: "overshoot-out(1.8)" })
  .arrive(root.querySelector(".sc3-metric-val"), { scale: 1.3, opacity: 0, dur: 0.6, curve: "strong-out" }, "end-0.4")
  .arrive(root.querySelector(".sc3-metric-lbl"), { y: 20, opacity: 0, dur: 0.5 }, "end-0.2");`
};

export const DEMO_PROJECT_MOOTWEEN: MooProject = {
  ...DEMO_PROJECT,
  composition: {
    ...DEMO_COMPOSITION,
    scenes: DEMO_COMPOSITION.scenes.map((m) => ({ ...m, buildJs: DEMO_SCENE_JS[m.id] ?? m.buildJs }))
  }
};
