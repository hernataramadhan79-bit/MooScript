import Dexie, { type Table } from 'dexie';
import type { MooProject, PersonaSkill, EngineSettings, WordTimestamp } from '../types';

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

export class MooDatabase extends Dexie {
  projects!: Table<MooProject, string>;
  audioBlobs!: Table<StoredAudio, string>;
  skills!: Table<PersonaSkill, string>;
  settings!: Table<{ id: string; data: EngineSettings }, string>;
  sceneAudioCache!: Table<CachedSceneAudio, string>;

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
  }
}

export const db = new MooDatabase();

let lastSavedAudioBlobRef: Blob | null | undefined = undefined;

export async function saveProjectToDb(project: MooProject): Promise<void> {
  try {
    const now = Date.now();
    // Store project data without blob in the project record
    const { audioBlob, ...cleanProject } = project;
    cleanProject.createdAt = cleanProject.createdAt || now;
    cleanProject.updatedAt = project.updatedAt !== undefined ? project.updatedAt : now;
    await db.projects.put(cleanProject as MooProject);

    // Only write audioBlob if reference has actually changed
    if (audioBlob !== undefined && audioBlob !== lastSavedAudioBlobRef) {
      if (audioBlob && audioBlob.size > 0) {
        await db.audioBlobs.put({
          projectId: project.id,
          blob: audioBlob,
          updatedAt: now
        });
      } else {
        await db.audioBlobs.delete(project.id);
      }
      lastSavedAudioBlobRef = audioBlob;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('IndexedDB saveProjectToDb error:', err);
    throw new Error(`Gagal menyimpan project ke IndexedDB (${msg})`);
  }
}

export async function loadProjectFromDb(id: string): Promise<MooProject | null> {
  try {
    const project = await db.projects.get(id);
    if (!project) return null;
    const storedAudio = await db.audioBlobs.get(id);
    if (storedAudio) {
      project.audioBlob = storedAudio.blob;
      lastSavedAudioBlobRef = storedAudio.blob;
    }
    return project;
  } catch (err: unknown) {
    console.warn('Failed to load project from IndexedDB', err);
    return null;
  }
}

export async function listProjectsFromDb(): Promise<MooProject[]> {
  try {
    const projects = await db.projects.toArray();
    return projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn('Failed to list projects from IndexedDB', err);
    return [];
  }
}

export async function deleteProjectFromDb(id: string): Promise<void> {
  try {
    await db.projects.delete(id);
    await db.audioBlobs.delete(id);
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

export async function putCachedSceneAudio(item: CachedSceneAudio): Promise<void> {
  try {
    await db.sceneAudioCache.put(item);
  } catch (err) {
    console.warn('Failed to write sceneAudioCache:', err);
  }
}

export async function getCacheSize(): Promise<number> {
  let size = 0;
  try {
    const audios = await db.audioBlobs.toArray();
    for (const a of audios) {
      if (a.blob) size += a.blob.size;
    }
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
    await db.audioBlobs.clear();
    await db.sceneAudioCache.clear();
    lastSavedAudioBlobRef = null;
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
