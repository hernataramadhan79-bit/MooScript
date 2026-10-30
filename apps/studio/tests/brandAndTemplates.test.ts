import { beforeEach, describe, expect, it } from 'vitest';
import { applyBrandKit, DEFAULT_BRAND_KIT, removeBrand, withBrandCards } from '../src/engine/brand/brandKit';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { compileProceduralProject } from '../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../src/engine/composition/sync';
import { frameSize, placeFrame } from '../src/engine/export/reframe';
import { applyWorldBible } from '../src/store/slices/scriptSlice';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import { useMooStore } from '../src/store/useMooStore';
import type { BrandKit, MooProject } from '../src/types';

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function project(): MooProject {
  return compileProceduralProject(
    syncComposition({
      ...INITIAL_PROJECT,
      scenes: [
        { id: 'a', narrationText: 'Satu ide kecil', durationInSeconds: 3, wordTimestamps: [] },
        { id: 'b', narrationText: 'Bisa mengubah segalanya', durationInSeconds: 3, wordTimestamps: [] }
      ]
    }),
    'auto',
    true
  );
}

const kit: BrandKit = {
  ...DEFAULT_BRAND_KIT,
  name: 'Kamu Tahu?',
  logoDataUrl: LOGO,
  palette: { bg: '#101010', primary: '#fafafa', accent: '#ff5500', text: '#ffffff' },
  intro: true,
  outro: { enabled: true, text: 'Follow ya' }
};

describe('reframe geometry', () => {
  it('knows the output sizes and centres crop / fit placements', () => {
    expect(frameSize('16:9')).toEqual({ width: 1920, height: 1080 });
    expect(frameSize('1:1', '720p')).toEqual({ width: 720, height: 720 });
    const src = { width: 1080, height: 1920 };
    const dst = { width: 1920, height: 1080 };
    const fit = placeFrame(src, dst, 'fit');
    expect(fit.height).toBe(1080);
    expect(fit.x).toBeCloseTo((1920 - 607.5) / 2, 1);
    const crop = placeFrame(src, dst, 'crop');
    expect(crop.width).toBe(1920);
    expect(crop.y).toBeLessThan(0);
  });
});

describe('brand kit', () => {
  it('applies palette, logo watermark and intro / outro cards', () => {
    const branded = applyBrandKit(project(), kit);
    expect(branded.scenes.map((s) => s.brandCard ?? s.id)).toEqual(['intro', 'a', 'b', 'outro']);
    expect(branded.composition!.scenes.map((m) => m.beatId)).toEqual(branded.scenes.map((s) => s.id));
    expect(branded.theme.bg).toBe('#101010');
    expect(branded.styleBrief?.palette.primary).toBe('#fafafa');
    const doc = buildCompositionDocument(branded);
    expect(doc).toContain('id="moo-watermark"');
    expect(doc).toContain(LOGO);
    expect(doc).toContain('Follow ya');

    // Applying again does not stack cards; removing takes them and the watermark away.
    expect(applyBrandKit(branded, kit).scenes).toHaveLength(4);
    const plain = removeBrand(branded);
    expect(plain.scenes.map((s) => s.id)).toEqual(['a', 'b']);
    expect(buildCompositionDocument(plain)).not.toContain('moo-watermark');
  });

  it('keeps the brand palette and cards through a new AI storyboard', () => {
    const branded = applyBrandKit(project(), kit);
    const next = applyWorldBible(
      { ...branded, scenes: [{ id: 'n', narrationText: 'Baru', durationInSeconds: 3, wordTimestamps: [] }] },
      { palette: { bg: '#00ff00', primary: '#00ff00', accent: '#00ff00', text: '#000000' }, motif: '', visualLanguage: '', cameraStyle: '' }
    );
    expect(next.theme.bg).toBe('#101010');
    const withCards = withBrandCards(syncComposition(next));
    expect(withCards.scenes.map((s) => s.brandCard ?? s.id)).toEqual(['intro', 'n', 'outro']);
  });
});

describe('shot templates', () => {
  beforeEach(() => {
    useMooStore.getState().setProject({ ...project(), assetData: { 'img-1': LOGO } });
    useMooStore.setState({ shotTemplates: [] });
  });

  it('saves a shot with its images and inserts it into another project', async () => {
    const state = () => useMooStore.getState();
    const comp = state().project.composition!;
    useMooStore.getState().setProject({
      ...state().project,
      composition: {
        ...comp,
        scenes: comp.scenes.map((m) => (m.beatId === 'a' ? { ...m, html: `${m.html}<img src="moo-asset:img-1">`, layerMotions: { Headline: { enter: { preset: 'pop', at: 0.2, dur: 0.5 } } } } : m))
      }
    });
    const id = await state().saveShotAsTemplate('a', 'Hook favorit');
    expect(id).toBeTruthy();
    expect(state().shotTemplates[0].assetData).toEqual({ 'img-1': LOGO });

    useMooStore.getState().setProject(syncComposition({ ...INITIAL_PROJECT, id: 'other', scenes: [{ id: 'x', narrationText: '', durationInSeconds: 2, wordTimestamps: [] }] }));
    await state().loadShotTemplates();
    const newId = state().insertShotTemplate(id!, 'x')!;
    const p = state().project;
    expect(p.scenes.map((s) => s.id)).toEqual(['x', newId]);
    const mod = p.composition!.scenes.find((m) => m.beatId === newId)!;
    expect(mod.html).toContain('moo-asset:img-1');
    expect(mod.layerMotions?.Headline?.enter?.preset).toBe('pop');
    expect(p.assetData?.['img-1']).toBe(LOGO);

    await state().deleteShotTemplate(id!);
    expect(state().shotTemplates).toHaveLength(0);
  });
});
