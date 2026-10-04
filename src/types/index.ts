export type SceneTransition = 'cut' | 'fade' | 'slide';
export type CaptionStyle = 'boxed' | 'karaoke' | 'bold-pop' | 'minimal';
export type CaptionPosition = 'top' | 'center' | 'bottom';
export type BgmPreset = 'none' | 'ambient' | 'hiphop' | 'cinematic' | 'lofi';

// Legacy (pre-generative) vocabulary. Kept ONLY so old projects can be read & migrated.
export type MotionPreset = 'punch_zoom' | 'slide_split' | 'fade_float' | 'kinetic_shake';
export type CameraMovement = 'push_in' | 'pull_out' | 'snap_zoom' | 'whip_pan' | 'steady_drift';
export type { LegacyLayoutType, LegacyVisualData } from './legacy';
import type { LegacyLayoutType, LegacyVisualData } from './legacy';

export type AspectRatio = '9:16' | '16:9' | '1:1';
/** 'legacy-canvas' only exists for un-migrated projects; migration converts them to 'composition'. */
export type RenderMode = 'composition' | 'legacy-canvas';

/* ------------------------------------------------------------------ *
 * A. CREATIVE PLAN — what we want to make
 * ------------------------------------------------------------------ */
export interface CreativeBrief {
  topic: string;
  audience?: string;
  goal?: string;
  aspectRatio: AspectRatio;
  targetDurationSec: number;
  visualDirection?: string;
  references?: string;
}

/* ------------------------------------------------------------------ *
 * B. STORYBOARD — what each beat must communicate (no layout, no code)
 * ------------------------------------------------------------------ */
export interface StoryBeat {
  id: string;
  narration: string;
  visualIntent: string;
  visualConcept?: string;
  visualElements?: string[];
  motionIntent?: string;
  cameraIntent?: string;
  transitionIntent?: string;
  emphasis?: string[];
  mood?: string;
  durationHint?: number;
  locked?: boolean;
}

export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * A storyboard beat placed on the timeline. `id` is the immutable scene identity:
 * the generated scene in the composition references it as `beatId`.
 *
 * Scene intentionally has NO layout / template field. The `@deprecated legacy`
 * fields are only populated on projects created before the generative rebuild
 * and are consumed exclusively by `migrateLegacyProject()`.
 */
export interface Scene {
  id: string;
  narrationText: string; // may be '' — narration is optional
  durationInSeconds: number;
  /** When true, narration edits never recompute the duration (set by AI pacing or manual edit). */
  durationLocked?: boolean;
  wordTimestamps: WordTimestamp[];
  showSubtitles?: boolean;

  // Storyboard intent (StoryBeat fields)
  visualIntent?: string;
  visualConcept?: string;
  visualElements?: string[];
  motionIntent?: string;
  cameraIntent?: string;
  transitionIntent?: string;
  emphasis?: string[];
  mood?: string;
  locked?: boolean;

  /** @deprecated legacy — migration only */
  layout?: LegacyLayoutType;
  /** @deprecated legacy — migration only */
  visualData?: LegacyVisualData;
  /** @deprecated legacy — migration only */
  motionPreset?: MotionPreset;
  /** @deprecated legacy — migration only */
  camera?: CameraMovement;
  /** @deprecated legacy — migration only */
  transition?: SceneTransition;
  /** @deprecated legacy — migration only */
  text?: string;
  /** @deprecated legacy — migration only */
  focusWords?: string[];
  /** @deprecated legacy — migration only */
  icon?: string;
}

/** Style = direction, never composition. */
export interface StyleBrief {
  adjectives: string[];
  palette: {
    bg: string;
    primary: string;
    accent: string;
    text: string;
    source?: string;
  };
  fontDisplay: string;
  fontBody: string;
  backgroundLanguage: string;
  motionSignature: string;
  texture?: string;
  lighting?: string;
  density?: string;
  transitionPlan?: string;
  heroMoment?: string;
}

/* ------------------------------------------------------------------ *
 * C. GENERATED COMPOSITION — how the idea is actually rendered
 * ------------------------------------------------------------------ */
