import { describe, it, expect } from 'vitest';
import { scopeCss } from '../src/engine/composition/scopeCss';
import { buildCompositionDocument, getProjectPalette } from '../src/engine/composition/buildDocument';
import { compileProceduralScene } from '../src/engine/composition/proceduralCompiler';
import { lintMographQuality } from '../src/engine/composition/mographLint';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import { tryParseAndValidate } from '../src/engine/ai/llm';
import { buildSceneGenerationContext, sceneToStoryBeat } from '../src/engine/ai/director/directorPipeline';
import { buildSceneCodegenPrompt } from '../src/engine/ai/director/motionLaws';
import { applyWorldBible } from '../src/store/slices/scriptSlice';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import type { MooProject, Scene } from '../src/types';

const shot = (id: string, extra: Partial<Scene> = {}): Scene => ({
  id,
  narrationText: `Narasi ${id}`,
  durationInSeconds: 3,
  wordTimestamps: [],
  visualIntent: `Visual ${id}`,
  ...extra
});

describe('scopeCss', () => {
  const scope = '#scene-a';

  it('prefixes every selector with a zero-specificity scene scope', () => {
    const out = scopeCss('.moo-camera { inset: 0; } .a, .b > .c { color: red; }', scope);
    expect(out).toContain(':where(#scene-a) .moo-camera {');
    expect(out).toContain(':where(#scene-a) .a, :where(#scene-a) .b > .c {');
  });

  it('maps document-level selectors onto the scene wrapper', () => {
    const out = scopeCss(':root { --x: 1; } body .t { color: red; } html body { margin: 0; } * { box-sizing: border-box; }', scope);
    expect(out).toContain(':where(#scene-a) {');
    expect(out).toContain(':where(#scene-a) .t {');
    expect(out).not.toMatch(/\bbody\b|\bhtml\b|:root/);
    expect(out).toContain(':where(#scene-a) * {');
  });

  it('keeps commas inside :is() and attribute strings intact', () => {
    const out = scopeCss(':is(.a, .b) .c, [data-x="1,2"] { opacity: 1; }', scope);
    expect(out).toContain(':where(#scene-a) :is(.a, .b) .c, :where(#scene-a) [data-x="1,2"] {');
  });

  it('recurses into @media and leaves @keyframes untouched', () => {
    const out = scopeCss('@media (min-width: 10px) { .a { color: red; } } @keyframes spin { from { opacity: 0 } to { opacity: 1 } }', scope);
    expect(out).toContain('@media (min-width: 10px) {');
    expect(out).toContain(':where(#scene-a) .a {');
    expect(out).toContain('@keyframes spin { from { opacity: 0 } to { opacity: 1 } }');
  });

  it('survives braces inside strings and comments', () => {
    const out = scopeCss('/* { not a rule } */ .q::after { content: "}"; } .r { color: blue; }', scope);
    expect(out).toContain(':where(#scene-a) .q::after { content: "}"; }');
    expect(out).toContain(':where(#scene-a) .r {');
  });
});

describe('Composition document: scoping, flow transition, world palette', () => {
  const makeProject = (): MooProject => {
    const scenes = [shot('s1'), shot('s2')];
    return {
      ...INITIAL_PROJECT,
      scenes,
      styleBrief: {
        adjectives: [],
        palette: { bg: '#0b1020', primary: '#38bdf8', accent: '#f59e0b', text: '#f8fafc' },
        fontDisplay: '',
        fontBody: '',
        backgroundLanguage: '',
        motionSignature: ''
      },
      composition: {
        id: 'c',
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 6,
        globalCss: '',
        createdAt: 0,
        scenes: scenes.map((sc, i) => ({
          id: sc.id,
          beatId: sc.id,
          duration: 3,
          html: `<div class="scene-s${i + 1}"><div class="moo-camera" data-moo-layer="camera"></div></div>`,
          css: `.moo-camera { transform-origin: ${i === 0 ? '10%' : '90%'} 50%; }`,
          buildJs: 'tl.to(root, { x: 1, duration: 1 }, 0);',
          status: 'ok' as const,
          version: 1,
          userEdited: false
        }))
      }
    };
  };

  it('scopes each scene stylesheet to its own wrapper so shared class names cannot collide', () => {
    const doc = buildCompositionDocument(makeProject());
    expect(doc).toContain(':where(#scene-s1) .moo-camera { transform-origin: 10% 50%; }');
    expect(doc).toContain(':where(#scene-s2) .moo-camera { transform-origin: 90% 50%; }');
  });

  it('defaults to the overlapping flow transition', () => {
    const doc = buildCompositionDocument(makeProject());
    expect(doc).toContain('transition: "flow"');
    expect(getRuntimeScript()).toContain("transitionType === 'flow'");
  });

  it('uses the world bible primary for --moo-primary', () => {
    const project = makeProject();
    expect(getProjectPalette(project).primary).toBe('#38bdf8');
    expect(getProjectPalette({ theme: project.theme }).primary).toBe(project.theme.textPrimary);
  });
});

