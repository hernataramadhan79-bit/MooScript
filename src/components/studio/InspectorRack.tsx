import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { mapFontDisplay } from '../../store/slices/mographSlice';
import {
  mergeEditableLayers,
  getLayerText,
  setLayerText
} from '../../engine/composition/layers';
import { isLocalModelCached, downloadLocalModel, getLocalVoice, purgeLocalModel } from '../../engine/ai/localTts';
import type {
  CaptionPosition,
  CaptionStyle,
  BgmPreset,
  EditableLayer,
  LayerOverride,
  ScenePalette
} from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal';
import { CommitNumberInput } from '../ui/CommitNumberInput';
import { AssetManagerPanel } from './AssetManagerPanel';
import { ExportPanel } from './ExportPanel';
import { LayerMotionPanel } from './LayerMotionPanel';
import { TypographyControls } from './TypographyControls';
import { BrandKitPanel } from './BrandKitPanel';
import { ShotTemplatesPanel } from './ShotTemplatesPanel';
import { getSceneStartSeconds } from '../../utils/projectDuration';
import {
  PROCEDURAL_ARCHETYPES,
  type ProceduralArchetype
} from '../../engine/composition/proceduralCompiler';

export type InspectorTab = 'mograph' | 'style' | 'asset' | 'audio' | 'subtitle' | 'ekspor';

/** What each visual state means to the person editing, not to the engine. */
const SCENE_STATUS_LABEL: Record<string, string> = {
  ok: 'siap',
  pending: 'belum dibuat',
  generating: 'sedang dibuat',
  error: 'gagal',
  'needs-repair': 'perlu perbaikan'
};

export const INSPECTOR_TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'mograph', label: 'Mograph', icon: 'movie_filter' },
  { id: 'style', label: 'Gaya', icon: 'tune' },
  { id: 'asset', label: 'Aset', icon: 'perm_media' },
  { id: 'audio', label: 'Audio', icon: 'graphic_eq' },
  { id: 'subtitle', label: 'Subtitel', icon: 'subtitles' },
  { id: 'ekspor', label: 'Ekspor', icon: 'download' }
];

const DebouncedSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChangeComplete: (val: number) => void;
  /** Called on every move, for a live readout while the store is only written on release. */
  onInput?: (val: number) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}> = ({ value, min, max, step, onChangeComplete, onInput, disabled, className, ariaLabel }) => {
  const [localVal, setLocalVal] = useState(value);
  const valRef = useRef(value);
  const committedRef = useRef(value);

  useEffect(() => {
    setLocalVal(value);
    valRef.current = value;
    committedRef.current = value;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setLocalVal(v);
    valRef.current = v;
    onInput?.(v);
  };

  // One commit per gesture, and none when the thumb ends where it started (a click or a blur).
  const handleCommit = () => {
    if (valRef.current === committedRef.current) return;
    committedRef.current = valRef.current;
    onChangeComplete(valRef.current);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localVal}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={handleChange}
      onPointerUp={handleCommit}
      onKeyUp={handleCommit}
      onBlur={handleCommit}
      className={className}
    />
  );
};

/** A labelled range whose readout follows the thumb live and whose value is committed on release. */
const CommitSliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (val: number) => string;
  onCommit: (val: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}> = ({ label, value, min, max, step, format, onCommit, disabled, size = 'md' }) => {
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);
  const small = size === 'sm';
  return (
    <div className={`flex flex-col ${small ? 'gap-1' : 'gap-1.5'}`}>
      <div className={`flex items-center justify-between ${small ? 'text-[11px]' : 'text-[12px]'}`}>
        <span className={`text-text-muted ${small ? '' : 'font-medium'}`}>{label}</span>
        <span className={`font-mono text-on-surface ${small ? 'text-[10px]' : 'font-semibold'}`}>{format(live)}</span>
      </div>
      <DebouncedSlider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        ariaLabel={label}
        onInput={setLive}
        onChangeComplete={onCommit}
        className={`w-full ${small ? 'h-1 bg-surface-3' : 'h-1.5 bg-surface-2'} rounded-lg appearance-none cursor-pointer accent-accent disabled:opacity-40 disabled:cursor-not-allowed`}
      />
    </div>
  );
};

