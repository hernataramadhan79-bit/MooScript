import type { Composition, MooProject, SceneModule } from '../../types';
import { getRuntimeScript } from './runtime/mooRuntime';
import gsapScript from 'gsap/dist/gsap.min.js?raw';

export function buildCompositionDocument(project: MooProject): string {
  const comp: Composition = project.composition || {
    id: `comp-${project.id}`,
    width: project.width || 1080,
    height: project.height || 1920,
    fps: project.fps || 30,
    globalCss: '',
    scenes: [],
    createdAt: Date.now()
  };

  const width = comp.width || 1080;
  const height = comp.height || 1920;
  const aspectRatio = `${width} / ${height}`;

  // Order modules according to project.scenes, then append leftover comp.scenes
  const orderedModules: SceneModule[] = [];
  const usedBeatIds = new Set<string>();

  for (const projScene of project.scenes || []) {
    const mod = comp.scenes.find((m) => m.beatId === projScene.id);
    if (mod) {
      orderedModules.push(mod);
      usedBeatIds.add(mod.beatId);
    }
  }

  for (const mod of comp.scenes) {
    if (!usedBeatIds.has(mod.beatId)) {
      orderedModules.push(mod);
    }
  }

  // Assemble scene CSS
  const scenesCss = orderedModules.map((s, idx) => `/* Scene ${idx + 1} (${s.beatId}) */\n${s.css || ''}`).join('\n\n');

  // Assemble scene JS module definitions
  const scenesJs = orderedModules
    .map((s, idx) => {
      return `
// Register Scene ${idx + 1}
MOO.scene('${s.beatId}', {
  html: ${JSON.stringify(s.html || '')},
  build: function(tl, root, ctx) {
    try {
      ${s.buildJs || ''}
    } catch (err) {
      console.error('Scene ${s.beatId} build runtime error:', err);
    }
  }
});
`;
    })
    .join('\n');

  const runtimeScript = getRuntimeScript();

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MooScript Stage</title>
  <!-- Google Fonts for Typography -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Syne:wght@700;800&display=swap" rel="stylesheet">
  <!-- GSAP Inlined Core -->
  <script>
    ${gsapScript}
  </script>
  <style>
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

    #moo-viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      aspect-ratio: ${aspectRatio};
      background: #09090b;
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

    /* Global user styles */
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
      const meta = {
        scenes: ${JSON.stringify(
          project.scenes.map((s) => ({
            id: s.id,
            duration: s.durationInSeconds || 3,
            wordTimestamps: s.wordTimestamps || []
          }))
        )}
      };

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
  </script>
</body>
</html>`;
}
