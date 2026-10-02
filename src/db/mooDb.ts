import Dexie, { type Table } from 'dexie';
import type { MooProject, PersonaSkill, EngineSettings } from '../types';

export interface StoredAudio {
  projectId: string;
  blob: Blob;
  updatedAt: number;
}

export class MooDatabase extends Dexie {
  projects!: Table<MooProject, string>;
  audioBlobs!: Table<StoredAudio, string>;
  skills!: Table<PersonaSkill, string>;
  settings!: Table<{ id: string; data: EngineSettings }, string>;

  constructor() {
    super('MooScriptDB');
    this.version(1).stores({
      projects: 'id, title, updatedAt',
      audioBlobs: 'projectId, updatedAt',
      skills: 'id, name, isBuiltin',
      settings: 'id'
    });
  }
}

export const db = new MooDatabase();

export async function saveProjectToDb(project: MooProject) {
  // Store project data without blob in the project record
  const { audioBlob, ...cleanProject } = project;
  await db.projects.put(cleanProject as MooProject);
  if (audioBlob) {
    await db.audioBlobs.put({
      projectId: project.id,
      blob: audioBlob,
      updatedAt: Date.now()
    });
  }
}

export async function loadProjectFromDb(id: string): Promise<MooProject | null> {
  const project = await db.projects.get(id);
  if (!project) return null;
  const storedAudio = await db.audioBlobs.get(id);
  if (storedAudio) {
    project.audioBlob = storedAudio.blob;
  }
  return project;
}

export async function getCacheSize(): Promise<number> {
  let size = 0;
  try {
    const audios = await db.audioBlobs.toArray();
    for (const a of audios) {
      size += a.blob.size;
    }
  } catch (err) {
    console.warn('Error reading cache size', err);
  }
  return size;
}

export async function clearAllCache(): Promise<void> {
  await db.audioBlobs.clear();
}
