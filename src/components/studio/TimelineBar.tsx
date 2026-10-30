import React, { useId, useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { extractWaveformPeaks } from '../../engine/audio/waveform';
import { getProjectDuration, MAX_SCENE_SECONDS } from '../../utils/projectDuration';
import type { LayerMotion } from '../../types';

interface TimelineBarProps {
  className?: string;
  compact?: boolean;
  onSelectScene?: (sceneId: string) => void;
}

/** Peaks sampled from the audio; enough for a zoomed-in track without hurting the compact one. */
const WAVEFORM_PEAKS = 480;
const LABEL_COL = 76;
const MAX_ZOOM = 24;
/** Pixel distance within which a dragged edge snaps to the playhead, a marker or a shot edge. */
const SNAP_PX = 6;

/** Format studio timecode: 00:02.1 */
export function formatTimecode(sec: number): string {
  const safeSec = Math.max(0, isNaN(sec) ? 0 : sec);
  const mins = Math.floor(safeSec / 60);
  const s = Math.floor(safeSec % 60);
  const tenths = Math.floor((safeSec % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

/** Ruler step (seconds between labels) so labels stay at least ~70 px apart. */
function rulerStep(pxPerSec: number): number {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  return steps.find((s) => s * pxPerSec >= 70) ?? 120;
}

function formatRulerLabel(sec: number, step: number): string {
  const mins = Math.floor(sec / 60);
  const rest = sec - mins * 60;
  const secText = step < 1 ? rest.toFixed(step < 0.5 ? 2 : 1) : String(Math.round(rest));
  return mins > 0 ? `${mins}:${secText.padStart(step < 1 ? 4 : 2, '0')}` : `${secText}s`;
}

/** SVG path of a mirrored waveform across `width` x `height`. */
function waveformPath(peaks: number[], width: number, height: number): string {
  if (peaks.length === 0 || width <= 0) return '';
  const mid = height / 2;
  const step = width / peaks.length;
  const top: string[] = [];
  const bottom: string[] = [];
  peaks.forEach((p, i) => {
    const amp = Math.max(0.04, Math.min(1, p)) * mid;
    const x = (i + 0.5) * step;
    top.push(`${x.toFixed(1)},${(mid - amp).toFixed(1)}`);
    bottom.push(`${x.toFixed(1)},${(mid + amp).toFixed(1)}`);
  });
  return `M0,${mid} L${top.join(' L')} L${width},${mid} L${bottom.reverse().join(' L')} Z`;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({ className = '', compact = false, onSelectScene }) => {
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
    bgmOnlyAudio,
    previewMode,
    setPreviewMode,
    waveformPeaks,
    setWaveformPeaks,
    setSceneDuration,
    setSceneBoundary,
    splitSceneAt,
    loopRange,
    setLoopPoint,
    clearLoopRange,
    addMarker,
    updateMarker,
    removeMarker,
    selectedLayerId,
    updateLayerMotion
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
      bgmOnlyAudio: s.bgmOnlyAudio,
      previewMode: s.previewMode,
      setPreviewMode: s.setPreviewMode,
      waveformPeaks: s.waveformPeaks,
      setWaveformPeaks: s.setWaveformPeaks,
      setSceneDuration: s.setSceneDuration,
      setSceneBoundary: s.setSceneBoundary,
      splitSceneAt: s.splitSceneAt,
      loopRange: s.loopRange,
      setLoopPoint: s.setLoopPoint,
      clearLoopRange: s.clearLoopRange,
      addMarker: s.addMarker,
      updateMarker: s.updateMarker,
      removeMarker: s.removeMarker,
      selectedLayerId: s.selectedLayerId,
      updateLayerMotion: s.updateLayerMotion
    }))
  );

  const fps = project.fps || 30;
  const totalDuration = getProjectDuration(project);
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  const currentTimeSec = currentFrame / fps;
  const playheadPercent = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100));
  const isAudioActive = Boolean(audioBlobUrl || project.audioBlob);
  const markers = project.markers || [];

  // Scene time boundaries with shot numbers
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

  // Peaks are read from whichever track is current; a result for a replaced track is dropped.
  useEffect(() => {
    const blob = project.audioBlob;
    if (!blob || waveformPeaks) return;
    let cancelled = false;
    extractWaveformPeaks(blob, WAVEFORM_PEAKS)
      .then((peaks) => {
        if (!cancelled && peaks.length > 0 && useMooStore.getState().project.audioBlob === blob) {
          setWaveformPeaks(peaks);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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

          {/* Loop range, markers, played region + playhead */}
          {loopRange && totalDuration > 0 && (
            <div
              className="absolute inset-y-0 bg-sky-400/10 border-x border-sky-400/50 pointer-events-none"
              style={{
                left: `${(loopRange.start / totalDuration) * 100}%`,
                width: `${((loopRange.end - loopRange.start) / totalDuration) * 100}%`
              }}
            />
          )}
          {totalDuration > 0 &&
            markers.map((m) => (
              <div
                key={m.id}
                className="absolute top-0 bottom-0 w-px bg-amber-300/80 pointer-events-none"
                style={{ left: `${(m.time / totalDuration) * 100}%` }}
              />
            ))}
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
        <div className="relative h-4 w-full rounded bg-black/50 border border-white/[0.06] overflow-hidden pointer-events-none" aria-hidden="true">
          <WaveformStrip peaks={waveformPeaks} progressPct={playheadPercent} />
        </div>
      )}
    </div>
  );

  // 2. TICKER VIEW: the mobile stage is hidden, so the compact bar stays as the only control
  if (previewMode === 'ticker') {
    return (
      <div className={`w-full ${className}`}>
        <div className="lg:hidden">{renderCompact()}</div>
        <div className="hidden lg:block">{renderFull()}</div>
      </div>
    );
  }

  // 3. FULL MULTI-TRACK TIMELINE (desktop)
  // The selected layer's editor animation, drawn on its own track under the shot it belongs to.
  const activeModule = project.composition?.scenes.find((m) => m.beatId === activeSceneId);
  const activeShot = sceneBoundaries.find((s) => s.id === activeSceneId);
  const layerTrack =
    selectedLayerId && activeShot && activeModule
      ? {
          layerId: selectedLayerId,
          shotStart: activeShot.startSec,
          shotDuration: activeShot.durationInSeconds,
          motion: activeModule.layerMotions?.[selectedLayerId],
          onChange: (motion: LayerMotion | null) => updateLayerMotion(activeShot.id, selectedLayerId, motion)
        }
      : null;

  function renderFull() {
    return (
      <MultiTrackTimeline
        totalDuration={totalDuration}
        fps={fps}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        sceneBoundaries={sceneBoundaries}
        activeIndex={activeIndex}
        activeSceneId={activeSceneId}
        isPlaying={isPlaying}
        isLooping={isLooping}
        audioStale={audioStale}
        isAudioActive={isAudioActive}
        audioLabel={bgmOnlyAudio ? 'Musik' : 'Suara'}
        audioDuration={project.audioDuration || totalDuration}
        waveformPeaks={waveformPeaks}
        musicLabel={
          project.bgm?.preset && project.bgm.preset !== 'none' && !bgmOnlyAudio
            ? `${project.bgm.preset === 'custom' ? project.bgm.customName || 'Musik sendiri' : project.bgm.preset} · ${Math.round((project.bgm.level ?? 0) * 100)}%`
            : null
        }
        chunkSize={project.theme?.subtitleCustomization?.maxWordsPerChunk || 4}
        markers={markers}
        loopRange={loopRange}
        onSeekFrame={seekFrame}
        onTogglePlay={togglePlay}
        onToggleLoop={toggleLoop}
        onSelectScene={(id, startSec) => {
          seekFrame(Math.round(startSec * fps));
          focusScene(id);
          onSelectScene?.(id);
        }}
        onSetDuration={(id, dur) => setSceneDuration(id, dur, true)}
        onSetBoundary={setSceneBoundary}
        onSplit={() => {
          const scene = sceneBoundaries[activeIndex];
          if (scene) splitSceneAt(scene.id, currentFrame / fps);
        }}
        onSetLoopPoint={setLoopPoint}
        onClearLoop={clearLoopRange}
        onAddMarker={addMarker}
        onUpdateMarker={updateMarker}
        onRemoveMarker={removeMarker}
        onTheater={() => setPreviewMode('theater')}
        layerTrack={layerTrack}
      />
    );
  }

  if (compact) {
    return renderCompact();
  }

  return (
    <div className={className}>
      <div className="sm:hidden">{renderCompact()}</div>
      <div className="hidden sm:block">{renderFull()}</div>
    </div>
  );
};

/** Waveform drawn as one SVG path that stretches to its box; the played part is tinted. */
const WaveformStrip: React.FC<{ peaks: number[] | null; progressPct: number }> = ({ peaks, progressPct }) => {
  const path = useMemo(() => waveformPath(peaks && peaks.length ? peaks : [], 1000, 40), [peaks]);
  const clipId = `moo-wave-${useId().replace(/:/g, '')}`;
  if (!path) {
    return <div className="absolute inset-0 flex items-center px-1"><div className="h-px w-full bg-[#84cc16]/30" /></div>;
  }
  return (
    <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={progressPct * 10} height="40" />
        </clipPath>
      </defs>
      <path d={path} fill="rgba(132,204,22,0.28)" />
      <path d={path} fill="#84cc16" clipPath={`url(#${clipId})`} />
    </svg>
  );
};

interface SceneBoundary {
  id: string;
  shotNumber: number;
  durationInSeconds: number;
  startSec: number;
  endSec: number;
  narrationText: string;
  wordTimestamps: { word: string; start: number; end: number }[];
}

interface MultiTrackTimelineProps {
  totalDuration: number;
  fps: number;
  currentFrame: number;
  totalFrames: number;
  sceneBoundaries: SceneBoundary[];
  activeIndex: number;
  activeSceneId: string | null;
  isPlaying: boolean;
  isLooping: boolean;
  audioStale: boolean;
  isAudioActive: boolean;
  audioLabel: string;
  audioDuration: number;
  waveformPeaks: number[] | null;
  musicLabel: string | null;
  chunkSize: number;
  markers: { id: string; time: number; label: string }[];
  loopRange: { start: number; end: number } | null;
  onSeekFrame: (frame: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSelectScene: (id: string, startSec: number) => void;
  onSetDuration: (id: string, dur: number) => void;
  onSetBoundary: (id: string, timeSec: number) => void;
  onSplit: () => void;
  onSetLoopPoint: (edge: 'start' | 'end', t: number) => void;
  onClearLoop: () => void;
  onAddMarker: (t: number, label?: string) => string;
  onUpdateMarker: (id: string, update: { time?: number; label?: string }) => void;
  onRemoveMarker: (id: string) => void;
  onTheater: () => void;
  layerTrack: {
    layerId: string;
    shotStart: number;
    shotDuration: number;
    motion: LayerMotion | undefined;
    onChange: (motion: LayerMotion | null) => void;
  } | null;
}

const toolBtn =
  'h-7 min-w-[28px] px-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center gap-1 text-[10px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none';

/** Zoomable multi-track timeline: ruler, shots, captions, voice-over and music. */
const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = (props) => {
  const {
    totalDuration,
    fps,
    currentFrame,
    totalFrames,
    sceneBoundaries,
    activeIndex,
    activeSceneId,
    isPlaying,
    isLooping,
    markers,
    loopRange
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewWidth, setViewWidth] = useState(600);
  // 1 = the whole film fits the view; higher values zoom in.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  // While an edge is dragged: 'end' previews a shot's new length (later shots ripple), 'start'
  // previews the cut between a shot and the one before it moving to a film time.
  const [trimPreview, setTrimPreview] = useState<
    { kind: 'end'; id: string; dur: number } | { kind: 'start'; id: string; time: number } | null
  >(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewWidth(Math.max(200, el.clientWidth - LABEL_COL));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeTotal = Math.max(0.5, totalDuration);
  const fitPx = (viewWidth - 12) / safeTotal;
  const pxPerSec = fitPx * zoom;
  const contentWidth = Math.max(viewWidth - 12, safeTotal * pxPerSec);
  const currentTimeSec = currentFrame / fps;
  const playheadX = currentTimeSec * pxPerSec;

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isPlaying || zoom <= 1) return;
    if (playheadX < el.scrollLeft || playheadX > el.scrollLeft + viewWidth - 24) {
      el.scrollLeft = Math.max(0, playheadX - viewWidth * 0.2);
    }
  }, [playheadX, isPlaying, zoom, viewWidth]);

  // Ctrl/⌘ + wheel zooms around the pointer; a plain wheel scrolls sideways when zoomed in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const pointerX = e.clientX - rect.left - LABEL_COL;
        const timeAtPointer = (el.scrollLeft + pointerX) / pxPerSec;
        const nextZoom = Math.max(1, Math.min(MAX_ZOOM, zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        setZoom(nextZoom);
        requestAnimationFrame(() => {
          el.scrollLeft = Math.max(0, timeAtPointer * fitPx * nextZoom - pointerX);
        });
      } else if (zoom > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, pxPerSec, fitPx]);

  const setZoomKeepingPlayhead = (next: number | ((z: number) => number)) => {
    const el = scrollRef.current;
    const z = Math.max(1, Math.min(MAX_ZOOM, typeof next === 'function' ? next(zoomRef.current) : next));
    zoomRef.current = z;
    setZoom(z);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, currentTimeSec * fitPx * z - (el.clientWidth - LABEL_COL) / 2);
      });
    }
  };

  const timeFromClientX = (clientX: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(totalDuration, (clientX - rect.left - LABEL_COL + el.scrollLeft) / pxPerSec));
  };

  // Drag anywhere on the ruler to scrub.
  const onRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    props.onSeekFrame(Math.round(timeFromClientX(e.clientX) * fps));
  };
  const onRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    props.onSeekFrame(Math.round(timeFromClientX(e.clientX) * fps));
  };

  /** Times a dragged edge may snap to: playhead, markers and shot edges. */
  const snapTargets = useMemo(() => {
    const list = [currentFrame / fps, ...markers.map((m) => m.time)];
    sceneBoundaries.forEach((s) => list.push(s.startSec, s.endSec));
    if (loopRange) list.push(loopRange.start, loopRange.end);
    return list;
  }, [currentFrame, fps, markers, sceneBoundaries, loopRange]);

  const snapTime = (t: number, ignore: number[] = []) => {
    const threshold = SNAP_PX / pxPerSec;
    let best = t;
    let bestDist = threshold;
    for (const target of snapTargets) {
      if (ignore.some((i) => Math.abs(i - target) < 1e-6)) continue;
      const d = Math.abs(target - t);
      if (d < bestDist) {
        best = target;
        bestDist = d;
      }
    }
    return best;
  };

  // Drag a shot's right edge: its length changes and every later shot moves with it (ripple).
  const startTrimEnd = (e: React.PointerEvent<HTMLDivElement>, scene: SceneBoundary) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    let lastDur = scene.durationInSeconds;
    const onMove = (ev: PointerEvent) => {
      const rawEnd = scene.endSec + (ev.clientX - startX) / pxPerSec;
      const end = snapTime(rawEnd, [scene.endSec]);
      lastDur = Math.min(MAX_SCENE_SECONDS, Math.max(0.5, Math.round((end - scene.startSec) * 10) / 10));
      setTrimPreview({ kind: 'end', id: scene.id, dur: lastDur });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setTrimPreview(null);
      if (Math.abs(lastDur - scene.durationInSeconds) >= 0.05) props.onSetDuration(scene.id, lastDur);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Drag a shot's left edge: the cut with the shot before it moves, the film keeps its length.
  const startTrimStart = (e: React.PointerEvent<HTMLDivElement>, scene: SceneBoundary, prev: SceneBoundary) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    let lastTime = scene.startSec;
    const onMove = (ev: PointerEvent) => {
      const raw = scene.startSec + (ev.clientX - startX) / pxPerSec;
      const snapped = snapTime(raw, [scene.startSec]);
      lastTime = Math.min(scene.endSec - 0.3, Math.max(prev.startSec + 0.3, Math.round(snapped * 100) / 100));
      setTrimPreview({ kind: 'start', id: scene.id, time: lastTime });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setTrimPreview(null);
      if (Math.abs(lastTime - scene.startSec) >= 0.01) props.onSetBoundary(scene.id, lastTime);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // While an edge is dragged, the shots move with the preview.
  const layout = useMemo(() => {
    const durs = sceneBoundaries.map((s) => s.durationInSeconds);
    if (trimPreview?.kind === 'end') {
      const i = sceneBoundaries.findIndex((s) => s.id === trimPreview.id);
      if (i >= 0) durs[i] = trimPreview.dur;
    } else if (trimPreview?.kind === 'start') {
      const i = sceneBoundaries.findIndex((s) => s.id === trimPreview.id);
      if (i > 0) {
        const shift = trimPreview.time - sceneBoundaries[i].startSec;
        durs[i - 1] += shift;
        durs[i] -= shift;
      }
    }
    let acc = 0;
    return sceneBoundaries.map((s, i) => {
      const start = acc;
      acc += durs[i];
      return { ...s, startSec: start, endSec: start + durs[i], durationInSeconds: durs[i] };
    });
  }, [sceneBoundaries, trimPreview]);

  // Caption phrases: words of each shot grouped like the burned-in subtitles.
  const captionChunks = useMemo(() => {
    const chunks: { key: string; text: string; start: number; end: number }[] = [];
    layout.forEach((s) => {
      const words = (s.wordTimestamps || []).filter((w) => w.word && w.word.trim());
      for (let i = 0; i < words.length; i += props.chunkSize) {
        const group = words.slice(i, i + props.chunkSize);
        const start = s.startSec + Math.max(0, group[0].start);
        const end = Math.min(s.endSec, s.startSec + Math.max(group[group.length - 1].end, group[0].start + 0.2));
        if (end > start) chunks.push({ key: `${s.id}-${i}`, text: group.map((w) => w.word).join(' '), start, end });
      }
    });
    return chunks;
  }, [layout, props.chunkSize]);

  const step = rulerStep(pxPerSec);
  const ticks = useMemo(() => {
    const list: { t: number; major: boolean }[] = [];
    const minor = step / 5;
    const count = Math.floor(safeTotal / minor) + 1;
    for (let i = 0; i <= Math.min(count, 4000); i++) {
      const t = Math.round(i * minor * 1000) / 1000;
      list.push({ t, major: i % 5 === 0 });
    }
    return list;
  }, [step, safeTotal]);

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) || null;
  const addMarkerHere = () => {
    const id = props.onAddMarker(currentTimeSec);
    setSelectedMarkerId(id);
  };

  const trackRow = (label: string, icon: string, height: string, children: React.ReactNode, title?: string) => (
    <div className="flex" style={{ height }}>
      <div
        className="sticky left-0 z-30 shrink-0 flex items-center gap-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 border-r border-white/[0.06] bg-[#0a0b0e]"
        style={{ width: LABEL_COL }}
        title={title}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[13px]">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );

  return (
    <div className="p-2 bg-[#0a0b0e]/95 border border-white/[0.08] rounded-xl space-y-1.5 select-none shadow-xl">
      {/* Toolbar: zoom, markers, loop range */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button type="button" className={toolBtn} onClick={() => setZoomKeepingPlayhead((z) => z / 1.5)} disabled={zoom <= 1} title="Perkecil (Ctrl + scroll)" aria-label="Perkecil timeline">
            <span className="material-symbols-outlined text-[16px]">zoom_out</span>
          </button>
          <input
            type="range"
            min={0}
            max={Math.log(MAX_ZOOM)}
            step={0.01}
            value={Math.log(zoom)}
            onChange={(e) => setZoomKeepingPlayhead(Math.exp(parseFloat(e.target.value)))}
            aria-label="Zoom timeline"
            className="w-24 accent-[#84cc16] h-1 cursor-pointer"
          />
          <button type="button" className={toolBtn} onClick={() => setZoomKeepingPlayhead((z) => z * 1.5)} disabled={zoom >= MAX_ZOOM} title="Perbesar (Ctrl + scroll)" aria-label="Perbesar timeline">
            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
          </button>
          <button type="button" className={toolBtn} onClick={() => setZoomKeepingPlayhead(1)} disabled={zoom === 1} title="Tampilkan seluruh video">
            Pas
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolBtn}
            onClick={props.onSplit}
            disabled={sceneBoundaries.length === 0}
            title="Potong shot di playhead (S); potongan kedua melanjutkan animasi yang sama"
          >
            <span className="material-symbols-outlined text-[15px]">content_cut</span>
            Potong
          </button>
          <button type="button" className={toolBtn} onClick={addMarkerHere} disabled={totalDuration <= 0} title="Tambah marker di playhead (M)">
            <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
            Marker
          </button>
          {selectedMarker && (
            <div className="flex items-center gap-1 pl-1">
              <input
                type="text"
                value={selectedMarker.label}
                onChange={(e) => props.onUpdateMarker(selectedMarker.id, { label: e.target.value })}
                placeholder={`Marker ${formatTimecode(selectedMarker.time)}`}
                aria-label="Nama marker"
                maxLength={60}
                className="h-7 w-32 px-2 rounded-md bg-black/60 border border-amber-300/40 focus:border-amber-300 text-[11px] text-zinc-100 focus:outline-none"
              />
              <button
                type="button"
                className={toolBtn}
                onClick={() => {
                  props.onRemoveMarker(selectedMarker.id);
                  setSelectedMarkerId(null);
                }}
                title="Hapus marker"
                aria-label="Hapus marker"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          )}
          <span className="w-px h-5 bg-white/[0.08] mx-1" aria-hidden="true" />
          <button type="button" className={toolBtn} onClick={() => props.onSetLoopPoint('start', currentTimeSec)} disabled={totalDuration <= 0} title="Awal rentang putar ulang di playhead (I)">
            In
          </button>
          <button type="button" className={toolBtn} onClick={() => props.onSetLoopPoint('end', currentTimeSec)} disabled={totalDuration <= 0} title="Akhir rentang putar ulang di playhead (O)">
            Out
          </button>
          {loopRange && (
            <button type="button" className={toolBtn} onClick={props.onClearLoop} title="Hapus rentang (X)">
              <span className="font-mono text-sky-300">
                {formatTimecode(loopRange.start)}–{formatTimecode(loopRange.end)}
              </span>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Tracks */}
      <div className="flex rounded-md border border-white/[0.08] bg-black/50 overflow-hidden">
        <div className="flex-1 min-w-0">
          <div ref={scrollRef} className="relative overflow-x-auto overflow-y-hidden" data-no-swipe>
            <div className="relative" style={{ width: contentWidth + LABEL_COL }}>
              {/* Ruler */}
              <div className="flex h-5 border-b border-white/[0.08]">
              <div className="sticky left-0 z-30 shrink-0 border-r border-white/[0.06] bg-[#0a0b0e]" style={{ width: LABEL_COL }} />
              <div
                className="relative flex-1 cursor-ew-resize"
                onPointerDown={onRulerPointerDown}
                onPointerMove={onRulerPointerMove}
                data-timeline-ruler
                title="Klik atau seret untuk memindah playhead"
              >
                {ticks.map((tk) => (
                  <div
                    key={tk.t}
                    className={`absolute bottom-0 w-px ${tk.major ? 'h-2.5 bg-zinc-500' : 'h-1 bg-zinc-700'}`}
                    style={{ left: tk.t * pxPerSec }}
                  >
                    {tk.major && (
                      <span className="absolute -top-0.5 left-1 text-[9px] font-mono text-zinc-500 whitespace-nowrap">
                        {formatRulerLabel(tk.t, step)}
                      </span>
                    )}
                  </div>
                ))}
                {markers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setSelectedMarkerId(m.id);
                      props.onSeekFrame(Math.round(m.time * fps));
                    }}
                    title={m.label || `Marker ${formatTimecode(m.time)}`}
                    aria-label={`Marker ${m.label || formatTimecode(m.time)}`}
                    className={`absolute top-0 -ml-1.5 w-3 h-3 rotate-45 rounded-[2px] border ${
                      m.id === selectedMarkerId ? 'bg-amber-300 border-amber-100' : 'bg-amber-400/80 border-amber-300/60'
                    }`}
                    style={{ left: m.time * pxPerSec }}
                  />
                ))}
              </div>
              </div>

              {/* Tracks; their labels stay pinned to the left edge while scrolling */}
              <div className="relative">
                {/* Shot track */}
                {trackRow(
                  'Shot',
                  'movie',
                  '34px',
                  <>
                    {layout.map((scene, idx) => {
                      const isSelected = activeSceneId === scene.id;
                      const isCurrent = idx === activeIndex;
                      const width = scene.durationInSeconds * pxPerSec;
                      return (
                        <div
                          key={scene.id}
                          onClick={() => props.onSelectScene(scene.id, scene.startSec)}
                          title={`Shot ${scene.shotNumber} (${scene.durationInSeconds.toFixed(1)} dtk)${scene.narrationText ? `: ${scene.narrationText}` : ''}`}
                          className={`group absolute top-1 bottom-1 rounded-md border px-1.5 flex items-center gap-1.5 overflow-hidden cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#84cc16]/20 border-[#84cc16]/70'
                              : isCurrent
                                ? 'bg-white/[0.09] border-white/[0.14]'
                                : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08]'
                          }`}
                          style={{ left: scene.startSec * pxPerSec + 1, width: Math.max(4, width - 2) }}
                        >
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${isSelected || isCurrent ? 'text-[#84cc16]' : 'text-zinc-400'}`}>
                            {scene.shotNumber}
                          </span>
                          {width > 70 && (
                            <span className="text-[10px] text-zinc-400 truncate min-w-0 flex-1">{scene.narrationText}</span>
                          )}
                          {width > 44 && (
                            <span className="text-[9px] font-mono text-zinc-500 shrink-0">{scene.durationInSeconds.toFixed(1)}s</span>
                          )}
                          {idx > 0 && (
                            <div
                              onPointerDown={(e) => startTrimStart(e, sceneBoundaries[idx], sceneBoundaries[idx - 1])}
                              onClick={(e) => e.stopPropagation()}
                              title="Tarik untuk menggeser potongan dengan shot sebelumnya (durasi total tetap)"
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-400/60 active:bg-sky-400 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100"
                            >
                              <span className="w-[1.5px] h-3 rounded-full bg-white/80" />
                            </div>
                          )}
                          <div
                            onPointerDown={(e) => startTrimEnd(e, scene)}
                            onClick={(e) => e.stopPropagation()}
                            title="Tarik untuk mengubah durasi (shot berikutnya ikut bergeser)"
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#84cc16]/60 active:bg-[#84cc16] z-10 flex items-center justify-center opacity-0 group-hover:opacity-100"
                          >
                            <span className="w-[1.5px] h-3 rounded-full bg-white/80" />
                          </div>
                        </div>
                      );
                    })}
                    {trimPreview && (
                      <div
                        className="absolute -top-0.5 px-1.5 py-0.5 rounded bg-[#84cc16] text-black text-[10px] font-mono font-bold z-30 pointer-events-none"
                        style={{
                          left:
                            (trimPreview.kind === 'end'
                              ? layout.find((s) => s.id === trimPreview.id)?.endSec || 0
                              : trimPreview.time) *
                              pxPerSec +
                            4
                        }}
                      >
                        {trimPreview.kind === 'end' ? `${trimPreview.dur.toFixed(1)}s` : formatTimecode(trimPreview.time)}
                      </div>
                    )}
                  </>
                )}

                {/* Caption track */}
                {trackRow(
                  'Teks',
                  'subtitles',
                  '20px',
                  captionChunks.map((c) => (
                    <div
                      key={c.key}
                      title={c.text}
                      className="absolute top-0.5 bottom-0.5 rounded-sm bg-sky-400/15 border border-sky-400/25 px-1 overflow-hidden"
                      style={{ left: c.start * pxPerSec, width: Math.max(2, (c.end - c.start) * pxPerSec - 1) }}
                    >
                      {(c.end - c.start) * pxPerSec > 30 && (
                        <span className="block text-[9px] leading-[14px] text-sky-200/80 truncate">{c.text}</span>
                      )}
                    </div>
                  )),
                  'Kalimat narasi menurut waktu kata'
                )}

                {/* Selected layer's animation: drag a step to retime it, drag its right edge to change its length */}
                {props.layerTrack &&
                  trackRow(
                    'Layer',
                    'layers',
                    '22px',
                    <LayerMotionTrack track={props.layerTrack} pxPerSec={pxPerSec} />,
                    `Animasi layer ${props.layerTrack.layerId}`
                  )}

                {/* Voice-over / audio track */}
                {props.isAudioActive &&
                  trackRow(
                    props.audioLabel,
                    'graphic_eq',
                    '26px',
                    <div
                      className="absolute top-0.5 bottom-0.5 left-0 rounded-sm bg-[#84cc16]/[0.06] overflow-hidden"
                      style={{ width: Math.max(2, props.audioDuration * pxPerSec) }}
                    >
                      <WaveformStrip
                        peaks={props.waveformPeaks}
                        progressPct={props.audioDuration > 0 ? Math.min(100, (currentTimeSec / props.audioDuration) * 100) : 0}
                      />
                    </div>
                  )}

                {/* Music track */}
                {props.musicLabel &&
                  trackRow(
                    'Musik',
                    'music_note',
                    '18px',
                    <div
                      className="absolute top-0.5 bottom-0.5 left-0 rounded-sm bg-violet-400/15 border border-violet-400/25 px-1.5 flex items-center"
                      style={{ width: Math.max(2, totalDuration * pxPerSec) }}
                    >
                      <span className="text-[9px] text-violet-200/80 truncate capitalize">{props.musicLabel}</span>
                    </div>,
                    'Musik latar dicampur ke trek suara'
                  )}

                {/* Loop range shading */}
                {loopRange && (
                  <div
                    className="absolute inset-y-0 bg-sky-400/[0.07] border-x border-sky-400/50 pointer-events-none"
                    style={{ left: LABEL_COL + loopRange.start * pxPerSec, width: (loopRange.end - loopRange.start) * pxPerSec }}
                  />
                )}
                {/* Marker lines */}
                {markers.map((m) => (
                  <div
                    key={m.id}
                    className="absolute inset-y-0 w-px bg-amber-300/40 pointer-events-none"
                    style={{ left: LABEL_COL + m.time * pxPerSec }}
                  />
                ))}
              </div>

              {/* Playhead across ruler and tracks */}
              <div
                className="absolute top-0 bottom-0 w-[2px] -ml-px bg-[#84cc16] pointer-events-none z-20"
                style={{ left: LABEL_COL + playheadX }}
              >
                <div className="w-2.5 h-2.5 bg-[#84cc16] rotate-45 -ml-[4px] -top-1 absolute rounded-[1px] shadow-[0_0_8px_rgba(132,204,22,0.6)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
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
          {props.audioStale && (
            <span
              className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded hidden sm:inline"
              title="Durasi adegan berubah setelah suara dibuat; buat ulang suara agar sinkron"
            >
              Sync
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => props.onSeekFrame(Math.max(0, currentFrame - 1))}
            title="Mundur 1 frame (←)"
            aria-label="Mundur 1 frame"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">skip_previous</span>
          </button>
          <button
            type="button"
            onClick={props.onTogglePlay}
            title={isPlaying ? 'Jeda (Space)' : 'Putar (Space)'}
            aria-label={isPlaying ? 'Jeda' : 'Putar'}
            className="h-7 sm:h-8 px-3 sm:px-3.5 rounded-md bg-[#84cc16] hover:bg-[#9ae62e] text-black font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-[#84cc16]/20"
          >
            <span className="material-symbols-outlined text-[17px] sm:text-[19px] font-bold">{isPlaying ? 'pause' : 'play_arrow'}</span>
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase opacity-75">Space</span>
          </button>
          <button
            type="button"
            onClick={() => props.onSeekFrame(Math.min(totalFrames, currentFrame + 1))}
            title="Maju 1 frame (→)"
            aria-label="Maju 1 frame"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">skip_next</span>
          </button>
          <button
            type="button"
            onClick={props.onToggleLoop}
            aria-pressed={isLooping}
            title={isLooping ? (loopRange ? 'Putar ulang rentang In–Out: aktif' : 'Putar ulang: aktif') : 'Putar ulang: mati'}
            aria-label="Putar ulang"
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md active:scale-95 flex items-center justify-center transition-all border ${
              isLooping
                ? 'bg-[#84cc16]/15 border-[#84cc16]/40 text-[#84cc16] shadow-[0_0_8px_rgba(132,204,22,0.15)]'
                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[17px]">repeat</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {activeIndex >= 0 && sceneBoundaries[activeIndex] && (
            <div className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]" />
              <span>Shot {sceneBoundaries[activeIndex].shotNumber}</span>
            </div>
          )}
          <button
            type="button"
            onClick={props.onTheater}
            title="Layar penuh"
            aria-label="Layar penuh"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">open_in_full</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const STEP_STYLE: Record<'enter' | 'move' | 'exit', { label: string; cls: string }> = {
  enter: { label: 'Masuk', cls: 'bg-emerald-400/20 border-emerald-400/50 text-emerald-200' },
  move: { label: 'Gerak', cls: 'bg-amber-400/20 border-amber-400/50 text-amber-200' },
  exit: { label: 'Keluar', cls: 'bg-rose-400/20 border-rose-400/50 text-rose-200' }
};

/** The selected layer's entrance / move / exit as draggable blocks inside its shot. */
const LayerMotionTrack: React.FC<{
  track: NonNullable<MultiTrackTimelineProps['layerTrack']>;
  pxPerSec: number;
}> = ({ track, pxPerSec }) => {
  const [drag, setDrag] = useState<{ step: 'enter' | 'move' | 'exit'; at: number; dur: number } | null>(null);
  const motion = track.motion || {};
  const steps = (['enter', 'move', 'exit'] as const).filter((k) => motion[k]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, step: 'enter' | 'move' | 'exit', edge: 'body' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    const original = motion[step]!;
    const startX = e.clientX;
    let next = { at: original.at, dur: original.dur };
    const onMove = (ev: PointerEvent) => {
      const delta = (ev.clientX - startX) / pxPerSec;
      next =
        edge === 'body'
          ? { at: Math.round(Math.min(track.shotDuration - 0.05, Math.max(0, original.at + delta)) * 100) / 100, dur: original.dur }
          : { at: original.at, dur: Math.round(Math.max(0.05, original.dur + delta) * 100) / 100 };
      setDrag({ step, ...next });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDrag(null);
      if (next.at !== original.at || next.dur !== original.dur) {
        track.onChange({ ...motion, [step]: { ...original, ...next } });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      <div
        className="absolute top-0.5 bottom-0.5 rounded-sm border border-dashed border-white/[0.08]"
        style={{ left: track.shotStart * pxPerSec, width: track.shotDuration * pxPerSec }}
      />
      {steps.length === 0 && (
        <span className="absolute top-0.5 text-[9px] text-zinc-600 whitespace-nowrap" style={{ left: track.shotStart * pxPerSec + 4 }}>
          Belum ada animasi untuk layer ini
        </span>
      )}
      {steps.map((step) => {
        const s = drag && drag.step === step ? drag : motion[step]!;
        // Short steps stay wide enough to grab; zoom in to resize them here.
        const width = Math.max(16, s.dur * pxPerSec);
        const canResize = s.dur * pxPerSec >= 24;
        return (
          <div
            key={step}
            onPointerDown={(e) => startDrag(e, step, 'body')}
            title={`${STEP_STYLE[step].label}: mulai ${s.at.toFixed(2)} dtk, ${s.dur.toFixed(2)} dtk`}
            className={`group absolute top-0.5 bottom-0.5 rounded-sm border px-1 overflow-hidden cursor-grab active:cursor-grabbing ${STEP_STYLE[step].cls}`}
            style={{ left: (track.shotStart + s.at) * pxPerSec, width }}
          >
            {width > 34 && <span className="block text-[9px] leading-[16px] truncate">{STEP_STYLE[step].label}</span>}
            {canResize && (
              <div
                onPointerDown={(e) => startDrag(e, step, 'end')}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40"
              />
            )}
          </div>
        );
      })}
    </>
  );
};
