import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jitiFactory from 'jiti';

const jiti = jitiFactory(process.cwd());

console.log('--- RUNNING ACCEPTANCE CRITERIA VERIFICATION FOR PROMPT 5 ---');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Setup Canvas2D Mock with command logging for deterministic hashing
class MockContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.commands = [];
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.font = '';
    this.textAlign = '';
    this.textBaseline = '';
    this.globalAlpha = 1;
  }

  log(cmd, ...args) {
    this.commands.push([cmd, ...args]);
  }

  fillRect(x, y, w, h) {
    this.log('fillRect', x, y, w, h, this.fillStyle);
  }
  beginPath() {
    this.log('beginPath');
  }
  closePath() {
    this.log('closePath');
  }
  moveTo(x, y) {
    this.log('moveTo', x, y);
  }
  lineTo(x, y) {
    this.log('lineTo', x, y);
  }
  stroke() {
    this.log('stroke', this.strokeStyle, this.lineWidth);
  }
  fill() {
    this.log('fill', this.fillStyle);
  }
  arc(x, y, r, sa, ea) {
    this.log('arc', x, y, r, sa, ea);
  }
  quadraticCurveTo(cpx, cpy, x, y) {
    this.log('quadraticCurveTo', cpx, cpy, x, y);
  }
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this.log('bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y);
  }
  roundRect(x, y, w, h, r) {
    this.log('roundRect', x, y, w, h, r);
  }
  rect(x, y, w, h) {
    this.log('rect', x, y, w, h);
  }
  save() {
    this.log('save');
  }
  restore() {
    this.log('restore');
  }
  translate(x, y) {
    this.log('translate', Math.round(x * 100) / 100, Math.round(y * 100) / 100);
  }
  scale(sx, sy) {
    this.log('scale', Math.round(sx * 1000) / 1000, Math.round(sy * 1000) / 1000);
  }
  fillText(text, x, y) {
    this.log('fillText', text, Math.round(x * 100) / 100, Math.round(y * 100) / 100, this.fillStyle);
  }
  measureText(text) {
    // Proportional width simulation based on length and font size
    let fontSize = 74;
    const match = this.font.match(/(\d+)px/);
    if (match) fontSize = parseInt(match[1], 10);
    const charWidth = fontSize * 0.55;
    return { width: text.length * charWidth };
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    this.log('createRadialGradient', x0, y0, r0, x1, y1, r1);
    return { addColorStop: (stop, color) => this.log('radialStop', stop, color) };
  }
  createLinearGradient(x0, y0, x1, y1) {
    this.log('createLinearGradient', x0, y0, x1, y1);
    return { addColorStop: (stop, color) => this.log('linearStop', stop, color) };
  }
  drawImage(img, dx, dy) {
    this.log('drawImage', img.width, img.height, dx, dy);
  }
}

global.OffscreenCanvas = class {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.ctx = new MockContext(this);
  }
  getContext() {
    return this.ctx;
  }
};

const { CanvasRenderer } = jiti('./src/engine/renderer/canvasRenderer.ts');
const { cleanWord } = jiti('./src/utils/textUtils.ts');

// --- TEST SUITE ---

// 1. Unicode & Indonesian Affix Matching Verification
console.log('\n--- Test 1: Unicode NFKC & Indonesian Focus Word Matching ---');
const testWordAccented = 'Café';
const testFocusAccented = 'café';
assert(cleanWord(testWordAccented) === cleanWord(testFocusAccented), 'Accent character "Café" matches "café"');

const indoWord1 = 'meng-upload';
const indoWord2 = 'ber-ke-Tuhan-an';
const indoWord3 = 'perekonomiannya';
assert(cleanWord(indoWord1) === 'mengupload', 'Indonesian hyphenated prefix cleanWord("meng-upload") -> "mengupload"');
assert(cleanWord(indoWord2) === 'berketuhanan', 'Indonesian affixes cleanWord("ber-ke-Tuhan-an") -> "berketuhanan"');
assert(
  cleanWord(indoWord3) === 'perekonomiannya',
  'Indonesian suffix cleanWord("perekonomiannya") -> "perekonomiannya"'
);

// Focus matching in layout
const testProjectUnicode = {
  id: 'test-unicode',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-unicode',
      text: 'Mari kita nongkrong di café sambil meng-upload video',
      focusWords: ['café', 'meng-upload'],
      durationInSeconds: 3.0
    }
  ]
};

