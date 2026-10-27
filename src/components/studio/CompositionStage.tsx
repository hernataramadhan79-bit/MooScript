import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AspectRatio, Composition, LayerOverride } from '../../types';
import { useMooStore } from '../../store/useMooStore';
import {
  buildCompositionDocument,
  compileCompositionOverridesCss
} from '../../engine/composition/buildDocument';

type LayerRect = { id: string; tagName: string; x: number; y: number; width: number; height: number };

/** Composition with one layer's override replaced by an in-progress drag value. */
function withDraftOverride(
  comp: Composition,
  sceneId: string,
  layerId: string,
  draft: Partial<LayerOverride>
): Composition {
  return {
    ...comp,
    scenes: comp.scenes.map((mod) =>
      mod.beatId !== sceneId && mod.id !== sceneId
        ? mod
        : { ...mod, overrides: { ...mod.overrides, [layerId]: { ...mod.overrides?.[layerId], ...draft } } }
    )
  };
}
import { useDebouncedValue } from '../../utils/hooks';

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
  const resetLayerOverride = useMooStore((s) => s.resetLayerOverride);

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
  const [snapGuide, setSnapGuide] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
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
      styleBrief
    } as any;
    return buildCompositionDocument(minimalProject, { omitOverrides: true });
  }, [composition, scenes, width, height, fps, projectId, theme, styleBrief]);

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
    const paddingX = 48;
    const paddingY = 80;
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
    setSelectedLayerId(layerId);
    dragCleanupRef.current?.();

    const existing = currentCompScene?.overrides?.[layerId] || {};
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = existing.x ?? 0;
    const initY = existing.y ?? 0;
    const initScale = existing.scale ?? 1;
    const initRot = existing.rotation ?? 0;
    const safeScale = Math.max(0.05, scale);
    // Snap distance stays ~8 screen px regardless of stage zoom.
    const snapThreshold = 8 / safeScale;
    const startCenterX = rect.x + rect.width / 2;
    const startCenterY = rect.y + rect.height / 2;

    let draft: Partial<LayerOverride> | null = null;
    let frameRequest = 0;

    const flushDraft = () => {
      frameRequest = 0;
      const comp = useMooStore.getState().project.composition;
      if (!comp || !draft) return;
      postOverridesCss(
        compileCompositionOverridesCss(withDraftOverride(comp, sceneId, layerId, draft), { important: true })
      );
      requestLayerRects();
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = (moveEv.clientX - startX) / safeScale;
      const dy = (moveEv.clientY - startY) / safeScale;

      if (mode === 'move') {
        let nextX = initX + dx;
        let nextY = initY + dy;
        // Snap the layer's center onto the canvas center lines (what the guides draw).
        const offCenterX = startCenterX + (nextX - initX) - width / 2;
        const offCenterY = startCenterY + (nextY - initY) - height / 2;
        const snapX = Math.abs(offCenterX) <= snapThreshold;
        const snapY = Math.abs(offCenterY) <= snapThreshold;
        if (snapX) nextX -= offCenterX;
        if (snapY) nextY -= offCenterY;
        setSnapGuide((prev) => (prev.x === snapX && prev.y === snapY ? prev : { x: snapX, y: snapY }));
        draft = { x: Math.round(nextX), y: Math.round(nextY) };
      } else if (mode === 'scale') {
        const deltaScale = (dx + dy) / 300;
        draft = { scale: Math.max(0.2, Math.min(3.0, Math.round((initScale + deltaScale) * 100) / 100)) };
      } else {
        draft = { rotation: Math.max(-180, Math.min(180, Math.round(initRot + dx * 0.4))) };
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
      setSnapGuide({ x: false, y: false });
      if (draft) {
        suppressCanvasClickRef.current = true;
        setTimeout(() => {
          suppressCanvasClickRef.current = false;
        }, 0);
        updateLayerOverride(sceneId, layerId, draft);
      }
      setTimeout(requestLayerRects, 50);
    }

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

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
                  className={`px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-[11px] font-medium transition-all duration-150 ${
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
              className={`px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-[11px] font-medium transition-all duration-150 flex items-center gap-1 ${
                isInteractiveEdit
                  ? 'bg-lime-500/20 text-[#84cc16] border border-lime-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className="material-symbols-outlined text-[12px] lg:text-[15px]">pan_tool_alt</span>
              <span className="hidden sm:inline">Pilih & Geser</span>
            </button>

            <div className="w-[1px] h-3 bg-white/10" />

            {/* Safe Zone Toggle */}
            <button
              type="button"
              onClick={() => setShowSafeZone((v) => !v)}
              title="Batas Medsos & Grid"
              className={`px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-[11px] font-medium transition-all duration-150 flex items-center gap-1 ${
                showSafeZone
                  ? 'bg-lime-500/20 text-[#84cc16] border border-lime-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className="material-symbols-outlined text-[12px] lg:text-[15px]">smartphone</span>
              <span className="hidden sm:inline">Batas Medsos</span>
            </button>

            <div className="w-[1px] h-3 bg-white/10" />

            {/* Zoom / Fit Button */}
            <button
              type="button"
              onClick={handleToggleZoom}
              title={isFit ? 'Perbesar 100%' : 'Fit ke Layar'}
              className={`px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-[11px] font-medium transition-all duration-150 flex items-center gap-1 ${
                !isFit
                  ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className="material-symbols-outlined text-[12px] lg:text-[15px]">fit_screen</span>
              <span className="text-[9px] lg:text-[10px] font-mono text-zinc-400">{Math.round(scale * 100)}%</span>
            </button>
          </div>
        </div>
      </div>

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
        {(snapGuide.x || snapGuide.y) && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {snapGuide.x && (
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#84cc16] shadow-[0_0_12px_#84cc16]" />
            )}
            {snapGuide.y && (
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-[#84cc16] shadow-[0_0_12px_#84cc16]" />
            )}
          </div>
        )}

        {/* Interactive On-Canvas Layer Selection & Gizmo Overlay */}
        {isInteractiveEdit && layerRects.length > 0 && (
          <div className="absolute inset-0 z-25 pointer-events-none">
            {layerRects.map((rect) => {
              const isSelected = selectedLayerId === rect.id;
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
                    setSelectedLayerId(rect.id);
                  }}
                  className={`absolute pointer-events-auto cursor-move transition-colors ${
                    isSelected
                      ? 'border-[3px] border-[#84cc16] bg-lime-500/[0.04] shadow-[0_0_24px_rgba(132,204,22,0.25)] z-30'
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

      {/* Fullscreen Theater Mode Overlay */}
      {previewMode === 'theater' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-fadeIn">
            <div className="absolute top-4 right-4 z-50">
              <button
                type="button"
                onClick={() => setPreviewMode('compact')}
                className="px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-xl"
              >
                <span className="material-symbols-outlined text-[18px]">close_fullscreen</span>
                <span>Tutup Layar Penuh (Esc)</span>
              </button>
            </div>

            <div
              style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `scale(${theaterScale})`,
                transformOrigin: 'center center'
              }}
              className="relative shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black"
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
