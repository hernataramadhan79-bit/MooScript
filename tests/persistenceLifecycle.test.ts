import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  db,
  saveProjectToDb,
  loadProjectFromDb,
  clearAllCache,
  getCacheSize,
  putCachedSceneAudio
} from '../src/db/mooDb';
import { useMooStore } from '../src/store/useMooStore';
import { stopPlaybackAudio } from '../src/store/slices/playbackSlice';
import type { MooProject } from '../src/types';

const MOCK_PROJ_A: MooProject = {
  id: 'proj-lifecycle-a',
  title: 'Project A',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#09090b',
    textPrimary: '#f4f4f5',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center',
    showSubtitles: false
  },
  scenes: [],
  audioDuration: 5.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Phase 2: Persistence and Project Lifecycle', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.projects.clear();
    await db.audioBlobs.clear();
    await db.sceneAudioCache.clear();
  });

  it('2a: persists audio for duplicated project sharing the exact same Blob reference', async () => {
    const sharedBlob = new Blob(['same audio bytes'], { type: 'audio/wav' });

    // Project A with sharedBlob
    const projA: MooProject = {
      ...MOCK_PROJ_A,
      id: 'proj-a-dup-test',
      audioBlob: sharedBlob
    };
    await saveProjectToDb(projA);

    // Project B duplicated with the exact same sharedBlob reference
    const projB: MooProject = {
      ...MOCK_PROJ_A,
      id: 'proj-b-dup-test',
      audioBlob: sharedBlob
    };
    await saveProjectToDb(projB);

    // Reload B from DB
    const loadedB = await loadProjectFromDb('proj-b-dup-test');
    expect(loadedB).not.toBeNull();
    expect(loadedB!.audioBlob).toBeDefined();
    expect(loadedB!.audioBlob!.size).toBe(sharedBlob.size);
  });

  it('2b: clearAllCache clears sceneAudioCache but project voiceover audio still loads', async () => {
    const projectAudio = new Blob(['voiceover audio'], { type: 'audio/wav' });
    const sceneAudio = new Blob(['scene segment'], { type: 'audio/wav' });

    await saveProjectToDb({
      ...MOCK_PROJ_A,
      id: 'proj-cache-test',
      audioBlob: projectAudio
    });

    await putCachedSceneAudio({
      cacheKey: 'scene-hash-1',
      blob: sceneAudio,
      wordTimestamps: [],
      duration: 2.0,
      updatedAt: Date.now()
    });

    // Cache size should reflect sceneAudioCache
    const sizeBefore = await getCacheSize();
    expect(sizeBefore).toBe(sceneAudio.size);

    // Clear cache
    await clearAllCache();

    // Cache size is 0
    const sizeAfter = await getCacheSize();
    expect(sizeAfter).toBe(0);

    // Project audio still loads!
    const reloaded = await loadProjectFromDb('proj-cache-test');
    expect(reloaded).not.toBeNull();
    expect(reloaded!.audioBlob).toBeDefined();
    expect(reloaded!.audioBlob!.size).toBe(projectAudio.size);
  });

  it('2c: saveProjectToDb always updates updatedAt with Date.now() ignoring incoming value', async () => {
    const pastTimestamp = 12345678;
    await saveProjectToDb({
      ...MOCK_PROJ_A,
      id: 'proj-timestamp-test',
      updatedAt: pastTimestamp
    });

    const loaded = await loadProjectFromDb('proj-timestamp-test');
    expect(loaded).not.toBeNull();
    expect(loaded!.updatedAt).not.toBe(pastTimestamp);
    expect(loaded!.updatedAt).toBeGreaterThan(Date.now() - 5000);
  });

  it('2d: stopPlaybackAudio resets state, and project switches pause playback and reset snapshot/activeSceneId', async () => {
    // Test stopPlaybackAudio direct execution
    expect(() => stopPlaybackAudio()).not.toThrow();

    useMooStore.setState({
      isPlaying: true,
      previousScenesSnapshot: [{ ...MOCK_PROJ_A.scenes[0] }] as any,
      activeSceneId: 'scene-99'
    });

    // Save project in DB so switch can find it
    await saveProjectToDb({ ...MOCK_PROJ_A, id: 'proj-switch-test' });

    const pauseSpy = vi.spyOn(useMooStore.getState(), 'pause');

    await useMooStore.getState().switchProject('proj-switch-test');

    expect(pauseSpy).toHaveBeenCalled();
    expect(useMooStore.getState().isPlaying).toBe(false);
    expect(useMooStore.getState().previousScenesSnapshot).toBeNull();
    expect(useMooStore.getState().activeSceneId).toBeNull();
  });

  it('2e: changing BGM on project with audioBlob sets audioStale: true and shows toast once', () => {
    useMooStore.setState({
      project: {
        ...MOCK_PROJ_A,
        audioBlob: new Blob(['audio'], { type: 'audio/wav' })
      },
      audioStale: false,
      toasts: []
    });

    // Tick 1
    useMooStore.getState().updateBgmLevel(0.5);
    expect(useMooStore.getState().audioStale).toBe(true);
    expect(
      useMooStore.getState().toasts.some((t) => t.message.includes('BGM berubah'))
    ).toBe(true);

    const toastCountBefore = useMooStore.getState().toasts.length;

    // Tick 2 (subsequent slider scrub while already stale)
    useMooStore.getState().updateBgmLevel(0.6);
    expect(useMooStore.getState().audioStale).toBe(true);
    // Should NOT duplicate toast
    expect(useMooStore.getState().toasts.length).toBe(toastCountBefore);
  });

  it('2f: setProject with { keepStale: true } preserves audioStale flag', () => {
    useMooStore.setState({
      project: MOCK_PROJ_A,
      audioStale: true
    });

    // With keepStale: true
    useMooStore.getState().setProject(
      { ...MOCK_PROJ_A, title: 'Updated Title' },
      { keepStale: true }
    );
    expect(useMooStore.getState().audioStale).toBe(true);
    expect(useMooStore.getState().project.title).toBe('Updated Title');

    // Without keepStale (default behavior resets to false)
    useMooStore.getState().setProject({
      ...MOCK_PROJ_A,
      title: 'Fresh Title'
    });
    expect(useMooStore.getState().audioStale).toBe(false);
  });
});
