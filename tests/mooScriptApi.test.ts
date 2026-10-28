import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findForeignApis, validateGeneratedScene, validateSceneCode } from '../src/engine/composition/validator';
import { lintMographQuality } from '../src/engine/composition/mographLint';
import { cleanGeneratedJs } from '../src/engine/ai/director/directorPipeline';
import { MOOTWEEN_RUNTIME_RULES, MOTION_DIRECTOR_SYSTEM_PROMPT, buildSceneCodegenPrompt } from '../src/engine/ai/director/motionLaws';
import { MOO_API_EXAMPLE, MOO_API_GUIDE, MOO_API_NAMES } from '../src/engine/composition/runtime/mooApiGuide';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { parseProjectBackup, serializeProjectBackup } from '../src/db/projectBackup';
import { DEMO_PROJECT_MOOTWEEN } from './fixtures/demoProject';

const scene = (buildJs: string) => ({ html: '<div class="s"><svg></svg></div>', css: '.s{}', buildJs });

describe('MooScript API: validator', () => {
  const cases: Array<[string, string]> = [
    ['tl', 'tl.to(".a", { x: 1 });'],
    ['.to/.from/.fromTo/.set', 'shot.go(".a", { x: 1 }).to(".b", { x: 2 });'],
    ['gsap', 'const t = gsap.timeline(); shot.go(".a", { x: 1 });'],
    ['plugin', 'MooTween.registerPlugin(ScrollTrigger); shot.go(".a", { x: 1 });'],
    ['duration', 'shot.go(".a", { x: 1, duration: 1 });'],
    ['delay', 'shot.go(".a", { x: 1, delay: 1 });'],
    ['ease', 'shot.go(".a", { x: 1, ease: "rush-out" });'],
    ['stagger', 'shot.go(".a", { x: 1, stagger: 0.1 });'],
    ['repeat', 'shot.go(".a", { x: 1, repeat: -1 });'],
    ['yoyo', 'shot.go(".a", { x: 1, yoyo: true });'],
    ['keyframes', 'shot.go(".a", { keyframes: [{ x: 1 }, { x: 2 }] });'],
    ['immediateRender', 'shot.travel(".a", { x: 0 }, { x: 1, immediateRender: false });'],
    ['onStart/onUpdate/onComplete', 'shot.go(".a", { x: 1, onUpdate: () => {} });'],
    ['rotation', 'shot.go(".a", { rotation: 90 });'],
    ['xPercent/yPercent', 'shot.go(".a", { xPercent: -50 });'],
    ['transformOrigin', 'shot.go(".a", { spin: 90, transformOrigin: "50% 50%" });'],
    ['autoAlpha', 'shot.go(".a", { autoAlpha: 0 });'],
    ['attr', 'shot.go(".a", { attr: { r: 4 } });'],
    ["'+=' / '-='", 'shot.go(".a", { x: "+=40" });'],
    ["posisi '<' / '>' / '+='", 'shot.go(".a", { x: 1 }, "<");'],
    ['curve lama', 'shot.go(".a", { x: 1, curve: "power2.out" });']
  ];

  for (const [api, js] of cases) {
    it(`rejects ${api} with the MooScript replacement`, () => {
      expect(findForeignApis(js)).toContain(api);
      const result = validateGeneratedScene(scene(js));
      expect(result.valid).toBe(false);
      const error = result.errors.find((e) => e.startsWith(`Bukan API MooScript: ${api} — `));
      expect(error).toBeDefined();
      expect(error!.split('—')[1].trim().length).toBeGreaterThan(10);
    });
  }

  it('accepts the MooScript API, MooTween.math and commented-out GSAP code', () => {
    const js = `// tl.to(".a", { duration: 1 }) and gsap.registerPlugin() were rewritten
const pick = (i) => MooTween.math.cycle([0, 90, 180], i);
shot.mark('hit', 0.4);
shot.travel('.a', { scale: 0.5 }, { scale: 1, spin: pick(1), dur: 0.6, curve: 'overshoot-out(1.7)' }, 0)
  .go('.b', { x: 'by(40)', cascade: { gap: 0.1, from: 'middle' } }, 'with+0.2')
  .arrive('.c', { fade: 0, y: 20, dur: 0.4, curve: 'spring-out(1, 0.4)' }, 'hit+0.1')
  .pin('.d', { attrs: { r: 4 }, pivot: '50% 50%' }, 'end');`;
    expect(findForeignApis(js)).toEqual([]);
    expect(validateGeneratedScene(scene(js)).valid).toBe(true);
  });

  it('keeps old code out of the security check so saved projects still load', () => {
    const legacy = 'gsap.registerPlugin(ScrollTrigger); tl.to(root, { x: 10, duration: 1 });';
    expect(validateSceneCode(scene(legacy)).valid).toBe(true);
    const project = structuredClone(DEMO_PROJECT_MOOTWEEN);
    project.composition!.scenes[0].buildJs = legacy;
    expect(() => parseProjectBackup(serializeProjectBackup(project))).not.toThrow();
  });

  it('syntax-checks code against the (shot, root, ctx, MooTween) parameters', () => {
    expect(validateSceneCode(scene('const sub = MooTween.track(); sub.go(root, { x: 1 }); shot.nest(sub, 0);')).valid).toBe(true);
  });
});

