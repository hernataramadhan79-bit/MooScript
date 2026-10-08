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

/* ------------------------------------------------------------------ *
 * ATOMIC SCENE GRAPH & SEMANTIC THEMING (OVERHAUL)
 * ------------------------------------------------------------------ */
export type NodeType = 'container' | 'text' | 'shape' | 'metric' | 'code' | 'badge';

export interface NodeTransform {
  x: number; // Persentase lebar canvas (0 - 100)
  y: number; // Persentase tinggi canvas (0 - 100)
  width?: number;
  height?: number;
  scale: number;
  rotation: number; // derajat
  opacity: number;
}

export interface NodeStyle {
  fillToken?: 'primary' | 'accent' | 'surface' | 'text' | 'muted';
  customFill?: string;
  strokeToken?: string;
  strokeWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  borderRadius?: number;
  blur?: number;
  shadow?: { color: string; blur: number; offsetY: number };
}

export interface NodeAnimation {
  enter?: {
    type: 'spring_pop' | 'wipe_up' | 'blur_in' | 'typewriter';
    startAtSecond: number;
    duration: number;
    springConfig?: { stiffness: number; damping: number; mass: number };
  };
  active?: {
    type: 'karaoke_glow' | 'subtle_float' | 'counter_tick';
    intensity?: number;
  };
  exit?: {
    type: 'fade_out' | 'slide_down';
    startAtSecond: number;
    duration: number;
  };
}

export interface MotionNode {
  id: string;
  type: NodeType;
  transform: NodeTransform;
  style: NodeStyle;
  animation: NodeAnimation;
  content?: string; // Teks, label, atau kode
  extraProps?: Record<string, any>; // Nilai counter, items list, dll
  children?: MotionNode[];
}

export interface BackgroundConfig {
  type: 'solid' | 'mesh_gradient' | 'dot_grid' | 'bento_card';
  fillToken?: 'primary' | 'accent' | 'surface' | 'text' | 'muted' | 'bg';
  customFill?: string;
  blur?: number;
  opacity?: number;
}

export interface ThemeTokens {
  id: string;
  name: string;
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  muted: string;
}

export const BUILTIN_THEMES: ThemeTokens[] = [
  {
    id: 'brutalist-lime',
    name: 'Brutalist Lime',
    bg: '#0d0d0e',
    surface: '#18181b',
    primary: '#84cc16',
    accent: '#a3e635',
    text: '#f4f4f5',
    muted: '#71717a'
  },
  {
    id: 'electric-studio',
    name: 'Electric Studio',
    bg: '#080914',
    surface: '#12142b',
    primary: '#6366f1',
    accent: '#38bdf8',
    text: '#ffffff',
    muted: '#818cf8'
  },
  {
    id: 'minimal-monochrome',
    name: 'Minimal Monochrome',
    bg: '#09090b',
    surface: '#18181b',
    primary: '#f4f4f5',
    accent: '#ffffff',
    text: '#fafafa',
    muted: '#a1a1aa'
  },
  {
    id: 'neo-cyber',
    name: 'Neo Cyber',
    bg: '#030712',
    surface: '#111827',
    primary: '#06b6d4',
    accent: '#22c55e',
    text: '#f9fafb',
    muted: '#9ca3af'
  },
  {
    id: 'sunset-editorial',
    name: 'Sunset Editorial',
    bg: '#1c1017',
    surface: '#2c1824',
    primary: '#f43f5e',
    accent: '#fb923c',
    text: '#fff1f2',
    muted: '#fda4af'
  }
];

export const DEFAULT_THEMES = BUILTIN_THEMES;

