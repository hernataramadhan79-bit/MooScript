import { describe, it, expect, vi } from 'vitest';
import { lintMographQuality, MOGRAPH_REPAIR_THRESHOLD } from '../src/engine/composition/mographLint';
import { validateGeneratedScene } from '../src/engine/composition/validator';
import {
  generateCustomScene,
  parseCodeBlocks,
  synthesizeFallbackScene
} from '../src/engine/ai/director/directorPipeline';
import {
  REFERENCE_SCENE_EXAMPLE,
  buildSceneCodegenPrompt,
  formatWordTimestamps
} from '../src/engine/ai/director/motionLaws';
import type { StoryBeat, StyleBrief } from '../src/types';

const styleBrief: StyleBrief = {
  adjectives: ['cinematic'],
  palette: { bg: '#0b1020', primary: '#38bdf8', accent: '#f59e0b', text: '#f8fafc' },
  fontDisplay: 'Syne',
  fontBody: 'Plus Jakarta Sans',
  backgroundLanguage: 'Dark',
  motionSignature: 'Kinetic'
};

const NARRATION = 'Setiap hari jutaan orang membuka aplikasi ini untuk mencari jawaban cepat';

const SLIDE_LIKE_RESPONSE = `\`\`\`html
<div class="scene-s1">
  <div class="card" data-moo-layer="card">
    <span class="badge">FAKTA</span>
    <h2>Jutaan Pengguna</h2>
    <p>${NARRATION}</p>
  </div>
</div>
\`\`\`
\`\`\`css
.scene-s1 { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
.scene-s1 .card { backdrop-filter: blur(20px); border-radius: 24px; padding: 32px; }
\`\`\`
\`\`\`javascript
shot.arrive(root.querySelector('.card'), { opacity: 0, y: 40, dur: 0.6, curve: 'strong-out' });
shot.arrive(root.querySelectorAll('h2, p'), { opacity: 0, y: 20, cascade: 0.1, dur: 0.5 }, 'end-0.3');
\`\`\``;

const MOGRAPH_RESPONSE = `\`\`\`html
<div class="scene-s1">
  <div class="moo-camera" data-moo-layer="camera">
    <div class="bg" data-moo-layer="bg"></div>
    <svg class="phones" data-moo-layer="phones" viewBox="0 0 1080 1920"><circle class="dot" cx="540" cy="960" r="40" /></svg>
    <div class="word" data-moo-layer="headline"><span>JUTAAN</span></div>
  </div>
</div>
\`\`\`
\`\`\`css
.scene-s1 { position: relative; width: 100%; height: 100%; overflow: hidden; }
.scene-s1 .moo-camera { position: absolute; inset: 0; }
.scene-s1 .word { position: absolute; left: 0; top: 300px; width: 100%; font-size: 160px; }
\`\`\`
\`\`\`javascript
const cam = root.querySelector('.moo-camera');
shot.travel(cam, { scale: 1.2 }, { scale: 1, dur: ctx.dur - 0.4, curve: 'gentle-inout' }, 0);
shot.arrive(root.querySelector('.dot'), { scale: 0, pivot: '50% 50%', dur: 0.5, curve: 'overshoot-out(2)' }, 0);
shot.arrive(root.querySelectorAll('.word span'), { shiftY: 110, spin: 8, dur: 0.4, curve: 'rush-out' }, ctx.at('jutaan') || 0.6);
shot.go(cam, { scale: 2.5, opacity: 0, dur: 0.4, curve: 'sharp-in' }, ctx.dur - 0.4);
\`\`\``;

const beat: StoryBeat = {
  id: 'beat-lint',
  narration: NARRATION,
  visualIntent: 'Jutaan pengguna membuka aplikasi',
  durationHint: 4
};

