import type {
  MooProject,
  Scene,
  PersonaSkill,
  EngineSettings,
  MotionPreset,
  SceneTransition,
  CaptionStyle,
  CaptionPosition,
  SubtitleCustomization,
  BgmPreset,
  ToastNotification,
  TTSProvider,
  CameraMovement,
  AspectRatio,
  ThemeTokens,
  MotionNode,
  LayerOverride,
  ScenePalette,
  SceneAssetAttachment,
  ProjectExportSettings
} from '../types';
import type { AudioProgressInfo } from '../engine/ai/tts';
import type { ExportProgress, ExportResult, ExportOptions } from '../engine/export/mp4Exporter';
import type { AssetRecord } from '../db/mooDb';
import type { ProceduralArchetype } from '../engine/composition/proceduralCompiler';

export type DeckTab = 'storyboard' | 'audio' | 'style' | 'export';

export type PreviewMode = 'compact' | 'theater' | 'ticker';

export interface UiSlice {
  activeTab: 'ide' | 'generate' | 'edit' | 'audio' | 'ekspor' | 'settings' | DeckTab;
  setActiveTab: (tab: 'ide' | 'generate' | 'edit' | 'audio' | 'ekspor' | 'settings' | DeckTab) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  isShortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  activeSceneId: string | null;
  setActiveSceneId: (id: string | null) => void;
  /** Selects a scene and moves the playhead into it, so the timeline keeps it selected. */
  focusScene: (sceneId: string) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  toasts: ToastNotification[];
  addToast: (message: string, type?: ToastNotification['type'], durationMs?: number) => void;
  removeToast: (id: string) => void;
  isCompilingMograph: boolean;
  setIsCompilingMograph: (isCompiling: boolean) => void;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
}

