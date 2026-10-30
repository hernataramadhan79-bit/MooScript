import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AspectRatio, Composition, LayerOverride } from '../../types';
import { useMooStore } from '../../store/useMooStore';
import {
  buildCompositionDocument,
  compileCompositionOverridesCss
} from '../../engine/composition/buildDocument';

/** k: how many stage px the layer moves per px of its own translate (its ancestors' scale). */
type LayerRect = { id: string; tagName: string; x: number; y: number; width: number; height: number; k?: number };

/** Composition with some layers' overrides replaced by in-progress drag values. */
function withDraftOverrides(
  comp: Composition,
  sceneId: string,
  drafts: Record<string, Partial<LayerOverride>>
): Composition {
  return {
    ...comp,
    scenes: comp.scenes.map((mod) => {
      if (mod.beatId !== sceneId && mod.id !== sceneId) return mod;
      const overrides = { ...mod.overrides };
      for (const [layerId, draft] of Object.entries(drafts)) overrides[layerId] = { ...overrides[layerId], ...draft };
      return { ...mod, overrides };
    })
  };
}

const ALIGN_BUTTONS: { mode: AlignMode; icon: string; label: string }[] = [
  { mode: 'left', icon: 'align_horizontal_left', label: 'Rata kiri' },
  { mode: 'hcenter', icon: 'align_horizontal_center', label: 'Tengah horizontal' },
  { mode: 'right', icon: 'align_horizontal_right', label: 'Rata kanan' },
  { mode: 'top', icon: 'align_vertical_top', label: 'Rata atas' },
  { mode: 'vcenter', icon: 'align_vertical_center', label: 'Tengah vertikal' },
  { mode: 'bottom', icon: 'align_vertical_bottom', label: 'Rata bawah' }
];
import { useDebouncedValue } from '../../utils/hooks';
import { alignOffsets, distributeOffsets, snapMove, unionBox, type AlignMode } from '../../engine/composition/layerAlign';
import { getProjectDuration } from '../../utils/projectDuration';

