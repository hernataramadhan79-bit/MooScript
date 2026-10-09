import type { Composition, GeneratedScene, MooProject, ScenePalette } from '../../types';
import { getRuntimeScript } from './runtime/mooRuntime';
import { compileOverridesCss, compilePaletteVars } from './layers';
import gsapScript from 'gsap/dist/gsap.min.js?raw';
// Local WOFF2 subsets inlined as data-URIs so SVG foreignObject export frames
// render with correct typography even when Google Fonts is unreachable
// (foreignObject isolates external <link> fonts; data: URIs always resolve).
import jakarta400 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2?inline';
import jakarta700 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2?inline';
import jakarta800 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2?inline';
import mono400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?inline';
import mono700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?inline';

const EMBEDDED_FONT_CSS = `
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:400;font-display:swap;src:url('${jakarta400}') format('woff2');}
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:700;font-display:swap;src:url('${jakarta700}') format('woff2');}
@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:800;font-display:swap;src:url('${jakarta800}') format('woff2');}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400;font-display:swap;src:url('${mono400}') format('woff2');}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:700;font-display:swap;src:url('${mono700}') format('woff2');}
/* Offline fallbacks for display typefaces so foreignObject and offline PWA never render system serif */
@font-face{font-family:'Syne';font-style:normal;font-weight:700 800;font-display:swap;src:url('${jakarta800}') format('woff2');}
@font-face{font-family:'Bricolage Grotesque';font-style:normal;font-weight:700 800;font-display:swap;src:url('${jakarta800}') format('woff2');}
`;

export interface BuildDocumentOptions {
  standalone?: boolean;
  audioDataUrl?: string;
}

const FONT_BY_THEME: Record<string, string> = {
  Jakarta: "'Plus Jakarta Sans', system-ui, sans-serif",
  Mono: "'JetBrains Mono', ui-monospace, monospace",
  Impact: "'Syne', 'Plus Jakarta Sans', system-ui, sans-serif"
};

/** Palette exposed to generated scenes as --moo-* CSS variables. */
export function getProjectPalette(project: Pick<MooProject, 'theme'>): ScenePalette {
  const theme = project.theme;
  return {
    bg: theme?.bg || '#09090b',
    primary: theme?.textPrimary || '#f4f4f5',
    accent: theme?.textHighlight || '#84cc16',
    text: theme?.textPrimary || '#f4f4f5'
  };
}

/** JSON that is safe to embed inside an inline <script> element. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function toDomId(sceneId: string): string {
  return `scene-${sceneId}`;
}

/** Neutral status surface for scenes that have not been generated (or failed). This is NOT a visual template. */
function statusPlaceholder(scene: GeneratedScene, text?: string): { html: string; css: string; buildJs: string } {
  const label =
    scene.status === 'generating'
      ? 'Generating motion graphics…'
      : scene.status === 'error'
        ? 'Scene generation failed'
        : 'Not generated yet';
  const detail =
    scene.status === 'error' && scene.errors?.length
      ? scene.errors[0]
      : text && text.trim()
        ? text.trim()
        : 'Run Generate Mograph or Regenerate Scene';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    html: `<div class="moo-status-card" data-moo-placeholder="${scene.status}"><div class="moo-status-title">${esc(label)}</div><div class="moo-status-detail">${esc(detail.slice(0, 160))}</div></div>`,
    css: `.moo-status-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:64px;text-align:center;background:var(--moo-bg,#09090b);color:var(--moo-text,#f4f4f5);font-family:var(--moo-font-body,sans-serif)}.moo-status-title{font-size:44px;font-weight:700;opacity:.9}.moo-status-detail{font-size:26px;opacity:.85;max-width:85%;line-height:1.4}`,
    buildJs: 'tl.from(".moo-status-card", { opacity: 0.9, duration: 0.1 });'
  };
}

