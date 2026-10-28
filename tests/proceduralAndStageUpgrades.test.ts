import { describe, it, expect, beforeEach } from 'vitest';
import {
  PROCEDURAL_ARCHETYPES,
  detectBestArchetype,
  compileProceduralScene
} from '../src/engine/composition/proceduralCompiler';
import { validateSceneCode } from '../src/engine/composition/validator';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject, AssetRecord } from '../src/types';

const INITIAL_PROJECT: MooProject = {
  id: 'proj-procedural-test',
  title: 'Procedural & Stage Upgrade Test',
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
    captionPosition: 'bottom',
    showSubtitles: true
  },
  scenes: [
    {
      id: 'sc-1',
      narrationText: 'Pendapatan meningkat 340% dalam waktu tiga bulan.',
      text: 'Pendapatan meningkat 340% dalam waktu tiga bulan.',
      focusWords: ['340%'],
      durationInSeconds: 3.5,
      wordTimestamps: []
    },
    {
      id: 'sc-2',
      narrationText: 'Tiga langkah utama: riset pasar, eksekusi cepat, dan evaluasi.',
      text: 'Tiga langkah utama: riset pasar, eksekusi cepat, dan evaluasi.',
      focusWords: ['eksekusi'],
      durationInSeconds: 3.5,
      wordTimestamps: []
    }
  ],
  audioDuration: 7.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Procedural Mograph Compiler & Semantic Widgets', () => {
  const sampleScene = {
    id: 'test-scene-1',
    narrationText: 'Pendapatan meningkat 340% dalam waktu 3 bulan dengan sistem otomatis.',
    durationInSeconds: 4,
    focusWords: [] as string[]
  };

  it('auto-detects semantic archetypes from narration text', () => {
    expect(detectBestArchetype({ ...sampleScene, narrationText: 'Kecepatan meningkat 85% tahun ini' }, 1)).toBe(
      'stat-counter'
    );
    expect(detectBestArchetype({ ...sampleScene, narrationText: 'Jalankan npm install di terminal API' }, 1)).toBe(
      'code-terminal'
    );
    expect(detectBestArchetype({ ...sampleScene, narrationText: 'Cara lama vs cara baru yang lebih cepat' }, 1)).toBe(
      'split-versus'
    );
    expect(
      detectBestArchetype(
        { ...sampleScene, narrationText: 'Tiga langkah utama: riset, eksekusi, dan evaluasi rutin' },
        1
      )
    ).toBe('bento-list');
    expect(detectBestArchetype({ ...sampleScene, narrationText: '"Fokus pada nilai nyata untuk pengguna"' }, 1)).toBe(
      'social-quote'
    );
    expect(
      detectBestArchetype({ ...sampleScene, narrationText: 'Grafik tren analitik kuartal keempat meningkat' }, 1)
    ).toBe('chart-data');
  });

  it('compiles valid, deterministic HTML/CSS/MooTween and editable layers for all archetypes', () => {
    for (const arch of PROCEDURAL_ARCHETYPES) {
      const mod = compileProceduralScene(sampleScene, 0, 3, undefined, arch.id);
      expect(mod.status).toBe('ok');
      expect(mod.html.length).toBeGreaterThan(20);
      expect(mod.css.length).toBeGreaterThan(20);
      expect(mod.buildJs.length).toBeGreaterThan(20);
      expect(mod.editableLayers && mod.editableLayers.length).toBeGreaterThan(0);

      const validation = validateSceneCode({
        html: mod.html,
        css: mod.css,
        buildJs: mod.buildJs
      });
      expect(validation.valid).toBe(true);
    }
  });

  it('renders live procedural kinetic visuals for pending scenes in buildCompositionDocument', () => {
    const doc = buildCompositionDocument(INITIAL_PROJECT);
    expect(doc).toContain('data-moo-layer');
    expect(doc).not.toContain('Not generated yet');
    expect(doc).toContain('query_layer_rects');
  });
});

