export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export type MotionPreset = 'punch_zoom' | 'slide_split' | 'fade_float' | 'kinetic_shake';

export interface Scene {
  id: string;
  text: string;
  focusWords: string[];
  motionPreset: MotionPreset;
  icon?: string;
  durationInSeconds: number;
  wordTimestamps: WordTimestamp[];
}

export interface MooProject {
  id: string;
  title: string;
  aspectRatio: '9:16';
  fps: number; // default 30
  width: number;  // 1080
  height: number; // 1920
  theme: {
    bg: string;
    textPrimary: string;
    textHighlight: string;
    fontFamily: 'Jakarta' | 'Mono' | 'Impact';
  };
  scenes: Scene[];
  audioBlob?: Blob;
  audioDuration: number;
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
export type TTSProvider = 'openai' | 'elevenlabs' | 'fallback';

export interface EngineSettings {
  apiKeys: {
    gemini?: string;
    openai?: string;
    groq?: string;
    elevenlabs?: string;
  };
  selectedLLMProvider: LLMProvider;
  selectedTTSProvider: TTSProvider;
  geminiModel: string;
  openaiModel: string;
  groqModel: string;
  voiceId: string;
  speed: number;
  stability: number;
  duckingDb: number;
  fps: number;
}
