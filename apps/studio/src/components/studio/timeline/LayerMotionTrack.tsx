import React, { useState } from 'react';
import { L, t } from '../../../i18n';
import { type MultiTrackTimelineProps } from './shared';

const STEP_STYLE: Record<'enter' | 'move' | 'exit', { label: string; cls: string }> = {
  enter: { label: L('Masuk'), cls: 'bg-emerald-400/20 border-emerald-400/50 text-emerald-200' },
  move: { label: L('Gerak'), cls: 'bg-amber-400/20 border-amber-400/50 text-amber-200' },
  exit: { label: L('Keluar'), cls: 'bg-rose-400/20 border-rose-400/50 text-rose-200' }
};

/** The selected layer's entrance / move / exit as draggable blocks inside its shot. */
export const LayerMotionTrack: React.FC<{
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
          {t('Belum ada animasi untuk layer ini')}
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
            title={t('{0}: mulai {1} dtk, {2} dtk', t(STEP_STYLE[step].label), s.at.toFixed(2), s.dur.toFixed(2))}
            className={`group absolute top-0.5 bottom-0.5 rounded-sm border px-1 overflow-hidden cursor-grab active:cursor-grabbing ${STEP_STYLE[step].cls}`}
            style={{ left: (track.shotStart + s.at) * pxPerSec, width }}
          >
            {width > 34 && <span className="block text-[9px] leading-[16px] truncate">{t(STEP_STYLE[step].label)}</span>}
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
