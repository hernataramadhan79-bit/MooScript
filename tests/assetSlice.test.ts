import { describe, it, expect, beforeEach } from 'vitest';
import { db, saveAssetToDb, listAssetsFromDb, deleteAssetFromDb } from '../src/db/mooDb';
import { useMooStore } from '../src/store/useMooStore';
import { MAX_ASSET_BYTES } from '../src/store/slices/assetSlice';
import type { MooProject } from '../src/types';

const TEST_PROJECT: MooProject = {
  id: 'proj-asset-test',
  title: 'Asset Test Project',
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
      id: 'sc-asset-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Scene 1',
      text: 'Scene 1',
      visualData: { title: 'Scene 1', focusWords: ['Scene'] },
      focusWords: ['Scene'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    }
  ],
  composition: {
    id: 'comp-1',
    width: 1080,
    height: 1920,
    fps: 30,
    globalCss: '',
    scenes: [
      {
        beatId: 'sc-asset-1',
        html: '<div class="content">Hello World</div>',
        css: '',
        buildJs: '',
        status: 'ok',
        version: 1
      }
    ],
    createdAt: Date.now()
  },
  audioDuration: 2.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Asset Management (IndexedDB & Store Slice)', () => {
  beforeEach(async () => {
    await db.assets.clear();
    const store = useMooStore.getState();
    store.setProject(TEST_PROJECT);
    store.setActiveSceneId('sc-asset-1');
  });

  it('saves, lists, and deletes assets in IndexedDB', async () => {
    const asset = {
      id: 'ast-1',
      projectId: 'proj-asset-test',
      name: 'logo.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      createdAt: Date.now()
    };

    await saveAssetToDb(asset);
    const list = await listAssetsFromDb('proj-asset-test');
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('logo.png');

    await deleteAssetFromDb('ast-1');
    const afterDelete = await listAssetsFromDb('proj-asset-test');
    expect(afterDelete.length).toBe(0);
  });

  it('rejects assets larger than 5 MB limit', async () => {
    const store = useMooStore.getState();
    const bigFile = new File([new Uint8Array(MAX_ASSET_BYTES + 100)], 'huge.png', { type: 'image/png' });

    const result = await store.addAsset(bigFile);
    expect(result).toBeNull();
    expect(useMooStore.getState().assets.length).toBe(0);
  });

  it('inserts asset into active scene composition HTML', () => {
    const store = useMooStore.getState();
    const asset = {
      id: 'ast-insert-1',
      projectId: 'proj-asset-test',
      name: 'sticker.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,mock',
      createdAt: Date.now()
    };

    store.insertAssetIntoScene(asset, 'sc-asset-1');

    const updatedComp = useMooStore.getState().project.composition;
    const sceneMod = updatedComp?.scenes.find((s) => s.beatId === 'sc-asset-1');

    expect(sceneMod).toBeDefined();
    expect(sceneMod!.html).toContain('data-moo-layer="asset"');
    expect(sceneMod!.html).toContain('data:image/png;base64,mock');
    expect(sceneMod!.userEdited).toBe(true);
  });

  it('rejects non-image files upon upload', async () => {
    const store = useMooStore.getState();
    const textFile = new File(['hello text'], 'notes.txt', { type: 'text/plain' });
    const result = await store.addAsset(textFile);
    expect(result).toBeNull();
    expect(useMooStore.getState().assets.length).toBe(0);
  });

  it('activates pending scene to status ok and adds default buildJs when inserting asset', () => {
    const store = useMooStore.getState();
    const projectWithPending = {
      ...TEST_PROJECT,
      composition: {
        ...TEST_PROJECT.composition!,
        scenes: [
          {
            beatId: 'sc-asset-1',
            html: '',
            css: '',
            buildJs: '',
            status: 'pending' as const,
            version: 1
          }
        ]
      }
    };
    store.setProject(projectWithPending);

    const asset = {
      id: 'ast-p-1',
      projectId: 'proj-asset-test',
      name: 'logo.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,sample-logo',
      createdAt: Date.now()
    };

    store.insertAssetIntoScene(asset, 'sc-asset-1');

    const sceneMod = useMooStore.getState().project.composition?.scenes.find((s) => s.beatId === 'sc-asset-1');
    expect(sceneMod).toBeDefined();
    expect(sceneMod!.status).toBe('ok');
    expect(sceneMod!.html).toContain('data-moo-layer="asset"');
    expect(sceneMod!.html).toContain('position:absolute');
    expect(sceneMod!.buildJs).toContain('moo-asset-container');
  });

  it('assigns unique layer IDs when multiple assets are inserted into same scene', () => {
    const store = useMooStore.getState();
    const asset1 = {
      id: 'ast-1',
      projectId: 'proj-asset-test',
      name: 'first.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,first',
      createdAt: Date.now()
    };
    const asset2 = {
      id: 'ast-2',
      projectId: 'proj-asset-test',
      name: 'second.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,second',
      createdAt: Date.now()
    };

    store.insertAssetIntoScene(asset1, 'sc-asset-1');
    store.insertAssetIntoScene(asset2, 'sc-asset-1');

    const sceneMod = useMooStore.getState().project.composition?.scenes.find((s) => s.beatId === 'sc-asset-1');
    expect(sceneMod?.html).toContain('data-moo-layer="asset"');
    expect(sceneMod?.html).toContain('data-moo-layer="asset-2"');
  });

  it('removes asset from scene via removeAssetFromScene', () => {
    const store = useMooStore.getState();
    const asset = {
      id: 'ast-rm-1',
      projectId: 'proj-asset-test',
      name: 'banner.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,banner-data',
      createdAt: Date.now()
    };

    store.insertAssetIntoScene(asset, 'sc-asset-1');
    let sceneMod = useMooStore.getState().project.composition?.scenes.find((s) => s.beatId === 'sc-asset-1');
    expect(sceneMod?.html).toContain('data:image/png;base64,banner-data');

    store.removeAssetFromScene(asset.dataUrl, 'sc-asset-1');
    sceneMod = useMooStore.getState().project.composition?.scenes.find((s) => s.beatId === 'sc-asset-1');
    expect(sceneMod?.html).not.toContain('data:image/png;base64,banner-data');
    expect(sceneMod?.html).not.toContain('moo-asset-container');
  });
});
