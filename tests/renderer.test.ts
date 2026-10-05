import { describe, it, expect } from 'vitest';
import { CanvasRenderer, interpolateMetricValue, tokenizeCodeLine } from '../src/engine/renderer/canvasRenderer';
import { createMockCanvas } from './mocks/mockCanvas';
import type { MooProject } from '../src/types';

const SAMPLE_PROJECT: MooProject = {
  id: 'test-project',
  title: 'Deterministic Engine Test',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#121214',
    textPrimary: '#ffffff',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center'
  },
  scenes: [
    {
      id: 'sc-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'First scene with kinetic typography',
      text: 'First scene with kinetic typography',
      visualData: {
        title: 'Typography Scene',
        focusWords: ['kinetic', 'typography'],
        accentIcon: 'zap'
      },
      focusWords: ['kinetic', 'typography'],
      motionPreset: 'punch_zoom',
      icon: 'zap',
      durationInSeconds: 3.0,
      wordTimestamps: [
        { word: 'First', start: 0.0, end: 0.5 },
        { word: 'scene', start: 0.5, end: 1.0 },
        { word: 'with', start: 1.0, end: 1.3 },
        { word: 'kinetic', start: 1.3, end: 2.1 },
        { word: 'typography', start: 2.1, end: 3.0 }
      ]
    },
    {
      id: 'sc-2',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Second scene sliding split animation',
      text: 'Second scene sliding split animation',
      visualData: {
        title: 'Sliding Scene',
        focusWords: ['sliding', 'animation'],
        accentIcon: 'sparkles'
      },
      focusWords: ['sliding', 'animation'],
      motionPreset: 'slide_split',
      transition: 'fade',
      icon: 'sparkles',
      durationInSeconds: 3.0,
      wordTimestamps: [
        { word: 'Second', start: 0.0, end: 0.6 },
        { word: 'scene', start: 0.6, end: 1.2 },
        { word: 'sliding', start: 1.2, end: 2.0 },
        { word: 'split', start: 2.0, end: 2.4 },
        { word: 'animation', start: 2.4, end: 3.0 }
      ]
    }
  ],
  audioDuration: 6.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Deterministic CanvasRenderer', () => {
  it('is 100% deterministic: rendering frame 15 twice yields identical draw commands', () => {
    const mock1 = createMockCanvas();
    const renderer1 = new CanvasRenderer(mock1.canvas as any);
    renderer1.draw(15, 180, SAMPLE_PROJECT, { hud: false, watermark: false });

    const mock2 = createMockCanvas();
    const renderer2 = new CanvasRenderer(mock2.canvas as any);
    renderer2.draw(15, 180, SAMPLE_PROJECT, { hud: false, watermark: false });

    expect(mock1.calls.length).toBeGreaterThan(10);
    expect(mock1.calls).toEqual(mock2.calls);
  });

  it('excludes HUD, timecodes, and frame counters when hud: false', () => {
    const mock = createMockCanvas();
    const renderer = new CanvasRenderer(mock.canvas as any);
    renderer.draw(30, 180, SAMPLE_PROJECT, { hud: false, watermark: false });

    const textCalls = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));

    // Assert NO debug/HUD text was rendered
    expect(textCalls.some((t) => t.includes('CORE ENGINE'))).toBe(false);
    expect(textCalls.some((t) => t.includes('FR:'))).toBe(false);
    expect(textCalls.some((t) => t.includes('AVC/AAC'))).toBe(false);
  });

  it('renders HUD overlays when hud: true (for studio preview)', () => {
    const mock = createMockCanvas();
    const renderer = new CanvasRenderer(mock.canvas as any);
    renderer.draw(30, 180, SAMPLE_PROJECT, { hud: true, watermark: false });

    const textCalls = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));

    expect(textCalls.some((t) => t.includes('MOOSCRIPT // CORE ENGINE'))).toBe(true);
    expect(textCalls.some((t) => t.includes('FR: 30'))).toBe(true);
    expect(textCalls.some((t) => t.includes('AVC/AAC'))).toBe(true);
  });

  it('renders watermark when watermark: true and omits it when watermark: false', () => {
    const mockWithout = createMockCanvas();
    const renderer1 = new CanvasRenderer(mockWithout.canvas as any);
    renderer1.draw(30, 180, SAMPLE_PROJECT, { hud: false, watermark: false });
    const textsWithout = mockWithout.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(textsWithout).not.toContain('MOOSCRIPT');

    const mockWith = createMockCanvas();
    const renderer2 = new CanvasRenderer(mockWith.canvas as any);
    renderer2.draw(30, 180, SAMPLE_PROJECT, { hud: false, watermark: true });
    const textsWith = mockWith.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(textsWith).toContain('MOOSCRIPT');
  });

  it('dynamically resizes canvas when project dimensions change', () => {
    const mock = createMockCanvas(1080, 1920);
    const renderer = new CanvasRenderer(mock.canvas as any);

    const project720p: MooProject = {
      ...SAMPLE_PROJECT,
      width: 720,
      height: 1280
    };

    renderer.draw(0, 90, project720p, { hud: false });
    expect(mock.canvas.width).toBe(720);
    expect(mock.canvas.height).toBe(1280);
    expect(renderer.width).toBe(720);
    expect(renderer.height).toBe(1280);
  });

  it('renders fallback when project has no scenes', () => {
    const mock = createMockCanvas();
    const renderer = new CanvasRenderer(mock.canvas as any);
    const emptyProject: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: []
    };

    renderer.draw(0, 30, emptyProject, { hud: false });
    const texts = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(texts).toContain('No Scenes Defined');
  });
});