const formatClock = (sec: number) => {
  const safe = Math.max(0, sec || 0);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

interface CompositionStageProps {
  className?: string;
}

const ASPECT_RATIOS: AspectRatio[] = ['9:16', '16:9', '1:1'];

export const CompositionStage: React.FC<CompositionStageProps> = ({ className = '' }) => {
  const composition = useMooStore((s) => s.project.composition);
  const scenes = useMooStore((s) => s.project.scenes);
  const width = useMooStore((s) => s.project.composition?.width || s.project.width || 1080);
  const height = useMooStore((s) => s.project.composition?.height || s.project.height || 1920);
  const fps = useMooStore((s) => s.project.fps || 30);
  const projectId = useMooStore((s) => s.project.id);
  const currentFrame = useMooStore((s) => s.currentFrame);
  const isPlaying = useMooStore((s) => s.isPlaying);
  const projectAspectRatio = useMooStore((s) => s.project.aspectRatio);
  const updateProjectAspectRatio = useMooStore((s) => s.updateProjectAspectRatio);
  const previewMode = useMooStore((s) => s.previewMode);
  const setPreviewMode = useMooStore((s) => s.setPreviewMode);
  const selectedLayerId = useMooStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useMooStore((s) => s.setSelectedLayerId);
  const activeSceneId = useMooStore((s) => s.activeSceneId);
  const updateLayerOverride = useMooStore((s) => s.updateLayerOverride);
  const updateLayerOverrides = useMooStore((s) => s.updateLayerOverrides);
  const extraSelectedLayerIds = useMooStore((s) => s.extraSelectedLayerIds);
  const toggleLayerSelection = useMooStore((s) => s.toggleLayerSelection);
  const resetLayerOverride = useMooStore((s) => s.resetLayerOverride);
  const togglePlay = useMooStore((s) => s.togglePlay);
  const seekFrame = useMooStore((s) => s.seekFrame);
  const totalDuration = useMooStore((s) => getProjectDuration(s.project));
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const theaterIframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [theaterScale, setTheaterScale] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [isInteractiveEdit, setIsInteractiveEdit] = useState(true);
  const [isFit, setIsFit] = useState(true);
  const [layerRects, setLayerRects] = useState<LayerRect[]>([]);
  // Stage-pixel lines a dragged layer snapped to (canvas edges/centre or other layers).
  const [snapGuide, setSnapGuide] = useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] });
  const dragCleanupRef = useRef<(() => void) | null>(null);
  // A drag that ends outside the layer box fires a click on the canvas; don't let it deselect.
  const suppressCanvasClickRef = useRef(false);

  const currentAspect: AspectRatio =
    projectAspectRatio ||
    (width === height ? '1:1' : width > height ? '16:9' : '9:16');
  const is9by16 = currentAspect === '9:16' || Math.abs(width / height - 9 / 16) < 0.02;

  const currentTime = currentFrame / fps;
  const latestTimeRef = useRef(currentTime);
  latestTimeRef.current = currentTime;
  const latestFrameRef = useRef(currentFrame);
  latestFrameRef.current = currentFrame;
  // While paused the runtime may show a scene's poster frame instead of an empty first frame.
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Determine active scene at current playhead or from activeSceneId
  const currentSceneId = React.useMemo(() => {
    if (activeSceneId && scenes.some((s) => s.id === activeSceneId)) {
      return activeSceneId;
    }
    let acc = 0;
    for (const s of scenes) {
      const d = s.durationInSeconds || 3;
      if (currentTime >= acc && currentTime < acc + d) {
        return s.id;
      }
      acc += d;
    }
    return scenes[0]?.id || null;
  }, [activeSceneId, scenes, currentTime]);

  const currentSceneRef = useRef(currentSceneId);
  currentSceneRef.current = currentSceneId;

  const currentCompScene = React.useMemo(
    () => composition?.scenes.find((s) => s.beatId === currentSceneId || s.id === currentSceneId),
    [composition, currentSceneId]
  );

  const theme = useMooStore((s) => s.project.theme);
  const styleBrief = useMooStore((s) => s.project.styleBrief);
  const customFonts = useMooStore((s) => s.project.customFonts);
  const assetData = useMooStore((s) => s.project.assetData);

  // Layer overrides are kept out of the document and pushed live to the runtime, so moving,
  // scaling or recoloring a layer restyles the stage in place instead of reloading the iframe.
  // The string stays identical when only overrides change, so React leaves srcDoc alone.
  const srcDoc = React.useMemo(() => {
    const minimalProject = {
      id: projectId,
      width,
      height,
      fps,
      scenes,
      composition,
      theme,
      styleBrief,
      customFonts,
      assetData
    } as any;
    return buildCompositionDocument(minimalProject, { omitOverrides: true });
  }, [composition, scenes, width, height, fps, projectId, theme, styleBrief, customFonts, assetData]);

  // !important: must win over inline translate/scale/rotate a scene's own code may write.
  const overridesCss = React.useMemo(
    () => compileCompositionOverridesCss(composition, { important: true }),
    [composition]
  );
  const latestOverridesCssRef = useRef(overridesCss);
  latestOverridesCssRef.current = overridesCss;

  // Reloading an iframe on every keystroke makes the preview flash while typing a script.
  // Debounce the document, but switch instantly when the project or canvas size changes.
  const shownDoc = useDebouncedValue(srcDoc, 350, `${projectId}-${width}x${height}`);
  // Adjust container scale to fit responsive viewport smoothly
  const updateScale = React.useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    if (isFit) {
      const scaleX = clientWidth / width;
      const scaleY = clientHeight / height;
      const bestScale = Math.min(scaleX, scaleY) * 0.94; // 6% padding
      setScale(Math.max(0.05, bestScale));
    } else {
      setScale(1);
    }
  }, [width, height, isFit]);

  useEffect(() => {
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateScale]);

  // Adjust theater container scale to fit fullscreen viewport
  const updateTheaterScale = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const paddingX = 32;
    const paddingY = 160;
    const availW = Math.max(100, window.innerWidth - paddingX);
    const availH = Math.max(100, window.innerHeight - paddingY);
    const scaleX = availW / width;
    const scaleY = availH / height;
    setTheaterScale(Math.max(0.1, Math.min(scaleX, scaleY)));
  }, [width, height]);

  useEffect(() => {
    if (previewMode !== 'theater') return;
    updateTheaterScale();
    window.addEventListener('resize', updateTheaterScale);
    return () => window.removeEventListener('resize', updateTheaterScale);
  }, [previewMode, updateTheaterScale]);

  // Escape key listener for exiting Theater mode
  useEffect(() => {
    if (previewMode !== 'theater') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewMode('compact');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMode, setPreviewMode]);

  const requestLayerRects = React.useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'query_layer_rects', sceneId: currentSceneRef.current },
      '*'
    );
  }, []);

  const postOverridesCss = React.useCallback((css: string) => {
    for (const frame of [iframeRef.current, theaterIframeRef.current]) {
      frame?.contentWindow?.postMessage({ type: 'set_override_css', css }, '*');
    }
  }, []);

  useEffect(() => {
    postOverridesCss(overridesCss);
    requestLayerRects();
  }, [overridesCss, postOverridesCss, requestLayerRects]);

  // Abort an in-flight drag if the stage unmounts mid-gesture.
  useEffect(() => () => dragCleanupRef.current?.(), []);

  // Handle postMessage communication from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || !data.type) return;

      if (e.source === iframeRef.current?.contentWindow) {
        if (data.type === 'ready') {
          setIsReady(true);
          // The runtime has parsed every tween by now, so overrides can be applied safely.
          postOverridesCss(latestOverridesCssRef.current);
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'seek',
              still: !isPlayingRef.current,
              time: latestTimeRef.current,
              id: latestFrameRef.current
            },
            '*'
          );
          setTimeout(requestLayerRects, 40);
        } else if (data.type === 'seeked') {
          requestLayerRects();
        } else if (data.type === 'layer_rects' && Array.isArray(data.rects)) {
          setLayerRects(data.rects);
        }
      } else if (e.source === theaterIframeRef.current?.contentWindow) {
        if (data.type === 'ready') {
          postOverridesCss(latestOverridesCssRef.current);
          theaterIframeRef.current?.contentWindow?.postMessage(
            {
              type: 'seek',
              still: !isPlayingRef.current,
              time: latestTimeRef.current,
              id: latestFrameRef.current
            },
            '*'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [requestLayerRects, postOverridesCss]);

  // Seek iframe runtime when currentFrame / currentTime changes
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'seek',
          still: !isPlayingRef.current,
          time: currentTime,
          id: currentFrame
        },
        '*'
      );
    }
    if (previewMode === 'theater' && theaterIframeRef.current && theaterIframeRef.current.contentWindow) {
      theaterIframeRef.current.contentWindow.postMessage(
        {
          type: 'seek',
          still: !isPlayingRef.current,
          time: currentTime,
          id: currentFrame
        },
        '*'
      );
    }
  }, [currentFrame, currentTime, isReady, previewMode, isPlaying]);

  // Highlight selected layer inside iframe runtime & refresh rects
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'highlight_layer', layerId: selectedLayerId },
      '*'
    );
    requestLayerRects();
    if (previewMode === 'theater' && theaterIframeRef.current?.contentWindow) {
      theaterIframeRef.current.contentWindow.postMessage(
        { type: 'highlight_layer', layerId: selectedLayerId },
        '*'
      );
    }
  }, [selectedLayerId, isReady, previewMode, currentSceneId, composition, requestLayerRects]);

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setIsFit(true);
    updateProjectAspectRatio?.(ratio);
  };

  const handleToggleZoom = () => {
    setIsFit((prev) => !prev);
  };

  // While dragging, the layer is restyled live inside the iframe and the store is written
  // once on release: one undo step, one save, and no document reload mid-gesture.
  const startLayerDrag = (
    e: React.PointerEvent,
    rect: LayerRect,
    mode: 'move' | 'scale' | 'rotate'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!currentSceneId || e.button !== 0) return;
    const sceneId = currentSceneId;
    const layerId = rect.id;
    // Shift+click adds or removes a layer from the selection instead of dragging.
    if (mode === 'move' && e.shiftKey) {
      toggleLayerSelection(layerId);
      suppressCanvasClickRef.current = true;
      setTimeout(() => {
        suppressCanvasClickRef.current = false;
      }, 0);
      return;
    }
    const state = useMooStore.getState();
    const selection = [state.selectedLayerId, ...state.extraSelectedLayerIds].filter(Boolean) as string[];
    // Dragging a layer of a group moves the whole group; any other layer becomes the selection.
    const group = mode === 'move' && selection.length > 1 && selection.includes(layerId) ? selection : [layerId];
    if (group.length === 1) setSelectedLayerId(layerId);
    dragCleanupRef.current?.();

    const overridesAtStart = currentCompScene?.overrides || {};
    const existing = overridesAtStart[layerId] || {};
    const startX = e.clientX;
    const startY = e.clientY;
    const initScale = existing.scale ?? 1;
    const initRot = existing.rotation ?? 0;
    const safeScale = Math.max(0.05, scale);
    // Snap distance stays ~8 screen px regardless of stage zoom.
    const snapThreshold = 8 / safeScale;
    const groupRects = layerRects.filter((r) => group.includes(r.id));
    const movingBox = unionBox(groupRects.length ? groupRects : [rect]);
    const otherBoxes = layerRects.filter((r) => !group.includes(r.id) && r.id !== 'camera');

    let drafts: Record<string, Partial<LayerOverride>> | null = null;
    let frameRequest = 0;

    const flushDraft = () => {
      frameRequest = 0;
      const comp = useMooStore.getState().project.composition;
      if (!comp || !drafts) return;
      postOverridesCss(compileCompositionOverridesCss(withDraftOverrides(comp, sceneId, drafts), { important: true }));
      requestLayerRects();
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - startX) / safeScale;
      const dy = (moveEv.clientY - startY) / safeScale;

      if (mode === 'move') {
        // Alt turns snapping off for fine placement.
        const snapped = moveEv.altKey
          ? { dx, dy, guidesX: [] as number[], guidesY: [] as number[] }
          : snapMove(movingBox, otherBoxes, { width, height }, dx, dy, snapThreshold);
        setSnapGuide({ xs: snapped.guidesX, ys: snapped.guidesY });
        drafts = {};
        for (const id of group) {
          const o = overridesAtStart[id] || {};
          const k = layerRects.find((r) => r.id === id)?.k || 1;
          drafts[id] = { x: Math.round((o.x ?? 0) + snapped.dx / k), y: Math.round((o.y ?? 0) + snapped.dy / k) };
        }
      } else if (mode === 'scale') {
        const deltaScale = (dx + dy) / 300;
        drafts = { [layerId]: { scale: Math.max(0.2, Math.min(3.0, Math.round((initScale + deltaScale) * 100) / 100)) } };
      } else {
        drafts = { [layerId]: { rotation: Math.max(-180, Math.min(180, Math.round(initRot + dx * 0.4))) } };
      }

      if (!frameRequest) frameRequest = requestAnimationFrame(flushDraft);
    };

    const cleanup = () => {
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      dragCleanupRef.current = null;
    };

    function handlePointerUp() {
      cleanup();
      setSnapGuide({ xs: [], ys: [] });
      if (drafts) {
        suppressCanvasClickRef.current = true;
        setTimeout(() => {
          suppressCanvasClickRef.current = false;
        }, 0);
        if (Object.keys(drafts).length === 1) updateLayerOverride(sceneId, layerId, drafts[layerId]);
        else updateLayerOverrides(sceneId, drafts);
      }
      setTimeout(requestLayerRects, 50);
    }

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Align / distribute the selected layers by moving their overrides.
  const selectedIds = [selectedLayerId, ...extraSelectedLayerIds].filter(Boolean) as string[];
  const selectedBoxes = layerRects.filter((r) => selectedIds.includes(r.id));
  // Ancestors that rotate or zoom (a rolling camera) make the first move land a few px off, so the
  // stage measures again and corrects once, inside the same undo step.
  const pendingAlignRef = useRef<{ compute: (boxes: LayerRect[]) => Record<string, { dx: number; dy: number }>; key: string; tries: number } | null>(null);
  const applyOffsets = (
    offsets: Record<string, { dx: number; dy: number }>,
    compute?: (boxes: LayerRect[]) => Record<string, { dx: number; dy: number }>
  ) => {
    if (!currentSceneId) return;
    const key = `align:${Date.now()}`;
    if (compute) pendingAlignRef.current = { compute, key, tries: 0 };
    const overrides = currentCompScene?.overrides || {};
    const patches: Record<string, Partial<LayerOverride>> = {};
    for (const [id, { dx, dy }] of Object.entries(offsets)) {
      if (!dx && !dy) continue;
      const k = layerRects.find((r) => r.id === id)?.k || 1;
      patches[id] = { x: Math.round((overrides[id]?.x ?? 0) + dx / k), y: Math.round((overrides[id]?.y ?? 0) + dy / k) };
    }
    if (Object.keys(patches).length) updateLayerOverrides(currentSceneId, patches, key);
    setTimeout(requestLayerRects, 60);
  };

  useEffect(() => {
    const pending = pendingAlignRef.current;
    if (!pending || !currentSceneId) return;
    const ids = [selectedLayerId, ...extraSelectedLayerIds].filter(Boolean) as string[];
    const boxes = layerRects.filter((r) => ids.includes(r.id));
    const offsets = pending.compute(boxes);
    const residual = Object.values(offsets).some((o) => Math.abs(o.dx) >= 1 || Math.abs(o.dy) >= 1);
    if (!residual || pending.tries >= 2) {
      pendingAlignRef.current = null;
      return;
    }
    pending.tries += 1;
    const overrides = useMooStore.getState().project.composition?.scenes.find((m) => m.beatId === currentSceneId)?.overrides || {};
    const patches: Record<string, Partial<LayerOverride>> = {};
    for (const [id, { dx, dy }] of Object.entries(offsets)) {
      const k = layerRects.find((r) => r.id === id)?.k || 1;
      patches[id] = { x: Math.round((overrides[id]?.x ?? 0) + dx / k), y: Math.round((overrides[id]?.y ?? 0) + dy / k) };
    }
    updateLayerOverrides(currentSceneId, patches, pending.key);
    setTimeout(requestLayerRects, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the stage reports new layer boxes
  }, [layerRects]);

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden select-none ${className}`}>
      {/* Studio Controls Bar: Non-overlapping top strip (compact split on mobile, centered pill on desktop) */}
      <div className="shrink-0 w-full z-30 flex items-center justify-between lg:justify-center px-2 pt-1 pb-0.5 lg:py-1.5">
        <div className="w-full lg:w-auto flex items-center justify-between lg:justify-center gap-1 lg:gap-1.5 lg:p-1 lg:rounded-xl lg:bg-black/75 lg:backdrop-blur-md lg:border lg:border-white/10 lg:shadow-2xl">
          {/* Aspect Ratio Selector */}
          <div className="flex items-center rounded-md lg:rounded-lg bg-black/80 lg:bg-white/[0.04] p-0.5 border border-white/10 lg:border-white/[0.06]">
            {ASPECT_RATIOS.map((ratio) => {
              const isSelected = currentAspect === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => handleAspectRatioChange(ratio)}
                  aria-pressed={isSelected}
                  className={`h-7 px-2 lg:h-auto lg:py-1 rounded text-[11px] font-medium transition-all duration-150 ${
                    isSelected
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                  title={`Rasio Aspek ${ratio}`}
                >
                  {ratio}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:block w-[1px] h-3.5 bg-white/10 mx-0.5" />

          {/* Right Controls Group (Interactive Stage Edit + Safe Zone + Zoom/Fit) */}
          <div className="flex items-center gap-1 rounded-md lg:rounded-none bg-black/80 lg:bg-transparent p-0.5 lg:p-0 border border-white/10 lg:border-0">
            {/* Interactive On-Canvas Gizmo Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsInteractiveEdit((v) => !v);
                setTimeout(requestLayerRects, 30);
              }}
              title="Pilih & Geser Layer Langsung di Panggung"
              aria-label="Pilih & geser layer di panggung"
              aria-pressed={isInteractiveEdit}
              className={`h-7 min-w-[28px] px-1.5 lg:h-auto lg:px-2 lg:py-1 rounded text-[11px] font-medium transition-all duration-150 flex items-center justify-center gap-1 ${
                isInteractiveEdit
                  ? 'bg-lime-500/20 text-[#84cc16] border border-lime-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] lg:text-[15px]">pan_tool_alt</span>
              <span className="hidden sm:inline">Pilih & Geser</span>
            </button>

            <div className="w-[1px] h-3 bg-white/10" />

            {/* Safe Zone Toggle */}
            <button
              type="button"
              onClick={() => setShowSafeZone((v) => !v)}
              title="Batas Medsos & Grid"
              aria-label="Tampilkan batas aman medsos & grid"
              aria-pressed={showSafeZone}
              className={`h-7 min-w-[28px] px-1.5 lg:h-auto lg:px-2 lg:py-1 rounded text-[11px] font-medium transition-all duration-150 flex items-center justify-center gap-1 ${
                showSafeZone
                  ? 'bg-lime-500/20 text-[#84cc16] border border-lime-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] lg:text-[15px]">smartphone</span>
              <span className="hidden sm:inline">Batas Medsos</span>
            </button>

            <div className="w-[1px] h-3 bg-white/10" />

            {/* Zoom / Fit Button */}
            <button
              type="button"
              onClick={handleToggleZoom}
              title={isFit ? 'Perbesar 100%' : 'Fit ke Layar'}
              aria-label={isFit ? 'Perbesar ke 100%' : 'Paskan ke layar'}
              className={`h-7 min-w-[28px] px-1.5 lg:h-auto lg:px-2 lg:py-1 rounded text-[11px] font-medium transition-all duration-150 flex items-center justify-center gap-1 ${
                !isFit
                  ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] lg:text-[15px]">fit_screen</span>
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{Math.round(scale * 100)}%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Align bar for the selected layer(s) */}
      {isInteractiveEdit && selectedBoxes.length > 0 && (
        <div className="shrink-0 w-full z-30 flex justify-center px-2 pb-1">
          <div className="flex flex-wrap items-center justify-center gap-0.5 p-0.5 rounded-lg bg-black/80 border border-white/10">
            <span className="px-1.5 text-[10px] text-zinc-400">
              {selectedBoxes.length > 1 ? `${selectedBoxes.length} layer` : 'Ke kanvas'}
            </span>
            {ALIGN_BUTTONS.map((b) => (
              <button
                key={b.mode}
                type="button"
                onClick={() =>
                  applyOffsets(alignOffsets(selectedBoxes, b.mode, { width, height }), (boxes) =>
                    alignOffsets(boxes, b.mode, { width, height })
                  )
                }
                title={`${b.label}${selectedBoxes.length > 1 ? '' : ' (terhadap kanvas)'}`}
                aria-label={b.label}
                className="h-7 w-7 rounded text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{b.icon}</span>
              </button>
            ))}
            {selectedBoxes.length >= 3 && (
              <>
                <span className="w-px h-4 bg-white/10 mx-0.5" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => applyOffsets(distributeOffsets(selectedBoxes, 'x'), (boxes) => distributeOffsets(boxes, 'x'))}
                  title="Jarak horizontal sama rata"
                  aria-label="Sebar horizontal"
                  className="h-7 w-7 rounded text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">horizontal_distribute</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyOffsets(distributeOffsets(selectedBoxes, 'y'), (boxes) => distributeOffsets(boxes, 'y'))}
                  title="Jarak vertikal sama rata"
                  aria-label="Sebar vertikal"
                  className="h-7 w-7 rounded text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">vertical_distribute</span>
                </button>
              </>
            )}
            <span className="hidden md:inline px-1.5 text-[10px] text-zinc-500">Shift+klik: pilih banyak · Alt: tanpa snap</span>
          </div>
        </div>
      )}

      {/* Dedicated Canvas Area (Never overlapped by controls) */}
      <div
        ref={containerRef}
        onClick={() => {
          if (suppressCanvasClickRef.current) return;
          if (selectedLayerId) setSelectedLayerId(null);
        }}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden p-1"
      >
        {/* Composition Canvas Container */}
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out'
          }}
          className="relative shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-border bg-black transition-transform duration-150 ease-out"
        >
        <iframe
          key={`${projectId}-${width}x${height}`}
          ref={iframeRef}
          srcDoc={shownDoc}
          title="MooScript Composition Stage"
          sandbox="allow-scripts"
          onLoad={() => {
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  type: 'seek',
                  still: !isPlayingRef.current,
                  time: latestTimeRef.current,
                  id: latestFrameRef.current
                },
                '*'
              );
              setTimeout(requestLayerRects, 60);
            }
          }}
          className="w-full h-full border-0 pointer-events-none"
        />

        {/* Center Snap Alignment Guides during Drag */}
        {(snapGuide.xs.length > 0 || snapGuide.ys.length > 0) && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {snapGuide.xs.map((x) => (
              <div key={`x${x}`} className="absolute top-0 bottom-0 -ml-px w-[2px] bg-[#84cc16] shadow-[0_0_12px_#84cc16]" style={{ left: x }} />
            ))}
            {snapGuide.ys.map((y) => (
              <div key={`y${y}`} className="absolute left-0 right-0 -mt-px h-[2px] bg-[#84cc16] shadow-[0_0_12px_#84cc16]" style={{ top: y }} />
            ))}
          </div>
        )}

        {/* Interactive On-Canvas Layer Selection & Gizmo Overlay */}
        {isInteractiveEdit && layerRects.length > 0 && (
          <div className="absolute inset-0 z-[25] pointer-events-none">
            {layerRects.map((rect) => {
              const isSelected = selectedLayerId === rect.id;
              const isAlsoSelected = extraSelectedLayerIds.includes(rect.id);
              return (
                <div
                  key={rect.id}
                  style={{
                    left: `${rect.x}px`,
                    top: `${rect.y}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    touchAction: 'none'
                  }}
                  onPointerDown={(e) => startLayerDrag(e, rect, 'move')}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!e.shiftKey && !isAlsoSelected) setSelectedLayerId(rect.id);
                  }}
                  className={`absolute pointer-events-auto cursor-move transition-colors ${
                    isSelected
                      ? 'border-[3px] border-[#84cc16] bg-lime-500/[0.04] shadow-[0_0_24px_rgba(132,204,22,0.25)] z-30'
                      : isAlsoSelected
                        ? 'border-[3px] border-dashed border-[#84cc16]/80 bg-lime-500/[0.03] z-30'
                        : 'border-2 border-transparent hover:border-white/40 hover:bg-white/[0.02] z-20'
                  }`}
                >
                  {isSelected && currentSceneId && (
                    <>
                      {/* Floating Layer Pill & Quick Reset */}
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute -top-12 left-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/95 border border-lime-500/50 text-white shadow-xl whitespace-nowrap"
                      >
                        <span className="text-[20px] font-bold text-[#84cc16] tracking-wide">
                          {rect.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetLayerOverride(currentSceneId, rect.id);
                            setTimeout(requestLayerRects, 40);
                          }}
                          title="Reset posisi & ukuran layer ini"
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[18px] text-zinc-200 font-semibold"
                        >
                          Reset
                        </button>
                      </div>

                      {/* Rotation Handle (Top Center) */}
                      <div
                        onPointerDown={(e) => startLayerDrag(e, rect, 'rotate')}
                        style={{ touchAction: 'none' }}
                        title="Tahan & geser untuk memutar (Rotate)"
                        className="absolute -top-9 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#84cc16] border-2 border-black shadow-lg cursor-ew-resize flex items-center justify-center"
                      />

                      {/* Scale Handle (Bottom Right) */}
                      <div
                        onPointerDown={(e) => startLayerDrag(e, rect, 'scale')}
                        style={{ touchAction: 'none' }}
                        title="Tahan & tarik sudut untuk mengubah ukuran (Scale)"
                        className="absolute -bottom-3.5 -right-3.5 w-7 h-7 rounded-md bg-[#84cc16] border-2 border-black shadow-lg cursor-nwse-resize"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Rule of Thirds Grid + Social Safe-Zone Overlay */}
        {showSafeZone && (
          <div className="absolute inset-0 pointer-events-none z-20 select-none">
            {/* Rule of Thirds Grid */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-white/15" />
              <div className="border-r border-white/15" />
              <div />
            </div>

            {is9by16 && (
              <div className="absolute inset-0 flex flex-col justify-between p-8">
                {/* Top Search / Status Bar Safe Zone */}
                <div className="w-full h-[7%] rounded-2xl border-2 border-dashed border-amber-400/30 bg-amber-500/[0.04] flex items-center justify-center">
                  <span className="text-[22px] font-mono font-bold text-amber-300/70 tracking-wider uppercase">
                    Area Header Platform (Reels / TikTok / Shorts)
                  </span>
                </div>

                <div className="flex flex-col justify-end gap-4">
                  {/* Right-side Action Column Guide (Like, Comment, Bookmark, Share) */}
                  <div className="self-end w-[15%] h-[520px] rounded-2xl border-2 border-dashed border-white/25 bg-black/25 flex flex-col items-center justify-around py-6 shadow-sm">
                    <span className="material-symbols-outlined text-[44px] text-white/40">favorite</span>
                    <span className="material-symbols-outlined text-[44px] text-white/40">chat</span>
                    <span className="material-symbols-outlined text-[44px] text-white/40">bookmark</span>
                    <span className="material-symbols-outlined text-[44px] text-white/40">share</span>
                  </div>

                  {/* Bottom Caption & Audio Area Guide */}
                  <div className="w-full h-[240px] rounded-2xl border-2 border-dashed border-white/25 bg-black/25 flex items-center justify-between px-8 shadow-sm">
                    <div className="flex flex-col gap-3 w-[72%]">
                      <div className="h-4 w-44 rounded-full bg-white/15" />
                      <div className="h-4 w-80 rounded-full bg-white/15" />
                      <div className="h-3 w-60 rounded-full bg-white/15" />
                    </div>
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/25 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[36px] text-white/40">music_note</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {scenes.length === 0 && (
        <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center pointer-events-none p-4">
          <div className="max-w-[260px] text-center flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-black/70 border border-white/10 backdrop-blur-sm">
            <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-accent">movie_edit</span>
            <p className="text-[12px] leading-relaxed text-zinc-300">
              Panggung masih kosong. Tulis ide di panel <strong className="text-white">Naskah</strong> lalu tekan{' '}
              <strong className="text-white">Susun Adegan</strong>, atau pilih template di menu proyek.
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Theater Mode Overlay */}
      {previewMode === 'theater' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pratinjau layar penuh"
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-fadeIn"
          >
            <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-50">
              <button
                type="button"
                onClick={() => setPreviewMode('compact')}
                aria-label="Tutup layar penuh"
                className="h-10 px-3.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-xl"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close_fullscreen</span>
                <span className="hidden sm:inline">Tutup (Esc)</span>
              </button>
            </div>

            {/* Transport: tap the picture or use the bar (phones have no Space key) */}
            <div className="absolute inset-x-0 bottom-0 z-50 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 to-transparent">
              <div className="mx-auto max-w-2xl flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  className="w-11 h-11 shrink-0 rounded-full bg-[#84cc16] hover:bg-[#9ae62e] text-black flex items-center justify-center active:scale-95"
                >
                  <span aria-hidden="true" className="material-symbols-outlined fill text-[24px]">
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <span className="font-mono text-[12px] text-zinc-300 tabular-nums shrink-0">
                  {formatClock(currentTime)} / {formatClock(totalDuration)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={totalFrames}
                  step={1}
                  value={currentFrame}
                  onChange={(e) => seekFrame(parseInt(e.target.value, 10))}
                  aria-label="Posisi pemutaran"
                  className="flex-1 min-w-0 accent-[#84cc16]"
                />
              </div>
            </div>

            <div
              style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `scale(${theaterScale})`,
                transformOrigin: 'center center'
              }}
              onClick={togglePlay}
              className="relative shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black cursor-pointer"
            >
              <iframe
                key={`theater-${projectId}-${width}x${height}`}
                ref={theaterIframeRef}
                srcDoc={shownDoc}
                title="MooScript Theater Mode Stage"
                sandbox="allow-scripts"
                onLoad={() => {
                  if (theaterIframeRef.current?.contentWindow) {
                    theaterIframeRef.current.contentWindow.postMessage(
                      {
                        type: 'seek',
                        still: !isPlayingRef.current,
                        time: latestTimeRef.current,
                        id: latestFrameRef.current
                      },
                      '*'
                    );
                  }
                }}
                className="w-full h-full border-0 pointer-events-none"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
