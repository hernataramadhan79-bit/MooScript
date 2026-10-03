/**
 * MooRuntime client-side script injected into the isolated iframe sandbox.
 * Enforces determinism, wraps GSAP timeline, and provides postMessage communication with host.
 */
export function getRuntimeScript(): string {
  return `
(function() {
  window.__MOO_SCENES__ = [];
  window.__MOO_READY__ = false;

  // 1. Seeded PRNG for deterministic rendering
  function createPrng(seed = 42) {
    let s = seed;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  const globalPrng = createPrng(1337);
  Math.random = globalPrng;

  // 2. Frozen time tracking for deterministic timeline
  let virtualTimeSeconds = 0;
  Date.now = function() { return Math.round(virtualTimeSeconds * 1000); };
  if (window.performance) {
    window.performance.now = function() { return virtualTimeSeconds * 1000; };
  }

  // 3. MOO global API for scene modules
  window.MOO = {
    scene: function(id, definition) {
      window.__MOO_SCENES__.push({ id: id, definition: definition });
    }
  };

  // 4. Master Timeline Controller
  let masterTl = null;
  let stageElem = null;

  async function initMasterTimeline(compositionMeta) {
    if (!window.gsap) {
      console.error('GSAP is not loaded inside iframe runtime');
      return;
    }

    // Disable real-time auto-ticker: playback is purely driven by host seek()
    window.gsap.ticker.lagSmoothing(0);
    masterTl = window.gsap.timeline({ paused: true });

    stageElem = document.getElementById('moo-stage');
    if (!stageElem) {
      console.error('#moo-stage container missing');
      return;
    }

    const scenes = window.__MOO_SCENES__;
    let accumulatedTime = 0;

    for (let i = 0; i < scenes.length; i++) {
      const sceneItem = scenes[i];
      const def = sceneItem.definition;
      const meta = (compositionMeta?.scenes || []).find(function(m) { return m.id === sceneItem.id; }) || {};
      const duration = meta.duration || 3.0;

      // Create container for scene
      const sceneWrapper = document.createElement('div');
      sceneWrapper.className = 'moo-scene-wrapper';
      sceneWrapper.id = 'scene-' + sceneItem.id;
      sceneWrapper.style.position = 'absolute';
      sceneWrapper.style.inset = '0';
      sceneWrapper.style.width = '100%';
      sceneWrapper.style.height = '100%';
      sceneWrapper.style.opacity = '0';
      sceneWrapper.style.visibility = 'hidden';
      sceneWrapper.style.pointerEvents = 'none';
      sceneWrapper.style.overflow = 'hidden';
      sceneWrapper.innerHTML = def.html || '';

      stageElem.appendChild(sceneWrapper);

      // Context passed to build(tl, root, ctx)
      const scenePrng = createPrng(i + 1);
      const ctx = {
        dur: duration,
        words: meta.wordTimestamps || [],
        at: function(word) {
          if (!meta.wordTimestamps) return 0;
          const clean = String(word).toLowerCase().trim();
          const match = meta.wordTimestamps.find(w => String(w.word).toLowerCase().includes(clean));
          return match ? Math.max(0, match.start - accumulatedTime) : 0;
        },
        rand: scenePrng,
        index: i
      };

      // Create scene child timeline
      const sceneTl = window.gsap.timeline();
      try {
        if (typeof def.build === 'function') {
          def.build(sceneTl, sceneWrapper, ctx);
        }
      } catch (err) {
        console.error('Error in scene build(): ' + sceneItem.id, err);
      }

      // Deterministic bidirectional visibility in master timeline
      masterTl.set(sceneWrapper, { opacity: 1, visibility: 'visible' }, accumulatedTime);
      if (i < scenes.length - 1) {
        masterTl.set(sceneWrapper, { opacity: 0, visibility: 'hidden' }, accumulatedTime + duration);
      }

      masterTl.add(sceneTl, accumulatedTime);
      accumulatedTime += duration;
    }

    // Wait for fonts & images (with 2500ms timeout fallback)
    if (document.fonts) {
      try {
        await Promise.race([document.fonts.ready, new Promise(function(r) { setTimeout(r, 2500); })]);
      } catch(e) {}
    }

    // Initial render at frame 0
    if (masterTl) {
      masterTl.seek(0, false);
    }

    window.__MOO_READY__ = true;
    window.parent.postMessage({
      type: 'ready',
      duration: accumulatedTime,
      totalScenes: scenes.length
    }, '*');
  }

  window.__MOO_INIT__ = initMasterTimeline;

  // 5. Host Communication Protocol
  window.addEventListener('message', async function(ev) {
    const data = ev.data;
    if (!data || !data.type) return;

    if (data.type === 'init') {
      await initMasterTimeline(data.meta);
    } else if (data.type === 'seek') {
      const t = Number(data.time) || 0;
      virtualTimeSeconds = t;
      if (masterTl) {
        masterTl.seek(t, false);
      }
      window.parent.postMessage({ type: 'seeked', id: data.id, time: t }, '*');
    } else if (data.type === 'capture') {
      const t = Number(data.time) || 0;
      virtualTimeSeconds = t;
      if (masterTl) {
        masterTl.seek(t, false);
      }

      // ForeignObject serialization for zero-server frame rasterization
      try {
        const width = data.width || 1080;
        const height = data.height || 1920;
        const styles = Array.from(document.querySelectorAll('style'))
          .map(function(s) { return s.textContent || ''; })
          .join(String.fromCharCode(10));

        const stageContainer = document.getElementById('moo-stage') || document.getElementById('moo-viewport') || document.body;
        const clone = stageContainer ? stageContainer.cloneNode(true) : document.createElement('div');

        const serialized = new XMLSerializer().serializeToString(clone);
        const wrapperXmlns = serialized.indexOf('xmlns="http://www.w3.org/1999/xhtml"') !== -1 ? '' : ' xmlns="http://www.w3.org/1999/xhtml"';

        const svgString = 
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
          '<style><![CDATA[' + styles + ']]></style>' +
          '<foreignObject width="100%" height="100%">' +
          '<div' + wrapperXmlns + ' style="width:100%;height:100%;position:relative;background:#09090b;color:#f4f4f6;overflow:hidden;">' +
          serialized +
          '</div>' +
          '</foreignObject>' +
          '</svg>';

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          const dataUrl = canvas.toDataURL('image/png');
          window.parent.postMessage({ type: 'frame', id: data.id, dataUrl: dataUrl }, '*');
        };
        img.onerror = function(err) {
          URL.revokeObjectURL(url);
          window.parent.postMessage({ type: 'frame_error', id: data.id, message: String(err) }, '*');
        };
        img.src = url;
      } catch (err) {
        window.parent.postMessage({ type: 'frame_error', id: data.id, message: String(err) }, '*');
      }
    }
  });
})();
`;
}

/**
 * Serializes a DOM node and CSS into an SVG string compatible with foreignObject rendering.
 */
export function serializeSvgFrame(
  clone: Element,
  width: number,
  height: number,
  styles: string
): string {
  const serialized = new XMLSerializer().serializeToString(clone);
  const wrapperXmlns = serialized.includes('xmlns="http://www.w3.org/1999/xhtml"')
    ? ''
    : ' xmlns="http://www.w3.org/1999/xhtml"';

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '">' +
    '<style><![CDATA[' +
    styles +
    ']]></style>' +
    '<foreignObject width="100%" height="100%">' +
    '<div' +
    wrapperXmlns +
    ' style="width:100%;height:100%;position:relative;background:#09090b;color:#f4f4f6;overflow:hidden;">' +
    serialized +
    '</div>' +
    '</foreignObject>' +
    '</svg>'
  );
}
