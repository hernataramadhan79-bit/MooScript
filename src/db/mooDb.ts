import Dexie, { type Table } from 'dexie';
import type { MooProject, PersonaSkill, EngineSettings, WordTimestamp } from '../types';
import { CURRENT_SCHEMA_VERSION, migrateLegacyScene, resolveTheme } from '../types';
import { migrateLegacyProject } from '../engine/composition/migrate';
import { flagScenesNeedingRepair } from '../engine/composition/legacyScenes';

export interface StoredAudio {
  projectId: string;
  blob: Blob;
  updatedAt: number;
}

export interface CachedSceneAudio {
  cacheKey: string;
  blob: Blob;
  wordTimestamps: WordTimestamp[];
  duration: number;
  updatedAt: number;
}

export interface StoredBgm {
  projectId: string;
  blob: Blob;
  name: string;
  updatedAt: number;
}

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  blob?: Blob;
  dataUrl?: string;
  createdAt: number;
}

/**
 * What the project audio is made of. 'voice' keeps the narration from before BGM mixing, so the
 * music can be changed later without losing the voice-over; 'bgm' means the audio is music only.
 */
export interface StoredVoiceTrack {
  projectId: string;
  kind: 'voice' | 'bgm';
  blob?: Blob;
  updatedAt: number;
}

export class MooDatabase extends Dexie {
  projects!: Table<MooProject, string>;
  audioBlobs!: Table<StoredAudio, string>;
  skills!: Table<PersonaSkill, string>;
  settings!: Table<{ id: string; data: EngineSettings }, string>;
  sceneAudioCache!: Table<CachedSceneAudio, string>;
  assets!: Table<AssetRecord, string>;
  bgmBlobs!: Table<StoredBgm, string>;
  voiceTracks!: Table<StoredVoiceTrack, string>;

  constructor() {
    super('MooScriptDB');
    this.version(1).stores({
      projects: 'id, title, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id'
    });

    // Version 2: Schema upgrade to separate voiceIds per provider
    this.version(2)
      .stores({
        projects: 'id, title, updatedAt',
        audioBlobs: 'projectId, updatedAt',
        skills: 'id, name, isBuiltin',
        settings: 'id'
      })
      .upgrade(async (tx) => {
        try {
          const current = await tx.table('settings').get('current');
          if (current?.data) {
            const oldData = current.data as any;
            if (oldData.voiceId && !oldData.voiceIds) {
              const oldVoice = oldData.voiceId;
              const isOpenAIVoice = ['alloy', 'nova', 'onyx', 'shimmer'].includes(oldVoice);
              oldData.voiceIds = {
                openai: isOpenAIVoice ? oldVoice : 'alloy',
                elevenlabs: !isOpenAIVoice && oldVoice !== 'alloy' ? oldVoice : '21m00Tcm4TlvDq8ikWAM'
              };
              delete oldData.voiceId;
              await tx.table('settings').put({ id: 'current', data: oldData });
            }
          }
        } catch (e) {
          console.warn('Database upgrade v2 migration notice:', e);
        }
      });

    // Version 3: Per-scene audio cache for instantaneous regenerations
    this.version(3).stores({
      projects: 'id, title, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id',
      sceneAudioCache: 'cacheKey, updatedAt'
    });

    // Version 4: Asset storage & Composition history
    this.version(4).stores({
      projects: 'id, title, renderMode, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id',
      sceneAudioCache: 'cacheKey, updatedAt',
      assets: 'id, projectId, name, mimeType, createdAt'
    });

    // Version 5: one user-uploaded BGM track per project
    this.version(5).stores({
      projects: 'id, title, renderMode, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id',
      sceneAudioCache: 'cacheKey, updatedAt',
      assets: 'id, projectId, name, mimeType, createdAt',
      bgmBlobs: 'projectId, updatedAt'
    });

    // Version 6: the raw voice-over per project, kept apart from the BGM mix
    this.version(6).stores({
      projects: 'id, title, renderMode, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id',
      sceneAudioCache: 'cacheKey, updatedAt',
      assets: 'id, projectId, name, mimeType, createdAt',
      bgmBlobs: 'projectId, updatedAt',
      voiceTracks: 'projectId, updatedAt'
    });
  }
}

export const db = new MooDatabase();

export const lastSavedAudioBlobByProject = new Map<string, Blob | null>();