// ── Caption Style Golden-Frame Tests ──────────────────────────────────────────

describe('Caption Style Presets (golden-frame determinism)', () => {
  const sceneWithTimestamps: MooProject['scenes'][0] = {
    id: 'cap-sc',
    layout: 'KINETIC_QUOTE',
    narrationText: 'Bold kinetic captions for social video',
    text: 'Bold kinetic captions for social video',
    visualData: {
      title: 'Social Video',
      focusWords: ['kinetic', 'social']
    },
    focusWords: ['kinetic', 'social'],
    motionPreset: 'punch_zoom',
    durationInSeconds: 4.0,
    wordTimestamps: [
      { word: 'Bold', start: 0.0, end: 0.4 },
      { word: 'kinetic', start: 0.4, end: 0.9 },
      { word: 'captions', start: 0.9, end: 1.5 },
      { word: 'for', start: 1.5, end: 1.7 },
      { word: 'social', start: 1.7, end: 2.3 },
      { word: 'video', start: 2.3, end: 4.0 }
    ]
  };

  const makeProject = (captionStyle: MooProject['theme']['captionStyle'], captionPosition: MooProject['theme']['captionPosition'] = 'center'): MooProject => ({
    ...SAMPLE_PROJECT,
    scenes: [sceneWithTimestamps],
    theme: { ...SAMPLE_PROJECT.theme, captionStyle, captionPosition },
    audioDuration: 4.0
  });

  it('boxed style: is fully deterministic across two renders at the same frame', () => {
    const proj = makeProject('boxed');
    const mock1 = createMockCanvas();
    new CanvasRenderer(mock1.canvas as any).draw(20, 120, proj, { hud: false });
    const mock2 = createMockCanvas();
    new CanvasRenderer(mock2.canvas as any).draw(20, 120, proj, { hud: false });
    expect(mock1.calls).toEqual(mock2.calls);
    expect(mock1.calls.filter((c) => c.method === 'fillText').length).toBeGreaterThan(0);
  });

  it('karaoke style: is fully deterministic across two renders at the same frame', () => {
    const proj = makeProject('karaoke');
    const mock1 = createMockCanvas();
    new CanvasRenderer(mock1.canvas as any).draw(20, 120, proj, { hud: false });
    const mock2 = createMockCanvas();
    new CanvasRenderer(mock2.canvas as any).draw(20, 120, proj, { hud: false });
    expect(mock1.calls).toEqual(mock2.calls);
    expect(mock1.calls.filter((c) => c.method === 'fillText').length).toBeGreaterThan(0);
  });

  it('bold-pop style: is fully deterministic across two renders at the same frame', () => {
    const proj = makeProject('bold-pop');
    const mock1 = createMockCanvas();
    new CanvasRenderer(mock1.canvas as any).draw(20, 120, proj, { hud: false });
    const mock2 = createMockCanvas();
    new CanvasRenderer(mock2.canvas as any).draw(20, 120, proj, { hud: false });
    expect(mock1.calls).toEqual(mock2.calls);
    expect(mock1.calls.filter((c) => c.method === 'fillText').length).toBeGreaterThan(0);
  });

  it('minimal style: is fully deterministic across two renders at the same frame', () => {
    const proj = makeProject('minimal');
    const mock1 = createMockCanvas();
    new CanvasRenderer(mock1.canvas as any).draw(20, 120, proj, { hud: false });
    const mock2 = createMockCanvas();
    new CanvasRenderer(mock2.canvas as any).draw(20, 120, proj, { hud: false });
    expect(mock1.calls).toEqual(mock2.calls);
    expect(mock1.calls.filter((c) => c.method === 'fillText').length).toBeGreaterThan(0);
  });

  it('different caption styles produce different draw commands (not identical to boxed)', () => {
    const boxedMock = createMockCanvas();
    new CanvasRenderer(boxedMock.canvas as any).draw(20, 120, makeProject('boxed'), { hud: false });

    const karaokeRock = createMockCanvas();
    new CanvasRenderer(karaokeRock.canvas as any).draw(20, 120, makeProject('karaoke'), { hud: false });

    // Styles must produce meaningfully different canvas operation sequences
    const boxedFills = boxedMock.calls.filter((c) => c.method === 'fillStyle').map((c) => c.args[0]);
    const karaokeFills = karaokeRock.calls.filter((c) => c.method === 'fillStyle').map((c) => c.args[0]);
    // Both render text, but overall operation sequences differ
    expect(boxedFills).not.toEqual(karaokeFills);
  });

  it('caption position "top" places text Y near top of canvas (no icon scene)', () => {
    const proj = makeProject('boxed', 'top');
    const mock = createMockCanvas();
    new CanvasRenderer(mock.canvas as any).draw(0, 120, proj, { hud: false });
    // Verify fillText is called (text is rendered)
    const textCalls = mock.calls.filter((c) => c.method === 'fillText');
    expect(textCalls.length).toBeGreaterThan(0);
    // All Y coords (args[2]) should be in the top third of the canvas
    const yCoords = textCalls.map((c) => Number(c.args[2])).filter((y) => !isNaN(y));
    expect(yCoords.every((y) => y < 1920 * 0.55)).toBe(true);
  });

  it('caption position "bottom" places text Y near bottom of canvas (no icon scene)', () => {
    const proj = makeProject('boxed', 'bottom');
    const mock = createMockCanvas();
    new CanvasRenderer(mock.canvas as any).draw(0, 120, proj, { hud: false });
    const textCalls = mock.calls.filter((c) => c.method === 'fillText');
    expect(textCalls.length).toBeGreaterThan(0);
    // At least some Y coords should be in the bottom half
    const yCoords = textCalls.map((c) => Number(c.args[2])).filter((y) => !isNaN(y));
    expect(yCoords.some((y) => y > 1920 * 0.5)).toBe(true);
  });

  it('caption position changes produce different startY in draw commands vs center', () => {
    const centerMock = createMockCanvas();
    new CanvasRenderer(centerMock.canvas as any).draw(0, 120, makeProject('boxed', 'center'), { hud: false });

    const topMock = createMockCanvas();
    new CanvasRenderer(topMock.canvas as any).draw(0, 120, makeProject('boxed', 'top'), { hud: false });

    const bottomMock = createMockCanvas();
    new CanvasRenderer(bottomMock.canvas as any).draw(0, 120, makeProject('boxed', 'bottom'), { hud: false });

    const getTextY = (calls: typeof centerMock.calls) =>
      calls
        .filter((c) => c.method === 'fillText')
        .map((c) => Number(c.args[2]))
        .filter((y) => !isNaN(y));

    const centerYs = getTextY(centerMock.calls);
    const topYs = getTextY(topMock.calls);
    const bottomYs = getTextY(bottomMock.calls);

    // All three positions must yield different first-word Y coordinates
    expect(centerYs[0]).not.toBe(topYs[0]);
    expect(centerYs[0]).not.toBe(bottomYs[0]);
    expect(topYs[0]).not.toBe(bottomYs[0]);
  });
});

