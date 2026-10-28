import type { CaptionPosition, CaptionStyle, SubtitleCustomization } from '../../types';

export interface CaptionConfig {
  show: boolean;
  style: CaptionStyle;
  position: CaptionPosition;
  width: number;
  height: number;
  subtitleCustomization?: SubtitleCustomization;
}

export interface CaptionSceneMeta {
  id: string;
  duration: number;
  text: string;
  wordTimestamps: { word: string; start: number; end: number }[];
  /** This scene opted out of captions. */
  hideSubtitles?: boolean;
}

/**
 * Picks the group of words to display at scene-relative time `t`.
 * Returns { words, active } or null when nothing should be shown.
 * Plain ES5 source: it is embedded verbatim into the stage iframe, and unit tests
 * evaluate this same string so there is no second copy to drift.
 */
export const CAPTION_CHUNK_SRC = `
function mooPickChunk(words, t, maxWords) {
  if (!words || !words.length) return null;
  var active = -1;
  for (var i = 0; i < words.length; i++) {
    if (t >= words[i].start && t < words[i].end) { active = i; break; }
  }
  if (active === -1) {
    // Between words: keep the most recent word on screen instead of flickering.
    for (var j = words.length - 1; j >= 0; j--) {
      if (t >= words[j].start) { active = j; break; }
    }
    if (active === -1) return null;
    if (t > words[active].end + 0.6) return null;
  }
  var size = Math.max(1, maxWords || 4);
  var from = Math.floor(active / size) * size;
  var to = Math.min(words.length, from + size);
  var out = [];
  for (var k = from; k < to; k++) out.push(words[k].word);
  return { words: out, active: active - from };
}
`;

/** Even word timing used when a scene has narration but no measured timestamps. */
export const CAPTION_FALLBACK_SRC = `
function mooEvenWords(text, duration) {
  var parts = String(text || '').split(/\\s+/).filter(Boolean);
  if (!parts.length || !(duration > 0)) return [];
  var step = duration / parts.length;
  return parts.map(function (w, i) { return { word: w, start: i * step, end: (i + 1) * step }; });
}
`;