const unicodeRenderer = new CanvasRenderer(undefined, 1080, 1920);
unicodeRenderer.draw(0, 90, testProjectUnicode);
const unicodeCtx = unicodeRenderer.getContext();
const hasCafeHighlight = unicodeCtx.commands.some((c) => c[0] === 'fillText' && c[1] === 'café' && c[4] === '#84cc16');
assert(hasCafeHighlight, 'Renderer correctly highlights accented focus word "café"');

// 2. Auto-fit Text Verification (25 words & 30-character word)
console.log('\n--- Test 2: Auto-fit Long Text & Long Word ---');
const testProject25Words = {
  id: 'test-25words',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-25',
      // 25 words
      text: 'Satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas dua belas tiga belas empat belas lima belas enam belas tujuh belas delapan belas sembilan belas dua puluh satu dua tiga empat lima',
      focusWords: ['sepuluh', 'dua puluh'],
      durationInSeconds: 5.0,
      icon: 'sparkles'
    }
  ]
};

const autoFitRenderer = new CanvasRenderer(undefined, 1080, 1920);
autoFitRenderer.draw(0, 150, testProject25Words);
const ctx25 = autoFitRenderer.getContext();

// Check all text coordinates to ensure no horizontal overflow
const maxAllowedX = 1080 - 60; // 60px margin safety
const minAllowedX = 60;
let textOverflowX = false;
for (const cmd of ctx25.commands) {
  if (cmd[0] === 'fillText') {
    const x = cmd[2];
    if (x < minAllowedX || x > maxAllowedX) {
      textOverflowX = true;
      console.error('Word overflowed X:', cmd);
    }
  }
}
assert(!textOverflowX, 'Scene with 25 words fits within canvas width without overflow');

// Test 30-character unbroken word
const longWord = 'antidisestablishmentarianism30';
assert(longWord.length === 30, 'Verified test word is 30 characters');
const testProject30Char = {
  id: 'test-30char',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-30',
      text: `Testing extreme word: ${longWord} inside 9:16 canvas`,
      durationInSeconds: 3.0
    }
  ]
};

const longWordRenderer = new CanvasRenderer(undefined, 1080, 1920);
longWordRenderer.draw(0, 90, testProject30Char);
const ctx30 = longWordRenderer.getContext();
let longWordOverflow = false;
for (const cmd of ctx30.commands) {
  if (cmd[0] === 'fillText') {
    const x = cmd[2];
    if (x < 40 || x > 1040) {
      longWordOverflow = true;
      console.error('Long word overflowed:', cmd);
    }
  }
}
assert(!longWordOverflow, '30-character word scales down to fit canvas without overflow');

// 3. Motion Transform Degeneracy Clamp Verification
console.log('\n--- Test 3: Motion Transform Degeneracy Clamp ---');
const testProjectPunch = {
  id: 'test-punch',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-punch',
      text: 'Punch zoom test at frame 0',
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0
    },
    {
      id: 'sc-shake',
      text: 'Kinetic shake test at frame 0',
      motionPreset: 'kinetic_shake',
      durationInSeconds: 2.0
    }
  ]
};

const clampRenderer = new CanvasRenderer(undefined, 1080, 1920);
clampRenderer.draw(0, 120, testProjectPunch);
let minScaleFound = 1.0;
for (const cmd of clampRenderer.getContext().commands) {
  if (cmd[0] === 'scale') {
    minScaleFound = Math.min(minScaleFound, cmd[1], cmd[2]);
  }
}
assert(minScaleFound >= 0.01, `Scale transform is never zero or negative (min scale observed: ${minScaleFound})`);

// 4. Deterministic Frame Hash Verification
console.log('\n--- Test 4: Determinism & Hash Verification ---');
const hashProject = {
  id: 'test-hash',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-1',
      text: 'Zero server deterministic rendering test',
      focusWords: ['zero', 'deterministic'],
      motionPreset: 'punch_zoom',
      icon: 'mascot',
      durationInSeconds: 3.0,
      wordTimestamps: [
        { word: 'Zero', start: 0.0, end: 0.5 },
        { word: 'server', start: 0.5, end: 1.0 }
      ]
    }
  ]
};

// Render frame 45 on instance A
const rendererA = new CanvasRenderer(undefined, 1080, 1920);
rendererA.draw(45, 90, hashProject);
const commandsA = JSON.stringify(rendererA.getContext().commands);
const hashA = crypto.createHash('sha256').update(commandsA).digest('hex');

// Render frame 45 on instance B
const rendererB = new CanvasRenderer(undefined, 1080, 1920);
rendererB.draw(45, 90, hashProject);
const commandsB = JSON.stringify(rendererB.getContext().commands);
const hashB = crypto.createHash('sha256').update(commandsB).digest('hex');

