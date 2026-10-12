/**
 * tests/projectBackup.test.ts
 * Project backup (.json) serialization, validation, and store import.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db, saveProjectToDb, listProjectsFromDb } from '../src/db/mooDb';
import { parseProjectBackup, serializeProjectBackup, BACKUP_FORMAT } from '../src/db/projectBackup';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

const PROJECT: MooProject = {
  id: 'proj-backup-src',
  title: 'Backup Source',
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
      id: 'sc-backup-1',
      layout: 'KINETIC_QUOTE',
      narrationText: 'Backup scene one',
      text: 'Backup scene one',
      visualData: { title: 'Backup', focusWords: ['backup'] },
      focusWords: ['backup'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 2.0,
      wordTimestamps: []
    }
  ],
  audioDuration: 2.0,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('projectBackup serialize/parse', () => {
  it('roundtrips title and scene ids and never serializes audio', () => {
    const withAudio = { ...PROJECT, audioBlob: new Blob(['audio'], { type: 'audio/wav' }) };
    const text = serializeProjectBackup(withAudio);
    expect(text).not.toContain('audioBlob');

    const parsed = parseProjectBackup(text);
    expect(parsed.title).toBe('Backup Source');
    expect(parsed.scenes.map((s) => s.id)).toEqual(['sc-backup-1']);
    expect(parsed.audioBlob).toBeUndefined();
  });

  it('rejects invalid input with Indonesian messages', () => {
    expect(() => parseProjectBackup('not json {')).toThrow('File bukan JSON yang valid.');
    expect(() =>
      parseProjectBackup(JSON.stringify({ format: 'other', version: 1, project: PROJECT }))
    ).toThrow('Berkas ini bukan cadangan proyek MooScript.');
    expect(() => parseProjectBackup('null')).toThrow('Berkas ini bukan cadangan proyek MooScript.');
    expect(() =>
      parseProjectBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 2, project: PROJECT }))
    ).toThrow('Versi cadangan tidak didukung.');
    expect(() =>
      parseProjectBackup(
        JSON.stringify({ format: BACKUP_FORMAT, version: 1, project: { ...PROJECT, scenes: 'x' } })
      )
    ).toThrow('Data proyek rusak.');
    expect(() => parseProjectBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }))).toThrow(
      'Data proyek rusak.'
    );
  });
});

describe('Store importProject', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.audioBlobs.clear();
    await saveProjectToDb(PROJECT);
    useMooStore.getState().setProject(PROJECT);
    await useMooStore.getState().refreshProjectsList();
  });

  it('imports under a fresh id without switching the active project', async () => {
    const parsed = parseProjectBackup(serializeProjectBackup(PROJECT));
    const newId = await useMooStore.getState().importProject(parsed);

    expect(newId).not.toBe(PROJECT.id);
    const list = await listProjectsFromDb();
    const imported = list.find((p) => p.id === newId);
    expect(imported?.title).toBe('Backup Source');
    expect(list.some((p) => p.id === PROJECT.id)).toBe(true);
    expect(useMooStore.getState().project.id).toBe(PROJECT.id);
  });
});