export function buildCompositionDocument(project: MooProject, options?: BuildDocumentOptions): string {
  const comp: Composition = project.composition || {
    id: `comp-${project.id}`,
    width: project.width || 1080,
    height: project.height || 1920,
    fps: project.fps || 30,
    duration: 0,
    globalCss: '',
    scenes: [],
    createdAt: Date.now()
  };

  const width = comp.width || 1080;
  const height = comp.height || 1920;
  const aspectRatio = `${width} / ${height}`;
  const timelineScenes = project.scenes || [];

  // Order generated scenes according to the timeline, then append leftovers.
  const orderedModules: GeneratedScene[] = [];
  const used = new Set<string>();
  for (const projScene of timelineScenes) {
    const mod = comp.scenes.find((m) => m.beatId === projScene.id);
    if (mod) {
      orderedModules.push(mod);
      used.add(mod.beatId);
    }
  }
  for (const mod of comp.scenes) {
    if (!used.has(mod.beatId)) orderedModules.push(mod);
  }

  const durationOf = (mod: GeneratedScene): number => {
    const ts = timelineScenes.find((s) => s.id === mod.beatId);
    return ts?.durationInSeconds || mod.duration || 3;
  };

  const resolved = orderedModules.map((mod) => {
    const ts = timelineScenes.find((s) => s.id === mod.beatId);
    const sceneText = ts?.narrationText || ts?.text || '';
    const needsPlaceholder = mod.status !== 'ok' || !(mod.html || '').trim();
    const src = needsPlaceholder ? statusPlaceholder(mod, sceneText) : { html: mod.html, css: mod.css, buildJs: mod.buildJs };
    return { mod, ...src };
  });

  const palette = getProjectPalette(project);
  const fontDisplay = FONT_BY_THEME[project.theme?.fontFamily || 'Jakarta'] || FONT_BY_THEME.Jakarta;

  // Assemble scene CSS (+ per-scene palette variables and non-destructive layer overrides)
  const scenesCss = resolved
    .map(({ mod, css }, idx) => {
      const domId = toDomId(mod.beatId);
      const paletteVars = compilePaletteVars(mod.palette);
      const paletteRule = paletteVars ? `#${domId} { ${paletteVars}; }` : '';
      const overrides = compileOverridesCss(domId, mod.overrides);
      return `/* Scene ${idx + 1} (${mod.beatId}) */\n${css || ''}\n${paletteRule}\n${overrides}`;
    })
    .join('\n\n');

  // Scene modules are registered as DATA (JSON strings). The runtime compiles each buildJs inside
  // its own try/catch so a syntax error in one scene can never take down the whole composition.
  const scenesJs = resolved
    .map(({ mod, html, buildJs }, idx) => {
      return `
// Register Scene ${idx + 1}
MOO.scene('${mod.beatId.replace(/['\\]/g, '\\$&')}', {
  html: ${safeJson(html || '')},
  buildSrc: ${safeJson(buildJs || '')}
});
`;
    })
    .join('\n');

  const runtimeScript = getRuntimeScript();

  const totalDuration = resolved.reduce((sum, r) => sum + durationOf(r.mod), 0) || 1;

  const standaloneController = options?.standalone
    ? `
  <!-- Standalone Player Controller -->
  <div id="moo-standalone-controller" style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:12px;background:rgba(24,24,27,0.9);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.15);padding:10px 18px;border-radius:9999px;z-index:99999;font-family:'Plus Jakarta Sans',sans-serif;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
    <button id="moo-play-btn" style="background:#84cc16;color:#000;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px;outline:none;">▶</button>
    <input id="moo-time-slider" type="range" min="0" max="${totalDuration}" step="0.01" value="0" style="width:200px;cursor:pointer;accent-color:#84cc16;" />
    <span id="moo-time-display" style="font-size:12px;font-family:monospace;min-width:70px;color:#d4d4d8;">0.0s / ${totalDuration.toFixed(1)}s</span>
    ${options.audioDataUrl ? `<audio id="moo-standalone-audio" src="${options.audioDataUrl}" preload="auto"></audio>` : ''}
  </div>
  <script>
    (function() {
      if (window.parent !== window) return;
      var ctrl = document.getElementById('moo-standalone-controller');
      if (ctrl) ctrl.style.display = 'flex';

      var playBtn = document.getElementById('moo-play-btn');
      var slider = document.getElementById('moo-time-slider');
      var display = document.getElementById('moo-time-display');
      var audio = document.getElementById('moo-standalone-audio');

      var isPlaying = false;
      var currentTime = 0;
      var totalDur = ${totalDuration};
      var lastTimestamp = null;
      var rafId = null;

      function updateDisplay(t) {
        if (display) display.textContent = t.toFixed(1) + 's / ' + totalDur.toFixed(1) + 's';
        if (slider) slider.value = t;
      }

      function seek(t) {
        currentTime = Math.max(0, Math.min(t, totalDur));
        if (typeof window.__MOO_SEEK__ === 'function') {
          window.__MOO_SEEK__(currentTime);
        }
        if (audio) {
          audio.currentTime = currentTime;
        }
        updateDisplay(currentTime);
      }

      function loop(timestamp) {
        if (!isPlaying) return;
        if (lastTimestamp === null) lastTimestamp = timestamp;
        var dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        currentTime += dt;
        if (currentTime >= totalDur) {
          currentTime = 0;
          if (audio) audio.currentTime = 0;
        }

        if (typeof window.__MOO_SEEK__ === 'function') {
          window.__MOO_SEEK__(currentTime);
        }
        updateDisplay(currentTime);

        rafId = requestAnimationFrame(loop);
      }

      function play() {
        isPlaying = true;
        if (playBtn) playBtn.textContent = '❚❚';
        lastTimestamp = null;
        if (audio) audio.play().catch(function() {});
        rafId = requestAnimationFrame(loop);
      }

      function pause() {
        isPlaying = false;
        if (playBtn) playBtn.textContent = '▶';
        if (audio) audio.pause();
        if (rafId) cancelAnimationFrame(rafId);
      }

      if (playBtn) {
        playBtn.addEventListener('click', function() {
          if (isPlaying) pause(); else play();
        });
      }

      if (slider) {
        slider.addEventListener('input', function(e) {
          pause();
          seek(parseFloat(e.target.value));
        });
      }
    })();
  </script>`
    : '';

  const standaloneScaleScript = options?.standalone
    ? `
  <!-- Standalone Responsive Auto-Scale: fit 1080x1920 internal coords to any viewport -->
  <script>
    (function() {
      if (window.parent !== window) return;
      var vp = document.getElementById('moo-viewport');
      if (!vp) return;
      var baseW = ${width};
      var baseH = ${height};
      function fit() {
        var availW = window.innerWidth || baseW;
        var availH = window.innerHeight || baseH;
        var controller = document.getElementById('moo-standalone-controller');
        var reservedH = controller ? 90 : 0;
        var s = Math.min(availW / baseW, (availH - reservedH) / baseH);
        if (!isFinite(s) || s <= 0) s = 1;
        vp.style.transform = 'scale(' + s + ')';
        vp.style.flexShrink = '0';
      }
      window.addEventListener('resize', fit);
      window.addEventListener('orientationchange', fit);
      fit();
    })();
  </script>`
    : '';

  const meta = {
    scenes: resolved.map(({ mod }) => {
      const ts = timelineScenes.find((s) => s.id === mod.beatId);
      return {
        id: mod.beatId,
        duration: durationOf(mod),
        wordTimestamps: ts?.wordTimestamps || []
      };
    })
  };

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'unsafe-inline' 'unsafe-eval'; img-src data: blob:; media-src data: blob:; connect-src 'none';">
  <title>MooScript Stage</title>
  <!-- Google Fonts for Typography (non-blocking fallback; local WOFF2 above is the primary source) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Syne:wght@700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <!-- GSAP Inlined Core -->
  <script>
    ${gsapScript}
    if (window.gsap && typeof window.gsap.config === 'function') {
      window.gsap.config({ nullTargetWarn: false });
    }
  </script>
  <style>
    /* Self-contained WOFF2 fonts (local @fontsource, data-URI) — primary type source */
    ${EMBEDDED_FONT_CSS}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: #000000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }

    :root {
      --moo-bg: ${palette.bg};
      --moo-primary: ${palette.primary};
      --moo-accent: ${palette.accent};
      --moo-text: ${palette.text};
      --moo-font-display: ${fontDisplay};
      --moo-font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
    }

    #moo-viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      aspect-ratio: ${aspectRatio};
      background: var(--moo-bg);
      overflow: hidden;
      transform-origin: center center;
    }

    #moo-stage {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    /* Global styles */
    ${comp.globalCss || ''}

    /* Scenes scoped styles */
    ${scenesCss}
  </style>
</head>
<body>
  <div id="moo-viewport">
    <div id="moo-stage"></div>
  </div>

  <!-- Runtime Injected Controller -->
  <script>
    ${runtimeScript}
  </script>

  <!-- Scenes Injected Definitions -->
  <script>
    ${scenesJs}

    // Auto initialize master timeline
    (function() {
      const meta = ${safeJson(meta)};

      function triggerInit() {
        if (typeof window.__MOO_INIT__ === 'function') {
          window.__MOO_INIT__(meta);
        } else {
          window.postMessage({ type: 'init', meta: meta }, '*');
        }
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(triggerInit, 10);
      } else {
        window.addEventListener('load', triggerInit);
      }
    })();
  </script>${standaloneController}${standaloneScaleScript}
</body>
</html>`;
}