export type EditableLayerType = 'text' | 'shape' | 'group' | 'image' | 'svg' | 'custom';

export interface EditableLayer {
  id: string;
  label: string;
  type: EditableLayerType;
  editableProperties?: string[];
}

/** Non-destructive user adjustments applied on top of generated code (via CSS individual transforms). */
export interface LayerOverride {
  x?: number; // px
  y?: number; // px
  scale?: number;
  rotation?: number; // deg
  opacity?: number; // 0..1 multiplier
  color?: string;
}

export interface ScenePalette {
  bg: string;
  primary: string;
  accent: string;
  text: string;
}

export type GeneratedSceneStatus = 'pending' | 'generating' | 'ok' | 'error';

export interface GeneratedScene {
  /** Immutable scene identity (equals the owning Scene.id). */
  id: string;
  beatId: string;
  duration: number;
  html: string;
  css: string;
  buildJs: string;
  editableLayers?: EditableLayer[];
  generatorVersion?: string;
  status: GeneratedSceneStatus;
  errors?: string[];
  version: number;
  userEdited: boolean;

  /** Per-layer non-destructive tweaks (position / scale / rotation / opacity / color). */
  overrides?: Record<string, LayerOverride>;
  /** Per-scene palette tweaks, exposed to generated CSS as --moo-* variables. */
  palette?: Partial<ScenePalette>;
  transitionOut?: string;
}

/** Alias kept for readability in the engine; a SceneModule IS a GeneratedScene. */
export type SceneModule = GeneratedScene;

export interface Composition {
  id: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  globalCss?: string;
  globalBuildJs?: string;
  scenes: GeneratedScene[];
  createdAt: number;
  updatedAt?: number;
}

/** Narration / music is an OPTIONAL layer that never gates composition generation. */
export interface AudioTrack {
  blob: Blob;
  duration: number;
  source: 'tts' | 'upload';
}

export interface MooProject {
  id: string;
  title: string;
  /** 2 = generative composition format. Absent/1 = legacy template-era project. */
  schemaVersion?: number;
  renderMode?: RenderMode;
  aspectRatio: AspectRatio;
  resolution?: '1080p' | '720p';
  fps: number; // default 30
  width: number;
  height: number;
  brief?: CreativeBrief;
  styleBrief?: StyleBrief;
  composition?: Composition;
  theme: {
    bg: string;
    textPrimary: string;
    textHighlight: string;
    fontFamily: 'Jakarta' | 'Mono' | 'Impact';
    captionStyle: CaptionStyle;
    captionPosition: CaptionPosition;
    showSubtitles?: boolean;
  };
  /** Storyboard beats placed on the timeline (the composition is stored separately). */
  scenes: Scene[];
  audioBlob?: Blob;
  audioDuration: number;
  bgm: {
    preset: BgmPreset;
    level: number;
    duckRatio: number;
  };
  createdAt?: number;
  updatedAt?: number;
}

export const CURRENT_SCHEMA_VERSION = 2;

export interface PersonaSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  isBuiltin?: boolean;
}

export type LLMProvider = 'gemini' | 'openai' | 'groq' | 'anthropic' | 'openrouter';
export type TTSProvider = 'openai' | 'elevenlabs' | 'fallback' | 'local';

export interface EngineSettings {
  apiKeys: {
    gemini?: string;
    openai?: string;
    groq?: string;
    anthropic?: string;
    openrouter?: string;
    elevenlabs?: string;
  };
  apiKeyStorage?: 'persistent' | 'session';
  outputLanguage?: 'id' | 'en' | 'auto';
  selectedLLMProvider: LLMProvider;
  selectedTTSProvider: TTSProvider;
  geminiModel: string;
  openaiModel: string;
  groqModel: string;
  anthropicModel?: string;
  openrouterModel?: string;
  voiceIds: {
    openai: string;
    elevenlabs: string;
    local: string;
  };
  speed: number;
  stability: number;
  duckingDb: number;
  fps: number;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  durationMs?: number;
}

