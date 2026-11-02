export type {
  PresetAspectRatio,
  PresetCategory,
  LocalizedString,
  PresetWordBeat,
  PresetShotCode,
  MooShowcasePreset,
  StarterTemplateScene,
  StarterProjectTemplate
} from './types';

export { SHOWCASE_PRESETS, getShowcasePreset } from './showcasePresets';

export {
  LEGACY_STARTER_TEMPLATES,
  LEGACY_STARTER_TEMPLATES_EN,
  SHOWCASE_AS_STARTER_TEMPLATES,
  ALL_STARTER_TEMPLATES,
  getStarterTemplates,
  showcaseAsStarterTemplates,
  findStarterTemplate,
  type StarterLocale
} from './starterTemplates';

export { getOfficialMooScriptPrompt } from './aiSystemPrompt';
