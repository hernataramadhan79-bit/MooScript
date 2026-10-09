import React, { useEffect, useRef, useState } from 'react';
import type { AspectRatio } from '../../types';
import { useMooStore } from '../../store/useMooStore';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';

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
  const projectAspectRatio = useMooStore((s) => s.project.aspectRatio);
  const updateProjectAspectRatio = useMooStore((s) => s.updateProjectAspectRatio);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [isFit, setIsFit] = useState(true);

  const currentAspect: AspectRatio =
    projectAspectRatio ||
    (width === height ? '1:1' : width > height ? '16:9' : '9:16');
  const is9by16 = currentAspect === '9:16' || Math.abs(width / height - 9 / 16) < 0.02;

  const currentTime = currentFrame / fps;
  const latestTimeRef = useRef(currentTime);
  latestTimeRef.current = currentTime;
  const latestFrameRef = useRef(currentFrame);
  latestFrameRef.current = currentFrame;

  // Build srcdoc when minimal composition or scenes properties change
  const srcDoc = React.useMemo(() => {
    const minimalProject = {
      id: projectId,
      width,
      height,
      fps,
      scenes,
      composition
    } as any;
    return buildCompositionDocument(minimalProject);
  }, [composition, scenes, width, height, fps, projectId]);

  // Adjust container scale to fit responsive viewport smoothly
  const updateScale = React.useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    if (isFit) {
      const scaleX = clientWidth / width;
      const scaleY = clientHeight / height;
      const bestScale = Math.min(scaleX, scaleY) * 0.95; // 5% padding
      setScale(Math.max(0.1, bestScale));
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

  // Handle postMessage communication from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || !data.type) return;

      if (data.type === 'ready') {
        setIsReady(true);
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'seek',
            time: latestTimeRef.current,
            id: latestFrameRef.current
          },
          '*'
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Seek iframe runtime when currentFrame / currentTime changes
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'seek',
          time: currentTime,
          id: currentFrame
        },
        '*'
      );
    }
  }, [currentFrame, currentTime, isReady]);

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setIsFit(true);
    updateProjectAspectRatio?.(ratio);
  };

  const handleToggleZoom = () => {
    setIsFit((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden p-2 select-none ${className}`}
    >
      {/* Floating Studio Controls */}
      <div className="absolute top-3 inset-x-0 z-30 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 shadow-2xl">
          {/* Aspect Ratio Selector */}
          <div className="flex items-center rounded-lg bg-white/[0.04] p-0.5 border border-white/[0.06]">
            {ASPECT_RATIOS.map((ratio) => {
              const isSelected = currentAspect === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => handleAspectRatioChange(ratio)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 ${
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

          <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

          {/* Safe Zone Toggle */}
          <button
            type="button"
            onClick={() => setShowSafeZone((v) => !v)}
            title="Batas Medsos"
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1.5 ${
              showSafeZone
                ? 'bg-lime-500/20 text-[#84cc16] border border-lime-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">smartphone</span>
            <span className="hidden sm:inline">Batas Medsos</span>
          </button>

          <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

          {/* Zoom / Fit Button */}
          <button
            type="button"
            onClick={handleToggleZoom}
            title={isFit ? 'Perbesar 100%' : 'Fit ke Layar'}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1.5 ${
              !isFit
                ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">fit_screen</span>
            <span className="text-[10px] font-mono text-zinc-400">{Math.round(scale * 100)}%</span>
          </button>
        </div>
      </div>

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
          srcDoc={srcDoc}
          title="MooScript Composition Stage"
          sandbox="allow-scripts"
          onLoad={() => {
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  type: 'seek',
                  time: latestTimeRef.current,
                  id: latestFrameRef.current
                },
                '*'
              );
            }
          }}
          className="w-full h-full border-0 pointer-events-none"
        />

        {/* Minimal Safe-Zone Overlay (9:16 Social Media Action & Caption Guides) */}
        {showSafeZone && is9by16 && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-end p-8 gap-4 select-none">
            {/* Right-side Action Column Guide (Like, Comment, Bookmark, Share) */}
            <div className="self-end w-[15%] h-[38%] rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] flex flex-col items-center justify-around py-6 shadow-sm">
              <span className="material-symbols-outlined text-[44px] text-white/35">favorite</span>
              <span className="material-symbols-outlined text-[44px] text-white/35">chat</span>
              <span className="material-symbols-outlined text-[44px] text-white/35">bookmark</span>
              <span className="material-symbols-outlined text-[44px] text-white/35">share</span>
            </div>

            {/* Bottom Caption & Audio Area Guide */}
            <div className="w-full h-[14%] rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] flex items-center justify-between px-8 shadow-sm">
              <div className="flex flex-col gap-3 w-[72%]">
                <div className="h-4 w-44 rounded-full bg-white/10" />
                <div className="h-4 w-80 rounded-full bg-white/10" />
                <div className="h-3 w-60 rounded-full bg-white/10" />
              </div>
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[36px] text-white/35">music_note</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