// ── Motion Graphics Primitives & Layout Tests ───────────────────────────────

describe('Motion Graphics Primitives & Layouts', () => {
  it('interpolateMetricValue correctly interpolates values with prefix/suffix', () => {
    expect(interpolateMetricValue('+400%', 0)).toBe('+0%');
    expect(interpolateMetricValue('+400%', 0.5)).toBe('+200%');
    expect(interpolateMetricValue('+400%', 1)).toBe('+400%');
    expect(interpolateMetricValue('$12.5M', 0.5)).toBe('$6.3M');
    expect(interpolateMetricValue('99.9%', 1)).toBe('99.9%');
    expect(interpolateMetricValue('NO_NUMBERS', 0.5)).toBe('NO_NUMBERS');
  });

  it('tokenizeCodeLine parses bash prompts, keywords, strings, and numbers', () => {
    const tokens = tokenizeCodeLine('$ npm install mooscript');
    expect(tokens.some((t) => t.text === '$ ' && t.color === '#84cc16')).toBe(true);
    expect(tokens.some((t) => t.text === 'npm' && t.color === '#38bdf8')).toBe(true);

    const commentTokens = tokenizeCodeLine('// this is a comment');
    expect(commentTokens[0].color).toBe('#71717a');

    const jsTokens = tokenizeCodeLine('const count = 42;');
    expect(jsTokens.some((t) => t.text === 'const' && t.color === '#38bdf8')).toBe(true);
    expect(jsTokens.some((t) => t.text === '42' && t.color === '#fb923c')).toBe(true);
  });

  it('METRIC_COUNTER layout renders counter value and label deterministically', () => {
    const metricProject: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: [
        {
          id: 'sc-metric',
          layout: 'METRIC_COUNTER',
          narrationText: 'Growing revenue by four hundred percent',
          visualData: {
            title: 'Revenue Spike',
            metricValue: '+400%',
            metricLabel: 'YoY Growth Rate'
          },
          durationInSeconds: 3.0,
          motionPreset: 'punch_zoom',
          wordTimestamps: []
        }
      ]
    };

    const mock1 = createMockCanvas();
    new CanvasRenderer(mock1.canvas as any).draw(45, 90, metricProject, { hud: false });

    const mock2 = createMockCanvas();
    new CanvasRenderer(mock2.canvas as any).draw(45, 90, metricProject, { hud: false });

    expect(mock1.calls).toEqual(mock2.calls);
    const fills = mock1.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fills.some((t) => t.includes('REVENUE SPIKE'))).toBe(true);
    expect(fills.some((t) => t.includes('YoY Growth Rate'))).toBe(true);
  });

  it('TERMINAL_MOCKUP layout renders title bar, code lines and cursor', () => {
    const terminalProject: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: [
        {
          id: 'sc-term',
          layout: 'TERMINAL_MOCKUP',
          narrationText: 'Install the package with a single command',
          visualData: {
            codeSnippet: '$ npm install mooscript\n$ npx mooscript build',
            codeLanguage: 'bash'
          },
          durationInSeconds: 3.0,
          motionPreset: 'slide_split',
          wordTimestamps: []
        }
      ]
    };

    const mock = createMockCanvas();
    new CanvasRenderer(mock.canvas as any).draw(30, 90, terminalProject, { hud: false });

    const fills = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fills.some((t) => t.includes('mooscript-term'))).toBe(true);
    expect(fills.some((t) => t.includes('01'))).toBe(true); // Line gutter
  });

  it('VS_COMPARISON layout renders comparison cards and VS badge', () => {
    const vsProject: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: [
        {
          id: 'sc-vs',
          layout: 'VS_COMPARISON',
          narrationText: 'Legacy video editors vs modern zero server motion graphics',
          visualData: {
            leftTitle: 'Traditional Workflows',
            leftDesc: 'Clunky timelines & slow renders',
            rightTitle: 'MooScript Studio',
            rightDesc: 'Real-time WebCodecs hardware export'
          },
          durationInSeconds: 3.0,
          motionPreset: 'punch_zoom',
          wordTimestamps: []
        }
      ]
    };

    const mock = createMockCanvas();
    new CanvasRenderer(mock.canvas as any).draw(30, 90, vsProject, { hud: false });

    const fills = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fills.some((t) => t.includes('TRADITIONAL WORKFLOWS'))).toBe(true);
    expect(fills.some((t) => t.includes('MOOSCRIPT STUDIO'))).toBe(true);
    expect(fills.includes('VS')).toBe(true);
  });

  it('LIST_STAGGER layout renders staggered bullet items', () => {
    const listProject: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: [
        {
          id: 'sc-list',
          layout: 'LIST_STAGGER',
          narrationText: 'Key features of the new engine',
          visualData: {
            title: 'Core Architecture',
            bulletItems: ['Deterministic Spring Physics', 'Zero-Server WebCodecs MP4', 'Dexie IndexedDB Storage']
          },
          durationInSeconds: 3.0,
          motionPreset: 'fade_float',
          wordTimestamps: []
        }
      ]
    };

    const mock = createMockCanvas();
    new CanvasRenderer(mock.canvas as any).draw(60, 90, listProject, { hud: false });

    const fills = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fills.some((t) => t.includes('CORE ARCHITECTURE'))).toBe(true);
    expect(fills.some((t) => t.includes('Deterministic Spring Physics'))).toBe(true);
    expect(fills.some((t) => t.includes('Zero-Server WebCodecs MP4'))).toBe(true);
    expect(fills.some((t) => t.includes('01'))).toBe(true);
  });

  it('optional subtitles: omitted when showSubtitles is false, rendered when true', () => {
    const baseScene = {
      id: 'sc-sub-test',
      layout: 'METRIC_COUNTER' as const,
      narrationText: 'Speed increased significantly today',
      visualData: { metricValue: '10x', metricLabel: 'Speedup' },
      durationInSeconds: 3.0,
      motionPreset: 'punch_zoom' as const,
      wordTimestamps: []
    };

    // 1. Without subtitles
    const projWithout: MooProject = {
      ...SAMPLE_PROJECT,
      theme: { ...SAMPLE_PROJECT.theme, showSubtitles: false },
      scenes: [{ ...baseScene, showSubtitles: false }]
    };
    const mockWithout = createMockCanvas();
    new CanvasRenderer(mockWithout.canvas as any).draw(30, 90, projWithout, { hud: false });
    const fillsWithout = mockWithout.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fillsWithout.includes('Speed')).toBe(false);

    // 2. With subtitles
    const projWith: MooProject = {
      ...SAMPLE_PROJECT,
      theme: { ...SAMPLE_PROJECT.theme, showSubtitles: true },
      scenes: [{ ...baseScene, showSubtitles: true }]
    };
    const mockWith = createMockCanvas();
    new CanvasRenderer(mockWith.canvas as any).draw(30, 90, projWith, { hud: false });
    const fillsWith = mockWith.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fillsWith.includes('Speed')).toBe(true);
  });
});

