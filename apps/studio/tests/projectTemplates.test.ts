import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/mooDb';
import { PROJECT_TEMPLATES, getProjectTemplate } from '../src/engine/templates/projectTemplates';
import { useMooStore } from '../src/store/useMooStore';

describe('project templates', () => {
  it('have unique ids and at least one scene with narration', () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tpl of PROJECT_TEMPLATES) {
      expect(tpl.scenes.length).toBeGreaterThan(0);
      for (const scene of tpl.scenes) {
        expect(scene.narration.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('looks templates up by id', () => {
    expect(getProjectTemplate('three-facts')?.title).toBe('Tiga Fakta Cepat');
    expect(getProjectTemplate('nope')).toBeUndefined();
  });
});

describe('createProjectFromTemplate', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await useMooStore.getState().refreshProjectsList();
  });

  it('creates an active project with the template scenes, size and aspect ratio', async () => {
    const template = getProjectTemplate('tutorial-steps')!;
    const id = await useMooStore.getState().createProjectFromTemplate(template.id);

    const { project, projectsList } = useMooStore.getState();
    expect(id).not.toBe('');
    expect(project.id).toBe(id);
    expect(project.title).toBe(template.title);
    expect(project.scenes).toHaveLength(template.scenes.length);
    expect(project.scenes.map((s) => s.narrationText)).toEqual(template.scenes.map((s) => s.narration));
    expect(project.aspectRatio).toBe('16:9');
    expect(project.width).toBe(1920);
    expect(project.height).toBe(1080);
    expect(projectsList.some((p) => p.id === id)).toBe(true);
  });

  it('returns an empty id and leaves the project untouched for an unknown template', async () => {
    const before = useMooStore.getState().project.id;
    expect(await useMooStore.getState().createProjectFromTemplate('missing')).toBe('');
    expect(useMooStore.getState().project.id).toBe(before);
  });
});
