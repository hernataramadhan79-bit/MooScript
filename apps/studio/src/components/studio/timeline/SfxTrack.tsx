import React, { useState } from 'react';
import type { SfxCue, SfxKind } from '../../../types';
import { SFX_LABEL } from '../../../engine/audio/sfx';
import { t } from '../../../i18n';

const SFX_COLOR: Record<SfxKind, string> = {
  whoosh: 'bg-sky-400/30 border-sky-300/70',
  pop: 'bg-orange-400/30 border-orange-300/70',
  tick: 'bg-zinc-300/25 border-zinc-200/60',
  riser: 'bg-fuchsia-400/30 border-fuchsia-300/70',
  impact: 'bg-rose-400/30 border-rose-300/70'
};

/** Sound effect cues on the timeline; drag one to move it (it snaps like everything else). */
export const SfxTrack: React.FC<{
  cues: SfxCue[];
  pxPerSec: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, time: number) => void;
  snapTime: (t: number, ignore?: number[]) => number;
  maxTime: number;
}> = ({ cues, pxPerSec, selectedId, onSelect, onMove, snapTime, maxTime }) => {
  const [drag, setDrag] = useState<{ id: string; time: number } | null>(null);

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, cue: SfxCue) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(cue.id);
    const startX = e.clientX;
    let last = cue.time;
    const onPointerMove = (ev: PointerEvent) => {
      const raw = cue.time + (ev.clientX - startX) / pxPerSec;
      last = Math.round(Math.min(maxTime, Math.max(0, snapTime(raw, [cue.time]))) * 100) / 100;
      setDrag({ id: cue.id, time: last });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDrag(null);
      if (Math.abs(last - cue.time) >= 0.01) onMove(cue.id, last);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  if (cues.length === 0) {
    return <span className="absolute top-1 left-1 text-[9px] text-zinc-600 whitespace-nowrap">{t('Belum ada efek suara')}</span>;
  }
  return (
    <>
      {cues.map((cue) => {
        const time = drag?.id === cue.id ? drag.time : cue.time;
        const selected = cue.id === selectedId;
        return (
          <button
            key={cue.id}
            type="button"
            onPointerDown={(e) => startDrag(e, cue)}
            title={t('{0} di {1} dtk{2}', t(SFX_LABEL[cue.kind]), time.toFixed(2), cue.auto ? t(' (otomatis)') : '')}
            aria-label={t('Efek suara {0} di {1} detik', t(SFX_LABEL[cue.kind]), time.toFixed(2))}
            className={`absolute top-0.5 bottom-0.5 -ml-1.5 min-w-[12px] px-1 rounded-sm border text-[9px] leading-[14px] text-zinc-100 cursor-grab active:cursor-grabbing ${SFX_COLOR[cue.kind]} ${
              selected ? 'ring-1 ring-white' : ''
            } ${cue.auto ? 'border-dashed' : ''}`}
            style={{ left: time * pxPerSec }}
          >
            {pxPerSec > 60 ? t(SFX_LABEL[cue.kind]) : ''}
          </button>
        );
      })}
    </>
  );
};
