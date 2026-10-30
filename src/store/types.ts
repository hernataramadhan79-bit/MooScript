import type {
  MooProject,
  Scene,
  PersonaSkill,
  EngineSettings,
  MotionPreset,
  SceneTransition,
  TransitionCurve,
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
  ProjectExportSettings,
  CreativeBrief,
  SfxCue,
  SfxKind,
  VoiceEdit,
  TimelineMarker,
  LayerMotion
} from '../types';
import type { AudioProgressInfo } from '../engine/ai/tts';
import type { ExportProgress, ExportResult, ExportOptions } from '../engine/export/mp4Exporter';
import type { AssetRecord } from '../db/mooDb';
import type { ProceduralArchetype } from '../engine/composition/proceduralCompiler';

export type DeckTab = 'storyboard' | 'audio' | 'style' | 'export';

/** Layers the editor can add from scratch. */
export type InsertElementKind = 'text' | 'rect' | 'circle' | 'line' | 'pill';

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
  /** The layer the inspector edits; selecting it alone drops the other selected layers. */
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  /** Layers selected together with selectedLayerId (Shift+click), moved and aligned as a group. */
  extraSelectedLayerIds: string[];
  toggleLayerSelection: (layerId: string) => void;
  /** Hits the stage reported for the open project (ctx.pop, ctx.punch, ...), on the film's clock. */
  stageAccents: { time: number; kind: 'pop' | 'impact' }[];
  setStageAccents: (accents: { time: number; kind: 'pop' | 'impact' }[]) => void;
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
  /** Adds a sound effect at a film time and returns its id. */
  addSfxCue: (time: number, kind: SfxKind) => string;
  updateSfxCue: (id: string, update: Partial<Omit<SfxCue, 'id'>>) => void;
  removeSfxCue: (id: string) => void;
  /** Volume of the whole SFX track, 0-1.5. */
  setSfxLevel: (level: number) => void;
  /**
   * Places sound effects on the cuts, on the hits the shots' code makes and on editor entrances,
   * replacing earlier automatic ones and keeping the ones placed by hand. Returns how many.
   */
  autoPlaceSfx: () => number;
  updateVoiceEdit: (edit: Partial<VoiceEdit>) => void;
  /** Finds the beats of the project's music; resolves to how many were found. */
  analyzeMusicBeats: () => Promise<number>;
  /** Moves every cut between shots to the nearest beat (within half a beat); returns how many moved. */
  snapCutsToBeats: () => number;
  /** Adds a marker at a time in seconds and returns its id. */
  addMarker: (time: number, label?: string) => string;
  updateMarker: (id: string, update: Partial<Omit<TimelineMarker, 'id'>>) => void;
  removeMarker: (id: string) => void;
  /** Merges into the creative brief; a platform also sets the frame and, if unset, the length. */
  updateBrief: (brief: Partial<CreativeBrief>) => void;
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
  /** Embeds an uploaded font in the project; resolves to its family name, or null when refused. */
  addCustomFont: (file: File) => Promise<string | null>;
  removeCustomFont: (id: string) => void;
  /** Adds a new text or shape layer to a shot and selects it; returns the layer id. */
  insertElementIntoScene: (sceneId: string, kind: InsertElementKind) => string | null;
  /** Applies tweaks to several layers of one shot as one undo step. */
  /** coalesceKey merges follow-up calls with the same key into the same undo step. */
  updateLayerOverrides: (sceneId: string, patches: Record<string, Partial<LayerOverride>>, coalesceKey?: string) => void;
  /** Sets a layer's entrance / move / exit; null (or an empty motion) removes it. */
  updateLayerMotion: (sceneId: string, layerId: string, motion: LayerMotion | null) => void;
  resetLayerOverride: (sceneId: string, layerId?: string) => void;
  updateScenePalette: (sceneId: string, palette: Partial<ScenePalette>) => void;
  compileSceneProcedural: (sceneId: string, archetype?: ProceduralArchetype) => void;
  compileAllScenesProcedural: (archetype?: ProceduralArchetype, overwriteExisting?: boolean) => void;
  updateSceneCamera: (sceneId: string, camera: CameraMovement) => void;
  toggleSceneSubtitles: (sceneId: string) => void;
  toggleWordFocus: (sceneId: string, word: string) => void;
  setSceneMotionPreset: (sceneId: string, preset: MotionPreset) => void;
  setSceneTransition: (sceneId: string, transition: SceneTransition) => void;
  /** null returns the duration or curve to automatic. */
  setSceneTransitionTiming: (
    sceneId: string,
    timing: { duration?: number | null; curve?: TransitionCurve | null }
  ) => void;
  setSceneIcon: (sceneId: string, icon: string) => void;
  setSceneDuration: (sceneId: string, duration: number, allowWithAudio?: boolean) => void;
  addScene: () => void;
  /**
   * Cuts a shot in two at a film time. The second piece keeps playing the same visual from the cut
   * on, narration words follow their timing. Returns the new shot's id, or null when the cut is too
   * close to an edge.
   */
  splitSceneAt: (sceneId: string, timeSec: number) => string | null;
  /** Moves the cut between a shot and the one before it to a film time; the film length stays the same. */
  setSceneBoundary: (sceneId: string, timeSec: number) => void;
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
  /** Mixes the project audio again after music, sound effects or the voice edit changed. */
  refreshMix: () => Promise<void>;
  /** Records a new take for one scene; the other scenes are reused from the cache. */
  regenerateSceneVoice: (sceneId: string) => Promise<void>;
  generateBgmOnlyAudio: () => Promise<void>;
  waveformPeaks: number[] | null;
  setWaveformPeaks: (peaks: number[] | null) => void;
}

export interface PlaybackSlice {
  currentFrame: number;
  isPlaying: boolean;
  isLooping: boolean;
  toggleLoop: () => void;
  /** Part of the film that playback loops over while looping is on, in seconds; null = whole film. */
  loopRange: { start: number; end: number } | null;
  /** Sets the range start (or end) at a time, keeping start before end. */
  setLoopPoint: (edge: 'start' | 'end', timeSec: number) => void;
  clearLoopRange: () => void;
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
