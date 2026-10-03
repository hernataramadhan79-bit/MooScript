import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { CanvasRenderer } from '../../engine/renderer/canvasRenderer';
import { CompositionStage } from './CompositionStage';

export type SafeAreaMode = 'none' | 'tiktok' | 'reels';

interface CanvasStageProps {
  showSafeZone?: boolean;
  setShowSafeZone?: (val: boolean | ((prev: boolean) => boolean)) => void;
  showDebugHud?: boolean;
  setShowDebugHud?: (val: boolean | ((prev: boolean) => boolean)) => void;
  className?: string;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  showDebugHud: extDebugHud,
  setShowDebugHud: extSetDebugHud,
  className = ''
}) => {
  const { project, currentFrame, isPlaying, previewMode, setPreviewMode } = useMooStore();

  const isComposition = (project.renderMode || 'composition') === 'composition' && !!project.composition;

  const [safeAreaMode, setSafeAreaMode] = useState<SafeAreaMode>('none');
  const [localDebugHud, setLocalDebugHud] = useState(false);

  const showDebugHud = extDebugHud !== undefined ? extDebugHud : localDebugHud;
  const setShowDebugHud = extSetDebugHud || setLocalDebugHud;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  const fps = project.fps || 30;
  const totalDuration = project.audioDuration || 10;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  useEffect(() => {
    if (!isComposition && canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, [isComposition]);

  useEffect(() => {
    if (!isComposition && rendererRef.current) {
      rendererRef.current.draw(currentFrame, totalFrames, project, {
        hud: showDebugHud,
        watermark: false
      });
    }
  }, [currentFrame, totalFrames, project, showDebugHud, isComposition]);

  if (isComposition) {
    return <CompositionStage className={className} />;
  }

  const isMobileTicker = previewMode === 'ticker';

  return (
    <div
      className={`relative select-none ${
        isMobileTicker ? 'hidden lg:flex' : 'flex'
      } flex-col items-center justify-center shrink-0 ${className}`}
    >
      {/* 9:16 Canvas Frame */}
      <div
        className={`relative aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border border-white/[0.1] bg-[#050507] flex items-center justify-center transition-all duration-200 ${
          previewMode === 'compact'
            ? 'h-[96px] sm:h-[110px] lg:h-auto lg:max-h-[64vh] lg:max-w-[400px]'
            : previewMode === 'theater'
            ? 'h-[40vh] sm:h-[48vh] lg:h-auto lg:max-h-[64vh] lg:max-w-[400px]'
            : 'lg:h-auto lg:max-h-[64vh] lg:max-w-[400px]'
        }`}
      >
        {/* Actual High-Res Canvas */}
        <canvas
          ref={canvasRef}
          width={project.width || 1080}
          height={project.height || 1920}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* 3-Way Safe Area Overlays (None, TikTok, Reels) */}
        {safeAreaMode === 'tiktok' && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-2">
            {/* Top Bar Guard */}
            <div className="w-full h-[8%] bg-cyan-500/10 border-b border-cyan-400/40 rounded flex items-center justify-center">
              <span className="text-[8px] font-mono text-cyan-300 font-bold tracking-wider">
                TIKTOK SEARCH & LIVE OVERLAY
              </span>
            </div>

            {/* Middle Right Action Column */}
            <div className="flex-1 flex justify-end items-center pr-1">
              <div className="w-[14%] h-[45%] bg-cyan-500/10 border border-cyan-400/30 rounded flex flex-col items-center justify-around py-1">
                <span className="text-[7px] font-mono text-cyan-300">Avatar</span>
                <span className="text-[7px] font-mono text-cyan-300">Like</span>
                <span className="text-[7px] font-mono text-cyan-300">Comment</span>
                <span className="text-[7px] font-mono text-cyan-300">Share</span>
                <span className="text-[7px] font-mono text-cyan-300">Disc</span>
              </div>
            </div>

            {/* Bottom Caption Guard */}
            <div className="w-full h-[15%] bg-cyan-500/10 border-t border-cyan-400/40 rounded flex items-center justify-center">
              <span className="text-[8px] font-mono text-cyan-300 font-bold tracking-wider">
                TIKTOK CAPTION & SOUND MARQUEE
              </span>
            </div>
          </div>
        )}

        {safeAreaMode === 'reels' && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-2">
            {/* Top Bar Guard */}
            <div className="w-full h-[6%] bg-fuchsia-500/10 border-b border-fuchsia-400/40 rounded flex items-center justify-center">
              <span className="text-[8px] font-mono text-fuchsia-300 font-bold tracking-wider">
                INSTAGRAM REELS HEADER
              </span>
            </div>

            {/* Middle Right Action Column */}
            <div className="flex-1 flex justify-end items-center pr-1">
              <div className="w-[12%] h-[40%] bg-fuchsia-500/10 border border-fuchsia-400/30 rounded flex flex-col items-center justify-around py-1">
                <span className="text-[7px] font-mono text-fuchsia-300">Like</span>
                <span className="text-[7px] font-mono text-fuchsia-300">Comment</span>
                <span className="text-[7px] font-mono text-fuchsia-300">Send</span>
                <span className="text-[7px] font-mono text-fuchsia-300">Audio</span>
              </div>
            </div>

            {/* Bottom Caption Guard */}
            <div className="w-full h-[12%] bg-fuchsia-500/10 border-t border-fuchsia-400/40 rounded flex items-center justify-center">
              <span className="text-[8px] font-mono text-fuchsia-300 font-bold tracking-wider">
                REELS CAPTION & AUDIO OVERLAY
              </span>
            </div>
          </div>
        )}

        {/* Floating Top Control Pills */}
        <div
          className={`absolute top-1.5 inset-x-1.5 flex items-center justify-between pointer-events-auto z-30 ${
            previewMode === 'compact' ? 'lg:flex' : 'flex'
          }`}
        >
          {/* Resolution & FPS Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/[0.08] text-[9px] font-mono text-zinc-300 shadow-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#84cc16] animate-pulse' : 'bg-zinc-500'}`}
            />
            <span>{project.width}×{project.height}</span>
            <span className="text-zinc-500">•</span>
            <span>{fps}fps</span>
          </div>

          {/* Quick HUD & Safe Area 3-way toggle */}
          <div className="flex items-center gap-1">
            {/* Safe Area 3-Way Selector */}
            <div className="flex items-center rounded bg-black/80 border border-white/[0.08] p-0.5">
              {(['none', 'tiktok', 'reels'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSafeAreaMode(mode)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-colors ${
                    safeAreaMode === mode
                      ? mode === 'tiktok'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                        : mode === 'reels'
                        ? 'bg-fuchsia-500/20 text-fuchsia-300 font-bold'
                        : 'bg-white/[0.1] text-white font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {mode === 'none' ? 'Clean' : mode === 'tiktok' ? 'TikTok' : 'Reels'}
                </button>
              ))}
            </div>

            {/* HUD Toggle */}
            <button
              type="button"
              onClick={() => setShowDebugHud((v) => !v)}
              title="Toggle Canvas Info HUD"
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono border backdrop-blur-md transition-all active:scale-95 ${
                showDebugHud
                  ? 'bg-[#84cc16]/20 text-[#84cc16] border-[#84cc16]/50 font-bold'
                  : 'bg-black/60 text-zinc-400 border-white/[0.08] hover:text-white'
              }`}
            >
              HUD
            </button>

            {/* Mobile Theater Switcher */}
            {previewMode === 'theater' && (
              <button
                type="button"
                onClick={() => setPreviewMode('compact')}
                title="Exit theater mode"
                className="px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-300 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] backdrop-blur-md transition-all lg:hidden flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[10px]">close_fullscreen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
