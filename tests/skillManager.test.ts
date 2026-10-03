import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/mooDb';
import {
  BUILTIN_SKILLS,
  initializeSkills,
  getAllSkills,
  addCustomSkill,
  updateSkill,
  deleteSkill,
  exportSkillToJson,
  importSkillFromJson
} from '../src/engine/skills/skillManager';

describe('Skill Manager', () => {
  beforeEach(async () => {
    await db.skills.clear();
  });

  it('initializes and populates built-in skills', async () => {
    const skills = await initializeSkills();
    expect(skills.length).toBe(BUILTIN_SKILLS.length);
    for (const builtin of BUILTIN_SKILLS) {
      expect(skills.some((s) => s.id === builtin.id)).toBe(true);
    }
  });

  it('allows adding, updating, and deleting custom skills', async () => {
    await initializeSkills();

    const created = await addCustomSkill({
      name: 'Custom Marketing Voice',
      icon: 'sparkles',
      description: 'Engaging sales copy',
      systemPrompt: 'Be punchy and direct.'
    });

    expect(created.id).toContain('custom-skill-');
    expect(created.isBuiltin).toBe(false);

    // Verify it exists in all skills
    let all = await getAllSkills();
    expect(all.some((s) => s.id === created.id)).toBe(true);

    // Update
    await updateSkill({
      ...created,
      name: 'Updated Marketing Voice'
    });

    all = await getAllSkills();
    const updated = all.find((s) => s.id === created.id);
    expect(updated?.name).toBe('Updated Marketing Voice');

    // Delete
    await deleteSkill(created.id);
    all = await getAllSkills();
    expect(all.some((s) => s.id === created.id)).toBe(false);
  });

  it('strictly protects built-in skills from edit or deletion', async () => {
    await initializeSkills();
    const builtin = BUILTIN_SKILLS[0];

    // Attempting to edit a built-in skill must throw
    await expect(
      updateSkill({
        ...builtin,
        name: 'Hacked Builtin'
      })
    ).rejects.toThrow('Built-in skills cannot be edited.');

    // Attempting to delete a built-in skill must throw
    await expect(deleteSkill(builtin.id)).rejects.toThrow('Built-in skills cannot be deleted.');
  });

  it('exports and re-imports custom skills correctly', async () => {
    await initializeSkills();

    const skill = await addCustomSkill({
      name: 'Documentary Director',
      icon: 'brain',
      description: 'Slow investigative pacing',
      systemPrompt: 'Focus on facts and dramatic questions.'
    });

    const exportedJson = exportSkillToJson(skill);
    expect(exportedJson).toContain('Documentary Director');

    const imported = await importSkillFromJson(exportedJson);
    expect(imported.name).toBe('Documentary Director');
    expect(imported.icon).toBe('brain');
    expect(imported.isBuiltin).toBe(false);
  });

  it('rejects invalid JSON or schema violations on import', async () => {
    // Malformed JSON
    await expect(importSkillFromJson('{ invalid json')).rejects.toThrow('Invalid JSON format.');

    // Missing required system prompt
    const invalidPayload = JSON.stringify({
      name: 'Missing Prompt',
      icon: 'zap'
    });
    await expect(importSkillFromJson(invalidPayload)).rejects.toThrow('Skill validation failed');

    // System prompt exceeding 8KB
    const oversizedPayload = JSON.stringify({
      name: 'Huge Prompt',
      icon: 'zap',
      systemPrompt: 'A'.repeat(9000)
    });
    await expect(importSkillFromJson(oversizedPayload)).rejects.toThrow('cannot exceed 8KB');
  });
});
