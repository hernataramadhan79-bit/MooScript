import React, { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAX_SCENE_SECONDS } from '../../../utils/projectDuration';
import type { SfxKind } from '../../../types';
import { SFX_KINDS, SFX_LABEL } from '../../../engine/audio/sfx';
import { t } from '../../../i18n';
import { LABEL_COL, MAX_ZOOM, SNAP_PX, formatRulerLabel, formatTimecode, rulerStep, toolBtn, type MultiTrackTimelineProps, type SceneBoundary } from './shared';
import { WaveformStrip } from './WaveformStrip';
import { LayerMotionTrack } from './LayerMotionTrack';
import { SfxTrack } from './SfxTrack';

/** Zoomable multi-track timeline: ruler, shots, captions, voice-over and music. */
export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = (props) => {
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
    list.push(...props.beats);
    return list;
  }, [currentFrame, fps, markers, sceneBoundaries, loopRange, props.beats]);

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
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const selectedCue = props.sfxCues.find((c) => c.id === selectedCueId) || null;
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
          <button type="button" className={toolBtn} onClick={() => setZoomKeepingPlayhead((z) => z / 1.5)} disabled={zoom <= 1} title={t('Perkecil (Ctrl + scroll)')} aria-label={t('Perkecil timeline')}>
            <span className="material-symbols-outlined text-[16px]">zoom_out</span>
          </button>
          <input
            type="range"
            min={0}
            max={Math.log(MAX_ZOOM)}
            step={0.01}
            value={Math.log(zoom)}
            onChange={(e) => setZoomKeepingPlayhead(Math.exp(parseFloat(e.target.value)))}
            aria-label={t('Zoom timeline')}
            className="w-24 accent-[#84cc16] h-1 cursor-pointer"
          />
          <button type="button" className={toolBtn} onClick={() => setZoomKeepingPlayhead((z) => z * 1.5)} disabled={zoom >= MAX_ZOOM} title={t('Perbesar (Ctrl + scroll)')} aria-label={t('Perbesar timeline')}>
            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
          </button>
          <button type="button" className={toolBtn} onClick={() => setZoomKeepingPlayhead(1)} disabled={zoom === 1} title={t('Tampilkan seluruh video')}>
            {t('Pas')}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolBtn}
            onClick={props.onSplit}
            disabled={sceneBoundaries.length === 0}
            title={t('Potong shot di playhead (S); potongan kedua melanjutkan animasi yang sama')}
          >
            <span className="material-symbols-outlined text-[15px]">content_cut</span>
            {t('Potong')}
          </button>
          <button type="button" className={toolBtn} onClick={addMarkerHere} disabled={totalDuration <= 0} title={t('Tambah marker di playhead (M)')}>
            <span className="material-symbols-outlined text-[15px]">bookmark_add</span>
            {t('Marker')}
          </button>
          {selectedMarker && (
            <div className="flex items-center gap-1 pl-1">
              <input
                type="text"
                value={selectedMarker.label}
                onChange={(e) => props.onUpdateMarker(selectedMarker.id, { label: e.target.value })}
                placeholder={t('Marker {0}', formatTimecode(selectedMarker.time))}
                aria-label={t('Nama marker')}
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
                title={t('Hapus marker')}
                aria-label={t('Hapus marker')}
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          )}
          <span className="w-px h-5 bg-white/[0.08] mx-1" aria-hidden="true" />
          <button type="button" className={toolBtn} onClick={() => props.onSetLoopPoint('start', currentTimeSec)} disabled={totalDuration <= 0} title={t('Awal rentang putar ulang di playhead (I)')}>
            {t('In')}
          </button>
          <button type="button" className={toolBtn} onClick={() => props.onSetLoopPoint('end', currentTimeSec)} disabled={totalDuration <= 0} title={t('Akhir rentang putar ulang di playhead (O)')}>
            {t('Out')}
          </button>
          {loopRange && (
            <button type="button" className={toolBtn} onClick={props.onClearLoop} title={t('Hapus rentang (X)')}>
              <span className="font-mono text-sky-300">
                {formatTimecode(loopRange.start)}–{formatTimecode(loopRange.end)}
              </span>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Sound tools: effects and beats */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          className={toolBtn}
          onClick={props.onAutoSfx}
          disabled={!props.hasScenes}
          title={t('Tempatkan whoosh di setiap potongan dan pop/hentakan di momen visual. Cue yang kamu taruh sendiri tetap.')}
        >
          <span className="material-symbols-outlined text-[15px]">graphic_eq</span>
          {t('SFX otomatis')}
        </button>
        <select
          value=""
          onChange={(e) => e.target.value && props.onAddSfx(e.target.value as SfxKind)}
          disabled={!props.hasScenes}
          aria-label={t('Tambah efek suara di playhead')}
          className="h-7 px-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-zinc-400 focus:outline-none disabled:opacity-40"
        >
          <option value="">{t('+ SFX di playhead')}</option>
          {SFX_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(SFX_LABEL[k])}
            </option>
          ))}
        </select>
        {selectedCue && (
          <div className="flex items-center gap-1 pl-1">
            <select
              value={selectedCue.kind}
              onChange={(e) => props.onUpdateSfx(selectedCue.id, { kind: e.target.value as SfxKind })}
              aria-label={t('Jenis efek suara')}
              className="h-7 px-1.5 rounded-md bg-black/60 border border-orange-300/40 text-[10px] text-zinc-100 focus:outline-none"
            >
              {SFX_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(SFX_LABEL[k])}
                </option>
              ))}
            </select>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={selectedCue.gain ?? 1}
              onChange={(e) => props.onUpdateSfx(selectedCue.id, { gain: parseFloat(e.target.value) })}
              aria-label={t('Volume efek suara ini')}
              title={t('Volume {0}%', Math.round((selectedCue.gain ?? 1) * 100))}
              className="w-16 accent-orange-300 h-1 cursor-pointer"
            />
            <button
              type="button"
              className={toolBtn}
              onClick={() => {
                props.onRemoveSfx(selectedCue.id);
                setSelectedCueId(null);
              }}
              title={t('Hapus efek suara')}
              aria-label={t('Hapus efek suara')}
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
            </button>
          </div>
        )}
        <span className="w-px h-5 bg-white/[0.08] mx-1" aria-hidden="true" />
        <button
          type="button"
          className={toolBtn}
          onClick={props.onAnalyzeBeats}
          disabled={!props.musicLabel}
          title={props.musicLabel ? t('Cari ketukan musik latar') : t('Pilih musik latar di tab Audio dulu')}
        >
          <span className="material-symbols-outlined text-[15px]">music_note</span>
          {props.beats.length ? `${t('Ketukan')}${props.beatsBpm ? ` · ${Math.round(props.beatsBpm)} BPM` : ''}` : t('Cari ketukan')}
        </button>
        {props.beats.length > 1 && (
          <button
            type="button"
            className={toolBtn}
            onClick={props.onSnapToBeats}
            disabled={sceneBoundaries.length < 2}
            title={t('Pindahkan setiap potongan antar-shot ke ketukan terdekat (durasi total tetap)')}
          >
            <span className="material-symbols-outlined text-[15px]">align_horizontal_center</span>
            {t('Potongan ke ketukan')}
          </button>
        )}
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
                title={t('Klik atau seret untuk memindah playhead')}
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
                    title={m.label || t('Marker {0}', formatTimecode(m.time))}
                    aria-label={t('Marker {0}', m.label || formatTimecode(m.time))}
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
                  t('Shot'),
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
                          title={t('Shot {0} ({1} dtk){2}', scene.shotNumber, scene.durationInSeconds.toFixed(1), scene.narrationText ? `: ${scene.narrationText}` : '')}
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
                              title={t('Tarik untuk menggeser potongan dengan shot sebelumnya (durasi total tetap)')}
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-400/60 active:bg-sky-400 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100"
                            >
                              <span className="w-[1.5px] h-3 rounded-full bg-white/80" />
                            </div>
                          )}
                          <div
                            onPointerDown={(e) => startTrimEnd(e, scene)}
                            onClick={(e) => e.stopPropagation()}
                            title={t('Tarik untuk mengubah durasi (shot berikutnya ikut bergeser)')}
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
                  t('Teks'),
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
                  t('Kalimat narasi menurut waktu kata')
                )}

                {/* Selected layer's animation: drag a step to retime it, drag its right edge to change its length */}
                {props.layerTrack &&
                  trackRow(
                    t('Layer'),
                    'layers',
                    '22px',
                    <LayerMotionTrack track={props.layerTrack} pxPerSec={pxPerSec} />,
                    t('Animasi layer {0}', props.layerTrack.layerId)
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

                {/* Sound effects */}
                {props.hasScenes &&
                  trackRow(
                    t('SFX'),
                    'graphic_eq',
                    '20px',
                    <SfxTrack
                      cues={props.sfxCues}
                      pxPerSec={pxPerSec}
                      selectedId={selectedCueId}
                      onSelect={(id) => setSelectedCueId(id)}
                      onMove={(id, t) => props.onUpdateSfx(id, { time: t })}
                      snapTime={snapTime}
                      maxTime={totalDuration}
                    />,
                    t('Efek suara; seret untuk memindah, klik untuk mengatur')
                  )}

                {/* Music track, with its beats */}
                {props.musicLabel &&
                  trackRow(
                    t('Musik'),
                    'music_note',
                    '18px',
                    <>
                      <div
                        className="absolute top-0.5 bottom-0.5 left-0 rounded-sm bg-violet-400/15 border border-violet-400/25 px-1.5 flex items-center"
                        style={{ width: Math.max(2, totalDuration * pxPerSec) }}
                      >
                        <span className="text-[9px] text-violet-200/80 truncate capitalize">{props.musicLabel}</span>
                      </div>
                      {props.beats.map((b) => (
                        <div
                          key={b}
                          className="absolute bottom-0.5 w-px h-2 bg-violet-200/60 pointer-events-none"
                          style={{ left: b * pxPerSec }}
                        />
                      ))}
                    </>,
                    t('Musik latar dicampur ke trek suara; garis kecil = ketukan')
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
              title={t('Durasi adegan berubah setelah suara dibuat; buat ulang suara agar sinkron')}
            >
              {t('Sync')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => props.onSeekFrame(Math.max(0, currentFrame - 1))}
            title={t('Mundur 1 frame (←)')}
            aria-label={t('Mundur 1 frame')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">skip_previous</span>
          </button>
          <button
            type="button"
            onClick={props.onTogglePlay}
            title={isPlaying ? t('Jeda (Space)') : t('Putar (Space)')}
            aria-label={isPlaying ? t('Jeda') : t('Putar')}
            className="h-7 sm:h-8 px-3 sm:px-3.5 rounded-md bg-[#84cc16] hover:bg-[#9ae62e] text-black font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-[#84cc16]/20"
          >
            <span className="material-symbols-outlined text-[17px] sm:text-[19px] font-bold">{isPlaying ? 'pause' : 'play_arrow'}</span>
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase opacity-75">{t('Space')}</span>
          </button>
          <button
            type="button"
            onClick={() => props.onSeekFrame(Math.min(totalFrames, currentFrame + 1))}
            title={t('Maju 1 frame (→)')}
            aria-label={t('Maju 1 frame')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">skip_next</span>
          </button>
          <button
            type="button"
            onClick={props.onToggleLoop}
            aria-pressed={isLooping}
            title={isLooping ? (loopRange ? t('Putar ulang rentang In–Out: aktif') : t('Putar ulang: aktif')) : t('Putar ulang: mati')}
            aria-label={t('Putar ulang')}
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
              <span>{t('Shot')} {sceneBoundaries[activeIndex].shotNumber}</span>
            </div>
          )}
          <button
            type="button"
            onClick={props.onTheater}
            title={t('Layar penuh')}
            aria-label={t('Layar penuh')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">open_in_full</span>
          </button>
        </div>
      </div>
    </div>
  );
};