describe('MooScript API: linter', () => {
  it('warns about document-wide element lookups', () => {
    const lint = lintMographQuality(scene('const a = document.querySelector(".ring"); shot.go(a, { spin: 90 });'));
    expect(lint.issues.map((i) => i.id)).toContain('global-selector');
    const scoped = lintMographQuality(scene('shot.go(root.querySelector(".ring"), { spin: 90 }); shot.go(".dot", { x: 4 });'));
    expect(scoped.issues.map((i) => i.id)).not.toContain('global-selector');
  });
});

describe('MooScript API in prompts, runtime and docs', () => {
  const oldApi = /\btl\s*\.\s*(?:to|from|fromTo|set)\s*\(|\bgsap\.\w|[{,]\s*(?:duration|ease|stagger|repeat|yoyo|rotation|autoAlpha)\s*:|power[1-4]\./;

  it('teaches the AI only the MooScript API', () => {
    expect(MOOTWEEN_RUNTIME_RULES).toContain('=== MOOSCRIPT SCENE API (MooTween)');
    expect(MOOTWEEN_RUNTIME_RULES).toContain('ctx.kinetic');
    expect(MOTION_DIRECTOR_SYSTEM_PROMPT).toContain(MOOTWEEN_RUNTIME_RULES);
    expect(MOTION_DIRECTOR_SYSTEM_PROMPT).toContain('(shot, root, ctx, MooTween)');
    expect(MOTION_DIRECTOR_SYSTEM_PROMPT).not.toMatch(oldApi);
    const styleBrief = {
      adjectives: [], palette: { bg: '#000', primary: '#fff', accent: '#f59e0b', text: '#fff' },
      fontDisplay: 'Syne', fontBody: 'Plus Jakarta Sans', backgroundLanguage: '', motionSignature: ''
    };
    const prompt = buildSceneCodegenPrompt({
      beatIndex: 0,
      totalBeats: 1,
      narration: 'Satu ide',
      visualIntent: 'Ide menyebar',
      durationSec: 3,
      aspectRatio: '9:16',
      styleBrief,
      assignedAssets: [{ assetId: 'a1', assetName: 'Logo', dataUrl: 'data:image/png;base64,AA', role: 'logo' }]
    } as any);
    expect(prompt).toContain('MooTween');
    expect(prompt).not.toMatch(oldApi);
  });

  it('runs scene code with (shot, root, ctx, MooTween) and no gsap global', () => {
    const runtime = getRuntimeScript();
    expect(runtime).toContain("new Function('shot', 'root', 'ctx', 'MooTween', def.buildSrc)");
    expect(runtime).not.toMatch(/window\.gsap\b/);
  });

  it('moves an own MooTween.track() that is never nested onto shot', () => {
    const js = cleanGeneratedJs(`const anim = MooTween.track({ curve: 'linear' });
anim.go('.a', { x: 10 });`);
    expect(js).toContain("shot.go('.a'");
    expect(js).not.toContain('MooTween.track');
  });

  it('ships a guide example that passes validation', () => {
    expect(MOO_API_GUIDE.length).toBeGreaterThan(5);
    expect(findForeignApis(MOO_API_EXAMPLE)).toEqual([]);
    expect(validateGeneratedScene(scene(MOO_API_EXAMPLE)).valid).toBe(true);
  });

  it('documents every API name in README.md', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const missing = MOO_API_NAMES.filter((name) => !readme.includes(name));
    expect(missing).toEqual([]);
  });
});
