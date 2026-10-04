import React, { useState, useRef, useMemo } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { GlobalVoiceSelector } from '../../components/studio/GlobalVoiceSelector';
import { generateCustomScene } from '../../engine/ai/director/directorPipeline';
import { callRawLLM } from '../../engine/ai/llm';
import {
  extractLayersFromHtml,
  mergeEditableLayers,
  getLayerText,
  setLayerText
} from '../../engine/composition/layers';
import type {
  Composition,
  EditableLayer,
  LayerOverride,
  ScenePalette,
  TTSProvider,
  BgmPreset
} from '../../types';

interface VisualEditorViewProps {
  onBackStep?: () => void;
  onNextStep?: () => void;
  onOpenCodeInspector?: (beatId: string) => void;
}

export const VisualEditorView: React.FC<VisualEditorViewProps> = ({
  onBackStep,
  onNextStep,
  onOpenCodeInspector
}) => {
  const {
    project,
    activeSceneId,
    setActiveSceneId,
    seekFrame,
    settings,
    updateSettings,
    updateLayerOverride,
    updateScenePalette,
    setProject,
    isGeneratingAudio,
    generateAudio,
    cancelAudioGeneration,
    audioProgress,
    audioStale,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio,
    addToast
  } = useMooStore();

  const fps = project.fps || 30;
  const scenes = project.scenes || [];
  const comp = project.composition;
  const compScenes = comp?.scenes || [];

  // Active scene fallback
  const effectiveActiveId = activeSceneId || scenes[0]?.id || '';
  const activeSceneIndex = scenes.findIndex((s) => s.id === effectiveActiveId);
  const activeScene = scenes[activeSceneIndex] || scenes[0];

  // Matching generated scene in composition
  const activeCompScene = useMemo(() => {
    if (!activeScene) return undefined;
    return compScenes.find((s) => s.id === activeScene.id || s.beatId === activeScene.id);
  }, [compScenes, activeScene]);

  // Selected layer within active scene
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Per-scene AI revision state
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [isRevisingScene, setIsRevisingScene] = useState(false);
  const [revisionProgress, setRevisionProgress] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio accordion state
  const [isAudioSectionOpen, setIsAudioSectionOpen] = useState(false);

  // Compute scene time offsets for seeking
  const sceneOffsets = useMemo(() => {
    let acc = 0;
    const offsets: Record<string, number> = {};
    for (const s of scenes) {
      offsets[s.id] = acc;
      acc += s.durationInSeconds;
    }
    return offsets;
  }, [scenes]);

  // Discover and merge editable layers for active scene
  const availableLayers: EditableLayer[] = useMemo(() => {
    if (!activeCompScene?.html) return [];
    return mergeEditableLayers(activeCompScene.editableLayers, activeCompScene.html);
  }, [activeCompScene?.editableLayers, activeCompScene?.html]);

  // Automatically select first layer if current selection not found
  const activeLayer = useMemo(() => {
    if (!availableLayers.length) return null;
    return availableLayers.find((l) => l.id === selectedLayerId) || availableLayers[0];
  }, [availableLayers, selectedLayerId]);

  // Current overrides and palette for active scene
  const currentOverrides: Record<string, LayerOverride> = activeCompScene?.overrides || {};
  const activeLayerOverride: LayerOverride = activeLayer ? currentOverrides[activeLayer.id] || {} : {};
  const currentPalette: Partial<ScenePalette> = activeCompScene?.palette || {};

  // Handle scene selection
  const handleSelectScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    setSelectedLayerId(null);
    const startSec = sceneOffsets[sceneId] || 0;
    seekFrame(Math.round(startSec * fps));
  };

  // Handle Layer Override Update
  const handleOverrideChange = (prop: keyof LayerOverride, val: number | string | undefined) => {
    if (!activeScene || !activeLayer) return;
    updateLayerOverride(activeScene.id, activeLayer.id, { [prop]: val });
  };

  // Reset layer overrides
  const handleResetLayerOverride = () => {
    if (!activeScene || !activeLayer) return;
    updateLayerOverride(activeScene.id, activeLayer.id, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      color: undefined
    });
    addToast(`Override layer ${activeLayer.label} direset.`, 'info');
  };

  // Handle text edit directly in layer HTML
  const handleLayerTextChange = (newText: string) => {
    if (!activeScene || !activeCompScene || !activeLayer || !comp) return;
    const updatedHtml = setLayerText(activeCompScene.html, activeLayer.id, newText);
    const updatedCompScenes = comp.scenes.map((s) => {
      if (s.id !== activeCompScene.id && s.beatId !== activeCompScene.beatId) return s;
      return {
        ...s,
        html: updatedHtml,
        userEdited: true
      };
    });
    setProject({
      ...project,
      composition: {
        ...comp,
        scenes: updatedCompScenes,
        updatedAt: Date.now()
      }
    });
  };

  // Handle Scene Palette Update
  const handlePaletteChange = (prop: keyof ScenePalette, val: string) => {
    if (!activeScene) return;
    updateScenePalette(activeScene.id, { [prop]: val });
  };

  // Reset scene palette
  const handleResetPalette = () => {
    if (!activeScene || !comp) return;
    updateScenePalette(activeScene.id, {
      bg: undefined,
      primary: undefined,
      accent: undefined,
      text: undefined
    });
    addToast('Palette warna adegan dikembalikan ke default.', 'info');
  };

  // Handle single-scene AI revision
  const handleReviseSingleScene = async () => {
    if (!activeScene) return;

    const provider = settings.selectedLLMProvider;
    const apiKey = settings.apiKeys[provider] || '';
    if (!apiKey) {
      addToast(`Silakan masukkan API Key untuk ${provider.toUpperCase()} di Pengaturan.`, 'warning');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRevisingScene(true);
    setRevisionProgress('Menghubungi AI Motion Director untuk revisi adegan...');

    const modelToUse =
      provider === 'gemini'
        ? settings.geminiModel
        : provider === 'openai'
          ? settings.openaiModel
          : provider === 'groq'
            ? settings.groqModel
            : provider === 'anthropic'
              ? settings.anthropicModel
              : settings.openrouterModel;

    try {
      const revisedVisualIntent = revisionPrompt.trim()
        ? `${activeScene.visualIntent || activeScene.narrationText || ''}. Instruksi perubahan pengguna: ${revisionPrompt.trim()}`
        : activeScene.visualIntent || activeScene.narrationText || 'Adegan mograph dinamis';

      const sceneModule = await generateCustomScene({
        beat: {
          id: activeScene.id,
          narration: activeScene.narrationText || activeScene.text || '',
          visualIntent: revisedVisualIntent,
          visualConcept: activeScene.visualConcept,
          visualElements: activeScene.visualElements,
          motionIntent: activeScene.motionIntent,
          cameraIntent: activeScene.camera,
          durationHint: activeScene.durationInSeconds || 3.5
        },
        index: activeSceneIndex >= 0 ? activeSceneIndex : 0,
        total: scenes.length,
        aspectRatio: project.aspectRatio || '9:16',
        styleBrief: {
          adjectives: ['energetic', 'clean', 'cinematic'],
          palette: {
            bg: project.theme.bg || '#09090b',
            primary: project.theme.textPrimary || '#f4f4f6',
            accent: project.theme.textHighlight || '#84cc16',
            text: project.theme.textPrimary || '#ffffff'
          },
          fontDisplay: project.theme.fontFamily || 'Plus Jakarta Sans',
          fontBody: 'Plus Jakarta Sans',
          backgroundLanguage: 'Subtle animated mesh gradient with floating particles',
          motionSignature: 'Smooth camera punch-in with kinetic typography bounce'
        },
        provider,
        apiKey,
        model: modelToUse,
        executeLlm: async ({ systemPrompt, userPrompt }) => {
          return await callRawLLM({
            provider,
            apiKey,
            model: modelToUse,
            systemPrompt,
            userPrompt,
            signal: controller.signal
          });
        }
      });

      if (controller.signal.aborted) {
        addToast('Revisi adegan dibatalkan.', 'info');
        return;
      }

      // Update composition with newly generated scene module
      const currentComp = useMooStore.getState().project.composition;
      const currentScenesList = currentComp?.scenes || [];
      const updatedCompScenes = currentScenesList.map((mod) => {
        if (mod.id !== activeScene.id && mod.beatId !== activeScene.id) return mod;
        return {
          ...sceneModule,
          userEdited: true
        };
      });

      // Also update visualIntent in storyboard scene
      const currentProject = useMooStore.getState().project;
      const updatedProjectScenes = currentProject.scenes.map((s) => {
        if (s.id !== activeScene.id) return s;
        return {
          ...s,
          visualIntent: revisedVisualIntent
        };
      });

      setProject({
        ...currentProject,
        scenes: updatedProjectScenes,
        composition: {
          ...(currentComp || {
            id: `comp-${Date.now()}`,
            width: currentProject.width || 1080,
            height: currentProject.height || 1920,
            fps: currentProject.fps || 30,
            duration: currentProject.audioDuration || 10,
            createdAt: Date.now()
          }),
          scenes: updatedCompScenes,
          updatedAt: Date.now()
        }
      });

      setRevisionPrompt('');
      if (sceneModule.status === 'error') {
        addToast('Gagal merevisi adegan. Silakan cek pesan error dan coba lagi.', 'error');
      } else {
        addToast(`Adegan #${activeSceneIndex + 1} berhasil direvisi!`, 'success');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        addToast('Revisi dibatalkan.', 'info');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Error saat revisi adegan: ${msg}`, 'error');
    } finally {
      setIsRevisingScene(false);
      setRevisionProgress('');
      abortControllerRef.current = null;
    }
  };

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

  const ttsProviders: { value: TTSProvider; label: string }[] = [
    { value: 'openai', label: 'OpenAI TTS' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'local', label: 'Local (Kokoro)' },
    { value: 'fallback', label: 'Fallback Timer' }
  ];

  const bgmPresets: { value: BgmPreset; label: string }[] = [
    { value: 'none', label: 'Tanpa BGM' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'lofi', label: 'Lofi Chill' },
    { value: 'ambient', label: 'Ambient' },
    { value: 'hiphop', label: 'High Energy' }
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 max-w-2xl mx-auto w-full">
      {/* 1. Header & Scene Selector Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">movie</span>
            Pilih Adegan
          </span>
          <span className="text-[12px] text-text-muted font-mono">
            {scenes.length} Adegan Total
          </span>
        </div>

        {/* Scene Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {scenes.map((scene, idx) => {
            const isSelected = scene.id === activeScene?.id;
            const compScene = compScenes.find((s) => s.id === scene.id || s.beatId === scene.id);
            const status = compScene?.status || 'pending';
            const isEdited = compScene?.userEdited || Boolean(compScene?.overrides && Object.keys(compScene.overrides).length);

            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => handleSelectScene(scene.id)}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1.5 transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-accent/10 border-accent text-on-surface shadow-sm ring-1 ring-accent/30'
                    : 'bg-surface-2 border-border text-text-muted hover:text-on-surface hover:bg-surface-3'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[12px] font-bold font-mono ${isSelected ? 'text-accent' : 'text-zinc-300'}`}>
                    #{idx + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    {isEdited && (
                      <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                        edited
                      </span>
                    )}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-bold ${
                        status === 'ok'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : status === 'error'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-zinc-500/20 text-zinc-400'
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-300 line-clamp-2 leading-tight">
                  {scene.visualIntent || scene.narrationText || scene.text || `Adegan ${idx + 1}`}
                </p>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>{scene.durationInSeconds.toFixed(1)}s</span>
                  {compScene?.editableLayers && compScene.editableLayers.length > 0 && (
                    <span>{compScene.editableLayers.length} layers</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeScene && (
        <>
          {/* Status Alert if Scene has Error */}
          {activeCompScene?.status === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-[13px]">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>Adegan ini mengalami kendala rendering</span>
              </div>
              {activeCompScene.errors && activeCompScene.errors.length > 0 && (
                <ul className="text-[12px] text-rose-300/80 list-disc list-inside space-y-0.5 font-mono">
                  {activeCompScene.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
              <Button
                variant="primary"
                icon="refresh"
                size="sm"
                onClick={handleReviseSingleScene}
                isLoading={isRevisingScene}
                className="mt-1 self-start"
              >
                Coba Generate Ulang Adegan Ini
              </Button>
            </div>
          )}

          {/* 2. Per-Scene AI Revision Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                Revisi Adegan #{activeSceneIndex + 1} dengan AI
              </span>
              <span className="text-[11px] text-text-muted">
                Tanpa merombak adegan lain
              </span>
            </div>

            <p className="text-[12px] text-text-muted">
              Masukkan instruksi perubahan spesifik untuk adegan ini. AI akan merancang ulang visual dan animasi adegan tanpa mengubah susunan video secara keseluruhan.
            </p>

            <textarea
              value={revisionPrompt}
              onChange={(e) => setRevisionPrompt(e.target.value)}
              placeholder="Contoh: 'Ubah grafik batang menjadi diagram melingkar', 'Buat ikon pesawat datang dari kiri atas', 'Perbesar font judul dan buat efek glow lebih terang'..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-[13px] text-on-surface placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-accent"
            />

            {revisionProgress && (
              <div className="p-2.5 rounded-lg bg-surface-3/80 border border-border text-[12px] text-accent flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[15px]">sync</span>
                <span>{revisionProgress}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                icon="auto_awesome"
                size="sm"
                onClick={handleReviseSingleScene}
                isLoading={isRevisingScene}
                disabled={isRevisingScene}
                className="flex-1"
              >
                {isRevisingScene ? 'Merevisi Adegan...' : 'Revisi Adegan Ini'}
              </Button>
              {isRevisingScene && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => abortControllerRef.current?.abort()}
                >
                  Batalkan
                </Button>
              )}
            </div>
          </div>

          {/* 3. Layer Inspector & Non-Destructive Overrides */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">layers</span>
                Layer Inspector (Non-Destructive)
              </span>
              <span className="text-[11px] text-text-muted">
                {availableLayers.length} Layer Ditemukan
              </span>
            </div>

            {availableLayers.length === 0 ? (
              <div className="p-4 rounded-xl bg-surface-2 border border-border text-center text-text-muted text-[13px]">
                Belum ada elemen dengan atribut <code className="text-accent text-[12px]">data-moo-layer</code> pada adegan ini.
                Generate mograph terlebih dahulu atau tambahkan atribut pada HTML.
              </div>
            ) : (
              <>
                {/* Horizontal Layer Pills */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {availableLayers.map((layer) => {
                    const isSelected = layer.id === activeLayer?.id;
                    const hasOverrides = Boolean(currentOverrides[layer.id]);

                    return (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => setSelectedLayerId(layer.id)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-accent text-on-accent shadow-sm font-semibold'
                            : 'bg-surface-2 text-zinc-300 hover:bg-surface-3 hover:text-white border border-border'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {getLayerIcon(layer.type)}
                        </span>
                        <span>{layer.label}</span>
                        {hasOverrides && (
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-accent'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Controls for Active Layer */}
                {activeLayer && (
                  <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-[18px]">
                          {getLayerIcon(activeLayer.type)}
                        </span>
                        <div>
                          <h4 className="text-[13px] font-semibold text-on-surface">
                            {activeLayer.label}
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-500">
                            id: {activeLayer.id} • type: {activeLayer.type}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetLayerOverride}
                        className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        title="Reset transform ke default"
                      >
                        <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                        Reset
                      </button>
                    </div>

                    {/* Text Layer Direct Content Editor */}
                    {activeLayer.type === 'text' && activeCompScene?.html && (
                      <Field label="Konten Teks Layer">
                        <input
                          type="text"
                          value={getLayerText(activeCompScene.html, activeLayer.id)}
                          onChange={(e) => handleLayerTextChange(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-[13px] text-on-surface focus:outline-none focus:ring-1 focus:ring-accent font-sans"
                        />
                      </Field>
                    )}

                    {/* Position X and Y */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                          <span>Posisi X</span>
                          <span className="text-accent">{activeLayerOverride.x || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min={-300}
                          max={300}
                          step={2}
                          value={activeLayerOverride.x || 0}
                          onChange={(e) => handleOverrideChange('x', parseFloat(e.target.value))}
                          className="w-full accent-accent h-1.5 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                          <span>Posisi Y</span>
                          <span className="text-accent">{activeLayerOverride.y || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min={-300}
                          max={300}
                          step={2}
                          value={activeLayerOverride.y || 0}
                          onChange={(e) => handleOverrideChange('y', parseFloat(e.target.value))}
                          className="w-full accent-accent h-1.5 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Scale and Rotation */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                          <span>Skala (Scale)</span>
                          <span className="text-accent">{activeLayerOverride.scale !== undefined ? activeLayerOverride.scale : 1.0}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={2.5}
                          step={0.05}
                          value={activeLayerOverride.scale !== undefined ? activeLayerOverride.scale : 1.0}
                          onChange={(e) => handleOverrideChange('scale', parseFloat(e.target.value))}
                          className="w-full accent-accent h-1.5 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                          <span>Rotasi</span>
                          <span className="text-accent">{activeLayerOverride.rotation || 0}°</span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={5}
                          value={activeLayerOverride.rotation || 0}
                          onChange={(e) => handleOverrideChange('rotation', parseFloat(e.target.value))}
                          className="w-full accent-accent h-1.5 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Opacity and Color Accent */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                          <span>Transparansi (Opacity)</span>
                          <span className="text-accent">
                            {Math.round((activeLayerOverride.opacity !== undefined ? activeLayerOverride.opacity : 1.0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={activeLayerOverride.opacity !== undefined ? activeLayerOverride.opacity : 1.0}
                          onChange={(e) => handleOverrideChange('opacity', parseFloat(e.target.value))}
                          className="w-full accent-accent h-1.5 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                          <span>Warna Layer</span>
                          <span className="text-accent text-[10px]">{activeLayerOverride.color || 'Default'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={activeLayerOverride.color || '#84cc16'}
                            onChange={(e) => handleOverrideChange('color', e.target.value)}
                            className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                          />
                          {activeLayerOverride.color && (
                            <button
                              type="button"
                              onClick={() => handleOverrideChange('color', undefined)}
                              className="text-[10px] text-zinc-400 hover:text-zinc-200"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 4. Scene Palette (CSS Variables Overrides) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">palette</span>
                Palette Warna Adegan #{activeSceneIndex + 1}
              </span>
              <button
                type="button"
                onClick={handleResetPalette}
                className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                Reset Palette
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-surface-2 border border-border flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-400">Background</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentPalette.bg || project.theme.bg || '#09090b'}
                    onChange={(e) => handlePaletteChange('bg', e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-zinc-300">
                    {currentPalette.bg || 'Theme'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-2 border border-border flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-400">Primary</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentPalette.primary || project.theme.textPrimary || '#ffffff'}
                    onChange={(e) => handlePaletteChange('primary', e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-zinc-300">
                    {currentPalette.primary || 'Theme'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-2 border border-border flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-400">Accent</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentPalette.accent || project.theme.textHighlight || '#84cc16'}
                    onChange={(e) => handlePaletteChange('accent', e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-zinc-300">
                    {currentPalette.accent || 'Theme'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-2 border border-border flex flex-col gap-1.5">
                <span className="text-[11px] text-zinc-400">Text</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentPalette.text || project.theme.textPrimary || '#ffffff'}
                    onChange={(e) => handlePaletteChange('text', e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-zinc-300">
                    {currentPalette.text || 'Theme'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Code Inspector Trigger Button */}
          <div className="p-4 rounded-2xl bg-surface-1 border border-border flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-semibold text-on-surface">
                Code Inspector (HTML / CSS / GSAP)
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                Inspeksi atau tweak kode animasi secara manual untuk kontrol tingkat lanjut.
              </p>
            </div>
            {onOpenCodeInspector && (
              <Button
                variant="secondary"
                icon="code"
                size="sm"
                onClick={() => onOpenCodeInspector(activeScene.id)}
              >
                Buka Code
              </Button>
            )}
          </div>
        </>
      )}

      {/* 6. Audio & Voiceover Layer (OPSIONAL) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-3 shadow-sm">
        <button
          type="button"
          onClick={() => setIsAudioSectionOpen(!isAudioSectionOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[20px]">graphic_eq</span>
            <div>
              <h3 className="text-[14px] font-semibold text-on-surface flex items-center gap-2">
                <span>Audio & Voiceover Layer</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  OPSIONAL
                </span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Tambahkan voiceover narasi dan latar musik (BGM). Anda tetap dapat mengekspor video tanpa audio.
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-zinc-400 text-[18px]">
            {isAudioSectionOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {isAudioSectionOpen && (
          <div className="pt-3 border-t border-border/60 space-y-4">
            {/* Audio stale notice */}
            {audioStale && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[12px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Naskah adegan telah diperbarui, audio narasi dapat di-generate ulang bila diinginkan.</span>
              </div>
            )}

            <Field label="Engine Voice AI">
              <SegmentedControl<TTSProvider>
                options={ttsProviders}
                value={settings.selectedTTSProvider || 'openai'}
                onChange={(val) => updateSettings({ selectedTTSProvider: val })}
              />
            </Field>

            <Field label="Pilih Karakter Suara">
              <GlobalVoiceSelector />
            </Field>

            {/* Audio Progress */}
            {isGeneratingAudio && audioProgress && (
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-2 border border-border">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-on-surface">{audioProgress.statusText}</span>
                  <span className="font-mono text-accent font-semibold">
                    {audioProgress.totalScenes > 0
                      ? Math.round((audioProgress.currentScene / audioProgress.totalScenes) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-150 rounded-full"
                    style={{
                      width: `${
                        audioProgress.totalScenes > 0
                          ? (audioProgress.currentScene / audioProgress.totalScenes) * 100
                          : 0
                      }%`
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                icon="record_voice_over"
                size="sm"
                onClick={generateAudio}
                isLoading={isGeneratingAudio}
                disabled={isGeneratingAudio}
                className="flex-1"
              >
                {isGeneratingAudio ? 'Membuat Voiceover...' : 'Generate Voiceover Narasi'}
              </Button>
              {isGeneratingAudio && (
                <Button variant="secondary" size="sm" onClick={cancelAudioGeneration}>
                  Batalkan
                </Button>
              )}
            </div>

            {/* BGM Options */}
            <div className="pt-2 border-t border-border/40 space-y-3">
              <Field label="Background Music (BGM)">
                <SegmentedControl<BgmPreset>
                  options={bgmPresets}
                  value={project.bgm?.preset || 'none'}
                  onChange={(val) => updateBgmPreset(val)}
                />
              </Field>

              {project.bgm?.preset !== 'none' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span>Volume BGM</span>
                      <span className="text-accent">{Math.round((project.bgm?.level ?? 0.18) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={project.bgm?.level ?? 0.18}
                      onChange={(e) => updateBgmLevel(parseFloat(e.target.value))}
                      className="w-full accent-accent h-1.5 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
                      <span>Audio Ducking</span>
                      <span className="text-accent">{Math.round((project.bgm?.duckRatio ?? 0.15) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.5}
                      step={0.05}
                      value={project.bgm?.duckRatio ?? 0.15}
                      onChange={(e) => updateBgmDuckRatio(parseFloat(e.target.value))}
                      className="w-full accent-accent h-1.5 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigasi Langkah */}
      <div className="flex items-center justify-between pt-2">
        {onBackStep ? (
          <Button variant="secondary" icon="arrow_back" onClick={onBackStep}>
            Kembali ke Mograph
          </Button>
        ) : (
          <div />
        )}
        {onNextStep && (
          <Button variant="primary" icon="arrow_forward" iconPosition="right" onClick={onNextStep}>
            Lanjut ke Ekspor
          </Button>
        )}
      </div>
    </div>
  );
};
