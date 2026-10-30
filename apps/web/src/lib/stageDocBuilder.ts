import type { MooShowcasePreset } from '@mooscript/presets';
import { installMooTween } from '../../../studio/src/engine/composition/runtime/mooTween';
import { getRuntimeScript } from '../../../studio/src/engine/composition/runtime/mooRuntime';
import { scopeCss } from '../../../studio/src/engine/composition/scopeCss';

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function jsString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\x3c')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `'${escaped}'`;
}

export interface StageDocOptions {
  clearBackgrounds?: boolean;
}

/**
 * Builds a self-contained sandboxed stage HTML document for a MooShowcasePreset
 * powered by MooScript's pure MooTween + MographKit runtime (zero GSAP).
 * Host controls playback deterministically via postMessage({ type: 'seek', time }).
 */
export function buildPresetStageDoc(preset: MooShowcasePreset, options?: StageDocOptions): string {
  const width = preset.width || 1080;
  const height = preset.height || 1920;
  const clearBg = Boolean(options?.clearBackgrounds);
  const firstPalette = preset.shots[0]?.palette || {
    bg: '#09090b',
    primary: '#f4f4f5',
    accent: '#84cc16',
    text: '#f4f4f5'
  };

  const scenesCss = preset.shots
    .map((shot, idx) => {
      const domId = `scene-${shot.id}`;
      const scoped = scopeCss(shot.css || '', `#${domId}`);
      const vars = `#${domId}{--moo-bg:${shot.palette.bg};--moo-primary:${shot.palette.primary};--moo-accent:${shot.palette.accent};--moo-text:${shot.palette.text};}`;
      return `/* Shot ${idx + 1} */\n${scoped}\n${vars}`;
    })
    .join('\n\n');

  const scenesJs = preset.shots
    .map(
      (shot) => `
MOO.scene(${jsString(shot.id)}, {
  html: ${safeJson(shot.html)},
  buildSrc: ${safeJson(shot.buildJs)},
  transition: "flow",
  transitionDuration: null,
  transitionCurve: null,
  clearBg: ${safeJson(clearBg)},
  inPoint: 0,
  sourceDuration: null,
  seed: null
});`
    )
    .join('\n');

  const meta = {
    scenes: preset.shots.map((shot) => ({
      id: shot.id,
      duration: shot.durationInSeconds,
      transition: 'flow',
      wordTimestamps: shot.wordTimestamps
    }))
  };

  const runtimeScript = getRuntimeScript();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: ${clearBg ? 'transparent' : firstPalette.bg};
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; /* taste-skill-ignore */
      color: #f4f4f5;
      -webkit-font-smoothing: antialiased;
    }
    :root {
      --moo-bg: ${firstPalette.bg};
      --moo-primary: ${firstPalette.primary};
      --moo-accent: ${firstPalette.accent};
      --moo-text: ${firstPalette.text};
      --moo-font-display: 'Syne', 'Plus Jakarta Sans', system-ui, sans-serif; /* taste-skill-ignore */
      --moo-font-body: 'Plus Jakarta Sans', system-ui, sans-serif; /* taste-skill-ignore */
    }
    #moo-viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      background: ${clearBg ? 'transparent' : 'var(--moo-bg)'};
      overflow: hidden;
      transform-origin: center center;
      flex-shrink: 0;
    }
    #moo-stage {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    ${clearBg ? '.moo-scene-wrapper { background: transparent !important; } .moo-scene-wrapper > :first-child { background: transparent !important; }' : ''}
    ${scenesCss}
  </style>
  <script>
    (${installMooTween.toString()})(window);
  </script>
</head>
<body>
  <div id="moo-viewport">
    <div id="moo-stage"></div>
  </div>
  <script>
    ${runtimeScript}
  </script>
  <script>
    ${scenesJs}
    (function() {
      var meta = ${safeJson(meta)};
      var vp = document.getElementById('moo-viewport');
      var baseW = ${width};
      var baseH = ${height};
      function fit() {
        if (!vp) return;
        var w = document.documentElement.clientWidth || window.innerWidth || baseW;
        var h = document.documentElement.clientHeight || window.innerHeight || baseH;
        var s = Math.min(w / baseW, h / baseH);
        if (!isFinite(s) || s <= 0) s = 1;
        vp.style.transform = 'scale(' + s + ')';
      }
      window.addEventListener('resize', fit);
      fit();

      function boot() {
        fit();
        if (typeof window.__MOO_INIT__ === 'function') {
          window.__MOO_INIT__(meta);
        }
        if (typeof window.__MOO_SEEK__ === 'function') {
          window.__MOO_SEEK__(0.35);
        }
      }
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(boot, 12);
      } else {
        window.addEventListener('load', boot);
      }
    })();
  </script>
</body>
</html>`;
}
