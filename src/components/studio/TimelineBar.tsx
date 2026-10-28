import React, { useMemo, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { extractWaveformPeaks } from '../../engine/audio/waveform';
import { getProjectDuration, MAX_SCENE_SECONDS } from '../../utils/projectDuration';

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
    isLooping,
    toggleLoop,
    togglePlay,
    seekFrame,
    activeSceneId,
    setActiveSceneId,
    focusScene,
    audioStale,
    audioBlobUrl,
    previewMode,
    setPreviewMode,
    waveformPeaks,
    setWaveformPeaks,
    setSceneDuration
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      currentFrame: s.currentFrame,
      isPlaying: s.isPlaying,
      isLooping: s.isLooping,
      toggleLoop: s.toggleLoop,
      togglePlay: s.togglePlay,
      seekFrame: s.seekFrame,
      activeSceneId: s.activeSceneId,
      setActiveSceneId: s.setActiveSceneId,
      focusScene: s.focusScene,
      audioStale: s.audioStale,
      audioBlobUrl: s.audioBlobUrl,
      previewMode: s.previewMode,
      setPreviewMode: s.setPreviewMode,
      waveformPeaks: s.waveformPeaks,
      setWaveformPeaks: s.setWaveformPeaks,
      setSceneDuration: s.setSceneDuration
    }))
  );

  const fps = project.fps || 30;
  const totalDuration = getProjectDuration(project);

  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  const currentTimeSec = currentFrame / fps;
  const playheadPercent = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100));
  const isAudioActive = Boolean(audioBlobUrl || project.audioBlob);

  // Compute scene time boundaries with Shot numbers
  const sceneBoundaries = useMemo(() => {
    // An empty project has no shots yet: show an empty timeline, not a placeholder shot.
    if (!project.scenes || project.scenes.length === 0) {
      return [];
    }

    let accumulated = 0;
    return project.scenes.map((s, idx) => {
      const start = accumulated;
      const dur = s.durationInSeconds || 3;
      const end = accumulated + dur;
      accumulated = end;
      return {
        ...s,
        shotNumber: idx + 1,
        durationInSeconds: dur,
        startSec: start,
        endSec: end,
        startFrame: Math.round(start * fps),
        endFrame: Math.round(end * fps),
        widthPct: totalDuration > 0 ? (dur / totalDuration) * 100 : 0
      };
    });
  }, [project.scenes, totalDuration, fps]);

  // Current active scene based on playhead position (discrete frame comparison eliminates rounding jitter)
  const currentSceneIndex = sceneBoundaries.findIndex(
    (s) => currentFrame >= s.startFrame && currentFrame < s.endFrame
  );
  const activeIndex =
    currentSceneIndex >= 0
      ? currentSceneIndex
      : currentFrame >= totalFrames && sceneBoundaries.length > 0
      ? sceneBoundaries.length - 1
      : 0;

  const activeBoundary = sceneBoundaries[activeIndex];

  // Synchronize activeSceneId with current timeline playhead/scrubbing
  useEffect(() => {
    if (activeBoundary && activeBoundary.id !== activeSceneId && activeBoundary.id !== 'default') {
      setActiveSceneId(activeBoundary.id);
    }
  }, [activeBoundary, activeSceneId, setActiveSceneId]);

  // Format studio timecode: 00:02.1 / 00:15.0
  const formatTimecode = (sec: number) => {
    const safeSec = Math.max(0, isNaN(sec) ? 0 : sec);
    const mins = Math.floor(safeSec / 60);
    const s = Math.floor(safeSec % 60);
    const tenths = Math.floor((safeSec % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  };

  const handleSceneClick = (sceneId: string, startSec: number) => {
    seekFrame(Math.round(startSec * fps));
    focusScene(sceneId);
    if (onSelectScene) {
      onSelectScene(sceneId);
    }
  };

  const handleTrackScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    seekFrame(Math.round(ratio * totalFrames));
  };

  const handleTrimSceneStart = (
    e: React.PointerEvent<HTMLDivElement>,
    sceneId: string,
    initialDuration: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (sceneId === 'default') return;

    const trackEl = e.currentTarget.parentElement?.parentElement;
    const trackWidth = trackEl ? trackEl.getBoundingClientRect().width : 300;
    const startX = e.clientX;
    const baseTotal = Math.max(3, totalDuration);

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const deltaSec = (dx / Math.max(100, trackWidth)) * baseTotal;
      const nextDur = Math.min(MAX_SCENE_SECONDS, Math.max(0.5, Math.round((initialDuration + deltaSec) * 10) / 10));
      setSceneDuration(sceneId, nextDur, true);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Synthetic speech cadence audio waveform bars (deterministic & responsive)
  // Audio waveform bars: real sampled peaks from audio track, or fallback rhythmic bars
  const waveformBars = useMemo(() => {
    if (waveformPeaks && waveformPeaks.length > 0) {
      return waveformPeaks.map((peak) => ({
        height: Math.max(15, Math.min(100, Math.round(peak * 100)))
      }));
    }

    const count = 64;
    const bars: { height: number }[] = [];
    for (let i = 0; i < count; i++) {
      const sin1 = Math.sin((i / count) * Math.PI * 8) * 0.3;
      const sin2 = Math.cos((i / count) * Math.PI * 14) * 0.25;
      const base = 0.48 + sin1 + sin2;
      const height = Math.max(20, Math.min(95, Math.round(base * 100)));
      bars.push({ height });
    }
    return bars;
  }, [waveformPeaks]);

  useEffect(() => {
    if (project.audioBlob && !waveformPeaks) {
      extractWaveformPeaks(project.audioBlob).then((peaks) => {
        if (peaks.length > 0) {
          setWaveformPeaks(peaks);
        }
      }).catch(() => {});
    }
  }, [project.audioBlob, waveformPeaks, setWaveformPeaks]);

  // Pointer scrubbing on the compact track: tap or drag anywhere along the shots.
  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekFrame(Math.round(ratio * totalFrames));
  };

  const compactBtn =
    'w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-300 flex items-center justify-center transition-colors';

  // 1. COMPACT VIEW (mobile): big transport buttons and a draggable shot track
  const renderCompact = () => (
    <div
      className={`flex flex-col px-2 py-2 bg-[#0a0b0e]/95 border border-white/[0.08] rounded-xl select-none min-w-0 w-full gap-2 ${className}`}
    >
      {/* Row 1: Play + loop, timecode, active shot + stage controls */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Jeda' : 'Putar'}
            className="h-9 w-11 rounded-lg bg-[#84cc16] hover:bg-[#9ae62e] text-black flex items-center justify-center active:scale-95 shadow-sm shadow-[#84cc16]/20"
          >
            <span className="material-symbols-outlined fill text-[22px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            aria-label={isLooping ? 'Matikan putar ulang' : 'Putar ulang terus'}
            aria-pressed={isLooping}
            className={`${compactBtn} ${isLooping ? '!bg-[#84cc16]/15 !border-[#84cc16]/40 !text-[#84cc16]' : ''}`}
          >
            <span className="material-symbols-outlined text-[18px]">repeat</span>
          </button>
        </div>

        <div className="flex items-baseline gap-1 px-2 py-1 rounded-md bg-black/70 border border-white/[0.08] font-mono text-[12px] tabular-nums">
          <span className="font-bold text-zinc-100">{formatTimecode(currentTimeSec)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreviewMode(previewMode === 'ticker' ? 'compact' : 'ticker')}
            aria-label={previewMode === 'ticker' ? 'Tampilkan panggung' : 'Sembunyikan panggung'}
            title={previewMode === 'ticker' ? 'Tampilkan panggung' : 'Sembunyikan panggung'}
            className={compactBtn}
          >
            <span className="material-symbols-outlined text-[20px]">
              {previewMode === 'ticker' ? 'expand_more' : 'expand_less'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('theater')}
            aria-label="Layar penuh"
            title="Layar penuh"
            className={compactBtn}
          >
            <span className="material-symbols-outlined text-[18px]">fullscreen</span>
          </button>
        </div>
      </div>

      {/* Row 2: shot track, tap or drag to scrub */}
      {sceneBoundaries.length > 0 ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posisi pemutaran"
          aria-valuemin={0}
          aria-valuemax={totalFrames}
          aria-valuenow={currentFrame}
          aria-valuetext={`${formatTimecode(currentTimeSec)}, shot ${activeIndex + 1}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              seekFrame(currentFrame + (e.key === 'ArrowLeft' ? -fps : fps));
            }
          }}
          style={{ touchAction: 'none' }}
          className="relative h-8 w-full rounded-md bg-black/60 border border-white/[0.08] overflow-hidden flex items-stretch cursor-pointer"
        >
          {sceneBoundaries.map((scene, idx) => {
            const isCurrent = idx === activeIndex;
            return (
              <div
                key={scene.id}
                style={{ width: `${scene.widthPct}%` }}
                className={`relative h-full flex items-center px-1.5 border-r border-white/[0.06] last:border-r-0 ${
                  isCurrent ? 'bg-[#84cc16]/15' : ''
                }`}
              >
                <span
                  className={`text-[10px] font-mono font-semibold truncate ${
                    isCurrent ? 'text-[#84cc16]' : 'text-zinc-500'
                  }`}
                >
                  {scene.shotNumber}
                </span>
              </div>
            );
          })}

          {/* Played region + playhead */}
          <div
            className="absolute inset-y-0 left-0 bg-white/[0.04] pointer-events-none"
            style={{ width: `${playheadPercent}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-[2px] -ml-px bg-[#84cc16] pointer-events-none z-20 shadow-[0_0_6px_#84cc16]"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>
      ) : (
        <div className="h-8 w-full rounded-md border border-dashed border-white/[0.1] flex items-center justify-center text-[11px] text-zinc-500">
          Belum ada shot
        </div>
      )}

      {/* Audio waveform (when a voice-over exists) */}
      {isAudioActive && (
        <div
          className="relative h-4 w-full rounded bg-black/50 border border-white/[0.06] overflow-hidden flex items-center gap-[1.5px] px-1 pointer-events-none"
          aria-hidden="true"
        >
          {waveformBars.map((bar, i) => {
            const isPast = (i / waveformBars.length) * 100 <= playheadPercent;
            return (
              <div
                key={i}
                className={`flex-1 min-w-[1px] rounded-full ${isPast ? 'bg-[#84cc16]' : 'bg-[#84cc16]/25'}`}
                style={{ height: `${bar.height}%` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  // 2. TICKER VIEW: the mobile stage is hidden, so the compact bar stays as the only control
  if (previewMode === 'ticker') {
    return (
      <div className={`w-full ${className}`}>
        <div className="lg:hidden">{renderCompact()}</div>
        <div className="hidden lg:block">{renderFullTimeline()}</div>
      </div>
    );
  }

  // 3. FULL MASTER STUDIO TIMELINE (Desktop & Theater)
  function renderFullTimeline() {
    return (
      <div className="p-2 sm:p-2.5 bg-[#0a0b0e]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl space-y-2 select-none shadow-xl">
        {/* Track Area: Scene Blocks, Scrubber, Audio Waveform */}
        <div className="space-y-1.5">
          {/* Proportional Scene Blocks */}
          <div
            className="relative h-8 sm:h-9 w-full rounded-md bg-black/60 border border-white/[0.08] overflow-hidden flex items-stretch cursor-pointer"
            onClick={handleTrackScrub}
          >
            {sceneBoundaries.map((scene, idx) => {
              const isCurrentPlaying = idx === activeIndex;
              const isSelected = activeSceneId === scene.id;

              return (
                <div
                  key={scene.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSceneClick(scene.id, scene.startSec);
                  }}
                  style={{ width: `${scene.widthPct}%` }}
                  title={`Shot ${scene.shotNumber} (${scene.durationInSeconds.toFixed(1)}s)`}
                  className={`relative h-full flex items-center justify-between px-2 border-r border-white/[0.06] transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-[#84cc16]/15 ring-1 ring-inset ring-[#84cc16]/60'
                      : isCurrentPlaying
                      ? 'bg-white/[0.08]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`text-[10px] font-mono font-semibold truncate ${
                      isSelected || isCurrentPlaying ? 'text-[#84cc16]' : 'text-zinc-400 group-hover:text-zinc-200'
                    }`}
                  >
                    Shot {scene.shotNumber}
                  </span>

                  <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">
                    {scene.durationInSeconds.toFixed(1)}s
                  </span>

                  {scene.id !== 'default' && (
                    <div
                      onPointerDown={(e) => handleTrimSceneStart(e, scene.id, scene.durationInSeconds)}
                      onClick={(e) => e.stopPropagation()}
                      title="Tarik tepi kanan untuk mengubah durasi adegan"
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#84cc16]/60 active:bg-[#84cc16] transition-colors z-10 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <span className="w-[1.5px] h-3.5 rounded-full bg-white/80" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Playhead Indicator Line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-[#84cc16] pointer-events-none z-20"
              style={{ left: `${playheadPercent}%` }}
            >
              <div className="w-2.5 h-2.5 bg-[#84cc16] rotate-45 -ml-[4px] -top-1 absolute rounded-[1px] shadow-[0_0_8px_rgba(132,204,22,0.6)]" />
            </div>
          </div>

          {/* Precision Range Scrubber */}
          <div className="px-0.5">
            <input
              className="w-full accent-[#84cc16] h-1.5 cursor-pointer bg-white/[0.06] rounded-full appearance-none"
              max={totalFrames}
              min={0}
              step={1}
              type="range"
              value={currentFrame}
              onChange={(e) => seekFrame(parseInt(e.target.value, 10))}
            />
          </div>

          {/* Audio Waveform Track (When Audio is Active) */}
          {isAudioActive && (
            <div
              onClick={handleTrackScrub}
              className="relative h-4 sm:h-5 w-full rounded bg-black/50 border border-white/[0.06] overflow-hidden flex items-center px-2 cursor-pointer select-none group transition-colors hover:border-white/[0.12]"
              title="Audio Track (Click to seek)"
            >
              <div className="flex items-center gap-1.5 shrink-0 mr-2 z-10 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]" />
                <span className="text-[8px] font-mono font-semibold uppercase tracking-wider text-[#84cc16]">
                  Audio
                </span>
              </div>

              {/* Dynamic Waveform Bars */}
              <div className="relative flex-1 h-full flex items-center gap-[2px] overflow-hidden pointer-events-none">
                {waveformBars.map((bar, i) => {
                  const barPct = (i / waveformBars.length) * 100;
                  const isPast = barPct <= playheadPercent;
                  return (
                    <div
                      key={i}
                      className={`flex-1 min-w-[1px] rounded-full transition-colors ${
                        isPast ? 'bg-[#84cc16]' : 'bg-[#84cc16]/25'
                      }`}
                      style={{ height: `${bar.height}%` }}
                    />
                  );
                })}
              </div>

              {/* Playhead line continuation in audio track */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-[#84cc16] pointer-events-none z-10"
                style={{ left: `${playheadPercent}%` }}
              />
            </div>
          )}
        </div>

        {/* Transport Controls & Readouts Bar */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Digital Timecode & Frame Readout */}
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-md bg-black/60 border border-white/[0.08] flex items-baseline font-mono text-[11px] sm:text-[12px] tracking-tight">
              <span className="font-bold text-zinc-100">{formatTimecode(currentTimeSec)}</span>
              <span className="mx-1 text-zinc-600">/</span>
              <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
            </div>

            <div className="hidden md:flex items-center text-[10px] font-mono text-zinc-500">
              <span className="text-zinc-300 font-medium">{currentFrame}</span>
              <span className="text-zinc-600">/{totalFrames}f</span>
            </div>

            {audioStale && (
              <span
                className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded hidden sm:inline"
                title="Voice sync required"
              >
                Sync
              </span>
            )}
          </div>

          {/* Center Transport Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Step Back (1 frame) */}
            <button
              type="button"
              onClick={() => seekFrame(Math.max(0, currentFrame - 1))}
              title="Step back 1 frame"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">skip_previous</span>
            </button>

            {/* Primary Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="h-7 sm:h-8 px-3 sm:px-3.5 rounded-md bg-[#84cc16] hover:bg-[#9ae62e] text-black font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-[#84cc16]/20"
            >
              <span className="material-symbols-outlined text-[17px] sm:text-[19px] font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase opacity-75">
                Space
              </span>
            </button>

            {/* Step Forward (1 frame) */}
            <button
              type="button"
              onClick={() => seekFrame(Math.min(totalFrames, currentFrame + 1))}
              title="Step forward 1 frame"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">skip_next</span>
            </button>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={toggleLoop}
              title={isLooping ? 'Loop enabled' : 'Loop disabled'}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md active:scale-95 flex items-center justify-center transition-all border ${
                isLooping
                  ? 'bg-[#84cc16]/15 border-[#84cc16]/40 text-[#84cc16] shadow-[0_0_8px_rgba(132,204,22,0.15)]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[17px]">repeat</span>
            </button>
          </div>

          {/* Right: Active Shot Badge & Controls */}
          <div className="flex items-center gap-1.5">
            {activeIndex >= 0 && sceneBoundaries[activeIndex] && (
              <div className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono text-zinc-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]" />
                <span>Shot {sceneBoundaries[activeIndex].shotNumber}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPreviewMode('theater')}
              title="Theater mode"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">open_in_full</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return renderCompact();
  }

  return (
    <div className={className}>
      <div className="sm:hidden">{renderCompact()}</div>
      <div className="hidden sm:block">{renderFullTimeline()}</div>
    </div>
  );
};