describe('Shot-list storyboard and world bible', () => {
  const raw = JSON.stringify({
    title: 'Air',
    targetDuration: 20,
    worldBible: {
      palette: { bg: '#04121f', primary: '#22d3ee', accent: 'not-a-color', text: '#e0f2fe' },
      motif: 'setetes air bercahaya',
      visualLanguage: 'garis tipis, bentuk datar, cahaya lembut',
      cameraStyle: 'mengikuti tetesan dari atas'
    },
    scenes: [
      { narration: 'Semua dimulai dari setetes air.', visualIntent: 'Tetesan jatuh', heroObject: 'tetesan air', matchCut: 'tetesan menjadi riak lingkaran', durationHint: 3 },
      { narration: 'Riaknya menyebar ke seluruh danau.', visualIntent: 'Riak melebar', heroObject: 'riak air', matchCut: 'riak menjadi orbit planet', durationHint: 3 }
    ]
  });

  it('parses the world bible and shot fields, dropping invalid colors', () => {
    const parsed = tryParseAndValidate(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.worldBible?.motif).toBe('setetes air bercahaya');
    expect(parsed.data.worldBible?.palette?.primary).toBe('#22d3ee');
    expect(parsed.data.worldBible?.palette?.accent).toBeUndefined();
    expect(parsed.data.scenes[0].heroObject).toBe('tetesan air');
    expect(parsed.data.scenes[0].matchCut).toBe('tetesan menjadi riak lingkaran');
  });

  it('applies the world bible to the theme and style brief', () => {
    const parsed = tryParseAndValidate(raw);
    if (!parsed.success) throw new Error('parse failed');
    const project = applyWorldBible(INITIAL_PROJECT, parsed.data.worldBible);
    expect(project.theme.bg).toBe('#04121f');
    expect(project.theme.textPrimary).toBe('#e0f2fe');
    // Invalid accent keeps the existing theme highlight
    expect(project.theme.textHighlight).toBe(INITIAL_PROJECT.theme.textHighlight);
    expect(project.styleBrief?.motif).toBe('setetes air bercahaya');
    expect(project.styleBrief?.palette.primary).toBe('#22d3ee');
    expect(project.styleBrief?.motionSignature).toBe('mengikuti tetesan dari atas');
    expect(applyWorldBible(INITIAL_PROJECT, undefined)).toBe(INITIAL_PROJECT);
  });
});

