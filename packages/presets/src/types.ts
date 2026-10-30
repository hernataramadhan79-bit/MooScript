export type PresetAspectRatio = '9:16' | '16:9' | '1:1';
export type PresetCategory = 'kinetic' | 'data' | 'code' | 'story';

export interface LocalizedString {
  en: string;
  id: string;
}

export interface PresetWordBeat {
  word: string;
  start: number;
  end: number;
}

export interface PresetShotCode {
  id: string;
  durationInSeconds: number;
  narration: LocalizedString;
  focusWords: {
    en: string[];
    id: string[];
  };
  visualIntent: LocalizedString;
  wordTimestamps: PresetWordBeat[];
  palette: {
    bg: string;
    primary: string;
    accent: string;
    text: string;
  };
  html: string;
  css: string;
  /** Pure MooTween shot code: runs as (shot, root, ctx, MooTween) */
  buildJs: string;
}

export interface MooShowcasePreset {
  /** URL slug for /templates/[slug] and Studio deep-link ?template=[slug] */
  slug: string;
  /** Short label used in the Hero Playground tabs */
  tabLabel: LocalizedString;
  title: LocalizedString;
  seoTitle: LocalizedString;
  summary: LocalizedString;
  howItWorks: {
    en: string[];
    id: string[];
  };
  targetKeywords: {
    en: string[];
    id: string[];
  };
  category: PresetCategory;
  aspectRatio: PresetAspectRatio;
  width: number;
  height: number;
  fps: number;
  icon: string;
  shots: PresetShotCode[];
}

export interface StarterTemplateScene {
  narration: string;
  focusWords: string[];
  visualIntent: string;
}

export interface StarterProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  aspectRatio: PresetAspectRatio;
  scenes: StarterTemplateScene[];
  /** Optional pre-compiled MooTween showcase preset backing this template */
  presetSlug?: string;
}
