import { describe, it, expect } from 'vitest';
import {
  buildCompositionDocument,
  compileCompositionOverridesCss
} from '../src/engine/composition/buildDocument';
import { getRuntimeScript } from '../src/engine/composition/runtime/mooRuntime';
import type { MooProject } from '../src/types';

describe('Composition Document Builder', () => {
  it('correctly injects GSAP, MooRuntime, and scene definitions into srcdoc', () => {
    const mockProject: MooProject = {
      id: 'test-proj',
      title: 'Test Mograph',
      renderMode: 'composition',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: {
        bg: '#09090b',
        textPrimary: '#ffffff',
        textHighlight: '#84cc16',
        fontFamily: 'Jakarta',
        captionStyle: 'boxed',
        captionPosition: 'center',
        showSubtitles: false
      },
      scenes: [
        {
          id: 'sc-1',
          layout: 'KINETIC_QUOTE',
          narrationText: 'Hello world test',
          durationInSeconds: 3,
          wordTimestamps: [],
          motionPreset: 'punch_zoom',
          visualData: {}
        }
      ],
      audioDuration: 3,
      bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
      composition: {
        id: 'comp-1',
        width: 1080,
        height: 1920,
        fps: 30,
        globalCss: 'body { background: #09090b; }',
        scenes: [
          {
            beatId: 'sc-1',
            html: '<div class="test">Hello</div>',
            css: '.test { color: #84cc16; }',
            buildJs: 'tl.from(".test", { opacity: 0 });',
            status: 'ok',
            version: 1
          }
        ],
        createdAt: Date.now()
      }
    };

    const doc = buildCompositionDocument(mockProject);
    expect(doc).toContain('gsap');
    expect(doc).toContain('MOO.scene');
    expect(doc).toContain('Hello');
    expect(doc).toContain('.test { color: #84cc16; }');
    expect(doc).toContain('moo-stage');
    expect(doc).toContain('Content-Security-Policy');
    expect(doc).toContain("connect-src 'none'");
  });

  it('ensures getRuntimeScript() compiles without syntax or regex errors and includes try-catch frame capture', () => {
    const script = getRuntimeScript();
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('frame_error');
    expect(script).toContain('encodeURIComponent(svgString)');
  });

  it('correctly injects and handles scene transitions (fade, slide, zoom, wipe) in composition document and runtime', () => {
    const mockProject: MooProject = {
      id: 'test-trans-proj',
      title: 'Test Transitions',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: {
        bg: '#09090b',
        textPrimary: '#ffffff',
        textHighlight: '#84cc16',
        fontFamily: 'Jakarta',
        captionStyle: 'boxed',
        captionPosition: 'center'
      },
      scenes: [
        { id: 'sc-1', narrationText: 'Scene 1', durationInSeconds: 3, wordTimestamps: [], transition: 'fade' },
        { id: 'sc-2', narrationText: 'Scene 2', durationInSeconds: 3, wordTimestamps: [], transition: 'slide' }
      ],
      audioDuration: 6,
      composition: {
        id: 'comp-trans',
        width: 1080,
        height: 1920,
        fps: 30,
        scenes: [
          { beatId: 'sc-1', html: '<div>1</div>', css: '', buildJs: 'tl.to(".x", {});', status: 'ok', version: 1 },
          { beatId: 'sc-2', html: '<div>2</div>', css: '', buildJs: 'tl.to(".y", {});', status: 'ok', version: 1 }
        ],
        createdAt: Date.now()
      }
    };

    const doc = buildCompositionDocument(mockProject);
    expect(doc).toContain('"transition":"fade"');
    expect(doc).toContain('"transition":"slide"');

    const runtime = getRuntimeScript();
    expect(runtime).toContain("transitionType === 'fade'");
    expect(runtime).toContain("transitionType === 'slide'");
    expect(runtime).toContain("transitionType === 'zoom'");
    expect(runtime).toContain("transitionType === 'wipe'");
  });

  it('keeps the editor document stable when only layer overrides change', () => {
    const base: MooProject = {
      id: 'drag-proj',
      title: 'Drag',
      renderMode: 'composition',
      aspectRatio: '9:16',
      fps: 30,
      width: 1080,
      height: 1920,
      theme: {
        bg: '#09090b',
        textPrimary: '#ffffff',
        textHighlight: '#84cc16',
        fontFamily: 'Jakarta',
        captionStyle: 'boxed',
        captionPosition: 'center',
        showSubtitles: false
      },
      scenes: [
        {
          id: 'sc-1',
          layout: 'KINETIC_QUOTE',
          narrationText: 'Drag me',
          durationInSeconds: 3,
          wordTimestamps: [],
          motionPreset: 'punch_zoom',
          visualData: {}
        }
      ],
      audioDuration: 3,
      bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
      composition: {
        id: 'comp-drag',
        width: 1080,
        height: 1920,
        fps: 30,
        globalCss: '',
        scenes: [
          {
            beatId: 'sc-1',
            html: '<h1 data-moo-layer="title">Drag me</h1>',
            css: '',
            buildJs: 'tl.from("h1", { opacity: 0 });',
            status: 'ok',
            version: 1
          }
        ],
        createdAt: 1
      }
    };
    const moved: MooProject = {
      ...base,
      composition: {
        ...base.composition!,
        updatedAt: 2,
        scenes: [{ ...base.composition!.scenes[0], userEdited: true, overrides: { title: { x: 120, y: -40 } } }]
      }
    };

    // Same string => React keeps srcDoc and the iframe is not reloaded mid-drag.
    expect(buildCompositionDocument(moved, { omitOverrides: true })).toBe(
      buildCompositionDocument(base, { omitOverrides: true })
    );
    // The full document (export path) still bakes the override in.
    expect(buildCompositionDocument(moved)).toContain('translate: 120px -40px');

    // Live editor CSS must beat the inline `translate: none` GSAP writes after parsing a layer.
    const css = compileCompositionOverridesCss(moved.composition, { important: true });
    expect(css).toContain('#scene-sc-1 [data-moo-layer="title"]');
    expect(css).toContain('translate: 120px -40px !important');
    expect(compileCompositionOverridesCss(moved.composition)).not.toContain('!important');

    const runtime = getRuntimeScript();
    expect(runtime).toContain("data.type === 'set_override_css'");
    // All tweens are initialized before 'ready', so later overrides are never folded into GSAP transforms.
    expect(runtime.indexOf('masterTl.progress(1, true)')).toBeLessThan(runtime.indexOf("type: 'ready'"));
  });
});
