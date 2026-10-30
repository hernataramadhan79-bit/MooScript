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
 * Enforces determinism, drives the MooTween master track, and provides postMessage communication with host.
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

  // 2. Frozen time tracking for a deterministic track
  let virtualTimeSeconds = 0;
  Date.now = function() { return Math.round(virtualTimeSeconds * 1000); };
  if (window.performance) {
    window.performance.now = function() { return virtualTimeSeconds * 1000; };
  }

  // Curve families a shot may pick for its transition (TRANSITION_CURVES in types).
  const TRANSITION_CURVE_FAMILIES = ['smooth', 'soft', 'strong', 'sharp', 'linear', 'rush'];

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

  // 4. Master track controller
  let masterTrack = null;
  let stageElem = null;

  async function initMasterTrack(compositionMeta) {
    const engine = window.MooTween;
    if (!engine) {
      console.error('MooTween is not loaded inside iframe runtime');
      return;
    }

    // MooTween never ticks in real time: playback is purely driven by host seek().
    // Moves on empty or missing targets are no-ops inside MooTween, so scene code needs no guard.
    masterTrack = engine.track({ paused: true });

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
      if (def.clearBg) sceneWrapper.setAttribute('data-clear-bg', '');
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

    // Phase 2: Set initial state at t=0 for all scene wrappers in the master track
    for (let i = 0; i < sceneElements.length; i++) {
      masterTrack.pin(sceneElements[i].wrapper, {
        visibility: i === 0 ? 'visible' : 'hidden',
        opacity: i === 0 ? 1 : 0,
        zIndex: 1,
        x: '0%',
        scale: 1,
        clipPath: 'none'
      }, 0);
    }

    const shotAccents = [];

    // Phase 3: Build each shot track and the inter-shot transitions
    for (let i = 0; i < sceneElements.length; i++) {
      const current = sceneElements[i];
      const sceneWrapper = current.wrapper;
      const def = current.def;
      const meta = current.meta;
      const duration = current.duration;
      const transitionType = current.item.transition || current.def.transition || meta.transition || 'flow';
      const next = sceneElements[i + 1];

      // Ensure current scene wrapper is unconditionally visible and reset at accumulatedTime
      masterTrack.pin(sceneWrapper, {
        visibility: 'visible',
        opacity: 1,
        zIndex: 1,
        x: '0%',
        scale: 1,
        clipPath: 'none'
      }, accumulatedTime);

      // A split piece plays its code from inPoint on, at the length the code was built for, so its
      // moves and word beats keep their original timing.
      const inPoint = Math.max(0, Number(def.inPoint) || 0);
      const sourceDuration = Number(def.sourceDuration) > 0 ? Number(def.sourceDuration) : duration + inPoint;
      const shotWords = (meta.wordTimestamps || []).map(function(w) {
        return { word: w.word, start: w.start + inPoint, end: w.end + inPoint };
      });

      // Context passed to build(shot, root, ctx)
      const scenePrng = createPrng(Number(def.seed) > 0 ? Number(def.seed) : i + 1);
      const ctx = {
        dur: sourceDuration,
        words: shotWords,
        at: function(word, occurrence) {
          if (!shotWords.length) return 0;
          // Exact word first, then prefix, then substring: 'ide' must not land on 'inside'.
          const norm = function(s) { return String(s).toLowerCase().replace(/[^\\p{L}\\p{N}%]/gu, ''); };
          const clean = norm(word);
          if (!clean) return 0;
          let matches = shotWords.filter(w => norm(w.word) === clean);
          if (matches.length === 0) matches = shotWords.filter(w => norm(w.word).startsWith(clean));
          if (matches.length === 0) matches = shotWords.filter(w => norm(w.word).includes(clean));
          const idx = typeof occurrence === 'number' && occurrence > 0 ? Math.min(occurrence, matches.length - 1) : 0;
          const match = matches[idx];
          return match ? Math.max(0, match.start) : 0;
        },
        rand: scenePrng,
        index: i,
        // Hits the shot's code makes (ctx.pop, ctx.punch, ...), kept when they land on screen.
        accent: function(kind, at) {
          const t = accumulatedTime - inPoint + Number(at || 0);
          if (t >= accumulatedTime - 0.001 && t < accumulatedTime + duration) {
            shotAccents.push({ kind: kind, time: Math.round(t * 1000) / 1000 });
          }
        }
      };

      // The shot's track: selectors resolve inside this shot only, and loop: true covers this shot.
      // Sub-tracks made with MooTween.track() while it builds inherit that scope.
      const shotTrack = engine.track({ scope: sceneWrapper, loopSpan: sourceDuration });
      engine.activeTrack = shotTrack;
      try {
        installMographKit(shotTrack, sceneWrapper, ctx);
      } catch (kitErr) {
        console.warn('Mograph kit unavailable for scene ' + current.item.id, kitErr);
      }
      try {
        if (typeof def.build === 'function') {
          def.build(shotTrack, sceneWrapper, ctx);
        } else if (typeof def.buildSrc === 'string' && def.buildSrc.trim()) {
          const fn = new Function('shot', 'root', 'ctx', 'MooTween', def.buildSrc);
          fn(shotTrack, sceneWrapper, ctx, engine);
        }
      } catch (err) {
        console.error('Error in scene build(): ' + current.item.id, err);
      }
      engine.activeTrack = null;

      // Place the shot track at accumulatedTime (earlier by inPoint, while the shot is still hidden)
      masterTrack.nest(shotTrack, accumulatedTime - inPoint);

      // Inter-scene transitions
      if (next) {
        // A duration set on the shot wins (kept inside the shot); otherwise 0.2-0.4 s from its length.
        const setDur = Number(def.transitionDuration);
        const transDur = setDur > 0
          ? Math.min(Math.max(0.1, setDur), Math.max(0.1, duration * 0.8))
          : Math.min(0.4, Math.max(0.2, duration * 0.25));
        // A curve family set on the shot replaces each transition's own family but keeps its direction.
        const curveFamily = TRANSITION_CURVE_FAMILIES.indexOf(def.transitionCurve) !== -1 ? def.transitionCurve : null;
        const curve = function(own) { return curveFamily ? curveFamily + own.slice(own.indexOf('-')) : own; };
        const transStart = accumulatedTime + duration - transDur;
        const transEnd = accumulatedTime + duration;

        if (transitionType === 'flow') {
          // Overlap: the next shot already waits underneath at its frame 0 while the current shot plays
          // its in-scene hand-off on top and dissolves. The next shot is held still on purpose: moving
          // its wrapper here (a scale push) fought its own camera move, so every shot start zoomed one
          // way, stopped, and set off again from where the push began.
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transStart);
          masterTrack.pin(sceneWrapper, { zIndex: 2 }, transStart);
          masterTrack.go(sceneWrapper, { opacity: 0, dur: transDur, curve: curve('smooth-in') }, transStart);
          masterTrack.pin(sceneWrapper, { visibility: 'hidden', opacity: 0, zIndex: 1 }, transEnd);
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1 }, transEnd);
        } else if (transitionType === 'fade') {
          // Crossfade: Next scene appears underneath at transStart, current scene fades out
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transStart);
          masterTrack.pin(sceneWrapper, { zIndex: 2 }, transStart);
          masterTrack.go(sceneWrapper, { opacity: 0, dur: transDur, curve: curve('smooth-inout') }, transStart);
          masterTrack.pin(sceneWrapper, { visibility: 'hidden', opacity: 0, zIndex: 1 }, transEnd);
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1 }, transEnd);
        } else if (transitionType === 'slide') {
          // Push slide: Next scene enters from right, current scene slides left. The next scene is made visible
          // with its own pin: a travel() with showStart: false never applies values only its start props name.
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 2, scale: 1, clipPath: 'none' }, transStart);
          masterTrack.travel(next.wrapper,
            { x: '100%' },
            { x: '0%', dur: transDur, curve: curve('smooth-inout'), showStart: false },
            transStart
          );
          masterTrack.go(sceneWrapper, { x: '-100%', dur: transDur, curve: curve('smooth-inout') }, transStart);
          masterTrack.pin(sceneWrapper, { visibility: 'hidden', x: '0%', opacity: 0, zIndex: 1 }, transEnd);
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, x: '0%', zIndex: 1 }, transEnd);
        } else if (transitionType === 'zoom') {
          // Zoom transition: Next scene zooms from 0.92 to 1.0 and fades in on top, current scene zooms to 1.15 and fades
          masterTrack.pin(next.wrapper, { visibility: 'visible', zIndex: 2, x: '0%', clipPath: 'none' }, transStart);
          masterTrack.travel(next.wrapper,
            { scale: 0.92, opacity: 0 },
            { scale: 1, opacity: 1, dur: transDur, curve: curve('smooth-out'), showStart: false },
            transStart
          );
          masterTrack.go(sceneWrapper, { scale: 1.15, opacity: 0, dur: transDur, curve: curve('smooth-in') }, transStart);
          masterTrack.pin(sceneWrapper, { visibility: 'hidden', scale: 1, opacity: 0, zIndex: 1 }, transEnd);
          masterTrack.pin(next.wrapper, { visibility: 'visible', scale: 1, opacity: 1, zIndex: 1 }, transEnd);
        } else if (transitionType === 'wipe') {
          // Vertical wipe: Next scene visible underneath, current scene wipes away
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transStart);
          masterTrack.pin(sceneWrapper, { zIndex: 2 }, transStart);
          masterTrack.travel(sceneWrapper,
            { clipPath: 'inset(0% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 100% 0%)', dur: transDur, curve: curve('smooth-inout'), showStart: false },
            transStart
          );
          masterTrack.pin(sceneWrapper, { visibility: 'hidden', clipPath: 'none', opacity: 0, zIndex: 1 }, transEnd);
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1 }, transEnd);
        } else {
          // Default cut: Instant switch at end of scene
          masterTrack.pin(sceneWrapper, { visibility: 'hidden', opacity: 0 }, transEnd);
          masterTrack.pin(next.wrapper, { visibility: 'visible', opacity: 1, zIndex: 1, x: '0%', scale: 1, clipPath: 'none' }, transEnd);
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

    // Initial render at frame 0. Rendering to the end first initializes every tween now, in time
    // order, so each tween reads its start values once, before the editor pushes live overrides
    // (set_override_css).
    if (masterTrack) {
      masterTrack.progress(1, true);
      measurePosterOffsets(sceneElements);
      masterTrack.seek(0, false);
    }

    window.__MOO_READY__ = true;
    window.parent.postMessage({
      type: 'ready',
      duration: accumulatedTime,
      totalScenes: scenes.length,
      accents: shotAccents
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
      const allWrappers = stageEl.querySelectorAll('.moo-scene-wrapper');
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
      // How much the layer's ancestors (a zooming camera, a scaled card) scale its moves: a translate
      // of 1px on the layer moves it k stage px.
      const parent = el.parentElement;
      let k = 1;
      if (parent && parent.offsetWidth > 0) {
        const pr = parent.getBoundingClientRect();
        k = Math.max(0.05, (pr.width * scaleX) / parent.offsetWidth);
      }
      rects.push({
        id: id,
        k: Math.round(k * 1000) / 1000,
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
        masterTrack.seek(start + 0.001, true);
        if (!hasVisibleContent(wrapper, stageArea)) {
          for (let k = 0; k < samples.length && samples[k] <= dur * 0.5; k++) {
            masterTrack.seek(start + samples[k], true);
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
    if (masterTrack) {
      masterTrack.seek(renderT, false);
    }
    // Overlay hook (subtitles). Must never break seeking.
    if (typeof window.__MOO_AFTER_SEEK__ === 'function') {
      try { window.__MOO_AFTER_SEEK__(t); } catch (e) {}
    }
  }

  window.__MOO_INIT__ = initMasterTrack;
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
  // 'pagehide' rather than 'unload': browsers block unload listeners in embedded documents.
  window.addEventListener('pagehide', resetSharedCanvas);

  // 5. Host Communication Protocol
  window.addEventListener('message', async function(ev) {
    const data = ev.data;
    if (!data || !data.type) return;

    if (data.type === 'init') {
      await initMasterTrack(data.meta);
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
          '<div' + wrapperXmlns + ' style="width:100%;height:100%;position:relative;background:' + (data.transparent ? 'transparent' : mooBg) + ';color:' + mooText + ';--moo-bg:' + mooBg + ';--moo-accent:' + mooAccent + ';--moo-text:' + mooText + ';--moo-primary:' + mooPrimary + ';overflow:hidden;">' +
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
            // Clear with solid background first so output is never transparent zeros, unless the
            // caller asked for alpha (B-roll underneath, transparent video).
            if (data.transparent) {
              sharedExportCtx.clearRect(0, 0, width, height);
            } else {
              sharedExportCtx.fillStyle = mooBg;
              sharedExportCtx.fillRect(0, 0, width, height);
            }
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