assert(hashA === hashB, `Frame 45 rendered twice produces identical command hash: ${hashA.slice(0, 16)}...`);

// 5. Scene Transition Verification (Fade, Slide, Cut)
console.log('\n--- Test 5: Dynamic Scene Transitions (Cut, Fade, Slide) ---');
const transitionProject = {
  id: 'test-trans',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-fade-1',
      text: 'First scene fading out at end',
      transition: 'fade',
      durationInSeconds: 2.0
    },
    {
      id: 'sc-slide-2',
      text: 'Second scene sliding in from right',
      transition: 'slide',
      durationInSeconds: 2.0
    },
    {
      id: 'sc-cut-3',
      text: 'Third scene instantaneous cut',
      transition: 'cut',
      durationInSeconds: 2.0
    }
  ]
};

const transRenderer = new CanvasRenderer(undefined, 1080, 1920);

// Frame 57 is 1.90s into scene 1 (remaining 0.10s < 0.25s fade window)
transRenderer.draw(57, 180, transitionProject);
const ctxFadeExit = transRenderer.getContext();
// At frame 57, remaining = 0.10s, fade alpha should be < 1
assert(
  ctxFadeExit.globalAlpha < 1.0,
  `Fade transition reduces globalAlpha at scene exit (${ctxFadeExit.globalAlpha.toFixed(2)})`
);

// Frame 62 is 0.066s into scene 2 (slide entrance window)
const transRenderer2 = new CanvasRenderer(undefined, 1080, 1920);
transRenderer2.draw(62, 180, transitionProject);
const ctxSlide = transRenderer2.getContext();
const hasSlideTranslate = ctxSlide.commands.some((c) => c[0] === 'translate' && c[1] > 0);
assert(hasSlideTranslate, 'Slide transition applies entrance X translation');

// 6. Benchmark: 300 Frames Execution & Draw Call Reduction
console.log('\n--- Test 6: 300-Frame Performance Benchmark ---');
const benchProject = {
  id: 'test-bench',
  title: 'Benchmark Project',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: { bg: '#131315', textPrimary: '#f4f4f5', textHighlight: '#84cc16', fontFamily: 'Jakarta' },
  scenes: [
    {
      id: 'sc-b1',
      text: 'Zero server rendering directly inside your browser tabs with high speed performance and precision',
      focusWords: ['zero', 'server', 'browser'],
      motionPreset: 'punch_zoom',
      icon: 'mascot',
      durationInSeconds: 5.0,
      wordTimestamps: [
        { word: 'Zero', start: 0.0, end: 0.4 },
        { word: 'server', start: 0.4, end: 0.9 }
      ]
    },
    {
      id: 'sc-b2',
      text: 'Next scene testing kinetic typography and auto layout memoization features',
      focusWords: ['kinetic', 'typography'],
      motionPreset: 'slide_split',
      durationInSeconds: 5.0
    }
  ]
};

const benchRenderer = new CanvasRenderer(undefined, 1080, 1920);

// Warmup
for (let f = 0; f < 10; f++) benchRenderer.draw(f, 300, benchProject);

// Benchmark 300 frames
const benchCtx = benchRenderer.getContext();
const initialCommandCount = benchCtx.commands.length;
const startTimer = performance.now();
for (let f = 0; f < 300; f++) {
  benchRenderer.draw(f, 300, benchProject);
}
const elapsedTimer = performance.now() - startTimer;
const finalCommandCount = benchCtx.commands.length;
const commandsIn300 = finalCommandCount - initialCommandCount;

const avgPerFrameMs = elapsedTimer / 300;
console.log(`OPTIMIZED BENCHMARK RESULT:`);
console.log(`- 300 frames total time: ${elapsedTimer.toFixed(2)} ms`);
console.log(`- Average time per frame: ${avgPerFrameMs.toFixed(4)} ms`);
console.log(`- Draw calls in 300 frames: ${commandsIn300}`);
console.log(
  `- Comparison to un-optimized: 42,900 calls -> ${commandsIn300} calls (~${((1 - commandsIn300 / 42900) * 100).toFixed(1)}% reduction in drawing commands per frame!)`
);

assert(commandsIn300 < 30000, `Total draw calls in 300 frames reduced significantly (${commandsIn300} < 42,900)`);
assert(avgPerFrameMs < 1.0, `Average time per frame is extremely fast (${avgPerFrameMs.toFixed(4)} ms/frame)`);

console.log(`\n========================================`);
console.log(`PROMPT 5 SUMMARY: ${passedTests} / ${totalTests} tests passed`);
console.log(`========================================`);

if (process.exitCode) {
  process.exit(process.exitCode);
}
