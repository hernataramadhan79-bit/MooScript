import { useEffect, useRef, useState } from 'react';
import { playhead } from '../../lib/playhead';

interface Props {
  playLabel: string;
  pauseLabel: string;
  frameLabel: string;
  loopSeconds?: number;
  fps?: number;
  tone?: 'ground' | 'lime';
}

/**
 * The page's playhead. It drives every live stage in the hero at once, so one
 * drag scrubs the slot in the headline and all three masters together.
 */
export default function HeroRail({ playLabel, pauseLabel, frameLabel, loopSeconds = 7, fps = 30, tone = 'ground' }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      playhead.setPlaying(false);
      setPlaying(false);
    }
    const stop = playhead.subscribe((t, isPlaying) => {
      const local = t % loopSeconds;
      if (rangeRef.current && document.activeElement !== rangeRef.current) {
        rangeRef.current.value = String(local);
      }
      if (fillRef.current) fillRef.current.style.width = `${(local / loopSeconds) * 100}%`;
      if (readoutRef.current) {
        readoutRef.current.textContent = `${String(Math.floor(local * fps)).padStart(3, '0')} / ${String(
          loopSeconds * fps
        ).padStart(3, '0')}`;
      }
      setPlaying((prev) => (prev === isPlaying ? prev : isPlaying));
    });

    const wrap = wrapRef.current;
    let io: IntersectionObserver | undefined;
    if (wrap && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => playhead.setVisible(entry.isIntersecting));
      io.observe(wrap.closest('section') || wrap);
    }
    return () => {
      stop();
      io?.disconnect();
    };
  }, [loopSeconds, fps]);

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    playhead.setPlaying(false);
    playhead.seek(v);
    if (fillRef.current) fillRef.current.style.width = `${(v / loopSeconds) * 100}%`;
  };

  return (
    <div ref={wrapRef} className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => playhead.setPlaying(!playing)}
        aria-pressed={playing}
        className={`btn min-w-[104px] !min-h-[48px] !px-4 ${tone === 'lime' ? 'btn-dark' : 'btn-ink'}`}
      >
        {playing ? pauseLabel : playLabel}
      </button>

      <div className="relative min-w-0 flex-1" style={{
          ['--track-on' as string]: tone === 'lime' ? '#0e1e00' : '#f4f4f6',
          ['--track-off' as string]: tone === 'lime' ? '#5f9510' : '#34343f',
          ['--thumb' as string]: tone === 'lime' ? '#0e1e00' : '#84cc16'
        }}>
        <span ref={fillRef} className="playhead-fill" aria-hidden="true" />
        <input
          ref={rangeRef}
          type="range"
          className="playhead"
          aria-label="Playhead"
          min={0}
          max={loopSeconds}
          step={1 / fps}
          defaultValue={0}
          onChange={onScrub}
        />
      </div>

      <span className="tabular hidden w-[128px] shrink-0 text-right text-[15px] font-semibold sm:block">
        {frameLabel} <span ref={readoutRef}>000 / {loopSeconds * fps}</span>
      </span>
    </div>
  );
}
