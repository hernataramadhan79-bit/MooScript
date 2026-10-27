import { describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_PROJECT, DEFAULT_PROJECT_ID } from '../src/store/slices/projectSlice';
import { useMooStore } from '../src/store/useMooStore';
import { db, saveProjectToDb, listProjectsFromDb, saveAssetToDb } from '../src/db/mooDb';
import {
  isPristineLegacyDemo,
  removePristineLegacyDemo,
  demoSceneCodeHash,
  LEGACY_DEMO_PROJECT_ID
} from '../src/db/legacyDemo';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { DEMO_PROJECT } from './fixtures/demoProject';
import type { MooProject } from '../src/types';

const demo = (): MooProject => structuredClone(DEMO_PROJECT);

describe('A new install starts empty', () => {
  it('ships no script, scenes or generated code', () => {
    expect(INITIAL_PROJECT.scenes).toEqual([]);
    expect(INITIAL_PROJECT.composition?.scenes).toEqual([]);
    expect(INITIAL_PROJECT.title).toBe('Proyek Tanpa Judul');
    expect(useMooStore.getState().scriptPrompt).toBe('');
  });

  it('still builds a valid stage document with zero scenes', () => {
    const doc = buildCompositionDocument(INITIAL_PROJECT);
    expect(doc).toContain('<div id="moo-stage"></div>');
    expect(doc).not.toContain("MOO.scene('");
  });
});

describe('Legacy demo detection', () => {
  it('recognises the shipped demo, including its code from every past build', () => {
    expect(LEGACY_DEMO_PROJECT_ID).toBe(DEFAULT_PROJECT_ID);
    expect(isPristineLegacyDemo(demo())).toBe(true);
    for (const mod of demo().composition!.scenes) {
      expect(['18f5b204', 'cb351b15', 'ea4bf121', 'a581a613', '34c14fc5', 'f464702b', '9f0bd5af']).toContain(
        demoSceneCodeHash(mod)
      );
    }
  });

  it('treats the oldest builds (migrated or pending demo scenes) as shipped too', () => {
    const p = demo();
    p.composition!.scenes = p.composition!.scenes.map((m, i) =>
      i === 0 ? { ...m, html: '<div>migrated</div>', generatorVersion: 'legacy-migrated' } : { ...m, html: '', css: '', buildJs: '', status: 'pending' as const }
    );
    expect(isPristineLegacyDemo(p)).toBe(true);
  });

  it.each([
    ['a renamed title', (p: MooProject) => { p.title = 'My video'; }],
    ['an edited narration', (p: MooProject) => { p.scenes[1].narrationText = 'Teks saya sendiri'; }],
    ['an added scene', (p: MooProject) => { p.scenes.push({ ...p.scenes[0], id: 'sc-4' }); }],
    ['a deleted scene', (p: MooProject) => { p.scenes.pop(); }],
    ['regenerated scene code', (p: MooProject) => { p.composition!.scenes[0].html += '<svg></svg>'; }],
    ['moved layers', (p: MooProject) => { p.composition!.scenes[0].overrides = { headline: { x: 20 } }; }],
    ['a recolored scene', (p: MooProject) => { p.composition!.scenes[0].palette = { accent: '#ff0000' }; }],
    ['a changed theme', (p: MooProject) => { p.theme.bg = '#ffffff'; }],
    ['a different aspect ratio', (p: MooProject) => { p.aspectRatio = '16:9'; }],
    ['music', (p: MooProject) => { p.bgm = { ...p.bgm, preset: 'lofi' as any }; }],
    ['another project id', (p: MooProject) => { p.id = 'proj-123'; }]
  ])('keeps the demo after %s', (_label, edit) => {
    const p = demo();
    edit(p);
    expect(isPristineLegacyDemo(p) && p.bgm.preset === 'none').toBe(false);
  });
});

describe('Startup cleanup of the stored demo', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.audioBlobs.clear();
    await db.assets.clear();
  });

  it('removes an untouched demo and leaves other projects alone', async () => {
    const other: MooProject = { ...structuredClone(INITIAL_PROJECT), id: 'proj-mine', title: 'Punya saya' };
    await saveProjectToDb(demo());
    await saveProjectToDb(other);

    const stored = (await listProjectsFromDb()).find((p) => p.id === LEGACY_DEMO_PROJECT_ID);
    expect(await removePristineLegacyDemo(stored)).toBe(true);

    const remaining = await listProjectsFromDb();
    expect(remaining.map((p) => p.id)).toEqual(['proj-mine']);
  });

  it('keeps the demo when it has a voice-over or uploaded assets', async () => {
    await saveProjectToDb({ ...demo(), audioBlob: new Blob(['voice'], { type: 'audio/wav' }) });
    let stored = (await listProjectsFromDb()).find((p) => p.id === LEGACY_DEMO_PROJECT_ID);
    expect(await removePristineLegacyDemo(stored)).toBe(false);

    await db.audioBlobs.clear();
    await saveAssetToDb({
      id: 'asset-1',
      projectId: LEGACY_DEMO_PROJECT_ID,
      name: 'logo.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA==',
      createdAt: 1
    } as any);
    stored = (await listProjectsFromDb()).find((p) => p.id === LEGACY_DEMO_PROJECT_ID);
    expect(await removePristineLegacyDemo(stored)).toBe(false);
    expect((await listProjectsFromDb()).some((p) => p.id === LEGACY_DEMO_PROJECT_ID)).toBe(true);
  });

  it('keeps an edited demo', async () => {
    const edited = demo();
    edited.scenes[0].narrationText = 'Naskah baru';
    await saveProjectToDb(edited);
    const stored = (await listProjectsFromDb()).find((p) => p.id === LEGACY_DEMO_PROJECT_ID);
    expect(await removePristineLegacyDemo(stored)).toBe(false);
  });
});
