import { describe, expect, it } from 'vitest';
import {
  findUnsupportedTimelineApis,
  validateGeneratedScene,
  validateSceneCode
} from '../src/engine/composition/validator';
import { lintMographQuality } from '../src/engine/composition/mographLint';
import { cleanGeneratedJs } from '../src/engine/ai/director/directorPipeline';
import { MOOTWEEN_RUNTIME_RULES, MOTION_DIRECTOR_SYSTEM_PROMPT, buildSceneCodegenPrompt } from '../src/engine/ai/director/motionLaws';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { parseProjectBackup, serializeProjectBackup } from '../src/db/projectBackup';
import { DEMO_PROJECT } from './fixtures/demoProject';

const scene = (buildJs: string) => ({ html: '<div class="s"><svg></svg></div>', css: '.s{}', buildJs });

describe('MooTween subset: validator', () => {
  const cases: Array<[string, string]> = [
    ['registerPlugin', 'gsap.registerPlugin(MotionPathPlugin); tl.to(".a", { x: 1 });'],
    ['ScrollTrigger', 'tl.to(".a", { x: 1, scrollTrigger: ".a" });'],
    ['MotionPathPlugin', 'tl.to(".a", { motionPath: { path: "#p" } });'],
    ['MorphSVG', 'tl.to(".a", { morphSVG: ".b" });'],
    ['SplitText', 'const s = new SplitText(".t"); tl.from(s.chars, { y: 20 });'],
    ['DrawSVGPlugin', 'tl.from(".p", { drawSVG: 0 });'],
    ['Draggable', 'Draggable.create(".a"); tl.to(".a", { x: 1 });'],
    ['ticker.add', 'gsap.ticker.add(() => {}); tl.to(".a", { x: 1 });'],
    ['context', 'MooTween.context(() => { tl.to(".a", { x: 1 }); });'],
    ['quickTo', 'const q = gsap.quickTo(".a", "x"); tl.to(".a", { x: 1 });'],
    ['quickSetter', 'const s = gsap.quickSetter(".a", "x", "px"); tl.to(".a", { x: 1 });'],
    ['matchMedia', 'gsap.matchMedia().add("(min-width: 1px)", () => {}); tl.to(".a", { x: 1 });']
  ];

  for (const [api, js] of cases) {
    it(`rejects ${api} with a repair hint`, () => {
      expect(findUnsupportedTimelineApis(js)).toContain(api);
      const result = validateGeneratedScene(scene(js));
      expect(result.valid).toBe(false);
      const error = result.errors.find((e) => e.includes(api));
      expect(error).toMatch(/^API di luar MooTween: /);
      expect(error!.split('—')[1].trim().length).toBeGreaterThan(10);
    });
  }

  it('accepts the subset, the MooTween utils and commented-out plugin code', () => {
    const js = `// gsap.registerPlugin(ScrollTrigger) was removed
const pick = MooTween.utils.wrap([0, 90, 180]);
tl.fromTo('.a', { scale: 0.5 }, { scale: 1, rotation: pick(1), duration: 0.6, ease: 'back.out(1.7)' }, 0)
  .to('.b', { x: '+=40', stagger: { each: 0.1, from: 'center' } }, '<0.2');`;
    expect(findUnsupportedTimelineApis(js)).toEqual([]);
    expect(validateGeneratedScene(scene(js)).valid).toBe(true);
  });

  it('keeps security validation separate so saved projects still load', () => {
    const legacy = 'gsap.registerPlugin(ScrollTrigger); tl.to(root, { x: 10 });';
    expect(validateSceneCode(scene(legacy)).valid).toBe(true);
    const project = structuredClone(DEMO_PROJECT);
    project.composition!.scenes[0].buildJs = legacy;
    expect(() => parseProjectBackup(serializeProjectBackup(project))).not.toThrow();
  });

  it('syntax-checks code that names the engine MooTween', () => {
    expect(validateSceneCode(scene('const MooTween = window.MooTween; MooTween.utils.clamp(0, 1, 2); tl.to(root, { x: 1 });')).valid).toBe(true);
  });
});

describe('MooTween subset: linter', () => {
  it('warns about document-wide element lookups', () => {
    const lint = lintMographQuality(scene('const a = document.querySelector(".ring"); tl.to(a, { rotation: 90 });'));
    expect(lint.issues.map((i) => i.id)).toContain('global-selector');
    const scoped = lintMographQuality(scene('tl.to(root.querySelector(".ring"), { rotation: 90 }); tl.to(".dot", { x: 4 });'));
    expect(scoped.issues.map((i) => i.id)).not.toContain('global-selector');
  });
});

describe('MooTween naming in prompts and runtime', () => {
  it('teaches MooTween, never GSAP', () => {
    expect(MOTION_DIRECTOR_SYSTEM_PROMPT).toContain('MOOTWEEN TIMELINE');
    expect(MOTION_DIRECTOR_SYSTEM_PROMPT).toContain('(tl, root, ctx, MooTween)');
    expect(MOOTWEEN_RUNTIME_RULES).toContain('ctx.kinetic');
    expect(MOTION_DIRECTOR_SYSTEM_PROMPT).not.toMatch(/gsap/i);
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
    expect(prompt).not.toMatch(/gsap/i);
  });

  it('passes the engine to scene code as MooTween and keeps gsap for older scenes', () => {
    const runtime = getRuntimeScript();
    expect(runtime).toContain("new Function('tl', 'root', 'ctx', 'MooTween', 'gsap', def.buildSrc)");
  });

  it('normalizes MooTween.timeline() redeclarations to tl', () => {
    const js = cleanGeneratedJs(`const anim = MooTween.timeline({ defaults: { ease: 'none' } });
anim.to('.a', { x: 10 });`);
    expect(js).toContain("tl.to('.a'");
    expect(js).not.toContain('MooTween.timeline');
  });
});
