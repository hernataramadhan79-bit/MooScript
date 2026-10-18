import type { MooProject } from '../types';
import { normalizeProject } from './mooDb';
import { validateSceneCode } from '../engine/composition/validator';

export const BACKUP_FORMAT = 'mooscript-project';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/**
 * Serialize a project to a portable JSON backup. The audio blob is intentionally
 * omitted: audio can be re-synthesized from narration and is cached separately.
 */
export function serializeProjectBackup(project: MooProject): string {
  const { audioBlob: _audioBlob, ...rest } = project;
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    project: rest
  });
}

export function parseProjectBackup(text: string): MooProject {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) {
    throw new Error('Berkas terlalu besar (maks 20 MB).');
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File bukan JSON yang valid.');
  }

  const envelope = data as { format?: unknown; version?: unknown; project?: unknown } | null;
  if (!envelope || typeof envelope !== 'object' || envelope.format !== BACKUP_FORMAT) {
    throw new Error('Berkas ini bukan cadangan proyek MooScript.');
  }
  if (envelope.version !== BACKUP_VERSION) {
    throw new Error('Versi cadangan tidak didukung.');
  }

  const project = envelope.project as MooProject | null | undefined;
  if (!project || typeof project !== 'object' || !Array.isArray(project.scenes)) {
    throw new Error('Data proyek rusak.');
  }

  const normalized = normalizeProject(project);
  if (normalized.composition?.scenes) {
    for (const scene of normalized.composition.scenes) {
      const check = validateSceneCode({
        html: scene.html,
        css: scene.css,
        buildJs: scene.buildJs
      });
      if (!check.valid) {
        throw new Error(`Kode adegan pada cadangan tidak lolos validasi keamanan: ${check.errors[0]}`);
      }
    }
  }
  return normalized;
}
