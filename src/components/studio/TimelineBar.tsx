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
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  const handleSceneClick = (sceneId: string, startSec: number) => {
    seekFrame(Math.round(startSec * fps));
    setActiveSceneId(sceneId);
    if (onSelectScene) {
      onSelectScene(sceneId);
    }
  };

  const playheadPercent = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100));

  const getSceneLabel = (scene?: { visualIntent?: string }) => {
    if (!scene?.visualIntent) return '';
    return scene.visualIntent.length > 14 ? scene.visualIntent.slice(0, 14) + '...' : scene.visualIntent;
  };

  // 1. COMPACT MODE (Docked horizontally or used on mobile screens)
  const renderCompact = () => (
    <div
      className={`flex flex-col justify-between p-2 sm:p-2.5 bg-[#0e0e11]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-md select-none min-w-0 w-full ${className}`}
    >
      {/* Top: Timecode & Mode Switchers */}
      <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/[0.06]">
          <span className="font-bold text-zinc-100">{formatTimecode(currentTimeSec)}</span>
          <span className="text-zinc-500">/</span>
          <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {currentSceneIndex >= 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/20 truncate max-w-[140px]">
              Shot #{currentSceneIndex + 1} {getSceneLabel(sceneBoundaries[currentSceneIndex])}
            </span>
          )}

          <button
            type="button"
            onClick={() => setPreviewMode('theater')}
            title="Theater mode"
            className="w-6 h-6 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[13px]">open_in_full</span>
          </button>
        </div>
      </div>

      {/* Middle: Range Scrubber Input */}
      <div className="px-0.5 py-1">
        <input
          className="w-full accent-[#84cc16] h-2 cursor-pointer"
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
            onClick={() => seekFrame(0)}
            title="Replay from start"
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 flex items-center justify-center active:scale-90"
          >
            <span className="material-symbols-outlined text-[15px]">replay</span>
          </button>

          <button
            type="button"
            onClick={() => seekFrame(Math.max(0, currentFrame - fps))}
            title="Step Back 1s"
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 flex items-center justify-center active:scale-90"
          >
            <span className="material-symbols-outlined text-[15px]">replay_10</span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className="h-8 px-3 rounded-lg bg-[#84cc16] text-black font-bold flex items-center gap-1 active:scale-95 text-[11px]"
          >
            <span className="material-symbols-outlined text-[16px] font-bold">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => seekFrame(Math.min(totalFrames, currentFrame + fps))}
            title="Step Forward 1s"
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 flex items-center justify-center active:scale-90"
          >
            <span className="material-symbols-outlined text-[15px]">forward_10</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-zinc-400">
          <span className="text-zinc-200">{currentFrame}</span>/{totalFrames}f
        </div>
      </div>
    </div>
  );

  if (compact) {
    return renderCompact();
  }

  // 2. TICKER MODE (Ultra-minimal 36px bar when preview is minimized on mobile)
  if (previewMode === 'ticker') {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0e0e11]/95 border-b border-white/[0.08] lg:hidden w-full select-none">
          <button
            type="button"
            onClick={togglePlay}
            className="h-6 px-2.5 rounded bg-[#84cc16] text-black font-bold text-[11px] flex items-center gap-1 active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[14px] font-bold">
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
            className="flex-1 accent-[#84cc16] h-1 cursor-pointer min-w-0"
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
          >
            <span>Stage</span>
          </button>
        </div>

        <div className="hidden lg:block">{renderFullTimeline()}</div>
      </div>
    );
  }

  // 3. REGULAR FULL MASTER TRANSPORT (Desktop & Theater)
  function renderFullTimeline() {
    return (
      <div className="p-2.5 bg-[#0e0e11]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl space-y-2 select-none shadow-lg">
        {/* Segmented Scene Timeline Track */}
        <div className="space-y-1">
          <div className="relative h-8 w-full rounded-md bg-black/60 border border-white/[0.08] overflow-hidden flex items-stretch">
            {sceneBoundaries.map((scene, idx) => {
              const isCurrentPlaying = idx === currentSceneIndex;
              const isSelected = activeSceneId === scene.id;
              const sceneLabel = getSceneLabel(scene);

              return (
                <div
                  key={scene.id}
                  onClick={() => handleSceneClick(scene.id, scene.startSec)}
                  style={{ width: `${scene.widthPct}%` }}
                  title={`Shot #${idx + 1} ${sceneLabel ? `[${sceneLabel}] ` : ''}(${scene.durationInSeconds.toFixed(1)}s): ${scene.narrationText || scene.text || ''}`}
                  className={`relative h-full flex flex-col justify-between p-1 border-r border-white/[0.06] transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-[#84cc16]/15 ring-1 ring-inset ring-[#84cc16]'
                      : isCurrentPlaying
                      ? 'bg-white/[0.08]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Top Scene Tag */}
                  <div className="flex items-center justify-between text-[9px] font-mono leading-none">
                    <span
                      className={`font-bold truncate max-w-[120px] ${
                        isSelected || isCurrentPlaying ? 'text-[#84cc16]' : 'text-zinc-400 group-hover:text-zinc-200'
                      }`}
                    >
                      #{idx + 1} {sceneLabel}
                    </span>
                    <span className="text-[9px] text-zinc-500 hidden sm:inline">
                      {scene.durationInSeconds.toFixed(1)}s
                    </span>
                  </div>

                  {/* Scene Preview Text */}
                  <div className="text-[8px] text-zinc-400 truncate font-sans leading-tight">
                    {scene.narrationText || scene.text || ''}
                  </div>

                  {/* Bottom Active Strip */}
                  <div
                    className={`h-0.5 w-full rounded-full ${
                      isCurrentPlaying ? 'bg-[#84cc16]' : 'bg-transparent'
                    }`}
                  />
                </div>
              );
            })}

            {/* Playhead Indicator Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-[#84cc16] pointer-events-none z-10 transition-transform duration-75"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#84cc16] -ml-[3px] -mt-[1px]" />
            </div>
          </div>

          {/* Precision Scrub Range Input */}
          <div className="px-0.5">
            <input
              className="w-full accent-[#84cc16] h-1.5 cursor-pointer"
              max={totalFrames}
              min={0}
              step={1}
              type="range"
              value={currentFrame}
              onChange={(e) => seekFrame(parseInt(e.target.value, 10))}
            />
          </div>
        </div>

        {/* Transport Controls & Readouts */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Digital Timecode */}
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded bg-black/60 border border-white/[0.08] flex items-baseline gap-1 font-mono text-[11px]">
              <span className="font-bold text-zinc-100">{formatTimecode(currentTimeSec)}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
            </div>

            {audioStale && (
              <span
                className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded hidden sm:inline"
                title="Narration changed - sync voice before final export"
              >
                Sync Voice
              </span>
            )}
          </div>

          {/* Center Transport Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Replay */}
            <button
              type="button"
              onClick={() => seekFrame(0)}
              title="Replay from start (Frame 0)"
              className="w-7 h-7 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[15px]">replay</span>
            </button>

            {/* Step Back 1s */}
            <button
              type="button"
              onClick={() => seekFrame(Math.max(0, currentFrame - fps))}
              title="Step Back 1s"
              className="w-7 h-7 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[15px]">replay_10</span>
            </button>

            {/* Primary Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="h-8 px-3 rounded-md bg-[#84cc16] text-black font-bold flex items-center gap-1.5 hover:bg-[#a3e635] transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider hidden sm:inline">
                {isPlaying ? 'Pause' : 'Play'}
              </span>
            </button>

            {/* Step Forward 1s */}
            <button
              type="button"
              onClick={() => seekFrame(Math.min(totalFrames, currentFrame + fps))}
              title="Step Forward 1s"
              className="w-7 h-7 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[15px]">forward_10</span>
            </button>
          </div>

          {/* Frame Number */}
          <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-400">
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
      <div className="sm:hidden">{renderCompact()}</div>
      <div className="hidden sm:block">{renderFullTimeline()}</div>
    </div>
  );
};
