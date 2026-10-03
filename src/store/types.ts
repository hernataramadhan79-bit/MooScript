import type {
  MooProject,
  Scene,
  PersonaSkill,
  EngineSettings,
  MotionPreset,
  SceneTransition,
  CaptionStyle,
  CaptionPosition,
  BgmPreset,
  ToastNotification,
  TTSProvider
} from '../types';
import type { AudioProgressInfo } from '../engine/ai/tts';
import type { ExportProgress, ExportResult, ExportOptions } from '../engine/export/mp4Exporter';

export type DeckTab = 'storyboard' | 'audio' | 'style' | 'export';

export type PreviewMode = 'compact' | 'theater' | 'ticker';

export interface UiSlice {
  activeTab: 'script' | 'voice' | 'studio' | 'settings' | DeckTab;
  setActiveTab: (tab: 'script' | 'voice' | 'studio' | 'settings' | DeckTab) => void;
  deckTab: DeckTab;
  setDeckTab: (tab: DeckTab) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  toasts: ToastNotification[];
  addToast: (message: string, type?: ToastNotification['type'], durationMs?: number) => void;
  removeToast: (id: string) => void;
}

export interface ProjectSlice {
  project: MooProject;
  projectsList: MooProject[];
  setProject: (project: MooProject) => void;
  refreshProjectsList: () => Promise<void>;
  createNewProject: (title?: string) => Promise<string>;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<string>;
  updateTitle: (title: string) => void;
  updateThemeFont: (font: 'Jakarta' | 'Mono' | 'Impact') => void;
  updateThemeHighlight: (color: string) => void;
  updateThemeBg: (color: string) => void;
  updateThemeCaptionStyle: (style: CaptionStyle) => void;
  updateThemeCaptionPosition: (position: CaptionPosition) => void;
  updateSceneText: (id: string, text: string) => void;
  toggleWordFocus: (sceneId: string, word: string) => void;
  setSceneMotionPreset: (sceneId: string, preset: MotionPreset) => void;
  setSceneTransition: (sceneId: string, transition: SceneTransition) => void;
  setSceneIcon: (sceneId: string, icon: string) => void;
  setSceneDuration: (sceneId: string, duration: number) => void;
  addScene: () => void;
  duplicateScene: (id: string) => void;
  removeScene: (id: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
}

export interface ScriptSlice {
  isGeneratingScript: boolean;
  scriptPrompt: string;
  setScriptPrompt: (p: string) => void;
  generateScript: () => Promise<void>;
  cancelGenerateScript: () => void;
  previousScenesSnapshot: Scene[] | null;
  undoGenerateScript: () => Promise<void>;
}

export interface AudioSlice {
  isGeneratingAudio: boolean;
  audioBlobUrl: string | null;
  audioStale: boolean;
  audioProgress: AudioProgressInfo | null;
  generateAudio: () => Promise<void>;
  cancelAudioGeneration: () => void;
  auditionVoice: (provider?: TTSProvider, voiceId?: string) => Promise<void>;
}

export interface PlaybackSlice {
  currentFrame: number;
  isPlaying: boolean;
  seekFrame: (frame: number) => void;
  seekTime: (timeSec: number) => void;
  togglePlay: () => void;
  pause: () => void;
  play: () => void;
}

export interface ExportSlice {
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportResult: ExportResult | null;
  startExport: (opts?: ExportOptions) => Promise<void>;
  cancelExport: () => void;
  revokeExportResult: () => void;
}

export interface SettingsSlice {
  settings: EngineSettings;
  updateSettings: (newSettings: Partial<EngineSettings>) => Promise<void>;
  updateApiKey: (provider: keyof EngineSettings['apiKeys'], key: string) => Promise<void>;
  skills: PersonaSkill[];
  activeSkillId: string;
  setActiveSkillId: (id: string) => void;
  refreshSkills: () => Promise<void>;
  cacheSizeBytes: number;
  refreshCacheSize: () => Promise<void>;
  clearCache: () => Promise<void>;
  initStore: () => Promise<void>;
}

export interface BgmSlice {
  updateBgmPreset: (preset: BgmPreset) => void;
  updateBgmLevel: (level: number) => void;
  updateBgmDuckRatio: (duckRatio: number) => void;
}

export type MooStoreState = UiSlice &
  ProjectSlice &
  ScriptSlice &
  AudioSlice &
  PlaybackSlice &
  ExportSlice &
  SettingsSlice &
  BgmSlice;
