import { installMographKit } from './mographKit';

/**
 * Shared canvas instance and context for canvas pooling in export rendering.
 */
export let sharedExportCanvas: HTMLCanvasElement | null = null;
export let sharedExportCtx: CanvasRenderingContext2D | null = null;

export function resetSharedCanvas(): void {
  if (sharedExportCanvas) {
    sharedExportCanvas.width = 0;
    sharedExportCanvas.height = 0;
    sharedExportCanvas = null;
    sharedExportCtx = null;
  }
}

/**
 * MooRuntime client-side script injected into the isolated iframe sandbox.
 * Enforces determinism, wraps GSAP timeline, and provides postMessage communication with host.
 */
export function getRuntimeScript(): string {
  return `
(function() {
  window.__MOO_SCENES__ = [];
  const installMographKit = ${installMographKit.toString()};
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
      window.__MOO_SCENES__.push({
        id: id,
        definition: definition,
        transition: (definition && definition.transition) || 'flow'
      });
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

    // Cache real per-scene durations so seekTo() never falls back to a hardcoded 3s.
    window.__MOO_SCENE_DURATIONS__ = scenes.map(function(sItem) {
      const mm = (compositionMeta?.scenes || []).find(function(m) { return m.id === sItem.id; }) || {};
      return mm.duration || 3.0;
    });

    // Phase 1: Create all scene wrapper DOM elements first
    const sceneElements = [];
    for (let i = 0; i < scenes.length; i++) {
      const sceneItem = scenes[i];
      const def = sceneItem.definition;
      const meta = (compositionMeta?.scenes || []).find(function(m) { return m.id === sceneItem.id; }) || {};
      const duration = meta.duration || 3.0;

      const sceneWrapper = document.createElement('div');
      sceneWrapper.className = 'moo-scene-wrapper';
      sceneWrapper.id = 'scene-' + sceneItem.id;
      sceneWrapper.style.position = 'absolute';
      sceneWrapper.style.inset = '0';
      sceneWrapper.style.width = '100%';
      sceneWrapper.style.height = '100%';
      sceneWrapper.style.pointerEvents = 'none';
      sceneWrapper.style.overflow = 'hidden';
      sceneWrapper.style.opacity = i === 0 ? '1' : '0';
      sceneWrapper.style.visibility = i === 0 ? 'visible' : 'hidden';
      sceneWrapper.innerHTML = def.html || '';

      stageElem.appendChild(sceneWrapper);
      sceneElements.push({
        wrapper: sceneWrapper,
        item: sceneItem,
        def: def,
        meta: meta,
        duration: duration
      });
    }

    // Phase 2: Set initial state at t=0 for all scene wrappers in master timeline
    for (let i = 0; i < sceneElements.length; i++) {
      masterTl.set(sceneElements[i].wrapper, {
        visibility: i === 0 ? 'visible' : 'hidden',
        opacity: i === 0 ? 1 : 0,
        zIndex: 1,
        x: '0%',
        scale: 1,
        clipPath: 'none'
      }, 0);
    }

    // Phase 3: Build individual scene timelines and inter-scene transitions
    for (let i = 0; i < sceneElements.length; i++) {
      const current = sceneElements[i];
      const sceneWrapper = current.wrapper;
      const def = current.def;
      const meta = current.meta;
      const duration = current.duration;
      const transitionType = current.item.transition || current.def.transition || meta.transition || 'flow';
      const next = sceneElements[i + 1];

      // Ensure current scene wrapper is unconditionally visible and reset at accumulatedTime
      masterTl.set(sceneWrapper, {
        visibility: 'visible',
        opacity: 1,
        zIndex: 1,
        x: '0%',
        scale: 1,
        clipPath: 'none'
      }, accumulatedTime);

      // Context passed to build(tl, root, ctx)
      const scenePrng = createPrng(i + 1);
      const ctx = {
        dur: duration,
        words: meta.wordTimestamps || [],
        at: function(word, occurrence) {
          if (!meta.wordTimestamps) return 0;
          // Exact word first, then prefix, then substring: 'ide' must not land on 'inside'.
          const norm = function(s) { return String(s).toLowerCase().replace(/[^\\p{L}\\p{N}%]/gu, ''); };
          const clean = norm(word);
          if (!clean) return 0;
          let matches = meta.wordTimestamps.filter(w => norm(w.word) === clean);
          if (matches.length === 0) matches = meta.wordTimestamps.filter(w => norm(w.word).startsWith(clean));
          if (matches.length === 0) matches = meta.wordTimestamps.filter(w => norm(w.word).includes(clean));
          const idx = typeof occurrence === 'number' && occurrence > 0 ? Math.min(occurrence, matches.length - 1) : 0;
          const match = matches[idx];
          return match ? Math.max(0, match.start) : 0;
        },
        rand: scenePrng,
        index: i
      };

      const rawSceneTl = window.gsap.timeline();
      const safeSceneTl = makeSafeTimeline(rawSceneTl);
      const safeGsap = makeSafeGsap(window.gsap);
      try {
        installMographKit(safeSceneTl, sceneWrapper, ctx);
      } catch (kitErr) {
        console.warn('Mograph kit unavailable for scene ' + current.item.id, kitErr);
      }
      try {
        if (typeof def.build === 'function') {
          def.build(safeSceneTl, sceneWrapper, ctx);
        } else if (typeof def.buildSrc === 'string' && def.buildSrc.trim()) {
          const fn = new Function('tl', 'root', 'ctx', 'gsap', def.buildSrc);
          fn(safeSceneTl, sceneWrapper, ctx, safeGsap);
        }
      } catch (err) {
        console.error('Error in scene build(): ' + current.item.id, err);
      }

      // Add child scene timeline at accumulatedTime
      masterTl.add(rawSceneTl, accumulatedTime);

      // Inter-scene transitions
      if (next) {
        const transDur = Math.min(0.4, Math.max(0.2, duration * 0.25));
        const transStart = accumulatedTime + duration - transDur;
        const transEnd = accumulatedTime + duration;

        if (transitionType === 'flow') {
          // Overlap: the next shot is already on screen underneath (its frame 0 is a composed poster) and
          // lands with a short push, while the current shot plays its in-scene hand-off on top and dissolves.
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', clipPath: 'none' }, transStart);
          masterTl.fromTo(next.wrapper,
            { scale: 1.12 },
            { scale: 1, duration: transDur, ease: 'power3.out', immediateRender: false },
            transStart
          );
          masterTl.set(sceneWrapper, { zIndex: 2 }, transStart);
          masterTl.to(sceneWrapper, { opacity: 0, duration: transDur, ease: 'power2.in' }, transStart);
          masterTl.set(sceneWrapper, { visibility: 'hidden', opacity: 0, zIndex: 1 }, transEnd);
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1 }, transEnd);
        } else if (transitionType === 'fade') {
          // Crossfade: Next scene appears underneath at transStart, current scene fades out
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transStart);
          masterTl.set(sceneWrapper, { zIndex: 2 }, transStart);
          masterTl.to(sceneWrapper, { opacity: 0, duration: transDur, ease: 'power2.inOut' }, transStart);
          masterTl.set(sceneWrapper, { visibility: 'hidden', opacity: 0, zIndex: 1 }, transEnd);
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1 }, transEnd);
        } else if (transitionType === 'slide') {
          // Push slide: Next scene enters from right, current scene slides left (immediateRender: false avoids premature offscreen state)
          masterTl.fromTo(next.wrapper,
            { x: '100%', visibility: 'visible', opacity: 1, zIndex: 2, scale: 1, clipPath: 'none' },
            { x: '0%', duration: transDur, ease: 'power2.inOut', immediateRender: false },
            transStart
          );
          masterTl.to(sceneWrapper, { x: '-100%', duration: transDur, ease: 'power2.inOut' }, transStart);
          masterTl.set(sceneWrapper, { visibility: 'hidden', x: '0%', opacity: 0, zIndex: 1 }, transEnd);
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, x: '0%', zIndex: 1 }, transEnd);
        } else if (transitionType === 'zoom') {
          // Zoom transition: Next scene zooms from 0.92 to 1.0, current scene zooms to 1.15 and fades
          masterTl.fromTo(next.wrapper,
            { scale: 0.92, visibility: 'visible', opacity: 0, zIndex: 1, x: '0%', clipPath: 'none' },
            { scale: 1, opacity: 1, duration: transDur, ease: 'power2.out', immediateRender: false },
            transStart
          );
          masterTl.to(sceneWrapper, { scale: 1.15, opacity: 0, duration: transDur, ease: 'power2.in' }, transStart);
          masterTl.set(sceneWrapper, { visibility: 'hidden', scale: 1, opacity: 0, zIndex: 1 }, transEnd);
          masterTl.set(next.wrapper, { visibility: 'visible', scale: 1, opacity: 1, zIndex: 1 }, transEnd);
        } else if (transitionType === 'wipe') {
          // Vertical wipe: Next scene visible underneath, current scene wipes away
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transStart);
          masterTl.fromTo(sceneWrapper,
            { clipPath: 'inset(0% 0% 0% 0%)', zIndex: 2 },
            { clipPath: 'inset(0% 0% 100% 0%)', duration: transDur, ease: 'power2.inOut', immediateRender: false },
            transStart
          );
          masterTl.set(sceneWrapper, { visibility: 'hidden', clipPath: 'none', opacity: 0, zIndex: 1 }, transEnd);
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1 }, transEnd);
        } else {
          // Default cut: Instant switch at end of scene
          masterTl.set(sceneWrapper, { visibility: 'hidden', opacity: 0 }, transEnd);
          masterTl.set(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transEnd);
        }
      }

      accumulatedTime += duration;
    }

    // Wait for fonts & images (with 2500ms timeout fallback)
    if (document.fonts) {
      try {
        await Promise.race([document.fonts.ready, new Promise(function(r) { setTimeout(r, 2500); })]);
      } catch(e) {}
    }

    // Initial render at frame 0. Rendering to the end first initializes every tween now, so GSAP
    // reads each layer's CSS translate/scale/rotate exactly once, before the editor can push
    // live overrides (set_override_css) that must not be folded into GSAP's transform.
    if (masterTl) {
      masterTl.progress(1, true);
      measurePosterOffsets(sceneElements);
      masterTl.seek(0, false);
    }

    window.__MOO_READY__ = true;
    window.parent.postMessage({
      type: 'ready',
      duration: accumulatedTime,
      totalScenes: scenes.length
    }, '*');
  }

  function computeLayerRects(targetSceneId) {
    const stageEl = document.getElementById('moo-stage') || document.getElementById('moo-viewport');
    if (!stageEl) return [];
    const stageRect = stageEl.getBoundingClientRect();
    const scaleX = (stageEl.clientWidth || 1080) / Math.max(1, stageRect.width || 1080);
    const scaleY = (stageEl.clientHeight || 1920) / Math.max(1, stageRect.height || 1920);

    let container = null;
    if (targetSceneId) {
      container = document.getElementById('scene-' + targetSceneId);
    }
    if (!container) {
      const allWrappers = stageEl.querySelectorAll('[data-scene-id]');
      for (let i = 0; i < allWrappers.length; i++) {
        const st = window.getComputedStyle(allWrappers[i]);
        if (st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.05) {
          container = allWrappers[i];
          break;
        }
      }
    }
    if (!container) return [];

    const nodes = container.querySelectorAll('[data-moo-layer]');
    const rects = [];
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const id = el.getAttribute('data-moo-layer');
      if (!id) continue;
      const r = el.getBoundingClientRect();
      rects.push({
        id: id,
        tagName: (el.tagName || 'div').toLowerCase(),
        x: Math.round((r.left - stageRect.left) * scaleX),
        y: Math.round((r.top - stageRect.top) * scaleY),
        width: Math.max(16, Math.round(r.width * scaleX)),
        height: Math.max(16, Math.round(r.height * scaleY))
      });
    }
    return rects;
  }

  // Poster frames: a scene whose first frame shows no content (everything still animating in)
  // would make a paused editor look black at that scene's start. For such scenes we remember the
  // first moment real content is visible and show that while the editor is paused there.
  // Playback and export always render the true timeline.
  const POSTER_SHAPES = { path: 1, circle: 1, rect: 1, line: 1, polyline: 1, polygon: 1, ellipse: 1, text: 1, tspan: 1, image: 1, use: 1 };
  let posterRanges = [];

  function hasVisibleContent(wrapper, stageArea) {
    const nodes = wrapper.querySelectorAll('*');
    const limit = Math.min(nodes.length, 600);
    for (let i = 0; i < limit; i++) {
      const el = nodes[i];
      const tag = String(el.tagName || '').toLowerCase();
      let paints = POSTER_SHAPES[tag] === 1 || tag === 'img' || tag === 'canvas' || tag === 'video';
      if (!paints) {
        for (let c = el.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3 && String(c.nodeValue || '').trim()) { paints = true; break; }
        }
      }
      if (!paints) continue;
      const r = el.getBoundingClientRect();
      const ratio = (r.width * r.height) / stageArea;
      if (ratio < 0.00002 || ratio > 0.9) continue;
      let alpha = 1;
      let hidden = false;
      for (let n = el; n && n !== wrapper.parentNode; n = n.parentElement) {
        const cs = window.getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') { hidden = true; break; }
        alpha *= parseFloat(cs.opacity || '1');
        if (alpha < 0.3) break;
      }
      if (!hidden && alpha >= 0.3) return true;
    }
    return false;
  }

  function measurePosterOffsets(sceneElements) {
    posterRanges = [];
    const stageRect = stageElem.getBoundingClientRect();
    const stageArea = Math.max(1, stageRect.width * stageRect.height);
    const samples = [0.1, 0.2, 0.35, 0.5, 0.7, 0.9, 1.2, 1.5];
    let start = 0;
    for (let i = 0; i < sceneElements.length; i++) {
      const wrapper = sceneElements[i].wrapper;
      const dur = sceneElements[i].duration;
      try {
        masterTl.seek(start + 0.001, true);
        if (!hasVisibleContent(wrapper, stageArea)) {
          for (let k = 0; k < samples.length && samples[k] <= dur * 0.5; k++) {
            masterTl.seek(start + samples[k], true);
            if (hasVisibleContent(wrapper, stageArea)) {
              posterRanges.push({ start: start, end: start + samples[k] });
              break;
            }
          }
        }
      } catch (e) {}
      start += dur;
    }
    window.__MOO_POSTERS__ = posterRanges;
  }

  function seekTo(t, still) {
    t = Number(t) || 0;
    virtualTimeSeconds = t;
    let renderT = t;
    if (still) {
      for (let i = 0; i < posterRanges.length; i++) {
        if (t >= posterRanges[i].start && t < posterRanges[i].end) { renderT = posterRanges[i].end; break; }
      }
    }
    if (masterTl) {
      masterTl.seek(renderT, false);
    }
    // Overlay hook (subtitles). Must never break seeking.
    if (typeof window.__MOO_AFTER_SEEK__ === 'function') {
      try { window.__MOO_AFTER_SEEK__(t); } catch (e) {}
    }
  }

  window.__MOO_INIT__ = initMasterTimeline;
  window.__MOO_SEEK__ = seekTo;

  // Canvas pooling for zero-allocation frame capture
  let sharedExportCanvas = null;
  let sharedExportCtx = null;

  function resetSharedCanvas() {
    if (sharedExportCanvas) {
      sharedExportCanvas.width = 0;
      sharedExportCanvas.height = 0;
      sharedExportCanvas = null;
      sharedExportCtx = null;
    }
  }

  window.__MOO_TEARDOWN__ = resetSharedCanvas;
  window.addEventListener('beforeunload', resetSharedCanvas);
  window.addEventListener('unload', resetSharedCanvas);

  // 5. Host Communication Protocol
  window.addEventListener('message', async function(ev) {
    const data = ev.data;
    if (!data || !data.type) return;

    if (data.type === 'init') {
      await initMasterTimeline(data.meta);
    } else if (data.type === 'seek') {
      const t = Number(data.time) || 0;
      seekTo(t, data.still === true);
      window.parent.postMessage({ type: 'seeked', id: data.id, time: t }, '*');
    } else if (data.type === 'query_layer_rects') {
      const rects = computeLayerRects(data.sceneId);
      window.parent.postMessage({ type: 'layer_rects', sceneId: data.sceneId, rects: rects }, '*');
    } else if (data.type === 'set_override_css') {
      // Live layer overrides from the editor: restyle in place instead of reloading the document.
      let liveTag = document.getElementById('moo-live-overrides');
      if (!liveTag) {
        liveTag = document.createElement('style');
        liveTag.id = 'moo-live-overrides';
        document.head.appendChild(liveTag);
      }
      liveTag.textContent = String(data.css || '');
    } else if (data.type === 'highlight_layer') {
      const layerId = data.layerId;
      let styleTag = document.getElementById('moo-layer-highlight-style');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'moo-layer-highlight-style';
        document.head.appendChild(styleTag);
      }
      if (layerId) {
        const safeId = String(layerId).replace(/[^a-zA-Z0-9_ -]/g, '');
        styleTag.textContent = '[data-moo-layer="' + safeId + '"] { outline: 2px dashed #84cc16 !important; outline-offset: 4px; }';
      } else {
        styleTag.textContent = '';
      }
    } else if (data.type === 'capture_frame' || data.type === 'capture') {
      const t = Number(data.time) || 0;
      seekTo(t);

      // ForeignObject serialization for zero-server frame rasterization
      try {
        const width = data.width || 1080;
        const height = data.height || 1920;
        const rawStyles = Array.from(document.querySelectorAll('style'))
          .map(function(s) { return s.textContent || ''; })
          .join(String.fromCharCode(10));

        // Only neutralize EXTERNAL urls (http/https/protocol-relative). data: URIs,
        // blob: URIs and #fragment anchors must survive rasterization intact.
        // NOTE: backslashes are doubled because this script is emitted through
        // a TypeScript template literal.
        var styles = rawStyles.replace(/url\\(\\s*['"]?(?:https?:|\\/\\/)[^)'"]*['"]?\\s*\\)/gi, 'none');
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
        // The wrapper <div> directly under <foreignObject> MUST always carry the
        // XHTML namespace — XMLSerializer puts xmlns on the first serialized child,
        // never on our wrapper, so a conditional check leaves the wrapper
        // namespace-less and Chromium renders a blank frame.
        const wrapperXmlns = ' xmlns="http://www.w3.org/1999/xhtml"';

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
            if (!sharedExportCanvas) {
              sharedExportCanvas = document.createElement('canvas');
              sharedExportCtx = sharedExportCanvas.getContext('2d');
            }
            if (!sharedExportCtx) {
              sharedExportCtx = sharedExportCanvas.getContext('2d');
            }
            if (sharedExportCanvas.width !== width) {
              sharedExportCanvas.width = width;
            }
            if (sharedExportCanvas.height !== height) {
              sharedExportCanvas.height = height;
            }
            if (!sharedExportCtx) {
              throw new Error('Canvas 2D context is unavailable');
            }
            // Clear with solid background first so output is never transparent zeros
            sharedExportCtx.fillStyle = mooBg;
            sharedExportCtx.fillRect(0, 0, width, height);
            sharedExportCtx.drawImage(img, 0, 0, width, height);
            img.onload = null;
            img.onerror = null;
            img.src = '';
            if (data.preferBitmap && typeof window.createImageBitmap === 'function') {
              window.createImageBitmap(sharedExportCanvas).then(function(bitmap) {
                window.parent.postMessage({ type: 'frame', id: data.id, bitmap: bitmap }, '*', [bitmap]);
              }).catch(function() {
                const dataUrl = sharedExportCanvas.toDataURL('image/png');
                window.parent.postMessage({ type: 'frame', id: data.id, dataUrl: dataUrl }, '*');
              });
            } else {
              const dataUrl = sharedExportCanvas.toDataURL('image/png');
              window.parent.postMessage({ type: 'frame', id: data.id, dataUrl: dataUrl }, '*');
            }
          } catch (err) {
            img.onload = null;
            img.onerror = null;
            img.src = '';
            window.parent.postMessage({ type: 'frame_error', id: data.id, message: String(err) }, '*');
          }
        };
        img.onerror = function(err) {
          img.onload = null;
          img.onerror = null;
          img.src = '';
          window.parent.postMessage({ type: 'frame_error', id: data.id, message: 'SVG image error: ' + String(err) }, '*');
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      } catch (err) {
        window.parent.postMessage({ type: 'frame_error', id: data.id, message: String(err) }, '*');
      }
    } else if (data.type === 'teardown' || data.type === 'cleanup' || data.type === 'reset_canvas') {
      resetSharedCanvas();
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
  // Wrapper <div> under <foreignObject> always needs the XHTML namespace
  // (see capture handler above for rationale).
  const wrapperXmlns = ' xmlns="http://www.w3.org/1999/xhtml"';

  const cleanStyles = styles
    .replace(/@import[^;\n]+;?/gi, '')
    .replace(/url\(\s*['"]?(?:https?:|\/\/)[^)'"]*['"]?\s*\)/gi, 'none');

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
