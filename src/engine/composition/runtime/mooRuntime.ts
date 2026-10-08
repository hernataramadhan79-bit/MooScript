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
    if (typeof window.gsap.config === 'function') {
      window.gsap.config({ nullTargetWarn: false });
    }
    masterTl = window.gsap.timeline({ paused: true });

    function isEmptyTarget(targets) {
      if (!targets) return true;
      if (typeof NodeList !== 'undefined' && targets instanceof NodeList && targets.length === 0) return true;
      if (typeof HTMLCollection !== 'undefined' && targets instanceof HTMLCollection && targets.length === 0) return true;
      if (Array.isArray(targets) && targets.length === 0) return true;
      return false;
    }

    function makeSafeTimeline(realTl) {
      if (typeof Proxy === 'undefined') return realTl;
      return new Proxy(realTl, {
        get: function(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function' && (prop === 'to' || prop === 'from' || prop === 'fromTo' || prop === 'set')) {
            return function() {
              const args = Array.prototype.slice.call(arguments);
              const targets = args[0];
              if (isEmptyTarget(targets)) {
                return receiver;
              }
              const res = val.apply(target, args);
              return res === target ? receiver : res;
            };
          }
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
    }

    function makeSafeGsap(realGsap) {
      if (typeof Proxy === 'undefined') return realGsap;
      return new Proxy(realGsap, {
        get: function(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function' && (prop === 'to' || prop === 'from' || prop === 'fromTo' || prop === 'set')) {
            return function() {
              const args = Array.prototype.slice.call(arguments);
              const targets = args[0];
              if (isEmptyTarget(targets)) {
                return target;
              }
              return val.apply(target, args);
            };
          }
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
    }

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
      sceneWrapper.style.opacity = i === 0 ? '1' : '0';
      sceneWrapper.style.visibility = i === 0 ? 'visible' : 'hidden';
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

      // Create scene child timeline with target safety
      const rawSceneTl = window.gsap.timeline();
      const safeSceneTl = makeSafeTimeline(rawSceneTl);
      const safeGsap = makeSafeGsap(window.gsap);
      try {
        if (typeof def.build === 'function') {
          def.build(safeSceneTl, sceneWrapper, ctx);
        } else if (typeof def.buildSrc === 'string' && def.buildSrc.trim()) {
          const fn = new Function('tl', 'root', 'ctx', 'gsap', def.buildSrc);
          fn(safeSceneTl, sceneWrapper, ctx, safeGsap);
        }
      } catch (err) {
        console.error('Error in scene build(): ' + sceneItem.id, err);
      }

      // Deterministic bidirectional visibility in master timeline
      masterTl.set(sceneWrapper, { opacity: 1, visibility: 'visible' }, accumulatedTime);
      if (i < scenes.length - 1) {
        masterTl.set(sceneWrapper, { opacity: 0, visibility: 'hidden' }, accumulatedTime + duration);
      }

      masterTl.add(rawSceneTl, accumulatedTime);
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

  function seekTo(t) {
    t = Number(t) || 0;
    virtualTimeSeconds = t;
    if (masterTl) {
      masterTl.seek(t, false);
    }
    // Explicitly enforce scene wrapper visibility so boundary/zero-duration issues never hide active scenes
    var allScenes = window.__MOO_SCENES__ || [];
    var curAccTime = 0;
    for (var idx = 0; idx < allScenes.length; idx++) {
      var sItem = allScenes[idx];
      var sWrap = document.getElementById('scene-' + sItem.id);
      var sDur = 3.0;
      if (masterTl && masterTl.getChildren) {
        // use default duration if meta is not locally cached
      }
      var isVisible = (t >= curAccTime && (t < curAccTime + sDur || idx === allScenes.length - 1));
      if (sWrap) {
        sWrap.style.opacity = isVisible ? '1' : '0';
        sWrap.style.visibility = isVisible ? 'visible' : 'hidden';
      }
      curAccTime += sDur;
    }
  }

  window.__MOO_INIT__ = initMasterTimeline;
  window.__MOO_SEEK__ = seekTo;

  // 5. Host Communication Protocol
  window.addEventListener('message', async function(ev) {
    const data = ev.data;
    if (!data || !data.type) return;

    if (data.type === 'init') {
      await initMasterTimeline(data.meta);
    } else if (data.type === 'seek') {
      const t = Number(data.time) || 0;
      seekTo(t);
      window.parent.postMessage({ type: 'seeked', id: data.id, time: t }, '*');
    } else if (data.type === 'capture') {
      const t = Number(data.time) || 0;
      seekTo(t);

      // ForeignObject serialization for zero-server frame rasterization
      try {
        const width = data.width || 1080;
        const height = data.height || 1920;
        const rawStyles = Array.from(document.querySelectorAll('style'))
          .map(function(s) { return s.textContent || ''; })
          .join(String.fromCharCode(10));

        var styles = rawStyles.split('url(').join('none(');
        if (styles.indexOf('@import') !== -1) {
          styles = styles.split('@import').map(function(part, i) {
            if (i === 0) return part;
            var semi = part.indexOf(';');
            return semi !== -1 ? part.slice(semi + 1) : '';
          }).join('');
        }

        const stageContainer = document.getElementById('moo-stage') || document.getElementById('moo-viewport') || document.body;
        const clone = stageContainer ? stageContainer.cloneNode(true) : document.createElement('div');

        if (clone.querySelectorAll) {
          const extImgs = clone.querySelectorAll('img, image');
          for (let i = 0; i < extImgs.length; i++) {
            const el = extImgs[i];
            const src = el.getAttribute('src') || el.getAttribute('href') || '';
            if (src.indexOf('http://') === 0 || src.indexOf('https://') === 0 || src.indexOf('//') === 0) {
              if (el.tagName && el.tagName.toLowerCase() === 'img') {
                el.setAttribute('src', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
              } else {
                el.removeAttribute('href');
              }
            }
          }
        }

        const serialized = new XMLSerializer().serializeToString(clone);
        const wrapperXmlns = serialized.indexOf('xmlns="http://www.w3.org/1999/xhtml"') !== -1 ? '' : ' xmlns="http://www.w3.org/1999/xhtml"';

        const rootComputed = window.getComputedStyle ? window.getComputedStyle(document.documentElement) : null;
        const mooBg = rootComputed?.getPropertyValue('--moo-bg')?.trim() || '#09090b';
        const mooAccent = rootComputed?.getPropertyValue('--moo-accent')?.trim() || '#84cc16';
        const mooText = rootComputed?.getPropertyValue('--moo-text')?.trim() || '#f4f4f5';
        const mooPrimary = rootComputed?.getPropertyValue('--moo-primary')?.trim() || '#ffffff';

        const svgString = 
          '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
          '<style><![CDATA[' + styles + ']]></style>' +
          '<foreignObject width="100%" height="100%">' +
          '<div' + wrapperXmlns + ' style="width:100%;height:100%;position:relative;background:' + mooBg + ';color:' + mooText + ';--moo-bg:' + mooBg + ';--moo-accent:' + mooAccent + ';--moo-text:' + mooText + ';--moo-primary:' + mooPrimary + ';overflow:hidden;">' +
          serialized +
          '</div>' +
          '</foreignObject>' +
          '</svg>';

        // Directly use Data URI to avoid Chromium tainted canvas on Blob URLs
        const img = new Image();
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Canvas 2D context is unavailable');
            }
            // Clear with solid background first so output is never transparent zeros
            ctx.fillStyle = mooBg;
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            window.parent.postMessage({ type: 'frame', id: data.id, dataUrl: dataUrl }, '*');
          } catch (err) {
            window.parent.postMessage({ type: 'frame_error', id: data.id, message: String(err) }, '*');
          }
        };
        img.onerror = function(err) {
          window.parent.postMessage({ type: 'frame_error', id: data.id, message: 'SVG image error: ' + String(err) }, '*');
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
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

  const cleanStyles = styles
    .replace(/@import[^;\n]+;?/gi, '')
    .replace(/url\([^)]*\)/gi, 'none');

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '">' +
    '<style><![CDATA[' +
    cleanStyles +
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