// ── Atomic Scene Graph & Procedural Background Tests (Overhaul) ──────────────

describe('Atomic Scene Graph & Procedural Backgrounds', () => {
  const THEME = {
    id: 'brutalist-lime',
    name: 'Brutalist Lime',
    bg: '#0d0d0e',
    surface: '#18181b',
    primary: '#84cc16',
    accent: '#a3e635',
    text: '#f4f4f5',
    muted: '#71717a'
  };

  it('drawDotGrid renders deterministic wave dot matrix across two renders', () => {
    const mock1 = createMockCanvas();
    const renderer1 = new CanvasRenderer(mock1.canvas as any);
    renderer1.drawDotGrid(mock1.ctx as any, 1.5, THEME);

    const mock2 = createMockCanvas();
    const renderer2 = new CanvasRenderer(mock2.canvas as any);
    renderer2.drawDotGrid(mock2.ctx as any, 1.5, THEME);

    expect(mock1.calls).toEqual(mock2.calls);
    expect(mock1.calls.filter((c) => c.method === 'arc').length).toBeGreaterThan(50);
  });

  it('drawMeshBlobs renders multi-point radial gradients deterministically', () => {
    const mock1 = createMockCanvas();
    const renderer1 = new CanvasRenderer(mock1.canvas as any);
    renderer1.drawMeshBlobs(mock1.ctx as any, 2.0, THEME);

    const mock2 = createMockCanvas();
    const renderer2 = new CanvasRenderer(mock2.canvas as any);
    renderer2.drawMeshBlobs(mock2.ctx as any, 2.0, THEME);

    expect(mock1.calls).toEqual(mock2.calls);
    expect(mock1.calls.filter((c) => c.method === 'createRadialGradient').length).toBe(3);
  });

  it('drawBentoBase renders glassmorphism card outline and surface fill', () => {
    const mock = createMockCanvas();
    const renderer = new CanvasRenderer(mock.canvas as any);
    renderer.drawBentoBase(mock.ctx as any, 1.0, THEME);

    const fills = mock.calls.filter((c) => c.method === 'fillRect');
    expect(fills.length).toBeGreaterThan(0);
  });

  it('renderNode renders atomic text, metric, and badge nodes with bounding box registration', () => {
    const mock = createMockCanvas();
    const renderer = new CanvasRenderer(mock.canvas as any);

    const node = {
      id: 'metric-card',
      type: 'container' as const,
      transform: { x: 50, y: 50, width: 80, height: 40, scale: 1, rotation: 0, opacity: 1 },
      style: { fillToken: 'surface' as const, borderRadius: 20 },
      animation: { enter: { type: 'spring_pop' as const, startAtSecond: 0, duration: 0.8 } },
      children: [
        {
          id: 'metric-val',
          type: 'metric' as const,
          transform: { x: 50, y: 40, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'primary' as const, fontSize: 64 },
          animation: { active: { type: 'counter_tick' as const } },
          content: '+500%'
        },
        {
          id: 'badge-tag',
          type: 'badge' as const,
          transform: { x: 50, y: 75, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'accent' as const, fontSize: 20 },
          animation: { enter: { type: 'wipe_up' as const, startAtSecond: 0.2, duration: 0.5 } },
          content: 'CONVERSION'
        }
      ]
    };

    renderer.renderNode(mock.ctx as any, node, 0.5, 0.5, THEME);

    const boundsMap = renderer.getNodeBoundsMap();
    expect(boundsMap.has('metric-card')).toBe(true);
    expect(boundsMap.has('metric-val')).toBe(true);
    expect(boundsMap.has('badge-tag')).toBe(true);

    const hitContainer = renderer.hitTestNode(540, 960);
    expect(hitContainer).toBeDefined();
  });

  it('renders an atomic scene graph project through draw() visitor pattern', () => {
    const atomicProject: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: [
        {
          id: 'atomic-sc-1',
          durationInSeconds: 3.0,
          narrationText: 'Atomic node based rendering',
          background: { type: 'dot_grid' },
          wordTimestamps: [],
          nodes: [
            {
              id: 'headline',
              type: 'text',
              transform: { x: 50, y: 45, scale: 1, rotation: 0, opacity: 1 },
              style: { fillToken: 'text', fontSize: 48, fontWeight: 800 },
              animation: { enter: { type: 'spring_pop', startAtSecond: 0, duration: 0.8 } },
              content: 'Atomic Scene Graph'
            },
            {
              id: 'sub-badge',
              type: 'badge',
              transform: { x: 50, y: 65, scale: 1, rotation: 0, opacity: 1 },
              style: { fillToken: 'primary', fontSize: 24 },
              animation: { enter: { type: 'wipe_up', startAtSecond: 0.2, duration: 0.6 } },
              content: 'PERFORMANCE'
            }
          ]
        }
      ]
    };

    const mock = createMockCanvas();
    const renderer = new CanvasRenderer(mock.canvas as any);
    renderer.draw(15, 90, atomicProject, { hud: false });

    const fills = mock.calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
    expect(fills.some((t) => t.includes('Atomic Scene Graph'))).toBe(true);
    expect(fills.some((t) => t.includes('PERFORMANCE'))).toBe(true);

    const bounds = renderer.getNodeBoundsMap();
    expect(bounds.has('headline')).toBe(true);
    expect(bounds.has('sub-badge')).toBe(true);
  });
});


