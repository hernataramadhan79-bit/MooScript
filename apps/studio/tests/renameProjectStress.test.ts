/**
 * tests/renameProjectStress.test.ts
 * Empirical Stress Test Suite for renameProject and Dexie Persistence (Milestone M3 Challenger)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db, saveProjectToDb, loadProjectFromDb, listProjectsFromDb } from '../src/db/mooDb';
import { useMooStore } from '../src/store/useMooStore';
import { flushPendingSave } from '../src/store/slices/projectSlice';
import type { MooProject } from '../src/types';

const BASE_PROJECT_A: MooProject = {
  id: 'proj-stress-a',
  title: 'Alpha Original',
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
      narrationText: 'Alpha test scene',
      text: 'Alpha test scene',
      visualIntent: 'Alpha visual intent',
      visualConcept: 'Alpha visual concept',
      focusWords: ['alpha'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    }
  ],
  audioDuration: 2.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

const BASE_PROJECT_B: MooProject = {
  id: 'proj-stress-b',
  title: 'Beta Original',
  aspectRatio: '16:9',
  fps: 30,
  width: 1920,
  height: 1080,
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
      narrationText: 'Beta test scene',
      text: 'Beta test scene',
      visualIntent: 'Beta visual intent',
      visualConcept: 'Beta visual concept',
      focusWords: ['beta'],
      motionPreset: 'slide_split',
      durationInSeconds: 3.5,
      wordTimestamps: []
    }
  ],
  audioDuration: 3.5,
  bgm: { preset: 'ambient', level: 0.25, duckRatio: 0.2 }
};

describe('Empirical Stress Testing: renameProject & Dexie Persistence', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.audioBlobs.clear();

    await saveProjectToDb(BASE_PROJECT_A);
    await saveProjectToDb(BASE_PROJECT_B);

    const store = useMooStore.getState();
    store.setProject(BASE_PROJECT_A);
    await flushPendingSave();
    await store.refreshProjectsList();
  });

  describe('1. Active vs Inactive Project Renaming', () => {
    it('renames active project: updates state.project, state.projectsList, and persists to Dexie', async () => {
      const store = useMooStore.getState();
      expect(store.project.id).toBe('proj-stress-a');

      await store.renameProject('proj-stress-a', 'Alpha Renamed Active');

      const state = useMooStore.getState();
      // Active project in state
      expect(state.project.id).toBe('proj-stress-a');
      expect(state.project.title).toBe('Alpha Renamed Active');
      // In projectsList
      const itemInList = state.projectsList.find((p) => p.id === 'proj-stress-a');
      expect(itemInList?.title).toBe('Alpha Renamed Active');

      // Dexie database direct inspection
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb).not.toBeNull();
      expect(fromDb!.title).toBe('Alpha Renamed Active');
      expect(fromDb!.updatedAt).toBeGreaterThanOrEqual(BASE_PROJECT_A.updatedAt || 0);
    });

    it('renames inactive project: leaves active project intact, updates projectsList and Dexie', async () => {
      const store = useMooStore.getState();
      expect(store.project.id).toBe('proj-stress-a');
      const originalActiveTitle = store.project.title;

      await store.renameProject('proj-stress-b', 'Beta Renamed Inactive');

      const state = useMooStore.getState();
      // Active project MUST NOT change
      expect(state.project.id).toBe('proj-stress-a');
      expect(state.project.title).toBe(originalActiveTitle);

      // Inactive project in projectsList MUST update
      const betaInList = state.projectsList.find((p) => p.id === 'proj-stress-b');
      expect(betaInList?.title).toBe('Beta Renamed Inactive');

      // Dexie persistence for inactive project
      const betaFromDb = await loadProjectFromDb('proj-stress-b');
      expect(betaFromDb).not.toBeNull();
      expect(betaFromDb!.title).toBe('Beta Renamed Inactive');

      // When switching to the renamed inactive project, title is preserved
      await store.switchProject('proj-stress-b');
      const switchedState = useMooStore.getState();
      expect(switchedState.project.id).toBe('proj-stress-b');
      expect(switchedState.project.title).toBe('Beta Renamed Inactive');
    });

    it('gracefully handles renaming a non-existent project ID without crash', async () => {
      const store = useMooStore.getState();
      await expect(store.renameProject('non-existent-id-999', 'Ghost Project')).resolves.not.toThrow();

      // State is unaltered
      expect(store.project.id).toBe('proj-stress-a');
      expect(store.projectsList.length).toBe(2);
    });
  });

  describe('2. Input Sanitization: Empty String, Whitespace Trimming, and Special Characters', () => {
    it('rejects empty string: does not overwrite existing title in store or Dexie', async () => {
      const store = useMooStore.getState();
      const prevTitle = store.project.title;

      await store.renameProject('proj-stress-a', '');

      const state = useMooStore.getState();
      expect(state.project.title).toBe(prevTitle);
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb!.title).toBe(prevTitle);
    });

    it('rejects whitespace-only strings: does not overwrite existing title', async () => {
      const store = useMooStore.getState();
      const prevTitle = store.project.title;

      await store.renameProject('proj-stress-a', '   \t  \n  ');

      const state = useMooStore.getState();
      expect(state.project.title).toBe(prevTitle);
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb!.title).toBe(prevTitle);
    });

    it('trims leading and trailing whitespace from valid title', async () => {
      const store = useMooStore.getState();
      await store.renameProject('proj-stress-a', '   Trimmed Title Video   ');

      const state = useMooStore.getState();
      expect(state.project.title).toBe('Trimmed Title Video');
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb!.title).toBe('Trimmed Title Video');
    });

    it('persists titles with emojis, symbols, quotes, and punctuation', async () => {
      const store = useMooStore.getState();
      const specialTitle = '🎬 [PROD-2026] "Director\'s Cut" & <Special> #1 — 100%!';

      await store.renameProject('proj-stress-a', specialTitle);

      const state = useMooStore.getState();
      expect(state.project.title).toBe(specialTitle);
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb!.title).toBe(specialTitle);
    });

    it('persists titles with non-Latin / Unicode scripts (Japanese, Cyrillic, Arabic)', async () => {
      const store = useMooStore.getState();
      const unicodeTitle = '動画プロジェクト №42 / Проект Анимации / مشروع تجريبي';

      await store.renameProject('proj-stress-b', unicodeTitle);

      const betaFromDb = await loadProjectFromDb('proj-stress-b');
      expect(betaFromDb!.title).toBe(unicodeTitle);
    });

    it('persists potential XSS payload strings literally without corruption', async () => {
      const store = useMooStore.getState();
      const xssTitle = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

      await store.renameProject('proj-stress-a', xssTitle);

      const state = useMooStore.getState();
      expect(state.project.title).toBe(xssTitle);
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb!.title).toBe(xssTitle);
    });

    it('handles very long title strings (1000 characters) safely', async () => {
      const store = useMooStore.getState();
      const longTitle = 'MooScript '.repeat(100); // 1000 chars

      await store.renameProject('proj-stress-a', longTitle);

      const state = useMooStore.getState();
      expect(state.project.title).toBe(longTitle.trim());
      const fromDb = await loadProjectFromDb('proj-stress-a');
      expect(fromDb!.title).toBe(longTitle.trim());
    });
  });

  describe('3. Dexie Persistence & Reload Verification', () => {
    it('persists rename across listProjectsFromDb and respects updatedAt order', async () => {
      const store = useMooStore.getState();
      // Ensure slight timestamp separation
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Rename inactive project Beta
      await store.renameProject('proj-stress-b', 'Beta Freshly Updated');

      const allProjects = await listProjectsFromDb();
      expect(allProjects.length).toBe(2);
      // Beta was updated most recently, so listProjectsFromDb (sorted by updatedAt desc) places it first
      expect(allProjects[0].id).toBe('proj-stress-b');
      expect(allProjects[0].title).toBe('Beta Freshly Updated');
    });

    it('preserves attached audioBlob when project is renamed', async () => {
      // Attach an audio blob to Alpha
      const mockAudio = new Blob(['mock-audio-bytes-12345'], { type: 'audio/wav' });
      await saveProjectToDb({ ...BASE_PROJECT_A, audioBlob: mockAudio });

      const store = useMooStore.getState();
      await store.switchProject('proj-stress-a');

      // Verify blob exists
      let loaded = await loadProjectFromDb('proj-stress-a');
      expect(loaded?.audioBlob).toBeDefined();

      // Rename Alpha
      await store.renameProject('proj-stress-a', 'Alpha With Preserved Audio');

      // Re-read from Dexie directly
      loaded = await loadProjectFromDb('proj-stress-a');
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe('Alpha With Preserved Audio');
      expect(loaded!.audioBlob).toBeDefined();
      expect(loaded!.audioBlob?.size).toBe(mockAudio.size);
    });

    it('survives rapid consecutive renames with final title winning in Dexie', async () => {
      const store = useMooStore.getState();

      await store.renameProject('proj-stress-a', 'Draft 1');
      await store.renameProject('proj-stress-a', 'Draft 2');
      await store.renameProject('proj-stress-a', 'Draft 3');
      await store.renameProject('proj-stress-a', 'Draft Final');

      const state = useMooStore.getState();
      expect(state.project.title).toBe('Draft Final');

      const loaded = await loadProjectFromDb('proj-stress-a');
      expect(loaded!.title).toBe('Draft Final');
    });
  });
});
