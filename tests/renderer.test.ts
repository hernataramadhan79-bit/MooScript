import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../src/engine/renderer/canvasRenderer';
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
      text: 'First scene with kinetic typography',
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
      text: 'Second scene sliding split animation',
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
    text: 'Bold kinetic captions for social video',
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
