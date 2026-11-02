import type { AspectRatio } from '../../types';
import {
  ALL_STARTER_TEMPLATES,
  findStarterTemplate,
  getShowcasePreset,
  getStarterTemplates,
  type MooShowcasePreset,
  type StarterProjectTemplate
} from '@mooscript/presets';
import { getLocale } from '../../i18n';

export interface TemplateScene {
  narration: string;
  focusWords: string[];
  visualIntent: string;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  aspectRatio: AspectRatio;
  scenes: TemplateScene[];
  presetSlug?: string;
}

const toProjectTemplate = (tpl: StarterProjectTemplate): ProjectTemplate => ({
  id: tpl.id,
  title: tpl.title,
  description: tpl.description,
  icon: tpl.icon,
  aspectRatio: tpl.aspectRatio,
  scenes: tpl.scenes,
  presetSlug: tpl.presetSlug
});

/** Starter storyboards & pre-compiled MooTween showcase presets from @mooscript/presets, in Indonesian. */
export const PROJECT_TEMPLATES: ProjectTemplate[] = ALL_STARTER_TEMPLATES.map(toProjectTemplate);

/** The same starters in the interface language, for the template picker. */
export function getProjectTemplates(): ProjectTemplate[] {
  return getStarterTemplates(getLocale()).map(toProjectTemplate);
}

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  const found = findStarterTemplate(id, getLocale());
  return found ? toProjectTemplate(found) : undefined;
}

export function getPrecompiledShowcase(idOrSlug: string): MooShowcasePreset | undefined {
  return getShowcasePreset(idOrSlug);
}
