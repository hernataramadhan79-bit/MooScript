import React, { useMemo } from 'react';
import { useMooStore } from '../../store/useMooStore';

interface TimelineBarProps {
  className?: string;
  compact?: boolean;
  onSelectScene?: (sceneId: string) => void;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  className = '',
  compact = false,
  onSelectScene
}) => {
  const {
    project,
    currentFrame,
    isPlaying,
    togglePlay,
    seekFrame,
    activeSceneId,
    setActiveSceneId,
    audioStale,
    previewMode,
    setPreviewMode
  } = useMooStore();

  const fps = project.fps || 30;
  const totalDuration = project.audioDuration || 10;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  const currentTimeSec = currentFrame / fps;

  // Compute scene time boundaries
  const sceneBoundaries = useMemo(() => {
    let accumulated = 0;
    return project.scenes.map((s) => {
      const start = accumulated;
      const end = accumulated + s.durationInSeconds;
      accumulated = end;
      return {
        ...s,
        startSec: start,
        endSec: end,
        widthPct: totalDuration > 0 ? (s.durationInSeconds / totalDuration) * 100 : 0
      };
    });
  }, [project.scenes, totalDuration]);

  // Current active scene based on playhead
  const currentSceneIndex = sceneBoundaries.findIndex(
    (s) => currentTimeSec >= s.startSec && currentTimeSec <= s.endSec
  );

  const formatTimecode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const handleSceneClick = (sceneId: string, startSec: number) => {
    seekFrame(Math.round(startSec * fps));
    setActiveSceneId(sceneId);
    if (onSelectScene) {
      onSelectScene(sceneId);
    }
  };

  const playheadPercent = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100));

  // 1. COMPACT MODE (Docked horizontally next to mini-monitor on mobile)
  if (compact) {
    return (
      <div
        className={`flex flex-col justify-between h-[96px] sm:h-[110px] p-2 bg-[#0d0d12]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-lg select-none min-w-0 flex-1 ${className}`}
      >
        {/* Top: Timecode & Mode Switchers */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 border border-white/[0.06]">
            <span className="font-bold text-zinc-100">{formatTimecode(currentTimeSec)}</span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
          </div>

          <div className="flex items-center gap-1">
            {currentSceneIndex >= 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate max-w-[80px]">
                #{currentSceneIndex + 1} ({sceneBoundaries[currentSceneIndex]?.durationInSeconds.toFixed(1)}s)
              </span>
            )}

            {/* Theater Mode Button */}
            <button
              type="button"
              onClick={() => setPreviewMode('theater')}
              title="Perbesar layar pratinjau (Theater mode)"
              className="w-5 h-5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[12px]">open_in_full</span>
            </button>

            {/* Hide Mode Button */}
            <button
              type="button"
              onClick={() => setPreviewMode('ticker')}
              title="Sembunyikan pratinjau agar naskah & setting 100% lega"
              className="w-5 h-5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[12px]">visibility_off</span>
            </button>
          </div>
        </div>

        {/* Middle: Range Scrubber Input */}
        <div className="px-0.5 py-0.5">
          <input
            className="w-full accent-primary h-1.5 cursor-pointer"
            max={totalFrames}
            min={0}
            step={1}
            type="range"
            value={currentFrame}
            onChange={(e) => seekFrame(parseInt(e.target.value, 10))}
          />
        </div>

        {/* Bottom: Compact Ergonomic Transport Buttons */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => seekFrame(Math.max(0, currentFrame - fps))}
              title="Step Back 1s"
              className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 flex items-center justify-center active:scale-90"
            >
              <span className="material-symbols-outlined text-[13px]">replay_10</span>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="h-6 px-3 rounded-lg bg-primary text-black font-bold flex items-center gap-1 active:scale-95 text-[11px]"
            >
              <span className="material-symbols-outlined text-[15px] font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => seekFrame(Math.min(totalFrames, currentFrame + fps))}
              title="Step Forward 1s"
              className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 flex items-center justify-center active:scale-90"
            >
              <span className="material-symbols-outlined text-[13px]">forward_10</span>
            </button>
          </div>

          <div className="text-[9px] font-mono text-zinc-500">
            <span className="text-zinc-300 font-semibold">{currentFrame}</span>/{totalFrames}f
          </div>
        </div>
      </div>
    );
  }

  // 2. TICKER MODE (Ultra-minimal 36px bar when preview is minimized on mobile)
  if (previewMode === 'ticker') {
    return (
      <div className={`w-full ${className}`}>
        {/* Mobile Single-Row Ticker */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0d0d12]/95 border-b border-white/[0.08] lg:hidden w-full select-none">
          <button
            type="button"
            onClick={togglePlay}
            className="h-6 px-2.5 rounded-md bg-primary text-black font-bold text-[11px] flex items-center gap-1 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[15px] font-bold">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <div className="font-mono text-[10px] text-zinc-300 shrink-0">
            <span className="font-bold text-zinc-100">{formatTimecode(currentTimeSec)}</span>
            <span className="text-zinc-500"> / </span>
            <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
          </div>

          <input
            className="flex-1 accent-primary h-1 cursor-pointer min-w-0"
            max={totalFrames}
            min={0}
            step={1}
            type="range"
            value={currentFrame}
            onChange={(e) => seekFrame(parseInt(e.target.value, 10))}
          />

          <button
            type="button"
            onClick={() => setPreviewMode('compact')}
            className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] flex items-center gap-1 active:scale-95 shrink-0"
            title="Tampilkan Preview"
          >
            <span className="material-symbols-outlined text-[12px] text-primary">aspect_ratio</span>
            <span>Stage</span>
          </button>
        </div>

        {/* Desktop Always Full Rich Timeline */}
        <div className="hidden lg:block">
          {renderFullTimeline()}
        </div>
      </div>
    );
  }

  // 3. REGULAR FULL TIMELINE (Desktop & Mobile Theater Mode)
  function renderFullTimeline() {
    return (
      <div
        className={`p-2.5 sm:p-3 bg-[#0d0d12]/90 backdrop-blur-xl border-y lg:border border-white/[0.08] lg:rounded-2xl space-y-1.5 sm:space-y-2.5 shadow-xl select-none`}
      >
        {/* 1. Segmented Scene Timeline Track */}
        <div className="space-y-1 sm:space-y-1.5">
          <div className="relative h-8 sm:h-10 w-full rounded-lg sm:rounded-xl bg-black/60 border border-white/[0.08] overflow-hidden flex items-stretch">
            {sceneBoundaries.map((scene, idx) => {
              const isCurrentPlaying = idx === currentSceneIndex;
              const isSelected = activeSceneId === scene.id;

              return (
                <div
                  key={scene.id}
                  onClick={() => handleSceneClick(scene.id, scene.startSec)}
                  style={{ width: `${scene.widthPct}%` }}
                  title={`Scene #${idx + 1} (${scene.durationInSeconds.toFixed(1)}s): ${scene.text}`}
                  className={`relative h-full flex flex-col justify-between p-1 border-r border-white/[0.06] transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-primary/20 ring-1 ring-inset ring-primary'
                      : isCurrentPlaying
                        ? 'bg-white/[0.08]'
                        : 'hover:bg-white/[0.05]'
                  }`}
                >
                  {/* Scene Tag */}
                  <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                    <span
                      className={`font-bold transition-colors ${
                        isSelected || isCurrentPlaying ? 'text-primary' : 'text-zinc-400 group-hover:text-zinc-200'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-[9px] text-zinc-500 hidden sm:inline">{scene.durationInSeconds.toFixed(1)}s</span>
                  </div>

                  {/* Scene Text Preview or Mini Ticker */}
                  <div className="text-[9px] text-zinc-400 truncate font-sans leading-tight">
                    {scene.text}
                  </div>

                  {/* Bottom Active Strip */}
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors ${
                      isCurrentPlaying ? 'bg-primary shadow-[0_0_8px_rgba(158,233,57,0.8)]' : 'bg-transparent'
                    }`}
                  />
                </div>
              );
            })}

            {/* Glowing Playhead Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_10px_#9ee939] pointer-events-none z-10 transition-transform duration-75"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-primary -ml-[4px] -mt-[1px] shadow-[0_0_8px_#9ee939]" />
            </div>
          </div>

          {/* Precision Scrub Range Input */}
          <div className="px-0.5">
            <input
              className="w-full accent-primary h-1.5 sm:h-2 cursor-pointer"
              max={totalFrames}
              min={0}
              step={1}
              type="range"
              value={currentFrame}
              onChange={(e) => seekFrame(parseInt(e.target.value, 10))}
            />
          </div>
        </div>

        {/* 2. Transport Controls & Digital Monospace Readout */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Digital Timecode */}
          <div className="flex items-center gap-2">
            <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-black/60 border border-white/[0.08] flex items-baseline gap-1 font-mono">
              <span className="text-[11px] sm:text-xs font-bold text-zinc-100 tracking-tight">
                {formatTimecode(currentTimeSec)}
              </span>
              <span className="text-[10px] text-zinc-500">/</span>
              <span className="text-[10px] text-zinc-400">{formatTimecode(totalDuration)}</span>
            </div>

            {audioStale && (
              <span
                className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded hidden sm:inline"
                title="Script/timings changed after audio generated. Sync audio before final export."
              >
                Sync Audio
              </span>
            )}
          </div>

          {/* Center Transport Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Step Back 1s */}
            <button
              type="button"
              onClick={() => seekFrame(Math.max(0, currentFrame - fps))}
              title="Step Back 1s"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">replay_10</span>
            </button>

            {/* Primary Ergonomic Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              className="h-8 sm:h-9 px-3.5 sm:px-4 rounded-lg sm:rounded-xl bg-primary text-black font-bold flex items-center gap-1.5 hover:bg-lime-300 transition-all shadow-[0_0_20px_rgba(158,233,57,0.3)] active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider hidden sm:inline">
                {isPlaying ? 'Pause' : 'Play'}
              </span>
            </button>

            {/* Step Forward 1s */}
            <button
              type="button"
              onClick={() => seekFrame(Math.min(totalFrames, currentFrame + fps))}
              title="Step Forward 1s"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white flex items-center justify-center transition-all active:scale-90"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">forward_10</span>
            </button>
          </div>

          {/* Frame Number & BGM Pill */}
          <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] text-zinc-400">
            <span className="hidden sm:inline">Frame</span>
            <span className="text-zinc-200 font-semibold">{currentFrame}</span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-500">{totalFrames}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {renderFullTimeline()}
    </div>
  );
};
