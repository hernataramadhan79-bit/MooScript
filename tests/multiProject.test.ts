/**
 * tests/multiProject.test.ts
 * Unit tests for Multi-Project database persistence and store management (Prompt 8.5)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db, saveProjectToDb, loadProjectFromDb, listProjectsFromDb, deleteProjectFromDb } from '../src/db/mooDb';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

const TEST_PROJ_1: MooProject = {
  id: 'proj-alpha',
  title: 'Alpha Project',
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
      narrationText: 'Alpha scene one',
      text: 'Alpha scene one',
      visualData: { title: 'Alpha', focusWords: ['alpha'] },
      focusWords: ['alpha'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    }
  ],
  audioDuration: 2.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

const TEST_PROJ_2: MooProject = {
  id: 'proj-beta',
  title: 'Beta Project',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#18181b',
    textPrimary: '#f4f4f5',
    textHighlight: '#38bdf8',
    fontFamily: 'Mono',
    captionStyle: 'karaoke',
    captionPosition: 'top'
  },
  scenes: [
    {
      id: 'sc-2',
      layout: 'TERMINAL_MOCKUP',
      narrationText: 'Beta scene one',
      text: 'Beta scene one',
      visualData: { title: 'Beta Terminal', codeSnippet: 'echo "beta"' },
      focusWords: ['beta'],
      motionPreset: 'slide_split',
      durationInSeconds: 3.5,
      wordTimestamps: []
    }
  ],
  audioDuration: 3.5,
  bgm: { preset: 'ambient', level: 0.25, duckRatio: 0.2 }
};

describe('Multi-Project Database Operations (IndexedDB)', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.audioBlobs.clear();
  });

  it('saves and loads projects with automatic createdAt and updatedAt timestamps', async () => {
    await saveProjectToDb(TEST_PROJ_1);
    const loaded = await loadProjectFromDb('proj-alpha');

    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe('Alpha Project');
    expect(loaded!.createdAt).toBeGreaterThan(0);
    expect(loaded!.updatedAt).toBeGreaterThan(0);
  });

  it('lists all projects sorted by updatedAt descending', async () => {
    await saveProjectToDb(TEST_PROJ_1);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await saveProjectToDb(TEST_PROJ_2);

    const list = await listProjectsFromDb();
    expect(list.length).toBe(2);
    // Beta was updated after Alpha, so it should be first
    expect(list[0].id).toBe('proj-beta');
    expect(list[1].id).toBe('proj-alpha');
  });

  it('deletes project and its associated audio blob cleanly', async () => {
    const audioBlob = new Blob(['mock audio'], { type: 'audio/wav' });
    await saveProjectToDb({ ...TEST_PROJ_1, audioBlob });

    // Verify both records exist
    expect(await db.projects.get('proj-alpha')).toBeDefined();
    expect(await db.audioBlobs.get('proj-alpha')).toBeDefined();

    // Delete
    await deleteProjectFromDb('proj-alpha');
    expect(await db.projects.get('proj-alpha')).toBeUndefined();
    expect(await db.audioBlobs.get('proj-alpha')).toBeUndefined();
  });
});

describe('Store Multi-Project Actions', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.audioBlobs.clear();
    // Seed test project 1 into db
    await saveProjectToDb(TEST_PROJ_1);

    const store = useMooStore.getState();
    store.setProject(TEST_PROJ_1);
    await store.refreshProjectsList();
  });

  it('creates a new project and switches active state to it', async () => {
    const store = useMooStore.getState();
    const newId = await store.createNewProject('My Cool Short');

    expect(newId).toMatch(/^proj-/);
    const current = useMooStore.getState().project;
    expect(current.id).toBe(newId);
    expect(current.title).toBe('My Cool Short');
    expect(current.scenes.length).toBe(1);

    // Verify it is in projectsList
    const list = useMooStore.getState().projectsList;
    expect(list.some((p) => p.id === newId)).toBe(true);
  });

  it('switches between projects and updates store state', async () => {
    await saveProjectToDb(TEST_PROJ_2);
    const store = useMooStore.getState();
    await store.refreshProjectsList();

    expect(store.project.id).toBe('proj-alpha');

    await store.switchProject('proj-beta');
    expect(useMooStore.getState().project.id).toBe('proj-beta');
    expect(useMooStore.getState().project.title).toBe('Beta Project');
    expect(useMooStore.getState().project.theme.captionStyle).toBe('karaoke');
  });

  it('duplicates an existing project with Copy title suffix', async () => {
    const store = useMooStore.getState();
    const dupId = await store.duplicateProject('proj-alpha');

    expect(dupId).toMatch(/^proj-/);
    expect(dupId).not.toBe('proj-alpha');

    const loaded = await loadProjectFromDb(dupId);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe('Alpha Project (Copy)');
    expect(loaded!.scenes.length).toBe(TEST_PROJ_1.scenes.length);

    // List should now have 2 projects
    expect(useMooStore.getState().projectsList.length).toBe(2);
  });

  it('prevents deleting the last remaining project', async () => {
    const store = useMooStore.getState();
    expect(store.projectsList.length).toBe(1);

    await store.deleteProject('proj-alpha');

    // Should still exist because it was the only project
    expect(store.projectsList.length).toBe(1);
    expect(store.project.id).toBe('proj-alpha');
  });

  it('deletes a project and automatically switches active project if active is deleted', async () => {
    await saveProjectToDb(TEST_PROJ_2);
    await useMooStore.getState().refreshProjectsList();
    expect(useMooStore.getState().projectsList.length).toBe(2);

    // Currently on proj-alpha, delete it
    await useMooStore.getState().deleteProject('proj-alpha');

    const updated = useMooStore.getState();
    expect(updated.projectsList.length).toBe(1);
    // Active project should automatically switch to the remaining proj-beta
    expect(updated.project.id).toBe('proj-beta');
  });

  it('updateTitle synchronizes title in both project and projectsList', () => {
    const store = useMooStore.getState();
    store.updateTitle('Renamed Title');

    const state = useMooStore.getState();
    expect(state.project.title).toBe('Renamed Title');
    const inList = state.projectsList.find((p) => p.id === state.project.id);
    expect(inList?.title).toBe('Renamed Title');
  });
});
