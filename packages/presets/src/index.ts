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
  SHOWCASE_AS_STARTER_TEMPLATES,
  ALL_STARTER_TEMPLATES,
  findStarterTemplate
} from './starterTemplates';

export { getOfficialMooScriptPrompt } from './aiSystemPrompt';
