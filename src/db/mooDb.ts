import Dexie, { type Table } from 'dexie';
import type { MooProject, PersonaSkill, EngineSettings, WordTimestamp } from '../types';
import { CURRENT_SCHEMA_VERSION, migrateLegacyScene, resolveTheme } from '../types';
import { migrateLegacyProject } from '../engine/composition/migrate';

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

    // Version 4: Asset storage & Composition history
    this.version(4).stores({
      projects: 'id, title, renderMode, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id',
      sceneAudioCache: 'cacheKey, updatedAt',
      assets: 'id, projectId, name, mimeType, createdAt'
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
    return migrateLegacyProject(project);
  }
  return project;
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
