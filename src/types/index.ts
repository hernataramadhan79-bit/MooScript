export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number; // in seconds
}

export type MotionPreset = 'punch_zoom' | 'slide_split' | 'fade_float' | 'kinetic_shake';
export type SceneTransition = 'cut' | 'fade' | 'slide';
export type CaptionStyle = 'boxed' | 'karaoke' | 'bold-pop' | 'minimal';
export type CaptionPosition = 'top' | 'center' | 'bottom';
export type BgmPreset = 'none' | 'ambient' | 'hiphop' | 'cinematic' | 'lofi';
export type CameraMovement = 'push_in' | 'pull_out' | 'snap_zoom' | 'whip_pan' | 'steady_drift';

export type LayoutType =
  | 'KINETIC_QUOTE'     // Dynamic typography with focus word punch & bounce
  | 'METRIC_COUNTER'    // Animated rolling numbers + label + circular progress
  | 'TERMINAL_MOCKUP'   // macOS terminal card + syntax typewriter animation
  | 'VS_COMPARISON'     // Side-by-side battle card split
  | 'LIST_STAGGER';     // Staggered bullet points appearing sequentially

export interface VisualData {
  title?: string;
  metricValue?: string;      // e.g. "+400%", "99.9%"
  metricLabel?: string;      // e.g. "User Growth", "Uptime"
  codeSnippet?: string;      // Shell or JS code
  codeLanguage?: string;
  leftTitle?: string;        // For VS_COMPARISON
  leftDesc?: string;
  rightTitle?: string;
  rightDesc?: string;
  bulletItems?: string[];    // For LIST_STAGGER
  accentIcon?: string;
  focusWords?: string[];     // For KINETIC_QUOTE punch
}

export interface Scene {
  id: string;
  layout: LayoutType;
  narrationText: string;     // Text fed to TTS
  visualData: VisualData;
  durationInSeconds: number;
  wordTimestamps: WordTimestamp[];
  motionPreset: MotionPreset;
  camera?: CameraMovement;
  transition?: SceneTransition;
  showSubtitles?: boolean;   // Optional subtitle overlay toggle

  /** Legacy / backwards compatibility fallbacks */
  text?: string;
  focusWords?: string[];
  icon?: string;
}

export type AspectRatio = '9:16' | '16:9' | '1:1';
export type RenderMode = 'composition' | 'legacy-canvas';

export interface CreativeBrief {
  topic: string;
  audience?: string;
  goal?: 'promo' | 'explainer' | 'opener' | 'kinetic' | 'social-hook' | 'custom';
  aspectRatio: AspectRatio;
  targetDurationSec: number;
  styleDirection?: string;
  brand?: {
    name?: string;
    colors?: string[];
    logoAssetId?: string;
  };
  references?: string;
}

export interface StoryBeat {
  id: string;
  narration: string;
  visualIntent: string;
  onScreenText?: string;
  assetIds?: string[];
  durationHint?: number;
  mood?: string;
  locked?: boolean;
}

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
  transitionPlan?: string;
  heroMoment?: string;
}

export interface SceneModule {
  beatId: string;
  html: string;
  css: string;
  buildJs: string;
  transitionOut?: string;
  status: 'pending' | 'generating' | 'ok' | 'error';
  errors?: string[];
  version: number;
  userEdited?: boolean;
}

export interface Composition {
  id: string;
  width: number;
  height: number;
  fps: number;
  globalCss: string;
  globalBuildJs?: string;
  scenes: SceneModule[];
  createdAt: number;
  updatedAt?: number;
}

export interface MooProject {
  id: string;
  title: string;
  renderMode?: RenderMode;
  aspectRatio: AspectRatio;
  resolution?: '1080p' | '720p';
  fps: number; // default 30
  width: number;
  height: number;
  brief?: CreativeBrief;
  beats?: StoryBeat[];
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