export async function saveProjectToDb(project: MooProject): Promise<void> {
  try {
    const now = Date.now();
    // Store project data without blob in the project record
    const { audioBlob, ...cleanProject } = project;
    cleanProject.createdAt = cleanProject.createdAt || now;
    cleanProject.updatedAt = now;
    await db.projects.put(cleanProject as MooProject);

    // Only write audioBlob if reference has actually changed for this project.
    // NOTE: an explicit delete is required when audioBlob is missing/empty
    // (timer mode or removed audio). The old `audioBlob !== undefined` check
    // skipped this case, leaving zombie blobs that resurrected on reload.
    const lastSaved = lastSavedAudioBlobByProject.get(project.id);
    const hasAudio = !!audioBlob && audioBlob.size > 0;
    const hadAudio = !!lastSaved && lastSaved.size > 0;
    if (hasAudio) {
      if (audioBlob !== lastSaved) {
        await db.audioBlobs.put({
          projectId: project.id,
          blob: audioBlob,
          updatedAt: now
        });
        lastSavedAudioBlobByProject.set(project.id, audioBlob);
      }
    } else if (hadAudio || lastSaved !== undefined) {
      await db.audioBlobs.delete(project.id);
      lastSavedAudioBlobByProject.delete(project.id);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('IndexedDB saveProjectToDb error:', err);
    throw new Error(`Gagal menyimpan project ke IndexedDB (${msg})`);
  }
}

export function normalizeProject(project: MooProject): MooProject {
  if (!project.aspectRatio) {
    project.aspectRatio = '9:16';
  }
  if (!project.renderMode) {
    project.renderMode = 'composition';
  }
  if (!project.scenes) project.scenes = [];
  project.scenes = project.scenes.map((s, idx) => {
    const narrationText = s.narrationText ?? (s as any).text ?? '';
    const visualIntent = s.visualIntent ?? (s as any).text ?? `Scene ${idx + 1}`;
    let migrated = s;
    if (!s.nodes || s.nodes.length === 0) {
      migrated = migrateLegacyScene(s as any);
    }
    return {
      ...migrated,
      narrationText,
      visualIntent,
      durationInSeconds: s.durationInSeconds || migrated.durationInSeconds || 3,
      wordTimestamps: s.wordTimestamps || []
    };
  });
  if (!project.theme) {
    project.theme = {
      bg: '#09090b',
      textPrimary: '#f4f4f5',
      textHighlight: '#84cc16',
      fontFamily: 'Jakarta',
      captionStyle: 'boxed',
      captionPosition: 'center',
      showSubtitles: false
    };
  }
  if (!project.themeTokens) {
    project.themeTokens = resolveTheme(project, project.scenes[0] || null);
  }
  // One-time migration for legacy projects
  if (project.schemaVersion !== CURRENT_SCHEMA_VERSION || !project.composition) {
    return flagScenesNeedingRepair(migrateLegacyProject(project));
  }
  // Scenes whose saved code uses APIs MooTween does not have are flagged, never rewritten.
  return flagScenesNeedingRepair(project);
}

export async function loadProjectFromDb(id: string): Promise<MooProject | null> {
  try {
    const project = await db.projects.get(id);
    if (!project) return null;
    const storedAudio = await db.audioBlobs.get(id);
    if (storedAudio) {
      project.audioBlob = storedAudio.blob;
      lastSavedAudioBlobByProject.set(id, storedAudio.blob);
    } else {
      // No blob on disk — drop any stale in-memory reference (zombie guard).
      lastSavedAudioBlobByProject.delete(id);
    }
    return normalizeProject(project);
  } catch (err: unknown) {
    console.warn('Failed to load project from IndexedDB', err);
    return null;
  }
}

export async function listProjectsFromDb(): Promise<MooProject[]> {
  try {
    const projects = await db.projects.toArray();
    return projects.map((p) => normalizeProject(p)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn('Failed to list projects from IndexedDB', err);
    return [];
  }
}

export async function deleteProjectFromDb(id: string): Promise<void> {
  try {
    await db.projects.delete(id);
    await db.audioBlobs.delete(id);
    await db.bgmBlobs.delete(id);
    await db.voiceTracks.delete(id);
    lastSavedAudioBlobByProject.delete(id);
  } catch (err) {
    console.warn('Failed to delete project from IndexedDB', err);
  }
}

export async function getCachedSceneAudio(cacheKey: string): Promise<CachedSceneAudio | undefined> {
  try {
    return await db.sceneAudioCache.get(cacheKey);
  } catch (err) {
    console.warn('Failed to read sceneAudioCache:', err);
    return undefined;
  }
}

export const SCENE_AUDIO_CACHE_MAX_BYTES = 200 * 1024 * 1024;

/** Drops the least recently written entries until the cache fits `maxBytes`; the newest entry is always kept. */
export async function evictSceneAudioCache(maxBytes: number = SCENE_AUDIO_CACHE_MAX_BYTES): Promise<number> {
  const entries = await db.sceneAudioCache.orderBy('updatedAt').toArray();
  let total = entries.reduce((sum, e) => sum + (e.blob?.size ?? 0), 0);
  const stale: string[] = [];
  for (let i = 0; i < entries.length - 1 && total > maxBytes; i++) {
    stale.push(entries[i].cacheKey);
    total -= entries[i].blob?.size ?? 0;
  }
  if (stale.length > 0) await db.sceneAudioCache.bulkDelete(stale);
  return stale.length;
}

export async function putCachedSceneAudio(item: CachedSceneAudio): Promise<void> {
  try {
    await db.sceneAudioCache.put(item);
    await evictSceneAudioCache();
  } catch (err) {
    console.warn('Failed to write sceneAudioCache:', err);
  }
}

export async function getCacheSize(): Promise<number> {
  let size = 0;
  try {
    const sceneCaches = await db.sceneAudioCache.toArray();
    for (const sc of sceneCaches) {
      if (sc.blob) size += sc.blob.size;
    }
  } catch (err) {
    console.warn('Error reading cache size', err);
  }
  return size;
}

export async function clearAllCache(): Promise<void> {
  try {
    await db.sceneAudioCache.clear();
  } catch (err) {
    console.warn('Error clearing audio cache', err);
  }
}

export async function checkStoragePersistence(): Promise<{ persisted: boolean; supported: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
    try {
      const persisted = await navigator.storage.persisted();
      return { persisted, supported: true };
    } catch {
      return { persisted: false, supported: true };
    }
  }
  return { persisted: false, supported: false };
}

export async function requestPersistentStorage(): Promise<{ persisted: boolean; supported: boolean }> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) return { persisted: true, supported: true };
      const granted = await navigator.storage.persist();
      return { persisted: granted, supported: true };
    } catch {
      return { persisted: false, supported: true };
    }
  }
  return { persisted: false, supported: false };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function saveBgmToDb(projectId: string, blob: Blob, name: string): Promise<void> {
  try {
    await db.bgmBlobs.put({ projectId, blob, name, updatedAt: Date.now() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gagal menyimpan BGM ke IndexedDB (${msg})`);
  }
}

export async function loadBgmFromDb(projectId: string): Promise<StoredBgm | undefined> {
  try {
    return await db.bgmBlobs.get(projectId);
  } catch (err) {
    console.warn('Failed to load custom BGM', err);
    return undefined;
  }
}

export async function deleteBgmFromDb(projectId: string): Promise<void> {
  try {
    await db.bgmBlobs.delete(projectId);
  } catch (err) {
    console.warn('Failed to delete custom BGM', err);
  }
}

/** Stores (or with `null`, forgets) what the project audio is made of. Never throws. */
export async function saveVoiceTrackToDb(
  projectId: string,
  track: { kind: 'voice'; blob: Blob } | { kind: 'bgm' } | null
): Promise<void> {
  try {
    if (!track) {
      await db.voiceTracks.delete(projectId);
    } else {
      await db.voiceTracks.put({ projectId, ...track, updatedAt: Date.now() });
    }
  } catch (err) {
    console.warn('Failed to store the voice track', err);
  }
}

export async function loadVoiceTrackFromDb(projectId: string): Promise<StoredVoiceTrack | undefined> {
  try {
    return await db.voiceTracks.get(projectId);
  } catch (err) {
    console.warn('Failed to load the voice track', err);
    return undefined;
  }
}

export async function saveAssetToDb(asset: AssetRecord): Promise<void> {
  try {
    // A base64 copy next to the blob would cost ~2.3x the file size; the data URL is rebuilt on load.
    const record = asset.blob ? { ...asset, dataUrl: undefined } : asset;
    await db.assets.put(record);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('saveAssetToDb error:', err);
    throw new Error(`Gagal menyimpan aset ke IndexedDB (${msg})`);
  }
}

export async function listAssetsFromDb(projectId: string): Promise<AssetRecord[]> {
  try {
    const records = await db.assets.where('projectId').equals(projectId).sortBy('createdAt');
    return await Promise.all(
      records.map(async (r) => {
        if (r.dataUrl || !r.blob) return r;
        try {
          return { ...r, dataUrl: await blobToDataUrl(r.blob) };
        } catch {
          return r;
        }
      })
    );
  } catch (err: unknown) {
    console.error('listAssetsFromDb error:', err);
    return [];
  }
}

export async function deleteAssetFromDb(id: string): Promise<void> {
  try {
    await db.assets.delete(id);
  } catch (err: unknown) {
    console.error('deleteAssetFromDb error:', err);
  }
}