describe('Store Upgrades: Undo/Redo Integrity, Procedural Compilation, Multi-Asset & Captions', () => {
  beforeEach(() => {
    useMooStore.getState().setProject(structuredClone(INITIAL_PROJECT));
  });

  it('compiles scene procedurally and records undo snapshot', () => {
    const store = useMooStore.getState();
    const firstSceneId = store.project.scenes[0].id;
    expect(store.canUndo).toBe(false);

    store.compileSceneProcedural(firstSceneId, 'stat-counter');
    const updated = useMooStore.getState();
    const compScene = updated.project.composition?.scenes.find((s) => s.beatId === firstSceneId);
    expect(compScene?.status).toBe('ok');
    expect(compScene?.editableLayers?.length).toBeGreaterThan(0);
    expect(updated.canUndo).toBe(true);

    updated.undo();
    expect(useMooStore.getState().canUndo).toBe(false);
    expect(useMooStore.getState().canRedo).toBe(true);
  });

  it('records undo snapshots for updateLayerOverride, resetLayerOverride, and updateScenePalette', () => {
    const store = useMooStore.getState();
    const sceneId = store.project.scenes[0].id;
    store.compileSceneProcedural(sceneId, 'kinetic-impact');

    useMooStore.getState().updateLayerOverride(sceneId, 'headline', { x: 120, y: -45, scale: 1.25 });
    const compAfterOverride = useMooStore
      .getState()
      .project.composition?.scenes.find((s) => s.beatId === sceneId);
    expect(compAfterOverride?.overrides?.headline?.x).toBe(120);

    useMooStore.getState().resetLayerOverride(sceneId, 'headline');
    const compAfterReset = useMooStore
      .getState()
      .project.composition?.scenes.find((s) => s.beatId === sceneId);
    expect(compAfterReset?.overrides?.headline).toBeUndefined();

    // Undo resetLayerOverride restores the x: 120 override
    useMooStore.getState().undo();
    const compAfterUndoReset = useMooStore
      .getState()
      .project.composition?.scenes.find((s) => s.beatId === sceneId);
    expect(compAfterUndoReset?.overrides?.headline?.x).toBe(120);

    useMooStore.getState().updateScenePalette(sceneId, { accent: '#ff0055' });
    const compAfterPalette = useMooStore
      .getState()
      .project.composition?.scenes.find((s) => s.beatId === sceneId);
    expect(compAfterPalette?.palette?.accent).toBe('#ff0055');
  });

  it('preserves undo history when setProject is called with preserveHistory: true', () => {
    const store = useMooStore.getState();
    store.updateSceneText('sc-1', 'Narasi Pertama Diubah');
    expect(useMooStore.getState().canUndo).toBe(true);

    const currentProj = useMooStore.getState().project;
    useMooStore.getState().setProject({ ...currentProj, title: 'Judul Kedua' }, { preserveHistory: true });
    expect(useMooStore.getState().canUndo).toBe(true);

    useMooStore.getState().undo();
    expect(useMooStore.getState().project.title).toBe('Procedural & Stage Upgrade Test');
    expect(useMooStore.getState().project.scenes[0].narrationText).toBe('Narasi Pertama Diubah');

    useMooStore.getState().undo();
    expect(useMooStore.getState().project.scenes[0].narrationText).toBe(
      'Pendapatan meningkat 340% dalam waktu tiga bulan.'
    );
  });

  it('allows setSceneDuration with allowWithAudio=true even when audioBlob exists', () => {
    const store = useMooStore.getState();
    const sceneId = store.project.scenes[0].id;
    const origDur = store.project.scenes[0].durationInSeconds;

    useMooStore.setState({
      project: {
        ...store.project,
        audioBlob: new Blob(['dummy'], { type: 'audio/wav' }),
        audioDuration: 12
      }
    });

    // Default allowWithAudio = false preserves existing lock
    useMooStore.getState().setSceneDuration(sceneId, 8);
    expect(useMooStore.getState().project.scenes[0].durationInSeconds).toBe(origDur);

    // Explicit allowWithAudio = true updates scene duration and marks audioStale
    useMooStore.getState().setSceneDuration(sceneId, 8, true);
    expect(useMooStore.getState().project.scenes[0].durationInSeconds).toBe(8);
    expect(useMooStore.getState().audioStale).toBe(true);
  });

  it('prevents multi-asset selector collision and extracts editableLayers when inserting multiple assets', () => {
    const store = useMooStore.getState();
    const sceneId = store.project.scenes[0].id;
    store.compileSceneProcedural(sceneId, 'kinetic-impact');

    const asset1: AssetRecord = {
      id: 'asset-1',
      name: 'Logo A',
      type: 'image',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAAA',
      size: 100,
      createdAt: Date.now()
    };
    const asset2: AssetRecord = {
      id: 'asset-2',
      name: 'Product B',
      type: 'image',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,BBBB',
      size: 100,
      createdAt: Date.now()
    };

    useMooStore.getState().insertAssetIntoScene(asset1, sceneId, { animationPreset: 'pop' });
    useMooStore.getState().insertAssetIntoScene(asset2, sceneId, { animationPreset: 'float' });

    const compScene = useMooStore
      .getState()
      .project.composition?.scenes.find((s) => s.beatId === sceneId);
    const assetLayers = compScene?.editableLayers?.filter((l) => l.id.startsWith('asset')) || [];
    expect(assetLayers.length).toBe(2);
    expect(compScene?.buildJs).toContain('.moo-asset-container.moo-asset-asset');
    expect(compScene?.buildJs).toContain('.moo-asset-container.moo-asset-asset-2');
  });

  it('respects custom bgColor and the per-scene caption opt-out in buildCompositionDocument', () => {
    const proj = structuredClone(INITIAL_PROJECT);
    proj.theme.showSubtitles = true;
    proj.theme.captionStyle = 'boxed';
    proj.theme.subtitleCustomization = {
      bgColor: '#1e293b',
      bgOpacity: 0.8
    };
    proj.scenes[0].hideSubtitles = true;

    const doc = buildCompositionDocument(proj);
    expect(doc).toContain('"bgColor":"#1e293b"');
    expect(doc).toContain('"hideSubtitles":true');
    expect(doc).toContain('hexToRgba(CUST.bgColor, bgOp)');
    expect(doc).toContain('if (!sc.hideSubtitles)');
  });

  it('shows captions for scenes saved with the old per-scene showSubtitles: false default', () => {
    const proj = structuredClone(INITIAL_PROJECT);
    proj.theme.showSubtitles = true;
    // Every scene used to be created with showSubtitles: false; it no longer hides captions.
    proj.scenes[0].showSubtitles = false;

    const doc = buildCompositionDocument(proj);
    expect(doc).not.toContain('"hideSubtitles":true');
    expect(doc).toContain('if (!sc.hideSubtitles)');
  });
});
