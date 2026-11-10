import React, { useMemo, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { extractWaveformPeaks } from '../../engine/audio/waveform';
import { getProjectDuration } from '../../utils/projectDuration';
import type { LayerMotion } from '../../types';
import { t } from '../../i18n';
import { WAVEFORM_PEAKS, formatTimecode } from './timeline/shared';
import { MultiTrackTimeline } from './timeline/MultiTrackTimeline';
import { WaveformStrip } from './timeline/WaveformStrip';

export { formatTimecode };

interface TimelineBarProps {
  className?: string;
  compact?: boolean;
  onSelectScene?: (sceneId: string) => void;
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
    updateLayerMotion,
    addSfxCue,
    updateSfxCue,
    removeSfxCue,
    autoPlaceSfx,
    analyzeMusicBeats,
    snapCutsToBeats,
    addToast
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
      updateLayerMotion: s.updateLayerMotion,
      addSfxCue: s.addSfxCue,
      updateSfxCue: s.updateSfxCue,
      removeSfxCue: s.removeSfxCue,
      autoPlaceSfx: s.autoPlaceSfx,
      analyzeMusicBeats: s.analyzeMusicBeats,
      snapCutsToBeats: s.snapCutsToBeats,
      addToast: s.addToast
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

  // Computed before any early return: renderFull() reads these from the ticker branch too.
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
            aria-label={isPlaying ? t('Jeda') : t('Putar')}
            className="h-9 w-11 rounded-lg bg-[#84cc16] hover:bg-[#9ae62e] text-black flex items-center justify-center active:scale-95 shadow-sm shadow-[#84cc16]/20"
          >
            <span className="material-symbols-outlined fill text-[22px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button
            type="button"
            onClick={toggleLoop}
            aria-label={isLooping ? t('Matikan putar ulang') : t('Putar ulang terus')}
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
            aria-label={previewMode === 'ticker' ? t('Tampilkan panggung') : t('Sembunyikan panggung')}
            title={previewMode === 'ticker' ? t('Tampilkan panggung') : t('Sembunyikan panggung')}
            className={compactBtn}
          >
            <span className="material-symbols-outlined text-[20px]">
              {previewMode === 'ticker' ? 'expand_more' : 'expand_less'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('theater')}
            aria-label={t('Layar penuh')}
            title={t('Layar penuh')}
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
          aria-label={t('Posisi pemutaran')}
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
          {t('Belum ada shot')}
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
        audioLabel={bgmOnlyAudio ? t('Audio') : t('Suara')}
        audioDuration={project.audioDuration || totalDuration}
        waveformPeaks={waveformPeaks}
        musicLabel={
          project.bgm?.preset && project.bgm.preset !== 'none'
            ? `${project.bgm.preset === 'custom' ? project.bgm.customName || t('Musik sendiri') : project.bgm.preset} · ${Math.round((project.bgm.level ?? 0) * 100)}%`
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
        sfxCues={project.sfxCues || []}
        beats={project.musicBeats?.times || []}
        beatsBpm={project.musicBeats?.bpm ?? null}
        hasScenes={sceneBoundaries.length > 0}
        onAddSfx={(kind) => addSfxCue(currentFrame / fps, kind)}
        onUpdateSfx={updateSfxCue}
        onRemoveSfx={removeSfxCue}
        onAutoSfx={() => {
          const n = autoPlaceSfx();
          addToast(n > 0 ? t('{0} efek suara ditempatkan. Geser atau hapus di track SFX.', n) : t('Tidak ada titik baru untuk efek suara.'), 'info');
        }}
        onAnalyzeBeats={async () => {
          const n = await analyzeMusicBeats();
          if (n > 0) addToast(t('{0} ketukan ditemukan. Potongan dan cue sekarang bisa menempel ke ketukan.', n), 'success');
        }}
        onSnapToBeats={() => {
          const n = snapCutsToBeats();
          addToast(n > 0 ? t('{0} potongan dipindah ke ketukan terdekat.', n) : t('Semua potongan sudah pas di ketukan.'), 'info');
        }}
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

