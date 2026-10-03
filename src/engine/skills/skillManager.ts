import type { PersonaSkill } from '../../types';
import { db } from '../../db/mooDb';

export const BUILTIN_SKILLS: PersonaSkill[] = [
  {
    id: 'skill-tech-explainer',
    name: '⚡ Tech Explainer',
    icon: 'zap',
    description: 'Fast tempo, punchy words, concise architectural logic.',
    systemPrompt: `Style: High-velocity technical explanation.
Pacing: Fast, energetic, zero fluff.
Tone: Expert systems engineer breaking down a hard technical concept.
Vocabulary: Use crisp modern tech terms (WebCodecs, zero-server, latency, memory-safety, pipeline).
Word limit: 12-18 words per scene.
Highlight words: Core verbs and technologies.`,
    isBuiltin: true
  },
  {
    id: 'skill-viral-hook',
    name: '🧠 Viral Hook',
    icon: 'brain',
    description: 'Aggressive first 3 seconds, curiosity gap phrasing.',
    systemPrompt: `Style: Addictive short-form hook format.
Pacing: Rapid-fire opening curiosity gap followed by rapid revelations.
Tone: Provocative, dramatic, counter-intuitive insight.
Structure: Scene 1 MUST be an irresistible pattern interrupt.
Word limit: 10-16 words per scene.
Highlight words: Surprising revelations, paradoxes, numbers.`,
    isBuiltin: true
  },
  {
    id: 'skill-chill-lofi',
    name: '☕ Chill Lofi Story',
    icon: 'sparkles',
    description: 'Relaxed cadence, poetic sentences, subtle kinetic transitions.',
    systemPrompt: `Style: Reflective, serene, contemplative storytelling.
Pacing: Measured and smooth with breathing room.
Tone: Calm, aesthetic, thoughtful.
Word limit: 14-22 words per scene.
Highlight words: Emotional anchors and evocative metaphors.`,
    isBuiltin: true
  }
];

export async function initializeSkills(): Promise<PersonaSkill[]> {
  const existing = await db.skills.toArray();
  const existingIds = new Set(existing.map((s) => s.id));

  // Ensure built-in skills are always present in DB
  for (const builtin of BUILTIN_SKILLS) {
    if (!existingIds.has(builtin.id)) {
      await db.skills.put(builtin);
    }
  }

  return await db.skills.toArray();
}

export async function getAllSkills(): Promise<PersonaSkill[]> {
  const skills = await db.skills.toArray();
  if (skills.length === 0) {
    return await initializeSkills();
  }
  return skills;
}

export async function addCustomSkill(skill: Omit<PersonaSkill, 'id' | 'isBuiltin'>): Promise<PersonaSkill> {
  const newSkill: PersonaSkill = {
    ...skill,
    id: `custom-skill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    isBuiltin: false
  };
  await db.skills.put(newSkill);
  return newSkill;
}

export async function updateSkill(skill: PersonaSkill): Promise<void> {
  if (skill.isBuiltin) {
    throw new Error('Built-in skills cannot be edited.');
  }
  await db.skills.put(skill);
}

export async function deleteSkill(id: string): Promise<void> {
  const skill = await db.skills.get(id);
  if (skill?.isBuiltin) {
    throw new Error('Built-in skills cannot be deleted.');
  }
  await db.skills.delete(id);
}

import { z } from 'zod';

const SkillImportSchema = z
  .object({
    name: z.string().min(1, 'Skill name is required').max(100, 'Skill name cannot exceed 100 characters'),
    icon: z.enum(['mascot', 'zap', 'brain', 'sparkles', 'flame', 'code']).catch('sparkles'),
    description: z.string().max(500, 'Description cannot exceed 500 characters').default('Imported custom skill'),
    systemPrompt: z
      .string()
      .min(1, 'System prompt is required')
      .max(8192, 'System prompt cannot exceed 8KB (8192 characters)')
  })
  .strip();

export function exportSkillToJson(skill: PersonaSkill): string {
  const exportable = {
    name: skill.name,
    icon: skill.icon,
    description: skill.description,
    systemPrompt: skill.systemPrompt,
    exportedAt: new Date().toISOString(),
    generator: 'MooScript Studio'
  };
  return JSON.stringify(exportable, null, 2);
}

export async function importSkillFromJson(jsonString: string): Promise<PersonaSkill> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format.');
  }

  const result = SkillImportSchema.safeParse(parsed);
  if (!result.success) {
    const errorMsg = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Skill validation failed: ${errorMsg}`);
  }

  const valid = result.data;
  return await addCustomSkill({
    name: valid.name,
    icon: valid.icon,
    description: valid.description,
    systemPrompt: valid.systemPrompt
  });
}
