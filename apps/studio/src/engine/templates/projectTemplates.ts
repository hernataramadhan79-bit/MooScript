import type { AspectRatio } from '../../types';
import {
  ALL_STARTER_TEMPLATES,
  findStarterTemplate,
  getShowcasePreset,
  type MooShowcasePreset
} from '@mooscript/presets';

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

/** Starter storyboards & pre-compiled MooTween showcase presets from @mooscript/presets. */
export const PROJECT_TEMPLATES: ProjectTemplate[] = ALL_STARTER_TEMPLATES.map((tpl) => ({
  id: tpl.id,
  title: tpl.title,
  description: tpl.description,
  icon: tpl.icon,
  aspectRatio: tpl.aspectRatio,
  scenes: tpl.scenes,
  presetSlug: tpl.presetSlug
}));

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  const found = findStarterTemplate(id);
  if (!found) return undefined;
  return {
    id: found.id,
    title: found.title,
    description: found.description,
    icon: found.icon,
    aspectRatio: found.aspectRatio,
    scenes: found.scenes,
    presetSlug: found.presetSlug
  };
}

export function getPrecompiledShowcase(idOrSlug: string): MooShowcasePreset | undefined {
  return getShowcasePreset(idOrSlug);
}