describe('Anti-PPT mograph linter', () => {
  it('passes the reference scene shipped in the system prompt', () => {
    const code = parseCodeBlocks(REFERENCE_SCENE_EXAMPLE);
    expect(validateGeneratedScene(code).valid).toBe(true);
    const lint = lintMographQuality(code, { hasWordTimestamps: true });
    expect(lint.issues).toEqual([]);
    expect(lint.needsRepair).toBe(false);
  });

  it('flags a glass-card slide with pasted narration and fade-up motion', () => {
    const lint = lintMographQuality(parseCodeBlocks(SLIDE_LIKE_RESPONSE), { narration: NARRATION });
    const ids = lint.issues.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['no-camera', 'web-layout', 'web-tags', 'fade-up-only', 'no-handoff']));
    expect(ids.some((id) => id === 'text-heavy' || id === 'narration-pasted')).toBe(true);
    expect(lint.score).toBeGreaterThanOrEqual(MOGRAPH_REPAIR_THRESHOLD);
    expect(lint.needsRepair).toBe(true);
  });

  it('flags an animated scene that never moves its camera and ignores voice timing', () => {
    const code = parseCodeBlocks(MOGRAPH_RESPONSE);
    const buildJs = code.buildJs
      .split('\n')
      .filter((line) => !/^shot\.(go|travel)\(cam\b/.test(line))
      .join('\n')
      .replace(/ctx\.at\('jutaan'\) \|\| /, '');
    const staticCam = { ...code, buildJs };
    const ids = lintMographQuality(staticCam, { hasWordTimestamps: true }).issues.map((i) => i.id);
    expect(ids).toContain('static-camera');
    expect(ids).toContain('unsynced');
  });

  it('flags a scene whose camera starts hidden, since the editor still at t=0 would be empty', () => {
    const code = parseCodeBlocks(MOGRAPH_RESPONSE);
    const hiddenStart = {
      ...code,
      buildJs: code.buildJs.replace("shot.travel(cam, { scale: 1.2 }", "shot.travel(cam, { scale: 1.2, opacity: 0 }")
    };
    const lint = lintMographQuality(hiddenStart);
    expect(lint.issues.map((i) => i.id)).toContain('empty-first-frame');
    expect(lint.needsRepair).toBe(true);

    const rootHidden = { ...code, buildJs: `${code.buildJs}\nshot.arrive(root.children, { fade: 0, dur: 0.5 }, 0);` };
    expect(lintMographQuality(rootHidden).issues.map((i) => i.id)).toContain('empty-first-frame');

    // Secondary details may still enter from nothing
    expect(lintMographQuality(code).issues.map((i) => i.id)).not.toContain('empty-first-frame');
  });

  it('builds a fail-safe scene that is itself mograph, not a card', () => {
    const code = synthesizeFallbackScene({ beat, index: 0, styleBrief, durationSec: 4, aspectRatio: '16:9' });
    expect(validateGeneratedScene(code).valid).toBe(true);
    expect(code.html).toContain('viewBox="0 0 1920 1080"');
    expect(lintMographQuality(code, { narration: NARRATION }).issues).toEqual([]);
  });
});

describe('Scene prompt: stage contract and voice timing', () => {
  it('includes stage size and scene-relative word timestamps', () => {
    const prompt = buildSceneCodegenPrompt({
      beatIndex: 1,
      totalBeats: 3,
      narration: 'Air mendidih pada seratus derajat',
      visualIntent: 'Panci air mendidih',
      durationSec: 3,
      aspectRatio: '16:9',
      styleBrief: {
        palette: styleBrief.palette,
        fontDisplay: 'Syne',
        motionSignature: 'Kinetic',
        backgroundLanguage: 'Dark'
      },
      wordTimestamps: [
        { word: 'Air', start: 0.1, end: 0.3 },
        { word: 'mendidih,', start: 0.35, end: 0.9 }
      ]
    });
    expect(prompt).toContain('panggung 1920x1080px');
    expect(prompt).toContain('=== TIMING SUARA');
    expect(prompt).toContain('Air@0.10s mendidih@0.35s');
    expect(prompt).toContain('class="moo-camera"');
  });

  it('omits the timing section when there are no timestamps', () => {
    expect(formatWordTimestamps([])).toBe('');
    expect(formatWordTimestamps(undefined)).toBe('');
  });
});

describe('generateCustomScene anti-PPT rewrite', () => {
  const run = (executeLlm: (opts: { systemPrompt: string; userPrompt: string }) => Promise<string>) =>
    generateCustomScene({
      beat,
      index: 0,
      total: 1,
      styleBrief,
      provider: 'openai',
      apiKey: 'test-key',
      wordTimestamps: [{ word: 'jutaan', start: 0.4, end: 0.8 }],
      executeLlm
    });

  it('replaces a slide-like scene with the mograph rewrite', async () => {
    const executeLlm = vi
      .fn()
      .mockResolvedValueOnce(SLIDE_LIKE_RESPONSE)
      .mockResolvedValueOnce(MOGRAPH_RESPONSE);

    const result = await run(executeLlm);

    expect(executeLlm).toHaveBeenCalledTimes(2);
    expect(executeLlm.mock.calls[0][0].userPrompt).toContain('jutaan@0.40s');
    expect(executeLlm.mock.calls[1][0].userPrompt).toContain('SLIDE / HALAMAN WEB');
    expect(result.status).toBe('ok');
    expect(result.html).toContain('moo-camera');
  });

  it('keeps the original scene when the rewrite is invalid', async () => {
    const executeLlm = vi
      .fn()
      .mockResolvedValueOnce(SLIDE_LIKE_RESPONSE)
      .mockResolvedValueOnce('```javascript\nwhile(true) { eval("x"); }\n```');

    const result = await run(executeLlm);

    expect(executeLlm).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('ok');
    expect(result.html).toContain('class="card"');
  });

  it('does not spend an extra call on a scene that already reads as mograph', async () => {
    const executeLlm = vi.fn().mockResolvedValue(MOGRAPH_RESPONSE);
    const result = await run(executeLlm);
    expect(executeLlm).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
  });
});
