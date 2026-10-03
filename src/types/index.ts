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

export interface Scene {
  id: string;
  text: string;
  focusWords: string[];
  motionPreset: MotionPreset;
  icon?: string;
  durationInSeconds: number;
  wordTimestamps: WordTimestamp[];
  transition?: SceneTransition;
}

export interface MooProject {
  id: string;
  title: string;
  aspectRatio: '9:16';
  fps: number; // default 30
  width: number; // 1080
  height: number; // 1920
  theme: {
    bg: string;
    textPrimary: string;
    textHighlight: string;
    fontFamily: 'Jakarta' | 'Mono' | 'Impact';
    captionStyle: CaptionStyle;
    captionPosition: CaptionPosition;
  };
  scenes: Scene[];
  audioBlob?: Blob;
  audioDuration: number;
  /** BGM settings persisted per-project */
  bgm: {
    preset: BgmPreset;
    /** 0–1 master BGM level (default 0.18) */
    level: number;
    /** 0–1 duck ratio: 0=silence BGM, 1=no duck (default 0.15) */
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

export type LLMProvider = 'gemini' | 'openai' | 'groq';
export type TTSProvider = 'openai' | 'elevenlabs' | 'fallback' | 'local';

export interface EngineSettings {
  apiKeys: {
    gemini?: string;
    openai?: string;
    groq?: string;
    elevenlabs?: string;
  };
  apiKeyStorage?: 'persistent' | 'session';
  outputLanguage?: 'id' | 'en' | 'auto';
  selectedLLMProvider: LLMProvider;
  selectedTTSProvider: TTSProvider;
  geminiModel: string;
  openaiModel: string;
  groqModel: string;
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