export function buildCaptionScript(config: CaptionConfig, scenes: CaptionSceneMeta[]): string {
  if (!config.show) return '';
  const json = (v: unknown) =>
    JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

  return `
(function () {
  var CFG = ${json(config)};
  var SCENES = ${json(scenes)};
  ${CAPTION_CHUNK_SRC}
  ${CAPTION_FALLBACK_SRC}
  var CUST = CFG.subtitleCustomization || {};
  var scale = Math.max(0.6, Math.min(2.0, CUST.fontScale || 1.0));
  var baseFontRatio = CFG.style === 'bold-pop' ? 0.068 : CFG.style === 'minimal' ? 0.048 : 0.054;
  var fontPx = Math.round(CFG.width * baseFontRatio * scale);
  var activeCol = CUST.activeColor || 'var(--moo-accent,#84cc16)';
  var textCol = CUST.textColor || '#ffffff';
  var isUpper = Boolean(CUST.uppercase || CFG.style === 'bold-pop');
  var yOff = Math.round((CUST.yOffsetPercent || 0) * 0.01 * CFG.height);

  function hexToRgba(hex, alpha) {
    var clean = String(hex || '#000000').replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    var r = parseInt(clean.slice(0, 2), 16) || 0;
    var g = parseInt(clean.slice(2, 4), 16) || 0;
    var b = parseInt(clean.slice(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  var posCss = CFG.position === 'top'
    ? 'top:' + Math.round(CFG.height * 0.1 + yOff) + 'px;'
    : CFG.position === 'center'
      ? 'top:calc(50% + ' + yOff + 'px);transform:translateY(-50%);'
      : 'bottom:' + Math.round(CFG.height * 0.14 - yOff) + 'px;';

  function ensureLayer() {
    var stage = document.getElementById('moo-stage');
    if (!stage) return null;
    var layer = document.getElementById('moo-captions');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'moo-captions';
      layer.setAttribute('style',
        'position:absolute;left:0;right:0;' + posCss +
        'z-index:9999;display:flex;justify-content:center;padding:0 ' + Math.round(CFG.width * 0.07) + 'px;' +
        'pointer-events:none;font-family:var(--moo-font-body,sans-serif);');
      stage.appendChild(layer);
    }
    return layer;
  }

  function wordStyle(isActive) {
    var base = 'display:inline-block;margin:0 ' + Math.round(fontPx * 0.12) + 'px;';
    if (CFG.style === 'karaoke') {
      return base + 'font-weight:800;color:' + (isActive ? activeCol : textCol) +
        ';text-shadow:0 3px 14px rgba(0,0,0,.75);';
    }
    if (CFG.style === 'bold-pop') {
      return base + 'font-weight:800;text-transform:uppercase;letter-spacing:.01em;color:' +
        (isActive ? activeCol : textCol) +
        ';text-shadow:0 4px 0 rgba(0,0,0,.55);' + (isActive ? 'transform:scale(1.15);' : '');
    }
    if (CFG.style === 'minimal') {
      return base + 'font-weight:600;color:' + (isActive ? activeCol : textCol) +
        ';text-shadow:0 2px 12px rgba(0,0,0,.8);';
    }
    if (CFG.style === 'outline') {
      return base + 'font-weight:900;color:' + (isActive ? activeCol : textCol) +
        ';-webkit-text-stroke:2px #000000;text-shadow:0 3px 0 #000000, 0 5px 12px rgba(0,0,0,.75);';
    }
    return base + 'font-weight:700;color:' + (isActive ? activeCol : textCol) + ';';
  }

  var lastKey = null;
  function render(t) {
    var layer = ensureLayer();
    if (!layer) return;
    var durations = window.__MOO_SCENE_DURATIONS__ || [];
    var start = 0, sceneIdx = -1, local = 0;
    for (var i = 0; i < SCENES.length; i++) {
      var d = durations[i] || SCENES[i].duration || 3;
      if (t >= start && (t < start + d || i === SCENES.length - 1)) { sceneIdx = i; local = t - start; break; }
      start += d;
    }
    var chunk = null;
    if (sceneIdx >= 0) {
      var sc = SCENES[sceneIdx];
      if (!sc.hideSubtitles) {
        var words = sc.wordTimestamps && sc.wordTimestamps.length
          ? sc.wordTimestamps
          : mooEvenWords(sc.text, durations[sceneIdx] || sc.duration);
        var maxChunkWords = CUST.maxWordsPerChunk || (CFG.style === 'bold-pop' ? 3 : 5);
        chunk = mooPickChunk(words, local, maxChunkWords);
      }
    }
    var key = chunk ? sceneIdx + ':' + chunk.words.join(' ') + ':' + chunk.active : '';
    if (key === lastKey) return;
    lastKey = key;
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (!chunk) return;
    var box = document.createElement('div');
    var boxCss = 'text-align:center;line-height:1.25;font-size:' + fontPx + 'px;max-width:100%;';
    if (CFG.style === 'boxed') {
      var bgOp = CUST.bgOpacity !== undefined ? CUST.bgOpacity : 0.62;
      var bgCol = CUST.bgColor ? hexToRgba(CUST.bgColor, bgOp) : 'rgba(0,0,0,' + bgOp + ')';
      boxCss += 'background:' + bgCol + ';border-radius:' + Math.round(fontPx * 0.4) + 'px;padding:' +
        Math.round(fontPx * 0.3) + 'px ' + Math.round(fontPx * 0.5) + 'px;backdrop-filter:blur(4px);';
    }
    box.setAttribute('style', boxCss);
    for (var w = 0; w < chunk.words.length; w++) {
      var span = document.createElement('span');
      span.setAttribute('style', wordStyle(w === chunk.active));
      var wordTxt = isUpper ? chunk.words[w].toUpperCase() : chunk.words[w];
      span.textContent = wordTxt;
      box.appendChild(span);
    }
    layer.appendChild(box);
  }

  window.__MOO_AFTER_SEEK__ = render;
})();
`;
}