export function resolveTheme(project?: MooProject | null, scene?: Scene | null): ThemeTokens {
  if (scene?.themeTokens && scene.themeTokens.bg && scene.themeTokens.text) {
    return {
      id: scene.themeTokens.id || 'custom-scene',
      name: scene.themeTokens.name || 'Custom Scene',
      bg: scene.themeTokens.bg,
      surface: scene.themeTokens.surface || '#18181b',
      primary: scene.themeTokens.primary || '#84cc16',
      accent: scene.themeTokens.accent || '#a3e635',
      text: scene.themeTokens.text,
      muted: scene.themeTokens.muted || '#71717a'
    };
  }

  if (project?.themeTokens) {
    return project.themeTokens;
  }

  if (project?.theme) {
    const pt = project.theme as any;
    return {
      id: 'project-theme',
      name: 'Project Theme',
      bg: pt.bg || '#0d0d0e',
      surface: pt.surface || '#18181b',
      primary: pt.primary || pt.textHighlight || '#84cc16',
      accent: pt.accent || pt.textHighlight || '#a3e635',
      text: pt.text || pt.textPrimary || '#f4f4f5',
      muted: pt.muted || '#71717a'
    };
  }

  return BUILTIN_THEMES[0];
}

/**
 * A storyboard beat placed on the timeline. `id` is the immutable scene identity:
 * the generated scene in the composition references it as `beatId`.
 */
export interface Scene {
  id: string;
  narrationText: string; // may be '' — narration is optional
  durationInSeconds: number;
  /** When true, narration edits never recompute the duration (set by AI pacing or manual edit). */
  durationLocked?: boolean;
  wordTimestamps: WordTimestamp[];
  showSubtitles?: boolean;

