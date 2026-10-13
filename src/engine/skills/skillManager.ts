import type { PersonaSkill } from '../../types';
import { db } from '../../db/mooDb';

export function resolveSkillIcon(icon?: string): string {
  if (!icon) return 'auto_awesome';
  const clean = icon.toLowerCase().trim();
  switch (clean) {
    case 'sparkles':
    case 'sparkle':
    case 'magic':
      return 'auto_awesome';
    case 'zap':
    case 'lightning':
      return 'bolt';
    case 'brain':
    case 'mind':
      return 'psychology';
    case 'flame':
    case 'fire':
      return 'local_fire_department';
    case 'mascot':
      return 'smart_toy';
    case 'code':
      return 'code';
    case 'palette':
      return 'palette';
    default:
      return icon;
  }
}

export const BUILTIN_SKILLS: PersonaSkill[] = [
  {
    id: 'skill-creative-director',
    name: 'Creative Director',
    icon: 'palette',
    description: 'Adaptif, ekspresif, dan visual-first. Bebas template kaku.',
    systemPrompt: `Style: Adaptif, ekspresif, dan berfokus pada kekuatan penceritaan visual yang segar.
Pacing: Mengalir dinamis sesuai emosi dan konteks topik cerita pengguna.
Tone: Sutradara kreatif yang mengutamakan analogi visual konkret, metafora orisinal, dan kejelasan konsep.
Vocabulary: Alami, variatif, dan persuasif tanpa batasan kata sempit.
Motion Personality: Gerakan kinetik organik dan sinematik yang mengekspresikan esensi ide secara hidup.`,
    isBuiltin: true
  },
  {
    id: 'skill-tech-explainer',
    name: 'Tech Explainer',
    icon: 'bolt',
    description: 'Penjelasan sistematis, tajam, dengan logika visual berstruktur.',
    systemPrompt: `Style: Penjelasan konsep dan teknologi secara jernih, tajam, dan berenergi.
Pacing: Mantap, lugas, mengalir terstruktur tanpa basa-basi berlebih.
Tone: Pakar yang menguraikan konsep rumit menjadi analogi logis yang mudah dipahami.
Vocabulary: Istilah relevan dan akurat sesuai topik teknis yang dibahas secara proporsional.
Highlight words: Kata kerja kunci, mekanisme, dan konsep inti.
Motion Personality: Presisi, snappy, kaya diagram alur, skematik visual, dan transisi vektor kinetik.`,
    isBuiltin: true
  },
  {
    id: 'skill-viral-hook',
    name: 'Viral Hook',
    icon: 'psychology',
    description: 'Hook 3 detik pertama yang kuat, format penceritaan memikat.',
    systemPrompt: `Style: Format penceritaan short-form dengan daya pikat dan retensi tinggi.
Pacing: Pembuka memikat rasa ingin tahu (curiosity gap) diikuti perkembangan cerita yang dinamis.
Tone: Provokatif, dramatis, dan penuh wawasan menarik.
Structure: Scene 1 wajib menjadi pemikat perhatian utama (pattern interrupt).
Highlight words: Poin kejutan, paradoks, angka kunci, dan kata aksi.
Motion Personality: Pergerakan kamera dinamis, titik fokus berkontras tinggi, dan transformasi visual dramatis.`,
    isBuiltin: true
  },
  {
    id: 'skill-chill-lofi',
    name: 'Chill Lofi Story',
    icon: 'auto_awesome',
    description: 'Tempo tenang, kalimat puitis dan estetis, transisi halus.',
    systemPrompt: `Style: Narasi reflektif, tenang, dan kontemplatif dengan ruang estetis.
Pacing: Mengalir santai dan teratur, memberi ruang bernapas bagi penonton.
Tone: Tenang, hangat, puitis, dan berwawasan mendalam.
Highlight words: Jangkar emosional dan metafora visual bermakna.
Motion Personality: Spatial drift halus, elemen mengambang organik, dan transisi parallax lembut.`,
    isBuiltin: true
  }
];

export async function initializeSkills(): Promise<PersonaSkill[]> {
  const existing = await db.skills.toArray();
  const _existingIds = new Set(existing.map((s) => s.id));

  // Ensure built-in skills are always present and updated in DB
  for (const builtin of BUILTIN_SKILLS) {
    await db.skills.put(builtin);
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
