import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { CanvasRenderer } from '../../engine/renderer/canvasRenderer';

export type PreviewMode = 'compact' | 'expanded' | 'hidden';

interface CanvasStageProps {
  showSafeZone?: boolean;
  setShowSafeZone?: (val: boolean | ((prev: boolean) => boolean)) => void;
  showDebugHud?: boolean;
  setShowDebugHud?: (val: boolean | ((prev: boolean) => boolean)) => void;
  className?: string;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  showSafeZone: extSafeZone,
  setShowSafeZone: extSetSafeZone,
  showDebugHud: extDebugHud,
  setShowDebugHud: extSetDebugHud,
  className = ''
}) => {
  const { project, currentFrame, isPlaying, previewMode, setPreviewMode } = useMooStore();

  const [localSafeZone, setLocalSafeZone] = useState(false);
  const [localDebugHud, setLocalDebugHud] = useState(false);

  const showSafeZone = extSafeZone !== undefined ? extSafeZone : localSafeZone;
  const setShowSafeZone = extSetSafeZone || setLocalSafeZone;

  const showDebugHud = extDebugHud !== undefined ? extDebugHud : localDebugHud;
  const setShowDebugHud = extSetDebugHud || setLocalDebugHud;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  const fps = project.fps || 30;
  const totalDuration = project.audioDuration || 10;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.draw(currentFrame, totalFrames, project, {
        hud: showDebugHud,
        watermark: false
      });
    }
  }, [currentFrame, totalFrames, project, showDebugHud]);

  // If in ticker mode on mobile, hide the canvas from layout while keeping it mounted for desktop or when switching back
  const isMobileTicker = previewMode === 'ticker';

  return (
    <div
      className={`relative select-none ${
        isMobileTicker ? 'hidden lg:flex' : 'flex'
      } flex-col items-center justify-center shrink-0 ${className}`}
    >
      {/* 9:16 Canvas Frame with Dynamic Mobile Sizing */}
      <div
        className={`relative aspect-[9/16] rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/[0.1] bg-[#050507] flex items-center justify-center transition-all duration-200 ${
          previewMode === 'compact'
            ? 'h-[96px] sm:h-[110px] lg:h-auto lg:max-h-[64vh] lg:max-w-[400px]'
            : previewMode === 'theater'
            ? 'h-[38vh] sm:h-[46vh] lg:h-auto lg:max-h-[64vh] lg:max-w-[400px]'
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

        {/* Safe Zone Overlay */}
        {showSafeZone && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-1.5 sm:p-2 border border-dashed border-rose-500/60 z-20 animate-fadeIn">
            <div className="w-full h-6 sm:h-8 bg-rose-500/15 border-b border-rose-500/40 rounded-t flex items-center justify-center">
              <span className="text-[7px] sm:text-[8px] font-mono font-bold text-rose-300 tracking-wider">
                TOP SAFE AREA
              </span>
            </div>
            <div className="w-full h-10 sm:h-14 bg-rose-500/15 border-t border-rose-500/40 rounded-b flex flex-col items-center justify-center text-center px-1">
              <span className="text-[7px] sm:text-[8px] font-mono font-bold text-rose-300 tracking-wider">
                BOTTOM SAFE AREA
              </span>
            </div>
          </div>
        )}

        {/* Floating Top Control Pills */}
        <div
          className={`absolute top-1 inset-x-1 sm:top-1.5 sm:inset-x-1.5 flex items-center justify-between pointer-events-auto z-30 ${
            previewMode === 'compact' ? 'lg:flex' : 'flex'
          }`}
        >
          {/* Resolution & FPS Badge */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/[0.08] text-[8px] sm:text-[9px] font-mono text-zinc-300 shadow-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-primary animate-pulse' : 'bg-zinc-500'}`}
            />
            <span>9:16</span>
            <span className="text-zinc-500 hidden sm:inline">•</span>
            <span className="hidden sm:inline">{fps}fps</span>
          </div>

          {/* Quick HUD & Safe Zone Toggles + Mobile Size Switcher */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSafeZone((v) => !v)}
              title="Toggle Safe Zone"
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-medium border backdrop-blur-md transition-all active:scale-95 ${
                showSafeZone
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                  : 'bg-black/60 text-zinc-400 border-white/[0.08] hover:text-white'
              }`}
            >
              Safe
            </button>

            <button
              type="button"
              onClick={() => setShowDebugHud((v) => !v)}
              title="Toggle Debug HUD"
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-medium border backdrop-blur-md transition-all active:scale-95 ${
                showDebugHud
                  ? 'bg-primary/20 text-primary border-primary/50'
                  : 'bg-black/60 text-zinc-400 border-white/[0.08] hover:text-white'
              }`}
            >
              HUD
            </button>

            {/* Mobile Theater Switcher in Theater Mode */}
            {previewMode === 'theater' && (
              <button
                type="button"
                onClick={() => setPreviewMode('compact')}
                title="Kecilkan pratinjau agar ruang kerja lega"
                className="px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-300 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] backdrop-blur-md transition-all active:scale-95 lg:hidden flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[10px]">close_fullscreen</span>
                <span>Compact</span>
              </button>
            )}
          </div>
        </div>

        {/* Tiny In-Canvas Compact Overlay Tag on Mobile */}
        {previewMode === 'compact' && (
          <div className="absolute bottom-1 inset-x-1 flex items-center justify-center lg:hidden pointer-events-none">
            <span className="text-[7px] font-mono text-zinc-400 bg-black/70 px-1 rounded border border-white/[0.06]">
              LIVE
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