  // Atomic Scene Graph
  nodes?: MotionNode[];
  background?: BackgroundConfig;
  themeTokens?: Partial<ThemeTokens>;

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

export type LegacyScene = Scene;

/**
 * Converts legacy scene data (layout, visualData) into an atomic MotionNode scene tree.
 */
export function migrateLegacyScene(scene: LegacyScene): Scene {
  const duration = scene.durationInSeconds && scene.durationInSeconds > 0 ? scene.durationInSeconds : 3.0;

  if (scene.nodes && scene.nodes.length > 0) {
    return {
      ...scene,
      durationInSeconds: duration,
      background: scene.background || { type: 'dot_grid' },
      nodes: scene.nodes
    };
  }

  const rawText = scene.narrationText || scene.text || '';
  const title = scene.visualData?.title;
  const layout = scene.layout || 'KINETIC_QUOTE';
  const nodes: MotionNode[] = [];
  let background: BackgroundConfig = { type: 'dot_grid' };

  switch (layout) {
    case 'METRIC_COUNTER': {
      background = { type: 'bento_card' };
      const val = scene.visualData?.metricValue || '100%';
      const lbl = scene.visualData?.metricLabel || rawText || 'Performance';

      const children: MotionNode[] = [];
      if (title) {
        children.push({
          id: `${scene.id}-badge`,
          type: 'badge',
          transform: { x: 50, y: 15, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'accent', fontSize: 22, fontWeight: 700, borderRadius: 20 },
          animation: { enter: { type: 'spring_pop', startAtSecond: 0.1, duration: 0.5 } },
          content: title.toUpperCase()
        });
      }
      children.push({
        id: `${scene.id}-metric`,
        type: 'metric',
        transform: { x: 50, y: title ? 48 : 42, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'primary', fontSize: 80, fontWeight: 900 },
        animation: {
          enter: { type: 'spring_pop', startAtSecond: 0.2, duration: 0.8 },
          active: { type: 'counter_tick', intensity: 1 }
        },
        content: val,
        extraProps: { value: val }
      });
      children.push({
        id: `${scene.id}-label`,
        type: 'text',
        transform: { x: 50, y: title ? 78 : 72, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'muted', fontSize: 28, fontWeight: 600 },
        animation: { enter: { type: 'wipe_up', startAtSecond: 0.4, duration: 0.6 } },
        content: lbl
      });

      nodes.push({
        id: `${scene.id}-container`,
        type: 'container',
        transform: { x: 50, y: 50, width: 85, height: 46, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'surface', borderRadius: 24, strokeToken: 'primary', strokeWidth: 2 },
        animation: { enter: { type: 'spring_pop', startAtSecond: 0, duration: 0.6 } },
        children
      });
      break;
    }
    case 'TERMINAL_MOCKUP': {
      background = { type: 'dot_grid' };
      const codeSnippet = scene.visualData?.codeSnippet || rawText || '$ npm install mooscript';
      const codeLanguage = scene.visualData?.codeLanguage || 'terminal';

      const children: MotionNode[] = [
        {
          id: `${scene.id}-term-header`,
          type: 'badge',
          transform: { x: 50, y: 12, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'muted', fontSize: 20, fontFamily: 'Mono' },
          animation: { enter: { type: 'wipe_up', startAtSecond: 0.1, duration: 0.4 } },
          content: `mooscript-term — ${codeLanguage}`
        },
        {
          id: `${scene.id}-code`,
          type: 'code',
          transform: { x: 50, y: 56, width: 85, height: 65, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'text', fontSize: 24, fontFamily: 'Mono' },
          animation: { enter: { type: 'typewriter', startAtSecond: 0.3, duration: 1.2 } },
          content: codeSnippet,
          extraProps: { language: codeLanguage }
        }
      ];

      nodes.push({
        id: `${scene.id}-term-box`,
        type: 'container',
        transform: { x: 50, y: 50, width: 88, height: 48, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'surface', borderRadius: 20, strokeToken: 'muted', strokeWidth: 1.5 },
        animation: { enter: { type: 'wipe_up', startAtSecond: 0, duration: 0.5 } },
        children
      });
      break;
    }
    case 'VS_COMPARISON': {
      background = { type: 'mesh_gradient' };
      const lTitle = scene.visualData?.leftTitle || 'BEFORE';
      const lDesc = scene.visualData?.leftDesc || 'Slow, manual editing';
      const rTitle = scene.visualData?.rightTitle || 'AFTER';
      const rDesc = scene.visualData?.rightDesc || rawText || 'Fast automated rendering';

      nodes.push({
        id: `${scene.id}-vs-left`,
        type: 'container',
        transform: { x: 50, y: 32, width: 85, height: 26, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'surface', borderRadius: 16, strokeToken: 'muted', strokeWidth: 1 },
        animation: { enter: { type: 'spring_pop', startAtSecond: 0.1, duration: 0.6 } },
        children: [
          {
            id: `${scene.id}-vs-ltitle`,
            type: 'badge',
            transform: { x: 50, y: 28, scale: 1, rotation: 0, opacity: 1 },
            style: { fillToken: 'muted', fontSize: 20, fontWeight: 700 },
            animation: { enter: { type: 'spring_pop', startAtSecond: 0.15, duration: 0.4 } },
            content: lTitle.toUpperCase()
          },
          {
            id: `${scene.id}-vs-ldesc`,
            type: 'text',
            transform: { x: 50, y: 65, scale: 1, rotation: 0, opacity: 1 },
            style: { fillToken: 'text', fontSize: 26, fontWeight: 600 },
            animation: { enter: { type: 'wipe_up', startAtSecond: 0.25, duration: 0.5 } },
            content: lDesc
          }
        ]
      });

      nodes.push({
        id: `${scene.id}-vs-badge`,
        type: 'badge',
        transform: { x: 50, y: 49, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'accent', fontSize: 22, fontWeight: 900, borderRadius: 24 },
        animation: { enter: { type: 'spring_pop', startAtSecond: 0.3, duration: 0.5 } },
        content: 'VS'
      });

      nodes.push({
        id: `${scene.id}-vs-right`,
        type: 'container',
        transform: { x: 50, y: 68, width: 85, height: 26, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'surface', borderRadius: 16, strokeToken: 'accent', strokeWidth: 2 },
        animation: { enter: { type: 'spring_pop', startAtSecond: 0.4, duration: 0.6 } },
        children: [
          {
            id: `${scene.id}-vs-rtitle`,
            type: 'badge',
            transform: { x: 50, y: 28, scale: 1, rotation: 0, opacity: 1 },
            style: { fillToken: 'accent', fontSize: 20, fontWeight: 700 },
            animation: { enter: { type: 'spring_pop', startAtSecond: 0.45, duration: 0.4 } },
            content: rTitle.toUpperCase()
          },
          {
            id: `${scene.id}-vs-rdesc`,
            type: 'text',
            transform: { x: 50, y: 65, scale: 1, rotation: 0, opacity: 1 },
            style: { fillToken: 'text', fontSize: 26, fontWeight: 600 },
            animation: { enter: { type: 'wipe_up', startAtSecond: 0.55, duration: 0.5 } },
            content: rDesc
          }
        ]
      });
      break;
    }
    case 'LIST_STAGGER': {
      background = { type: 'bento_card' };
      let items = scene.visualData?.bulletItems;
      if (!items || items.length === 0) {
        items = rawText.split(/[.,;]\s+/).filter(Boolean);
        if (items.length === 0 && rawText) items = [rawText];
      }

      if (title) {
        nodes.push({
          id: `${scene.id}-list-title`,
          type: 'badge',
          transform: { x: 50, y: 20, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'accent', fontSize: 22, fontWeight: 700 },
          animation: { enter: { type: 'spring_pop', startAtSecond: 0.1, duration: 0.5 } },
          content: title.toUpperCase()
        });
      }

      const startY = title ? 32 : 25;
      const count = Math.min(items.length, 5);
      const spacing = 48 / Math.max(count, 1);

      items.slice(0, 5).forEach((item, idx) => {
        nodes.push({
          id: `${scene.id}-item-${idx}`,
          type: 'container',
          transform: { x: 50, y: startY + idx * spacing, width: 85, height: spacing * 0.8, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'surface', borderRadius: 14, strokeToken: idx === 0 ? 'primary' : 'muted', strokeWidth: 1 },
          animation: { enter: { type: 'wipe_up', startAtSecond: 0.2 + idx * 0.15, duration: 0.5 } },
          children: [
            {
              id: `${scene.id}-item-${idx}-num`,
              type: 'badge',
              transform: { x: 12, y: 50, scale: 1, rotation: 0, opacity: 1 },
              style: { fillToken: 'primary', fontSize: 18, fontFamily: 'Mono', fontWeight: 700 },
              animation: { enter: { type: 'spring_pop', startAtSecond: 0.25 + idx * 0.15, duration: 0.4 } },
              content: `0${idx + 1}`
            },
            {
              id: `${scene.id}-item-${idx}-text`,
              type: 'text',
              transform: { x: 55, y: 50, scale: 1, rotation: 0, opacity: 1 },
              style: { fillToken: 'text', fontSize: 24, fontWeight: 600 },
              animation: { enter: { type: 'wipe_up', startAtSecond: 0.3 + idx * 0.15, duration: 0.4 } },
              content: item
            }
          ]
        });
      });
      break;
    }
    case 'KINETIC_QUOTE':
    default: {
      background = { type: 'dot_grid' };
      if (title) {
        nodes.push({
          id: `${scene.id}-badge`,
          type: 'badge',
          transform: { x: 50, y: 25, scale: 1, rotation: 0, opacity: 1 },
          style: { fillToken: 'accent', fontSize: 22, fontWeight: 700, borderRadius: 20 },
          animation: { enter: { type: 'spring_pop', startAtSecond: 0.1, duration: 0.5 } },
          content: title.toUpperCase()
        });
      }

      const focusList = scene.visualData?.focusWords || scene.focusWords || [];
      nodes.push({
        id: `${scene.id}-text`,
        type: 'text',
        transform: { x: 50, y: 50, width: 85, scale: 1, rotation: 0, opacity: 1 },
        style: { fillToken: 'text', fontSize: 44, fontWeight: 800 },
        animation: {
          enter: { type: 'spring_pop', startAtSecond: 0.2, duration: 0.8 },
          active: { type: 'karaoke_glow', intensity: 1 }
        },
        content: rawText,
        extraProps: { focusWords: focusList }
      });
      break;
    }
  }

  return {
    ...scene,
    durationInSeconds: duration,
    background,
    nodes
  };
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
  themeTokens?: ThemeTokens;
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
  maxOutputTokens?: number;
  voiceIds: {
    openai: string;
    elevenlabs: string;
    local: string;
  };
  /** ElevenLabs TTS model id. Defaults to eleven_flash_v2_5 (cheapest, free-tier friendly). */
  elevenLabsModel?: string;
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