const DebouncedColor: React.FC<{
  value: string;
  onChangeComplete: (val: string) => void;
  className?: string;
  ariaLabel?: string;
}> = ({ value, onChangeComplete, className, ariaLabel }) => {
  const [localVal, setLocalVal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef(value);

  useEffect(() => {
    setLocalVal(value);
    committedRef.current = value;
  }, [value]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  // Opening and closing the picker without choosing must not apply the color shown as default.
  const commit = (v: string) => {
    if (v.toLowerCase() === committedRef.current.toLowerCase()) return;
    committedRef.current = v;
    onChangeComplete(v);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalVal(v);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => commit(v), 200);
  };

  const handleBlur = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    commit(localVal);
  };

  return (
    <input
      type="color"
      value={localVal}
      aria-label={ariaLabel}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};

export interface InspectorRackProps {
  className?: string;
  defaultTab?: InspectorTab;
  activeTab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  onOpenCodeInspector?: (beatId: string) => void;
}

export const InspectorRack: React.FC<InspectorRackProps> = ({
  className = '',
  defaultTab = 'mograph',
  activeTab: controlledTab,
  onTabChange,
  onOpenCodeInspector
}) => {
  const [internalTab, setInternalTab] = useState<InspectorTab>(defaultTab);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = (tab: InspectorTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const {
    project,
    settings,
    activeSceneId,
    focusScene,
    updateLayerOverride,
    updateLayerMotion,
    addCustomFont,
    insertElementIntoScene,
    resetLayerOverride,
    removeAssetFromScene,
    updateScenePalette,
    compileSceneProcedural,
    compileAllScenesProcedural,
    setProject,
    isCompilingMograph,
    mographProgress,
    mographStats,
    revisingSceneId,
    revisionProgress,
    generateAllScenesAi,
    regenerateSceneAi,
    repairSceneAi,
    cancelMographGeneration,
    updateThemeFont,
    updateThemeCaptionPosition,
    updateThemeCaptionStyle,
    updateSubtitleCustomization,
    toggleGlobalSubtitles,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    uploadCustomAudio,
    cancelAudioGeneration,
    deleteAudio,
    audioProgress,
    auditionVoice,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio,
    updateVoiceEdit,
    setSfxLevel,
    autoPlaceSfx,
    uploadCustomBgm,
    removeCustomBgm,
    audioStale,
    bgmOnlyAudio,
    setSettingsOpen,
    addToast
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      settings: s.settings,
      activeSceneId: s.activeSceneId,
      focusScene: s.focusScene,
      updateLayerOverride: s.updateLayerOverride,
      updateLayerMotion: s.updateLayerMotion,
      addCustomFont: s.addCustomFont,
      insertElementIntoScene: s.insertElementIntoScene,
      resetLayerOverride: s.resetLayerOverride,
      removeAssetFromScene: s.removeAssetFromScene,
      updateScenePalette: s.updateScenePalette,
      compileSceneProcedural: s.compileSceneProcedural,
      compileAllScenesProcedural: s.compileAllScenesProcedural,
      setProject: s.setProject,
      isCompilingMograph: s.isCompilingMograph,
      mographProgress: s.mographProgress,
      mographStats: s.mographStats,
      revisingSceneId: s.revisingSceneId,
      revisionProgress: s.revisionProgress,
      generateAllScenesAi: s.generateAllScenesAi,
      regenerateSceneAi: s.regenerateSceneAi,
      repairSceneAi: s.repairSceneAi,
      cancelMographGeneration: s.cancelMographGeneration,
      updateThemeFont: s.updateThemeFont,
      updateThemeCaptionPosition: s.updateThemeCaptionPosition,
      updateThemeCaptionStyle: s.updateThemeCaptionStyle,
      updateSubtitleCustomization: s.updateSubtitleCustomization,
      toggleGlobalSubtitles: s.toggleGlobalSubtitles,
      updateSettings: s.updateSettings,
      isGeneratingAudio: s.isGeneratingAudio,
      generateAudio: s.generateAudio,
      uploadCustomAudio: s.uploadCustomAudio,
      cancelAudioGeneration: s.cancelAudioGeneration,
      deleteAudio: s.deleteAudio,
      audioProgress: s.audioProgress,
      auditionVoice: s.auditionVoice,
      updateBgmPreset: s.updateBgmPreset,
      updateBgmLevel: s.updateBgmLevel,
      updateBgmDuckRatio: s.updateBgmDuckRatio,
      updateVoiceEdit: s.updateVoiceEdit,
      setSfxLevel: s.setSfxLevel,
      autoPlaceSfx: s.autoPlaceSfx,
      uploadCustomBgm: s.uploadCustomBgm,
      removeCustomBgm: s.removeCustomBgm,
      audioStale: s.audioStale,
      bgmOnlyAudio: s.bgmOnlyAudio,
      setSettingsOpen: s.setSettingsOpen,
      addToast: s.addToast
    }))
  );

  const hasRawVoice = useMooStore((s) => Boolean(s.rawVoiceBlob));
  const voiceEdit = project.voiceEdit || {};
  const voiceEditActive = Object.values(voiceEdit).some((v) => v !== undefined);
  const currentLlmProvider = settings.selectedLLMProvider;
  const currentLlmApiKey = settings.apiKeys[currentLlmProvider] || '';
  const hasLlmApiKey = Boolean(currentLlmApiKey.trim());

  // Active Scene & Layer States
  const scenes = useMemo(() => project.scenes || [], [project.scenes]);
  const activeScene = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0];
  }, [scenes, activeSceneId]);

  const activeSceneIndex = useMemo(() => {
    return scenes.findIndex((s) => s.id === activeScene?.id);
  }, [scenes, activeScene]);

  const activeCompScene = useMemo(() => {
    const compScenes = project.composition?.scenes || [];
    return compScenes.find((s) => s.id === activeScene?.id || s.beatId === activeScene?.id);
  }, [project.composition?.scenes, activeScene]);

  const availableLayers = useMemo(() => {
    if (!activeCompScene?.html) return [];
    return mergeEditableLayers(activeCompScene.editableLayers, activeCompScene.html);
  }, [activeCompScene?.editableLayers, activeCompScene?.html]);

  const selectedLayerId = useMooStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useMooStore((s) => s.setSelectedLayerId);

  useEffect(() => {
    setSelectedLayerId(null);
  }, [activeScene?.id, setSelectedLayerId]);

  const activeLayer = useMemo(() => {
    if (!availableLayers.length) return null;
    return availableLayers.find((l) => l.id === selectedLayerId) || availableLayers[0];
  }, [availableLayers, selectedLayerId]);

  const currentOverrides = activeCompScene?.overrides || {};
  const activeLayerOverride = activeLayer ? currentOverrides[activeLayer.id] || {} : {};
  const currentPalette = activeCompScene?.palette || {};
  // Local debounced state for layer text editing
  const [localLayerText, setLocalLayerText] = useState<string>('');
  useEffect(() => {
    if (activeLayer && activeLayer.type === 'text' && activeCompScene?.html) {
      setLocalLayerText(getLayerText(activeCompScene.html, activeLayer.id));
    } else {
      setLocalLayerText('');
    }
  }, [activeLayer, activeCompScene?.html]);

  const commitLayerText = (text: string) => {
    if (!activeCompScene?.html || !activeLayer) return;
    const current = getLayerText(activeCompScene.html, activeLayer.id);
    if (current === text) return;
    handleLayerTextChange(text);
  };


  // Single scene AI revision: the job itself runs in the store and survives tab switches.
  const [revisionPrompt, setRevisionPrompt] = useState<string>('');
  const isRevisingScene = revisingSceneId !== null;
  const isRevisingThisScene = Boolean(activeScene) && revisingSceneId === activeScene?.id;

  const getLayerIcon = (type: EditableLayer['type']) => {
    switch (type) {
      case 'text':
        return 'title';
      case 'shape':
        return 'crop_square';
      case 'svg':
        return 'polyline';
      case 'image':
        return 'image';
      case 'group':
      default:
        return 'folder';
    }
  };

  const handleOverridesChange = (changes: Partial<LayerOverride>) => {
    if (!activeScene || !activeLayer) return;
    updateLayerOverride(activeScene.id, activeLayer.id, { ...changes, layerType: activeLayer.type });
  };

  const handleOverrideChange = (prop: keyof LayerOverride, val: number | string | boolean | undefined) =>
    handleOverridesChange({ [prop]: val });

  const [selectedArchetype, setSelectedArchetype] = useState<ProceduralArchetype>('auto');
  const customAudioInputRef = useRef<HTMLInputElement | null>(null);
  const customBgmInputRef = useRef<HTMLInputElement | null>(null);

  const handleResetLayerOverride = () => {
    if (!activeScene || !activeLayer) return;
    resetLayerOverride(activeScene.id, activeLayer.id);
    addToast(`Override layer ${activeLayer.label} direset.`, 'info');
  };

  const handleRemoveLayer = () => {
    if (!activeScene || !activeLayer) return;
    removeAssetFromScene(activeLayer.id, activeScene.id);
  };

  const handleLayerTextChange = (newText: string) => {
    if (!activeScene || !activeCompScene || !activeLayer || !project.composition) return;
    const updatedHtml = setLayerText(activeCompScene.html, activeLayer.id, newText);
    const updatedCompScenes = project.composition.scenes.map((s) => {
      if (s.id !== activeCompScene.id && s.beatId !== activeCompScene.beatId) return s;
      return {
        ...s,
        html: updatedHtml,
        userEdited: true
      };
    });
    setProject(
      {
        ...project,
        composition: {
          ...project.composition,
          scenes: updatedCompScenes,
          updatedAt: Date.now()
        }
      },
      { keepStale: true, preserveHistory: true }
    );
  };

  const handlePaletteChange = (prop: keyof ScenePalette, val: string) => {
    if (!activeScene) return;
    updateScenePalette(activeScene.id, { [prop]: val });
  };

  const handleResetPalette = () => {
    if (!activeScene) return;
    updateScenePalette(activeScene.id, {
      bg: undefined,
      primary: undefined,
      accent: undefined,
      text: undefined
    });
    addToast('Palet warna adegan dikembalikan ke default.', 'info');
  };

  const handleReviseSingleScene = async () => {
    if (!activeScene) return;
    const instruction = revisionPrompt;
    await regenerateSceneAi(activeScene.id, instruction);
    setRevisionPrompt('');
  };

  const handleRepairLegacyScene = () => {
    if (activeScene) repairSceneAi(activeScene.id);
  };


  // Text position options
  const currentPosition = project.theme?.captionPosition || 'bottom';
  const positionOptions: { value: CaptionPosition; label: string }[] = [
    { value: 'top', label: 'Atas' },
    { value: 'center', label: 'Tengah' },
    { value: 'bottom', label: 'Bawah' }
  ];

  // Text style options
  const currentStyle = project.theme?.captionStyle || 'boxed';
  const styleOptions: { value: CaptionStyle; label: string }[] = [
    { value: 'boxed', label: 'Kotak (Klasik)' },
    { value: 'karaoke', label: 'Highlight (Neon)' },
    { value: 'bold-pop', label: 'Bold Pop (Viral)' },
    { value: 'minimal', label: 'Minimalis' },
    { value: 'outline', label: 'Kontras Outline' }
  ];

  const subCust = project.theme?.subtitleCustomization || {};
  const activeHighlightColor = subCust.activeColor || project.theme?.textHighlight || '#84cc16';

  // Voice provider mapping
  const currentVoiceProvider = useMemo(() => {
    const p = settings.selectedTTSProvider;
    if (p === 'openai') return 'openai';
    if (p === 'elevenlabs') return 'elevenlabs';
    if (p === 'local') return 'local';
    return 'timer';
  }, [settings.selectedTTSProvider]);

  const voiceProviders = [
    { id: 'timer', label: 'Tanpa Suara (Timer)' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'elevenlabs', label: 'ElevenLabs' },
    { id: 'local', label: 'Offline Lokal' }
  ];

  const OPENAI_VOICE_OPTIONS = [
    { id: 'alloy', label: 'Alloy' },
    { id: 'echo', label: 'Echo' },
    { id: 'fable', label: 'Fable' },
    { id: 'onyx', label: 'Onyx' },
    { id: 'nova', label: 'Nova' },
    { id: 'shimmer', label: 'Shimmer' }
  ];

  const ELEVENLABS_VOICE_OPTIONS = [
    { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel' },
    { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi' },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella' },
    { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh' },
    { id: 'custom', label: 'Kustom' }
  ];

  const LOCAL_VOICE_OPTIONS = [
    { id: 'id_ID-news_tts', label: 'Ayu (id_ID) - Narasi Berita & Edukasi' },
    { id: 'en_US-lessac', label: 'Lessac (en_US) - Storyteller & Narasi' },
    { id: 'fallback', label: 'WebSpeech - Standar Suara Browser (Live)' }
  ];

  const currentOpenAIVoice = settings.voiceIds?.openai || 'alloy';
  const currentElevenLabsVoice = settings.voiceIds?.elevenlabs || '21m00Tcm4TlvDq8ikWAM';
  const isElevenLabsCustom =
    !ELEVENLABS_VOICE_OPTIONS.slice(0, 5).some((v) => v.id === currentElevenLabsVoice) ||
    currentElevenLabsVoice === 'custom';
  const currentLocalVoice = settings.voiceIds?.local || 'id_ID-news_tts';
  const [isLocalVoiceCached, setIsLocalVoiceCached] = useState<boolean>(true);
  const [isDownloadingLocalVoice, setIsDownloadingLocalVoice] = useState<boolean>(false);
  const [localVoiceDownloadProgress, setLocalVoiceDownloadProgress] = useState<number>(0);

  useEffect(() => {
    if (currentVoiceProvider === 'local' && currentLocalVoice && currentLocalVoice !== 'fallback') {
      isLocalModelCached(currentLocalVoice).then(setIsLocalVoiceCached).catch(() => setIsLocalVoiceCached(false));
    }
  }, [currentVoiceProvider, currentLocalVoice]);

  const handleDownloadCurrentLocalVoice = async () => {
    const voice = getLocalVoice(currentLocalVoice);
    if (!voice) return;
    setIsDownloadingLocalVoice(true);
    setLocalVoiceDownloadProgress(0);
    try {
      await downloadLocalModel(voice.id, (p) => {
        setLocalVoiceDownloadProgress(p.percent);
      });
      setIsLocalVoiceCached(true);
      addToast(`Model suara ${voice.name} berhasil diunduh dan siap offline!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal mengunduh model: ${msg}`, 'error');
    } finally {
      setIsDownloadingLocalVoice(false);
    }
  };

  const handlePurgeCurrentLocalVoice = async () => {
    const voice = getLocalVoice(currentLocalVoice);
    if (!voice) return;
    try {
      await purgeLocalModel(voice.id);
      setIsLocalVoiceCached(false);
      addToast(`Model suara ${voice.name} dihapus dari cache browser.`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal menghapus model: ${msg}`, 'error');
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'timer') {
      updateSettings({ selectedTTSProvider: 'fallback' });
    } else if (val === 'openai') {
      updateSettings({ selectedTTSProvider: 'openai' });
    } else if (val === 'elevenlabs') {
      updateSettings({ selectedTTSProvider: 'elevenlabs' });
    } else if (val === 'local') {
      updateSettings({ selectedTTSProvider: 'local' });
    }
  };

  const handleAuditionVoice = async () => {
    if (currentVoiceProvider === 'openai') {
      await auditionVoice('openai', currentOpenAIVoice);
    } else if (currentVoiceProvider === 'elevenlabs') {
      await auditionVoice('elevenlabs', currentElevenLabsVoice);
    } else if (currentVoiceProvider === 'local') {
      if (currentLocalVoice === 'fallback') {
        await auditionVoice('fallback');
      } else {
        await auditionVoice('local', currentLocalVoice);
      }
    } else {
      await auditionVoice('fallback');
    }
  };

  // BGM Presets
  const currentBgmPreset = project.bgm?.preset || 'none';
  const bgmPresets: { value: BgmPreset; label: string }[] = [
    { value: 'none', label: 'Tanpa' },
    { value: 'ambient', label: 'Ambient' },
    { value: 'lofi', label: 'Lofi' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'hiphop', label: 'Hiphop' },
    ...(project.bgm?.customName ? [{ value: 'custom' as BgmPreset, label: 'Kustom' }] : [])
  ];

  const bgmLevel = project.bgm?.level ?? 0.18;
  const duckRatio = project.bgm?.duckRatio ?? 0.15;

  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showProceduralOverwriteConfirm, setShowProceduralOverwriteConfirm] = useState(false);

  const hasProjectAudio = Boolean(project.audioBlob);
  const hasNarration = scenes.some((s) => (s.narrationText || s.text || '').trim().length > 0);
  // AI Mograph generation for every scene. The job runs in the store; this only asks before
  // overwriting scenes the user edited by hand.
  const handleGenerateCustomMograph = (skipConfirm = false) => {
    const existingModules = useMooStore.getState().project.composition?.scenes || [];
    if (!skipConfirm && existingModules.some((m) => m.userEdited === true)) {
      setShowOverwriteConfirm(true);
      return;
    }
    generateAllScenesAi();
  };

  return (
    <div
      className={`w-full flex flex-col bg-surface-1 border border-border rounded-2xl overflow-hidden select-none ${className}`}
    >
      {/* 1. Tab header (desktop; on mobile the bottom navigation switches tabs) */}
      <div className="hidden lg:block p-2 border-b border-border bg-surface-1/90 backdrop-blur-sm shrink-0">
        <div className="grid grid-cols-6 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
          {INSPECTOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`py-1.5 px-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95 ${
                activeTab === tab.id
                  ? 'bg-surface-3 text-accent shadow-sm'
                  : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
              <span className="tracking-tight truncate max-w-full">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Isi Panel Tab */}
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
        {/* ================= TAB GAYA & LAYER (PER-SCENE EDITING, LAYERS & PALETTE) ================= */}
        {activeTab === 'style' && (
          <div className="flex flex-col gap-4">
            {!activeScene ? (
              <div className="p-4 rounded-xl bg-surface-2 border border-border text-center text-text-muted text-[13px]">
                Belum ada adegan. Tambahkan adegan pada naskah terlebih dahulu.
              </div>
            ) : (
              <>
                {/* 1. Scene Switcher & Summary Card */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-surface-3 text-accent font-mono text-[11px] font-bold">
                        #{activeSceneIndex + 1}
                      </span>
                      <span className="text-[12px] font-semibold text-on-surface truncate">
                        {activeScene.visualIntent || activeScene.narrationText || `Adegan #${activeSceneIndex + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">
                        {activeScene.durationInSeconds.toFixed(1)}s
                      </span>
                      {activeCompScene && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold ${
                            activeCompScene.status === 'ok'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : activeCompScene.status === 'error'
                                ? 'bg-rose-500/15 text-rose-400'
                                : activeCompScene.status === 'needs-repair'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-zinc-500/15 text-zinc-400'
                          }`}
                        >
                          {SCENE_STATUS_LABEL[activeCompScene.status] || activeCompScene.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scene Selector Dropdown */}
                  {scenes.length > 1 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                      <span className="text-[11px] text-text-muted shrink-0">Pilih Adegan:</span>
                      <select
                        value={activeScene.id}
                        onChange={(e) => focusScene(e.target.value)}
                        className="flex-1 bg-surface-2 border border-border rounded-lg px-2 py-1 text-[11px] text-on-surface focus:outline-none focus:border-accent"
                      >
                        {scenes.map((s, idx) => (
                          <option key={s.id} value={s.id}>
                            #{idx + 1} - {(s.visualIntent || s.narrationText || `Adegan ${idx + 1}`).slice(0, 32)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Status Alert if Scene has Error */}
                {activeCompScene?.status === 'error' && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-[12px]">
                      <span className="material-symbols-outlined text-[17px]">error</span>
                      <span>Adegan ini mengalami kendala rendering</span>
                    </div>
                    {activeCompScene.errors && activeCompScene.errors.length > 0 && (
                      <p className="text-[11px] text-rose-300/80 font-mono truncate">
                        {activeCompScene.errors[0]}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleReviseSingleScene}
                      disabled={isRevisingScene || isCompilingMograph || !hasLlmApiKey}
                      title={
                        !hasLlmApiKey
                          ? `Silakan masukkan API Key untuk ${currentLlmProvider.toUpperCase()} di Pengaturan`
                          : undefined
                      }
                      className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-600 transition-colors self-start flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      Generate Ulang Adegan Ini
                    </button>
                  </div>
                )}

                {/* Scene saved before MooTween that calls APIs it does not have */}
                {activeCompScene?.status === 'needs-repair' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold text-[12px]">
                      <span className="material-symbols-outlined text-[17px]">build</span>
                      <span>Kode adegan ini bukan API MooScript</span>
                    </div>
                    <p className="text-[11px] text-amber-100/70 leading-relaxed">
                      Kodenya ditulis untuk API animasi lain (gaya GSAP), jadi adegan tampil diam sampai diperbaiki. Kode
                      belum diubah; AI akan menerjemahkan bagian berikut ke API MooScript dan mempertahankan desainnya.
                    </p>
                    {activeCompScene.errors && activeCompScene.errors.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {activeCompScene.errors.map((err) => (
                          <li key={err} className="text-[11px] text-amber-200/90 font-mono leading-snug">
                            {err.replace(/^Bukan API MooScript: /, '')}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={handleRepairLegacyScene}
                      disabled={isRevisingScene || isCompilingMograph || !hasLlmApiKey}
                      title={
                        !hasLlmApiKey
                          ? `Silakan masukkan API Key untuk ${currentLlmProvider.toUpperCase()} di Pengaturan`
                          : undefined
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[11px] font-semibold hover:bg-amber-400 transition-colors self-start flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isRevisingThisScene ? 'animate-spin' : ''}`}>
                        {isRevisingThisScene ? 'progress_activity' : 'auto_fix_high'}
                      </span>
                      {isRevisingThisScene ? revisionProgress || 'Memperbaiki...' : 'Perbaiki dengan AI'}
                    </button>
                  </div>
                )}

                {/* 2. Revisi AI Adegan Tunggal */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">auto_awesome</span>
                      Revisi AI Adegan #{activeSceneIndex + 1}
                    </span>
                    <span className="text-[10px] text-text-muted">Khusus adegan ini</span>
                  </div>

                  <textarea
                    value={revisionPrompt}
                    onChange={(e) => setRevisionPrompt(e.target.value)}
                    placeholder="Instruksi revisi, misal: 'Ubah grafik batang jadi diagram lingkaran'..."
                    rows={2}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-surface-1 border border-border text-[12px] text-on-surface placeholder:text-text-muted/60 focus:outline-none focus:border-accent resize-none"
                  />

                  {isRevisingThisScene && revisionProgress && (
                    <div className="p-2 rounded-lg bg-surface-1 border border-border text-[11px] text-accent flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[14px]">sync</span>
                      <span className="truncate">{revisionProgress}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleReviseSingleScene}
                      disabled={isRevisingScene || isCompilingMograph || !hasLlmApiKey}
                      title={
                        !hasLlmApiKey
                          ? `Silakan masukkan API Key untuk ${currentLlmProvider.toUpperCase()} di Pengaturan`
                          : undefined
                      }
                      className="flex-1 py-1.5 px-3 rounded-xl bg-accent text-on-accent text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isRevisingThisScene ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[15px]">sync</span>
                          <span>Merevisi...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                          <span>Revisi Adegan Ini</span>
                        </>
                      )}
                    </button>
                    {isRevisingThisScene && (
                      <button
                        type="button"
                        onClick={cancelMographGeneration}
                        className="py-1.5 px-2.5 rounded-xl bg-surface-1 border border-border text-[11px] text-text-muted hover:text-rose-400 transition-colors"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Layer Inspector & Non-Destructive Overrides */}
                <div id="layer-inspector" className="scroll-mt-2 p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">layers</span>
                      Layer & Transform
                    </span>
                    <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-3">
                      {availableLayers.length} Layer
                    </span>
                  </div>

                  {/* New layers from scratch */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-text-muted mr-0.5">Tambah:</span>
                    {(
                      [
                        { kind: 'text', icon: 'title', label: 'Teks' },
                        { kind: 'rect', icon: 'crop_square', label: 'Kotak' },
                        { kind: 'circle', icon: 'circle', label: 'Lingkaran' },
                        { kind: 'pill', icon: 'rounded_corner', label: 'Pil' },
                        { kind: 'line', icon: 'horizontal_rule', label: 'Garis' }
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => insertElementIntoScene(activeScene.id, item.kind)}
                        title={`Tambah ${item.label.toLowerCase()} ke adegan ini`}
                        className="h-7 px-2 rounded-lg bg-surface-1 border border-border text-[10px] font-semibold text-text-muted hover:text-accent hover:border-accent/40 flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {availableLayers.length === 0 ? (
                    <div className="p-3 rounded-xl bg-surface-1 border border-border text-center text-text-muted text-[11px] leading-relaxed flex flex-col items-center gap-2">
                      <span>
                        {activeCompScene?.html
                          ? 'Tidak ada layer yang ditandai data-moo-layer pada adegan ini.'
                          : 'Layer visual belum disusun secara permanen untuk adegan ini.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => compileSceneProcedural(activeScene.id, 'auto')}
                        className="px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/40 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        <span>Susun Layer & Visual Instan</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Layer Pills Selector */}
                      <div className="flex flex-wrap gap-1">
                        {availableLayers.map((layer) => {
                          const isSelected = layer.id === activeLayer?.id;
                          const hasOverrides = Boolean(currentOverrides[layer.id]);

                          return (
                            <button
                              key={layer.id}
                              type="button"
                              onClick={() => setSelectedLayerId(layer.id)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
                                isSelected
                                  ? 'bg-accent text-on-accent font-semibold shadow-xs'
                                  : 'bg-surface-1 text-text-muted hover:text-on-surface border border-border'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {getLayerIcon(layer.type)}
                              </span>
                              <span className="truncate max-w-[90px]">{layer.label}</span>
                              {hasOverrides && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-accent'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Controls for Active Layer */}
                      {activeLayer && (
                        <div className="p-3 rounded-xl bg-surface-1 border border-border space-y-3.5">
                          {/* Header Layer & Quick Tools */}
                          <div className="flex items-center justify-between pb-2 border-b border-border/40">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="material-symbols-outlined text-accent text-[17px] shrink-0">
                                {getLayerIcon(activeLayer.type)}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-[12px] font-semibold text-on-surface truncate">
                                  {activeLayer.label}
                                </h4>
                                <span className="text-[9px] font-mono text-text-muted">
                                  {activeLayer.id} • {activeLayer.type}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Visibility Toggle */}
                              <button
                                type="button"
                                onClick={() => handleOverrideChange('hidden', !activeLayerOverride.hidden)}
                                className={`p-1 rounded-lg border text-[11px] transition-colors ${
                                  activeLayerOverride.hidden
                                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                    : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                }`}
                                title={activeLayerOverride.hidden ? 'Layer tersembunyi (Klik untuk tampilkan)' : 'Sembunyikan layer'}
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  {activeLayerOverride.hidden ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>

                              {/* Z-Index Controls */}
                              <div className="flex items-center gap-0.5 bg-surface-2 border border-border rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('zIndex', Math.max(0, (activeLayerOverride.zIndex || 0) - 1))}
                                  className="p-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-on-surface transition-colors"
                                  title="Kirim ke Belakang (Z-Index -1)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">arrow_downward</span>
                                </button>
                                <span className="text-[10px] font-mono px-1 text-on-surface">
                                  Z:{activeLayerOverride.zIndex ?? 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('zIndex', (activeLayerOverride.zIndex || 0) + 1)}
                                  className="p-0.5 rounded hover:bg-surface-3 text-text-muted hover:text-on-surface transition-colors"
                                  title="Bawa ke Depan (Z-Index +1)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                                </button>
                              </div>

                              {/* Reset & Delete */}
                              <button
                                type="button"
                                onClick={handleResetLayerOverride}
                                className="p-1 rounded-lg hover:bg-surface-2 text-text-muted hover:text-accent transition-colors"
                                title="Reset transform ke default"
                              >
                                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLayer}
                                className="p-1 rounded-lg hover:bg-surface-2 text-text-muted hover:text-rose-400 transition-colors"
                                title="Hapus layer ini dari adegan"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Kontrol Khusus Layer Teks */}
                          {activeLayer.type === 'text' && (
                            <div className="space-y-2 p-2.5 rounded-xl bg-surface-2/50 border border-border/70">
                              <div className="space-y-1">
                                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                                  Isi teks
                                </span>
                                <input
                                  type="text"
                                  value={localLayerText}
                                  onChange={(e) => setLocalLayerText(e.target.value)}
                                  onBlur={() => commitLayerText(localLayerText)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitLayerText(localLayerText);
                                  }}
                                  placeholder="Ketik teks layer di sini..."
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-1 border border-border text-[12px] text-on-surface focus:outline-none focus:border-accent"
                                />
                              </div>

                              {/* Ukuran Teks (fontSizeScale) */}
                              <div className="space-y-1 pt-1 border-t border-border/50">
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                                  <span>Ukuran Font</span>
                                  <span className="text-accent">{Math.round((activeLayerOverride.fontSizeScale || 1.0) * 100)}%</span>
                                </div>
                                <DebouncedSlider
                                  min={0.5}
                                  max={2.5}
                                  step={0.05}
                                  value={activeLayerOverride.fontSizeScale || 1.0}
                                  onChangeComplete={(val) => handleOverrideChange('fontSizeScale', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                                <div className="flex items-center gap-1 pt-0.5">
                                  {[0.8, 1.0, 1.25, 1.5, 2.0].map((sc) => (
                                    <button
                                      key={sc}
                                      type="button"
                                      onClick={() => handleOverrideChange('fontSizeScale', sc)}
                                      className={`flex-1 py-0.5 rounded text-[9px] font-mono border transition-all ${
                                        Math.abs((activeLayerOverride.fontSizeScale || 1.0) - sc) < 0.05
                                          ? 'bg-accent/15 border-accent text-accent font-bold'
                                          : 'bg-surface-1 border-border text-text-muted hover:text-on-surface'
                                      }`}
                                    >
                                      {Math.round(sc * 100)}%
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Perataan Teks (textAlign) */}
                              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                <span className="text-[10px] text-text-muted font-medium">Perataan Teks</span>
                                <div className="flex items-center gap-1 bg-surface-1 p-0.5 rounded-lg border border-border">
                                  {(['left', 'center', 'right'] as const).map((align) => {
                                    const isSel = (activeLayerOverride.textAlign || 'center') === align;
                                    return (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() => handleOverrideChange('textAlign', align)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                          isSel ? 'bg-surface-3 text-accent font-bold shadow-xs' : 'text-text-muted hover:text-on-surface'
                                        }`}
                                      >
                                        {align === 'left' ? 'Kiri' : align === 'center' ? 'Tengah' : 'Kanan'}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <TypographyControls
                                override={activeLayerOverride}
                                customFonts={project.customFonts || []}
                                onChange={handleOverridesChange}
                                onUploadFont={addCustomFont}
                              />
                            </div>
                          )}

                          {/* Position X and Y */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                              <span className="font-semibold uppercase tracking-wider text-[9px]">Posisi Koordinat</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('x', 0)}
                                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] hover:text-accent"
                                  title="Rata Tengah X"
                                >
                                  X=0
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('y', 0)}
                                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] hover:text-accent"
                                  title="Rata Tengah Y"
                                >
                                  Y=0
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverridesChange({ x: 0, y: 0 })}
                                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[9px] hover:text-accent"
                                  title="Pusat Canvas"
                                >
                                  Pusat
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>Pos X</span>
                                  <CommitNumberInput
                                    min={-960}
                                    max={960}
                                    step={1}
                                    value={activeLayerOverride.x || 0}
                                    onCommit={(val) => handleOverrideChange('x', val)}
                                    ariaLabel="Posisi X"
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <DebouncedSlider
                                  min={-960}
                                  max={960}
                                  step={2}
                                  value={activeLayerOverride.x || 0}
                                  onChangeComplete={(val) => handleOverrideChange('x', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>Pos Y</span>
                                  <CommitNumberInput
                                    min={-1080}
                                    max={1080}
                                    step={1}
                                    value={activeLayerOverride.y || 0}
                                    onCommit={(val) => handleOverrideChange('y', val)}
                                    ariaLabel="Posisi Y"
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <DebouncedSlider
                                  min={-1080}
                                  max={1080}
                                  step={2}
                                  value={activeLayerOverride.y || 0}
                                  onChangeComplete={(val) => handleOverrideChange('y', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Scale, Rotation, and Flip */}
                          <div className="space-y-1.5 pt-1 border-t border-border/40">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>Skala</span>
                                  <div className="flex items-center gap-1">
                                    <CommitNumberInput
                                      min={0.1}
                                      max={3.5}
                                      step={0.05}
                                      value={activeLayerOverride.scale !== undefined ? activeLayerOverride.scale : 1.0}
                                      onCommit={(val) => handleOverrideChange('scale', val)}
                                      ariaLabel="Skala Layer"
                                      className="w-11 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange('scale', 1.0)}
                                      className="text-[9px] px-1 py-0.2 rounded bg-surface-2 border border-border text-text-muted hover:text-accent"
                                      title="Reset 1.0x"
                                    >
                                      1x
                                    </button>
                                  </div>
                                </div>
                                <DebouncedSlider
                                  min={0.1}
                                  max={3.5}
                                  step={0.05}
                                  value={activeLayerOverride.scale !== undefined ? activeLayerOverride.scale : 1.0}
                                  onChangeComplete={(val) => handleOverrideChange('scale', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>Rotasi</span>
                                  <CommitNumberInput
                                    min={-180}
                                    max={180}
                                    step={5}
                                    value={activeLayerOverride.rotation || 0}
                                    onCommit={(val) => handleOverrideChange('rotation', val)}
                                    ariaLabel="Rotasi Layer"
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                </div>
                                <DebouncedSlider
                                  min={-180}
                                  max={180}
                                  step={5}
                                  value={activeLayerOverride.rotation || 0}
                                  onChangeComplete={(val) => handleOverrideChange('rotation', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                                <div className="flex items-center gap-1 pt-0.5">
                                  {[0, 90, 180, -90].map((deg) => (
                                    <button
                                      key={deg}
                                      type="button"
                                      onClick={() => handleOverrideChange('rotation', deg)}
                                      className={`flex-1 py-0.2 rounded text-[8px] font-mono border transition-all ${
                                        (activeLayerOverride.rotation || 0) === deg
                                          ? 'bg-accent/15 border-accent text-accent font-bold'
                                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                      }`}
                                    >
                                      {deg}°
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Flip Buttons */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-text-muted font-medium">Balik Arah (Flip):</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('flipX', !activeLayerOverride.flipX)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                    activeLayerOverride.flipX
                                      ? 'bg-accent/15 border-accent text-accent font-bold'
                                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                  }`}
                                  title="Balik Horisontal (Flip H)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                                  <span>Flip H</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOverrideChange('flipY', !activeLayerOverride.flipY)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition-all ${
                                    activeLayerOverride.flipY
                                      ? 'bg-accent/15 border-accent text-accent font-bold'
                                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                  }`}
                                  title="Balik Vertikal (Flip V)"
                                >
                                  <span className="material-symbols-outlined text-[13px]">swap_vert</span>
                                  <span>Flip V</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Border Radius for Shape & Box & Group */}
                          {(activeLayer.type === 'shape' || activeLayer.type === 'group' || activeLayer.type === 'image') && (
                            <div className="space-y-1 pt-1 border-t border-border/40">
                              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                <span>Kelengkungan Sudut</span>
                                <div className="flex items-center gap-1">
                                  <CommitNumberInput
                                    min={0}
                                    max={64}
                                    step={1}
                                    value={activeLayerOverride.borderRadius || 0}
                                    onCommit={(val) => handleOverrideChange('borderRadius', val)}
                                    ariaLabel="Kelengkungan Sudut"
                                    className="w-12 px-1 py-0.2 rounded bg-surface-2 border border-border text-[9px] font-mono text-right text-accent focus:outline-none focus:border-accent"
                                  />
                                  <span className="text-[9px]">px</span>
                                </div>
                              </div>
                              <DebouncedSlider
                                min={0}
                                max={64}
                                step={2}
                                value={activeLayerOverride.borderRadius || 0}
                                onChangeComplete={(val) => handleOverrideChange('borderRadius', val)}
                                className="w-full accent-accent h-1 cursor-pointer"
                              />
                              <div className="flex items-center gap-1 pt-0.5">
                                {[0, 8, 16, 24, 32].map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleOverrideChange('borderRadius', r)}
                                    className={`flex-1 py-0.2 rounded text-[8px] font-mono border transition-all ${
                                      (activeLayerOverride.borderRadius || 0) === r
                                        ? 'bg-accent/15 border-accent text-accent font-bold'
                                        : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                                    }`}
                                  >
                                    {r}px
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Opacity and Color */}
                          <div className="space-y-2 pt-1 border-t border-border/40">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>Transparansi</span>
                                  <span className="text-accent">
                                    {Math.round((activeLayerOverride.opacity !== undefined ? activeLayerOverride.opacity : 1.0) * 100)}%
                                  </span>
                                </div>
                                <DebouncedSlider
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={activeLayerOverride.opacity !== undefined ? activeLayerOverride.opacity : 1.0}
                                  onChangeComplete={(val) => handleOverrideChange('opacity', val)}
                                  className="w-full accent-accent h-1 cursor-pointer"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted mb-0.5">
                                  <span>Warna Layer</span>
                                  <span className="text-accent text-[9px]">{activeLayerOverride.color || 'Bawaan'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <DebouncedColor
                                    value={activeLayerOverride.color || '#84cc16'}
                                    onChangeComplete={(val) => handleOverrideChange('color', val)}
                                    className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                                  />
                                  {activeLayerOverride.color && (
                                    <button
                                      type="button"
                                      onClick={() => handleOverrideChange('color', undefined)}
                                      className="text-[9px] text-text-muted hover:text-on-surface"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick color palette chips */}
                            <div className="flex items-center gap-1 pt-0.5">
                              <span className="text-[9px] text-text-muted mr-1">Palet Cepat:</span>
                              {['#84cc16', '#38bdf8', '#f59e0b', '#ef4444', '#ec4899', '#ffffff'].map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => handleOverrideChange('color', c)}
                                  className={`w-4 h-4 rounded-full border transition-transform ${
                                    activeLayerOverride.color === c ? 'border-white scale-125' : 'border-border/60 hover:scale-110'
                                  }`}
                                  style={{ backgroundColor: c }}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>

                          <LayerMotionPanel
                            key={`${activeScene.id}:${activeLayer.id}`}
                            motion={activeCompScene?.layerMotions?.[activeLayer.id]}
                            sceneDuration={activeScene.durationInSeconds}
                            getPlayheadInShot={() => {
                              const { currentFrame, project: p } = useMooStore.getState();
                              const start = getSceneStartSeconds(p.scenes, activeScene.id) ?? 0;
                              return currentFrame / (p.fps || 30) - start;
                            }}
                            onChange={(motion) => updateLayerMotion(activeScene.id, activeLayer.id, motion)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 4. Scene Palette (CSS Variables Overrides) */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">palette</span>
                      Palet Warna Adegan #{activeSceneIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetPalette}
                      className="text-[10px] text-text-muted hover:text-rose-400 flex items-center gap-0.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">restart_alt</span>
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">Bg</span>
                      <DebouncedColor
                        value={currentPalette.bg || project.theme.bg || '#09090b'}
                        onChangeComplete={(val) => handlePaletteChange('bg', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">Primary</span>
                      <DebouncedColor
                        value={currentPalette.primary || project.theme.textPrimary || '#ffffff'}
                        onChangeComplete={(val) => handlePaletteChange('primary', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">Accent</span>
                      <DebouncedColor
                        value={currentPalette.accent || project.theme.textHighlight || '#84cc16'}
                        onChangeComplete={(val) => handlePaletteChange('accent', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-surface-1 border border-border flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-text-muted uppercase">Text</span>
                      <DebouncedColor
                        value={currentPalette.text || project.theme.textPrimary || '#ffffff'}
                        onChangeComplete={(val) => handlePaletteChange('text', val)}
                        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Tipografi & Font Utama Proyek */}
                <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-accent">font_download</span>
                      Tipografi & Font Proyek
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {mapFontDisplay(project.theme.fontFamily)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'Jakarta', label: 'Jakarta Sans', sub: 'Modern & Bersih' },
                        { id: 'Impact', label: 'Syne Display', sub: 'Kinetik & Bold' },
                        { id: 'Mono', label: 'JetBrains Mono', sub: 'Teknis & Kode' }
                      ] as const
                    ).map((f) => {
                      const isSel = (project.theme.fontFamily || 'Jakarta') === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateThemeFont(f.id)}
                          className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                            isSel
                              ? 'bg-accent/15 border-accent text-accent font-semibold shadow-xs'
                              : 'bg-surface-1 border-border text-text-muted hover:text-on-surface'
                          }`}
                        >
                          <span className="text-[11px] font-bold truncate">{f.label}</span>
                          <span className="text-[9px] opacity-75 truncate">{f.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}


          </div>
        )}

        {/* ================= TAB ASET MEDIA (UPLOAD & SISIPKAN ASET) ================= */}
        {activeTab === 'asset' && (
          <div className="flex flex-col gap-4">
            <BrandKitPanel />
            <AssetManagerPanel />
            <ShotTemplatesPanel />
          </div>
        )}

        {/* ================= TAB MOGRAPH (AI GENERATOR & PACING) ================= */}
        {activeTab === 'mograph' && (
          <div className="flex flex-col gap-5">
            {/* Studio Visual & Widget Instan (Zero-API Procedural Engine) */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">bolt</span>
                  Visual & Widget Instan
                </span>
                <span className="text-[10px] font-mono text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25">
                  Tanpa API key
                </span>
              </div>

              <p className="text-[11px] text-text-muted leading-relaxed">
                Susun animasi tipografi kinetik & widget grafik secara instan dari naskah tanpa kuota API. Seluruh elemen langsung memiliki layer yang dapat digeser di kanvas.
              </p>

              {/* Pilihan Archetype Widget */}
              <div className="grid grid-cols-3 gap-1.5">
                {PROCEDURAL_ARCHETYPES.map((arch) => {
                  const isSel = selectedArchetype === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => {
                        setSelectedArchetype(arch.id);
                        if (activeScene) {
                          compileSceneProcedural(activeScene.id, arch.id);
                        }
                      }}
                      title={arch.description}
                      className={`p-2 rounded-xl border text-left flex flex-col gap-1 transition-all active:scale-95 ${
                        isSel
                          ? 'bg-accent/15 border-accent text-accent font-semibold shadow-xs'
                          : 'bg-surface-1 border-border text-text-muted hover:text-on-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined text-[15px] text-accent">{arch.icon}</span>
                        {isSel && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </div>
                      <span className="text-[10px] font-semibold leading-tight line-clamp-2 min-h-[2lh]">{arch.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={!activeScene}
                  onClick={() => activeScene && compileSceneProcedural(activeScene.id, selectedArchetype)}
                  className="py-2 px-2.5 rounded-xl bg-surface-1 hover:bg-surface-3 border border-border text-on-surface text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px] text-accent">auto_fix_high</span>
                  <span>{activeScene ? `Terapkan ke Shot #${activeSceneIndex + 1}` : 'Terapkan ke Shot'}</span>
                </button>

                <button
                  type="button"
                  disabled={scenes.length === 0}
                  onClick={() => {
                    const hasCustomVisuals = (project.composition?.scenes || []).some(
                      (m) => m.userEdited || m.generatorVersion?.startsWith('generative')
                    );
                    if (hasCustomVisuals) {
                      setShowProceduralOverwriteConfirm(true);
                    } else {
                      compileAllScenesProcedural(selectedArchetype, true);
                    }
                  }}
                  className="py-2 px-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">bolt</span>
                  <span>Susun Semua ({scenes.length})</span>
                </button>
              </div>
            </div>

            {/* Action Box Utama: Generator Mograph AI */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">auto_awesome</span>
                  Generator Mograph AI
                </span>
                <span className="text-[11px] font-mono text-text-muted px-2 py-0.5 rounded-full bg-surface-1 border border-border">
                  {project.scenes?.length || 0} Adegan
                </span>
              </div>

              {/* Status & Progress Watchdog saat generate */}
              {isCompilingMograph ? (
                <div className="p-3 rounded-xl bg-surface-1 border border-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-accent flex items-center gap-1.5 font-medium truncate">
                      <span className="material-symbols-outlined animate-spin text-[16px] shrink-0">
                        sync
                      </span>
                      <span className="truncate">{mographProgress || 'Menyiapkan...'}</span>
                    </span>
                    {mographStats && (
                      <span className="text-[11px] font-mono text-text-muted shrink-0 ml-1">
                        {Math.round((mographStats.completed / mographStats.total) * 100)}%
                      </span>
                    )}
                  </div>

                  {mographStats && (
                    <>
                      <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-accent h-full transition-all duration-300 rounded-full"
                          style={{
                            width: `${(mographStats.completed / mographStats.total) * 100}%`
                          }}
                        />
                      </div>

                      {/* Scene Badges */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {project.scenes.map((b, idx) => {
                          const st = mographStats.sceneStatuses[b.id] || 'pending';
                          return (
                            <span
                              key={b.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 border ${
                                st === 'ok'
                                  ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                                  : st === 'generating'
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                                    : st === 'error'
                                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                      : 'bg-surface-2 border-border text-text-muted'
                              }`}
                            >
                              {st === 'ok' ? '✓' : st === 'generating' ? '⟳' : st === 'error' ? '!' : '•'}
                              #{idx + 1}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={cancelMographGeneration}
                    className="w-full mt-1 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-rose-400 text-[12px] font-medium transition-colors"
                  >
                    Batalkan Pembuatan
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {!hasLlmApiKey && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                      <div className="flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">key_off</span>
                        <span>
                          API Key untuk <strong>{currentLlmProvider.toUpperCase()}</strong> belum diatur. Masukkan API Key di Pengaturan agar AI dapat membuat visual adegan.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">settings</span>
                        <span>Buka Pengaturan API</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleGenerateCustomMograph(false)}
                    disabled={isCompilingMograph || (project.scenes?.length || 0) === 0 || !hasLlmApiKey}
                    title={
                      !hasLlmApiKey
                        ? `Silakan masukkan API Key untuk ${currentLlmProvider.toUpperCase()} di Pengaturan terlebih dahulu`
                        : undefined
                    }
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">movie_filter</span>
                    <span>Buat Mograph AI</span>
                  </button>
                </div>
              )}
            </div>

            {/* Akses Editor Kode Adegan */}
            {onOpenCodeInspector && activeScene && (
              <button
                type="button"
                onClick={() => onOpenCodeInspector(activeScene.id)}
                className="p-3 rounded-2xl bg-surface-2/60 border border-border hover:border-accent/40 text-on-surface hover:text-accent flex items-center justify-between transition-colors text-[12px] font-medium"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[17px]">code</span>
                  Buka Editor Kode Adegan
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-muted">chevron_right</span>
              </button>
            )}

            {/* Advanced: how long an AI answer may be (max output tokens) */}
            <details className="group p-3.5 rounded-2xl bg-surface-2/60 border border-border">
              <summary className="flex items-center justify-between cursor-pointer list-none text-[12px] font-semibold text-on-surface">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-text-muted">settings</span>
                  Lanjutan
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-muted transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="flex flex-col gap-2.5 pt-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-on-surface">Panjang jawaban AI</span>
                  <span className="font-mono text-accent font-semibold">
                    {settings.maxOutputTokens || 2048} token
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Naikkan kalau visual adegan sering terpotong atau gagal. Angka lebih besar memakai kuota API lebih banyak.
                </p>
  
                <input
                  type="range"
                  min={512}
                  max={8192}
                  step={256}
                  disabled={isCompilingMograph}
                  value={settings.maxOutputTokens || 2048}
                  onChange={(e) => updateSettings({ maxOutputTokens: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
  
                <div className="flex gap-1 pt-0.5">
                  {[1024, 2048, 4096, 8192].map((tok) => {
                    const isActive = (settings.maxOutputTokens || 2048) === tok;
                    return (
                      <button
                        key={tok}
                        type="button"
                        disabled={isCompilingMograph}
                        onClick={() => updateSettings({ maxOutputTokens: tok })}
                        className={`flex-1 py-1 rounded text-[10px] font-mono border transition-colors ${
                          isActive
                            ? 'bg-surface-3 border-accent text-accent font-bold'
                            : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                        }`}
                      >
                        {tok}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* ================= TAB SUBTITEL ================= */}
        {activeTab === 'subtitle' && (
          <div className="flex flex-col gap-5">
            {/* ================= PENGATURAN SUBTITEL VIDEO ================= */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              {/* Header & Toggle Utama */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">subtitles</span>
                  Pengaturan Subtitel Video
                </span>
                <button
                  type="button"
                  onClick={toggleGlobalSubtitles}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1.5 transition-all select-none ${
                    project.theme.showSubtitles
                      ? 'bg-accent/15 border-accent text-accent font-semibold'
                      : 'bg-surface-1 border-border text-text-muted hover:text-on-surface'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      project.theme.showSubtitles ? 'bg-accent' : 'bg-zinc-600'
                    }`}
                  />
                  <span>{project.theme.showSubtitles ? 'Aktif' : 'Nonaktif'}</span>
                </button>
              </div>

              {/* Panel Kustomisasi Subtitel Terpadu */}
              {project.theme.showSubtitles && (
                <div className="flex flex-col gap-3.5 pt-1">
                  {/* 1. Live Subtitle Preview */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Pratinjau Langsung
                    </span>
                    <div className="w-full h-16 rounded-xl bg-black/90 border border-border flex items-center justify-center p-2 overflow-hidden relative shadow-inner">
                      <div
                        className={`text-center font-bold transition-all ${
                          subCust.uppercase ? 'uppercase' : ''
                        }`}
                        style={{
                          fontSize: `${Math.round(14 * (subCust.fontScale || 1.0))}px`,
                          padding: currentStyle === 'boxed' ? '4px 12px' : '0',
                          borderRadius: currentStyle === 'boxed' ? '8px' : '0',
                          backgroundColor:
                            currentStyle === 'boxed'
                              ? `rgba(9, 9, 11, ${subCust.bgOpacity !== undefined ? subCust.bgOpacity : 0.65})`
                              : 'transparent',
                          textShadow:
                            currentStyle === 'outline'
                              ? '0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                              : currentStyle === 'karaoke'
                                ? `0 0 12px ${activeHighlightColor}`
                                : '0 2px 8px rgba(0,0,0,0.8)'
                        }}
                      >
                        <span style={{ color: subCust.textColor || '#ffffff' }}>MooScript </span>
                        <span
                          style={{
                            color: activeHighlightColor,
                            transform: currentStyle === 'bold-pop' ? 'scale(1.15)' : 'none',
                            display: 'inline-block'
                          }}
                        >
                          Studio
                        </span>
                        <span style={{ color: subCust.textColor || '#ffffff' }}> AI</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Pilihan Gaya Tampilan (Style Presets) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Pilihan Gaya Tampilan
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {styleOptions.map((opt) => {
                        const isSelected = currentStyle === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateThemeCaptionStyle(opt.value)}
                            className={`py-2 px-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all text-left ${
                              isSelected
                                ? 'bg-surface-3 border-accent text-accent font-semibold shadow-sm'
                                : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px] shrink-0">
                              {opt.value === 'boxed'
                                ? 'crop_7_5'
                                : opt.value === 'karaoke'
                                  ? 'music_note'
                                  : opt.value === 'bold-pop'
                                    ? 'bolt'
                                    : opt.value === 'outline'
                                      ? 'border_style'
                                      : 'short_text'}
                            </span>
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Tata Letak & Posisi */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Tata Letak & Posisi
                    </span>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-1 border border-border">
                      {positionOptions.map((pos) => {
                        const isSelected = currentPosition === pos.value;
                        return (
                          <button
                            key={pos.value}
                            type="button"
                            onClick={() => updateThemeCaptionPosition(pos.value)}
                            className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                              isSelected
                                ? 'bg-surface-3 text-accent font-bold shadow-sm'
                                : 'text-text-muted hover:text-on-surface'
                            }`}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Tipografi & Ukuran */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted font-medium">Ukuran Huruf</span>
                      <span className="font-mono text-on-surface font-semibold">
                        {Math.round((subCust.fontScale || 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.6"
                      step="0.05"
                      value={subCust.fontScale || 1.0}
                      onChange={(e) => updateSubtitleCustomization({ fontScale: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'S (80%)', val: 0.8 },
                        { label: 'M (100%)', val: 1.0 },
                        { label: 'L (125%)', val: 1.25 },
                        { label: 'XL (150%)', val: 1.5 }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => updateSubtitleCustomization({ fontScale: item.val })}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                            Math.abs((subCust.fontScale || 1.0) - item.val) < 0.05
                              ? 'bg-accent/15 border-accent text-accent font-bold'
                              : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-text-muted">Huruf Besar (UPPERCASE)</span>
                      <button
                        type="button"
                        onClick={() => updateSubtitleCustomization({ uppercase: !subCust.uppercase })}
                        className={`w-9 h-5 rounded-full transition-colors relative ${
                          subCust.uppercase ? 'bg-accent' : 'bg-surface-3 border border-border'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                            subCust.uppercase ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 5. Warna Sorotan Kata */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Warna Sorotan Kata
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { color: '#84cc16', name: 'Lime' },
                        { color: '#eab308', name: 'Kuning' },
                        { color: '#06b6d4', name: 'Cyan' },
                        { color: '#f97316', name: 'Oranye' },
                        { color: '#ec4899', name: 'Pink' },
                        { color: '#ffffff', name: 'Putih' }
                      ].map((c) => {
                        const isSelected = (subCust.activeColor || project.theme.textHighlight || '#84cc16') === c.color;
                        return (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => updateSubtitleCustomization({ activeColor: c.color })}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              isSelected ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        );
                      })}
                      <input
                        type="color"
                        value={subCust.activeColor || project.theme.textHighlight || '#84cc16'}
                        onChange={(e) => updateSubtitleCustomization({ activeColor: e.target.value })}
                        className="w-7 h-7 rounded-full bg-transparent border border-border cursor-pointer overflow-hidden p-0"
                        title="Pilih warna kustom"
                      />
                    </div>
                  </div>

                  {/* 6. Ritme & Pacing Teks */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Ritme Kata per Frasa</span>
                      <div className="flex items-center gap-1">
                        {[
                          { label: '3 kata', count: 3 },
                          { label: '4 kata', count: 4 },
                          { label: '5 kata', count: 5 }
                        ].map((chunk) => {
                          const isSelected = (subCust.maxWordsPerChunk || 4) === chunk.count;
                          return (
                            <button
                              key={chunk.count}
                              type="button"
                              onClick={() => updateSubtitleCustomization({ maxWordsPerChunk: chunk.count })}
                              className={`py-1 px-2 rounded-lg text-[10px] border transition-all ${
                                isSelected
                                  ? 'bg-accent/15 border-accent text-accent font-bold'
                                  : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                              }`}
                            >
                              {chunk.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Opasitas Kotak (jika style boxed) */}
                    {currentStyle === 'boxed' && (
                      <div className="flex flex-col gap-1 pt-1 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">Opasitas Latar Kotak</span>
                          <span className="font-mono text-on-surface font-semibold">
                            {Math.round((subCust.bgOpacity !== undefined ? subCust.bgOpacity : 0.65) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={subCust.bgOpacity !== undefined ? subCust.bgOpacity : 0.65}
                          onChange={(e) => updateSubtitleCustomization({ bgOpacity: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= TAB SUARA ================= */}
        {activeTab === 'audio' && (
          <div className="flex flex-col gap-5">
            {/* Vokal / Voiceover */}
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Penyedia Suara (TTS)
                </span>
                <div className="relative">
                  <select
                    value={currentVoiceProvider}
                    onChange={handleProviderChange}
                    className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                  >
                    {voiceProviders.map((vp) => (
                      <option key={vp.id} value={vp.id} className="bg-surface-1 text-on-surface">
                        {vp.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Karakter Suara Berdasarkan Provider */}
              {currentVoiceProvider === 'openai' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Karakter Suara OpenAI
                  </span>
                  <div className="relative">
                    <select
                      value={currentOpenAIVoice}
                      onChange={(e) =>
                        updateSettings({
                          voiceIds: { ...settings.voiceIds, openai: e.target.value }
                        })
                      }
                      className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                    >
                      {OPENAI_VOICE_OPTIONS.map((v) => (
                        <option key={v.id} value={v.id} className="bg-surface-1 text-on-surface">
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
              )}

              {currentVoiceProvider === 'elevenlabs' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Karakter Suara ElevenLabs
                  </span>
                  <div className="relative">
                    <select
                      value={isElevenLabsCustom ? 'custom' : currentElevenLabsVoice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          updateSettings({
                            voiceIds: {
                              ...settings.voiceIds,
                              elevenlabs: isElevenLabsCustom ? currentElevenLabsVoice : ''
                            }
                          });
                        } else {
                          updateSettings({
                            voiceIds: { ...settings.voiceIds, elevenlabs: val }
                          });
                        }
                      }}
                      className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                    >
                      {ELEVENLABS_VOICE_OPTIONS.map((v) => (
                        <option key={v.id} value={v.id} className="bg-surface-1 text-on-surface">
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>

                  {isElevenLabsCustom && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-muted font-medium">Custom Voice ID</span>
                      <input
                        type="text"
                        placeholder="Masukkan Custom Voice ID ElevenLabs..."
                        value={currentElevenLabsVoice === 'custom' ? '' : currentElevenLabsVoice}
                        onChange={(e) =>
                          updateSettings({
                            voiceIds: { ...settings.voiceIds, elevenlabs: e.target.value.trim() }
                          })
                        }
                        className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[12px] font-mono rounded-xl h-9 px-3 focus:outline-none transition-colors"
                      />
                    </div>
                  )}
                </div>
              )}

              {currentVoiceProvider === 'local' && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-text-muted uppercase tracking-wider">
                        Karakter Suara Lokal (Offline)
                      </span>
                      <span className="font-mono text-[10px] text-accent">Zero-API</span>
                    </div>
                    <div className="relative">
                      <select
                        value={currentLocalVoice}
                        onChange={(e) =>
                          updateSettings({
                            voiceIds: { ...settings.voiceIds, local: e.target.value }
                          })
                        }
                        className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                      >
                        {LOCAL_VOICE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id} className="bg-surface-1 text-on-surface">
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Status & Kontrol Unduh Model Piper */}
                  {currentLocalVoice !== 'fallback' && (
                    <div className="p-2.5 rounded-xl border transition-all text-[11px] flex flex-col gap-2 bg-surface-2/60 border-border">
                      {isLocalVoiceCached ? (
                        <div className="flex items-center justify-between text-emerald-400 font-medium">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>Model siap offline</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted">
                              {getLocalVoice(currentLocalVoice)?.sizeMb} MB
                            </span>
                            <button
                              type="button"
                              onClick={handlePurgeCurrentLocalVoice}
                              className="p-1 rounded hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors"
                              title="Hapus file model dari cache browser"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ) : isDownloadingLocalVoice ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono text-accent">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                              <span>Mengunduh bobot ONNX...</span>
                            </span>
                            <span>{localVoiceDownloadProgress}%</span>
                          </div>
                          <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-accent h-full transition-all duration-200 rounded-full"
                              style={{ width: `${localVoiceDownloadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-1.5 text-text-muted leading-relaxed text-[11px]">
                            <span className="material-symbols-outlined text-[16px] text-accent shrink-0 mt-0.5">
                              download_for_offline
                            </span>
                            <span>
                              Model ini ({getLocalVoice(currentLocalVoice)?.sizeMb} MB) belum tersimpan di browser. Unduh sekali agar dapat bersuara tanpa internet.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleDownloadCurrentLocalVoice}
                            className="w-full py-2 px-3 rounded-lg bg-accent text-on-accent text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                            <span>Unduh Model ({getLocalVoice(currentLocalVoice)?.sizeMb} MB)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kustomisasi Akustik Piper ONNX */}
                  {currentLocalVoice !== 'fallback' && (
                    <div className="p-2.5 rounded-xl border border-border/80 bg-surface-2/40 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        Kustomisasi Akustik Piper
                      </span>
                      <CommitSliderRow
                        size="sm"
                        label="Variasi Intonasi (Ekspresivitas)"
                        value={settings.piperNoiseScale ?? 0.667}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        format={(v) => v.toFixed(2)}
                        onCommit={(v) => updateSettings({ piperNoiseScale: v })}
                      />
                      <CommitSliderRow
                        size="sm"
                        label="Variasi Ritme / Fonem"
                        value={settings.piperNoiseW ?? 0.8}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        format={(v) => v.toFixed(2)}
                        onCommit={(v) => updateSettings({ piperNoiseW: v })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Slider Kecepatan Bicara (Speech Rate) */}
              <div className="flex flex-col gap-1.5 pt-0.5">
                <CommitSliderRow
                  label="Kecepatan Bicara"
                  value={settings.speed ?? 1.05}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)}x`}
                  onCommit={(v) => updateSettings({ speed: v })}
                />
                {/* Preset Chips Kecepatan */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[0.8, 1.0, 1.25, 1.5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => updateSettings({ speed: spd })}
                      className={`flex-1 py-1 text-[10px] font-mono rounded-lg border transition-all ${
                        Math.abs((settings.speed ?? 1.05) - spd) < 0.03
                          ? 'bg-accent/15 border-accent text-accent font-bold'
                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Audisi & Generate Suara */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAuditionVoice}
                  disabled={currentVoiceProvider === 'timer'}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-surface-2 border border-border hover:bg-surface-3 text-on-surface font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                  title={currentVoiceProvider === 'timer' ? 'Mode tanpa suara tidak punya contoh suara' : 'Dengarkan contoh suara'}
                >
                  <span className="material-symbols-outlined text-[17px] text-accent">volume_up</span>
                  <span>Coba Suara</span>
                </button>

                <button
                  type="button"
                  onClick={() => generateAudio()}
                  disabled={isGeneratingAudio || !hasNarration}
                  title={!hasNarration ? 'Tulis naskah adegan terlebih dahulu' : undefined}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-accent text-on-accent font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
                >
                  {isGeneratingAudio ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      <span className="truncate">
                        {audioProgress?.currentScene
                          ? `(${audioProgress.currentScene}/${audioProgress.totalScenes})`
                          : 'Proses...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
                      <span className="truncate">Generate Suara</span>
                    </>
                  )}
                </button>
              </div>

              {isGeneratingAudio && (
                <button
                  type="button"
                  onClick={() => cancelAudioGeneration()}
                  className="w-full py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-rose-400 text-[12px] font-medium transition-colors"
                >
                  Batalkan Pembuatan Suara
                </button>
              )}

              {/* Unggah File Audio / Voiceover Rekaman Sendiri */}
              <div className="pt-1">
                <input
                  ref={customAudioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadCustomAudio(file);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isGeneratingAudio}
                  onClick={() => customAudioInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-dashed border-border hover:border-accent/50 text-on-surface text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50"
                  title="Unggah rekaman voiceover atau musik MP3/WAV/M4A untuk disinkronkan otomatis ke adegan"
                >
                  <span className="material-symbols-outlined text-[16px] text-accent">upload_file</span>
                  <span>Unggah Audio / Voiceover Sendiri (MP3/WAV)</span>
                </button>
              </div>

              {/* Status audio proyek */}
              <div
                className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex flex-col gap-2 ${
                  !hasProjectAudio
                    ? 'bg-surface-2 border-border text-text-muted'
                    : audioStale
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-accent/10 border-accent/30 text-accent'
                }`}
                role="status"
              >
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0">
                    {!hasProjectAudio ? 'volume_off' : audioStale ? 'warning' : 'check_circle'}
                  </span>
                  <span className="flex-1">
                    {hasProjectAudio && bgmOnlyAudio
                      ? audioStale
                        ? 'Durasi adegan berubah. Tekan Generate Suara agar musik latar menyesuaikan.'
                        : `Musik latar siap (${(project.audioDuration || 0).toFixed(1)} detik), tanpa narasi suara.`
                      : currentVoiceProvider === 'timer' && !hasProjectAudio
                        ? 'Mode tanpa suara: hanya durasi adegan yang dihitung dari panjang naskah.'
                        : !hasProjectAudio
                          ? 'Suara belum dibuat.'
                          : audioStale
                            ? 'Naskah atau pengaturan berubah. Buat ulang suara agar sinkron.'
                            : `Suara siap (${(project.audioDuration || 0).toFixed(1)} detik).`}
                  </span>
                </div>

                {hasProjectAudio && (
                  <button
                    type="button"
                    onClick={() => deleteAudio()}
                    className="w-full py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                    title="Hapus trek audio dari proyek"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>Hapus Suara Proyek</span>
                  </button>
                )}
              </div>
            </div>

            {/* Musik Latar (BGM) */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Musik Latar
              </span>

              {/* Preset Musik */}
              <div
                className={`grid gap-1 p-1 rounded-xl bg-surface-2 border border-border ${
                  bgmPresets.length > 5 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-5'
                }`}
              >
                {bgmPresets.map((bp) => {
                  const isSelected = currentBgmPreset === bp.value;
                  return (
                    <button
                      key={bp.value}
                      type="button"
                      onClick={() => updateBgmPreset(bp.value)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {bp.label}
                    </button>
                  );
                })}
              </div>

              {/* Unggah musik sendiri */}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={customBgmInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadCustomBgm(file);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isGeneratingAudio}
                  onClick={() => customBgmInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-dashed border-border hover:border-accent/50 text-on-surface text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50"
                  title="Unggah musik latar sendiri (maks 25 MB). Musik diulang otomatis sampai video selesai."
                >
                  <span className="material-symbols-outlined text-[16px] text-accent">library_music</span>
                  <span>{project.bgm?.customName ? 'Ganti Musik Sendiri' : 'Unggah Musik Sendiri'}</span>
                </button>
                {project.bgm?.customName && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                    <span className="truncate" title={project.bgm.customName}>
                      {project.bgm.customName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCustomBgm()}
                      className="shrink-0 text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Volume & ducking: the mix is rendered once, when the thumb is released */}
              <CommitSliderRow
                label="Volume"
                value={bgmLevel}
                min={0}
                max={1}
                step={0.01}
                disabled={currentBgmPreset === 'none'}
                format={(v) => `${Math.round(v * 100)}%`}
                onCommit={(v) => updateBgmLevel(v)}
              />
              <CommitSliderRow
                label="Volume Musik Saat Ada Suara (Ducking)"
                value={duckRatio}
                min={0}
                max={1}
                step={0.01}
                disabled={currentBgmPreset === 'none'}
                format={(v) => `${Math.round(v * 100)}%`}
                onCommit={(v) => updateBgmDuckRatio(v)}
              />
            </div>

            {/* Voice-over edit: trim, shift, fades and level, applied in the mix */}
            {hasRawVoice && (
              <div className="flex flex-col gap-3 pt-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Edit Suara</span>
                  {voiceEditActive && (
                    <button
                      type="button"
                      onClick={() =>
                        updateVoiceEdit({ offset: undefined, trimStart: undefined, trimEnd: undefined, fadeIn: undefined, fadeOut: undefined, gain: undefined })
                      }
                      className="text-[10px] text-text-muted hover:text-rose-300"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-text-faint leading-snug">
                  Subtitel dan ketukan kata ikut bergeser bersama suara.
                </p>
                <CommitSliderRow
                  label="Geser suara"
                  value={voiceEdit.offset ?? 0}
                  min={-2}
                  max={2}
                  step={0.05}
                  format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} dtk`}
                  onCommit={(v) => updateVoiceEdit({ offset: v })}
                />
                <CommitSliderRow
                  label="Potong awal"
                  value={voiceEdit.trimStart ?? 0}
                  min={0}
                  max={3}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)} dtk`}
                  onCommit={(v) => updateVoiceEdit({ trimStart: v })}
                />
                <CommitSliderRow
                  label="Potong akhir"
                  value={voiceEdit.trimEnd ?? 0}
                  min={0}
                  max={3}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)} dtk`}
                  onCommit={(v) => updateVoiceEdit({ trimEnd: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <CommitSliderRow
                    label="Fade masuk"
                    value={voiceEdit.fadeIn ?? 0}
                    min={0}
                    max={2}
                    step={0.05}
                    size="sm"
                    format={(v) => `${v.toFixed(2)} dtk`}
                    onCommit={(v) => updateVoiceEdit({ fadeIn: v })}
                  />
                  <CommitSliderRow
                    label="Fade keluar"
                    value={voiceEdit.fadeOut ?? 0}
                    min={0}
                    max={2}
                    step={0.05}
                    size="sm"
                    format={(v) => `${v.toFixed(2)} dtk`}
                    onCommit={(v) => updateVoiceEdit({ fadeOut: v })}
                  />
                </div>
                <CommitSliderRow
                  label="Volume suara"
                  value={voiceEdit.gain ?? 1}
                  min={0}
                  max={2}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onCommit={(v) => updateVoiceEdit({ gain: v })}
                />
              </div>
            )}

            {/* Sound effects */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Efek Suara (SFX)</span>
                <span className="text-[10px] font-mono text-text-muted">{(project.sfxCues || []).length} cue</span>
              </div>
              <p className="text-[11px] text-text-faint leading-snug">
                Whoosh di setiap potongan, pop dan hentakan di momen visual. Atur satu per satu di track SFX timeline.
              </p>
              <button
                type="button"
                disabled={scenes.length === 0}
                onClick={() => {
                  const n = autoPlaceSfx();
                  addToast(n > 0 ? `${n} efek suara ditempatkan.` : 'Tidak ada titik baru untuk efek suara.', 'info');
                }}
                className="w-full py-2 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
                SFX otomatis
              </button>
              <CommitSliderRow
                label="Volume SFX"
                value={project.sfxLevel ?? 0.8}
                min={0}
                max={1.5}
                step={0.05}
                disabled={(project.sfxCues || []).length === 0}
                format={(v) => `${Math.round(v * 100)}%`}
                onCommit={(v) => setSfxLevel(v)}
              />
            </div>
          </div>
        )}

        {/* ================= TAB EKSPOR ================= */}
        {activeTab === 'ekspor' && <ExportPanel />}
      </div>

      {/* Konfirmasi Timpa Adegan yang Diedit Manual */}
      <ConfirmModal
        isOpen={showOverwriteConfirm}
        onClose={() => setShowOverwriteConfirm(false)}
        onConfirm={() => {
          setShowOverwriteConfirm(false);
          handleGenerateCustomMograph(true);
        }}
        title="Timpa Perubahan Manual?"
        description="Beberapa adegan dalam proyek ini telah diedit secara manual. Menjalankan AI Generator akan menimpa kode adegan tersebut dengan hasil generasi baru. Lanjutkan?"
        confirmLabel="Timpa & Generate"
        cancelLabel="Batal"
        variant="warning"
        icon="warning"
      />

      {/* Konfirmasi Ganti Semua Visual dengan Visual Instan */}
      <ConfirmModal
        isOpen={showProceduralOverwriteConfirm}
        onClose={() => setShowProceduralOverwriteConfirm(false)}
        onConfirm={() => {
          setShowProceduralOverwriteConfirm(false);
          compileAllScenesProcedural(selectedArchetype, true);
        }}
        title="Ganti Semua Visual?"
        description="Beberapa adegan memakai visual AI atau sudah diedit manual. Visual instan akan menggantikan semuanya. Anda masih bisa mengembalikannya dengan Urungkan (Ctrl+Z)."
        confirmLabel="Ganti Semua"
        cancelLabel="Batal"
        variant="warning"
        icon="bolt"
      />
    </div>
  );
};