export interface ProjectSlice {
  project: MooProject;
  projectsList: MooProject[];
  /**
   * preserveHistory records an undo step; skipHistory leaves the history untouched (follow-up
   * writes of one operation); otherwise the history is cleared (a different project was loaded).
   */
  setProject: (
    project: MooProject,
    options?: { keepStale?: boolean; preserveHistory?: boolean; skipHistory?: boolean }
  ) => void;
  refreshProjectsList: () => Promise<void>;
  createNewProject: (title?: string) => Promise<string>;
  createProjectFromTemplate: (templateId: string) => Promise<string>;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<string>;
  importProject: (project: MooProject) => Promise<string>;
  updateTitle: (title: string) => void;
  renameProject: (id: string, newTitle: string) => Promise<void>;
  updateResolution: (res: '1080p' | '720p') => void;
  updateExportSettings: (settings: Partial<ProjectExportSettings>) => void;
  toggleGlobalSubtitles: () => void;
  updateThemeFont: (font: 'Jakarta' | 'Mono' | 'Impact') => void;
  updateThemeHighlight: (color: string) => void;
  updateThemePrimary: (color: string) => void;
  updateThemeBg: (color: string) => void;
  updateProjectAspectRatio: (aspectRatio: AspectRatio) => void;
  updateThemeCaptionStyle: (style: CaptionStyle) => void;
  updateThemeCaptionPosition: (position: CaptionPosition) => void;
  updateSubtitleCustomization: (customization: Partial<SubtitleCustomization>) => void;
  updateSceneText: (id: string, text: string) => void;
  updateSceneVisualIntent: (sceneId: string, visualIntent: string) => void;
  updateSceneVisualConcept: (sceneId: string, visualConcept: string) => void;
  updateLayerOverride: (sceneId: string, layerId: string, override: Partial<LayerOverride>) => void;
  resetLayerOverride: (sceneId: string, layerId?: string) => void;
  updateScenePalette: (sceneId: string, palette: Partial<ScenePalette>) => void;
  compileSceneProcedural: (sceneId: string, archetype?: ProceduralArchetype) => void;
  compileAllScenesProcedural: (archetype?: ProceduralArchetype, overwriteExisting?: boolean) => void;
  updateSceneCamera: (sceneId: string, camera: CameraMovement) => void;
  toggleSceneSubtitles: (sceneId: string) => void;
  toggleWordFocus: (sceneId: string, word: string) => void;
  setSceneMotionPreset: (sceneId: string, preset: MotionPreset) => void;
  setSceneTransition: (sceneId: string, transition: SceneTransition) => void;
  setSceneIcon: (sceneId: string, icon: string) => void;
  setSceneDuration: (sceneId: string, duration: number, allowWithAudio?: boolean) => void;
  addScene: () => void;
  duplicateScene: (id: string) => void;
  removeScene: (id: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  shufflePalette: (sceneId?: string) => void;
  setThemeTokens: (tokens: ThemeTokens, sceneId?: string) => void;
  updateThemeToken: (key: keyof ThemeTokens, value: string, sceneId?: string) => void;
  updateSceneNode: (sceneId: string, nodeId: string, update: Partial<MotionNode>) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  assignAssetToScene: (sceneId: string, attachment: SceneAssetAttachment) => void;
  removeAssetFromSceneBeat: (sceneId: string, assetId: string) => void;
  updateSceneAssetRole: (sceneId: string, assetId: string, role: SceneAssetAttachment['role'], guidance?: string) => void;
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
  /** The narration before BGM mixing; null when the project has no voice-over. */
  rawVoiceBlob?: Blob | null;
  /** The project audio is background music only, so changing the music may replace it freely. */
  bgmOnlyAudio: boolean;
  generateAudio: () => Promise<void>;
  uploadCustomAudio: (file: File) => Promise<void>;
  cancelAudioGeneration: () => void;
  deleteAudio: () => Promise<void>;
  auditionVoice: (provider?: TTSProvider, voiceId?: string) => Promise<void>;
  remixAudio: () => Promise<void>;
  generateBgmOnlyAudio: () => Promise<void>;
  waveformPeaks: number[] | null;
  setWaveformPeaks: (peaks: number[] | null) => void;
}

export interface PlaybackSlice {
  currentFrame: number;
  isPlaying: boolean;
  isLooping: boolean;
  toggleLoop: () => void;
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
  updateBgmPreset: (preset: BgmPreset) => Promise<void> | void;
  uploadCustomBgm: (file: File) => Promise<void>;
  removeCustomBgm: () => Promise<void>;
  updateBgmLevel: (level: number) => Promise<void> | void;
  updateBgmDuckRatio: (duckRatio: number) => Promise<void> | void;
}

export type AssetAnimationPreset = 'pop' | 'slide' | 'float' | 'zoom';
export type AssetFramePreset = 'cutout' | 'bento' | 'avatar';

export interface InsertAssetOptions {
  animationPreset?: AssetAnimationPreset;
  framePreset?: AssetFramePreset;
}

export interface AssetSlice {
  assets: AssetRecord[];
  isLoadingAssets: boolean;
  loadAssets: (projectId?: string) => Promise<void>;
  addAsset: (file: File) => Promise<AssetRecord | null>;
  deleteAsset: (id: string) => Promise<void>;
  insertAssetIntoScene: (asset: AssetRecord, sceneId?: string, options?: InsertAssetOptions) => void;
  removeAssetFromScene: (assetDataUrlOrLayerId: string, sceneId?: string) => void;
}

export type MographSceneStatus = 'pending' | 'generating' | 'ok' | 'error';

export interface MographSlice {
  /** Status line of the running "generate all scenes" job. */
  mographProgress: string;
  mographStats: { completed: number; total: number; sceneStatuses: Record<string, MographSceneStatus> } | null;
  /** Scene being regenerated or repaired on its own, if any. */
  revisingSceneId: string | null;
  revisionProgress: string;
  generateAllScenesAi: () => Promise<void>;
  regenerateSceneAi: (sceneId: string, instruction?: string) => Promise<void>;
  repairSceneAi: (sceneId: string) => Promise<void>;
  cancelMographGeneration: () => void;
}

export type MooStoreState = UiSlice &
  MographSlice &
  ProjectSlice &
  ScriptSlice &
  AudioSlice &
  PlaybackSlice &
  ExportSlice &
  SettingsSlice &
  BgmSlice &
  AssetSlice;