describe('Shot continuity in scene generation', () => {
  const project: MooProject = {
    ...INITIAL_PROJECT,
    theme: { ...INITIAL_PROJECT.theme, bg: '#04121f', textHighlight: '#84cc16', textPrimary: '#e0f2fe' },
    styleBrief: {
      adjectives: [],
      palette: { bg: '#04121f', primary: '#22d3ee', accent: '#f472b6', text: '#e0f2fe' },
      fontDisplay: '',
      fontBody: '',
      backgroundLanguage: 'garis tipis',
      motionSignature: 'mengikuti tetesan',
      motif: 'setetes air bercahaya'
    },
    scenes: [
      shot('a', { heroObject: 'tetesan', matchCut: 'tetesan menjadi riak' }),
      shot('b', { heroObject: 'riak', matchCut: 'riak menjadi orbit', cameraIntent: 'orbit', camera: 'zoom_in' as any }),
      shot('c', { heroObject: 'planet' })
    ]
  };

  it('gives a shot its neighbours, the incoming match cut and the world bible', () => {
    const ctx = buildSceneGenerationContext(project, 1, 'Syne');
    expect(ctx.previousSceneSummary).toBe('Visual a (subjek: tetesan)');
    expect(ctx.nextSceneSummary).toBe('Visual c (subjek: planet)');
    expect(ctx.incomingMatchCut).toBe('tetesan menjadi riak');
    expect(ctx.styleBrief.motif).toBe('setetes air bercahaya');
    expect(ctx.styleBrief.palette.primary).toBe('#22d3ee');
    // The lime UI default is never passed on as the film's accent
    expect(ctx.styleBrief.palette.accent).toBe('');
    expect(buildSceneGenerationContext(project, 0, 'Syne').incomingMatchCut).toBeUndefined();
  });

  it('reads cameraIntent from the storyboard before the legacy camera field', () => {
    const beat = sceneToStoryBeat(project.scenes[1]);
    expect(beat.cameraIntent).toBe('orbit');
    expect(beat.heroObject).toBe('riak');
    expect(beat.matchCut).toBe('riak menjadi orbit');
  });

  it('writes the world, hero object and both match cuts into the shot prompt', () => {
    const ctx = buildSceneGenerationContext(project, 1, 'Syne');
    const beat = sceneToStoryBeat(project.scenes[1]);
    const prompt = buildSceneCodegenPrompt({
      beatIndex: 1,
      totalBeats: 3,
      narration: beat.narration,
      visualIntent: beat.visualIntent,
      durationSec: 3,
      aspectRatio: '9:16',
      heroObject: beat.heroObject,
      matchCut: beat.matchCut,
      incomingMatchCut: ctx.incomingMatchCut,
      previousSceneSummary: ctx.previousSceneSummary,
      nextSceneSummary: ctx.nextSceneSummary,
      styleBrief: ctx.styleBrief
    });
    expect(prompt).toContain('=== DUNIA FILM');
    expect(prompt).toContain('setetes air bercahaya');
    expect(prompt).toContain('Subjek utama shot');
    expect(prompt).toContain('DIBUKA dari hand-off shot sebelumnya: "tetesan menjadi riak"');
    expect(prompt).toContain('DITUTUP dengan: "riak menjadi orbit"');
  });
});

describe('Procedural archetypes move like shots', () => {
  const archetypes = [
    'stat-counter', 'code-terminal', 'split-versus', 'bento-list',
    'chart-data', 'social-quote', 'glass-spotlight', 'kinetic-impact'
  ] as const;

  it.each(archetypes)('%s has a camera layer, camera move, hand-off and a visible frame 0', (archetype) => {
    const sc = shot('p1', { narrationText: 'Produktivitas naik 40% dalam 3 langkah sederhana setiap hari' });
    const mod = compileProceduralScene(sc, 0, 3, undefined, archetype);
    expect(mod.html).toContain('class="moo-camera" data-moo-layer="camera"');
    expect(mod.buildJs).toContain("ctx.camera({ move: 'push', handoff: 'zoom' })");
    expect(mod.css).not.toContain('rgba(132, 204, 22');
    const ids = lintMographQuality(mod).issues.map((i) => i.id);
    expect(ids).not.toContain('no-camera');
    expect(ids).not.toContain('static-camera');
    expect(ids).not.toContain('no-handoff');
    expect(ids).not.toContain('empty-first-frame');
  });

  it('keeps the poster layer visible at t=0', () => {
    const mod = compileProceduralScene(shot('p2'), 0, 1, undefined, 'stat-counter');
    expect(mod.buildJs).toMatch(/\.fromTo\(card, \{ y: 60, scale: 0\.92, opacity: 1 \}/);
  });
});
