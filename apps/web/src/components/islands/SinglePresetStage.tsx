import { useEffect, useMemo, useRef, useState } from 'react';
import { getShowcasePreset, SHOWCASE_PRESETS } from '@mooscript/presets';
import { buildStudioUrl, type Locale } from '../../config/site';
import { buildPresetStageDoc } from '../../lib/stageDocBuilder';

interface Props {
  slug: string;
  locale: Locale;
  /** Match the field the stage sits on: the controls adapt. */
  tone?: 'ground' | 'lime';
}

export default function SinglePresetStage({ slug, locale, tone = 'ground' }: Props) {
  const preset = useMemo(() => getShowcasePreset(slug) || SHOWCASE_PRESETS[0], [slug]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(1.4);
  const [scale, setScale] = useState(1);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const timeRef = useRef<number>(1.4);

  const totalDuration = useMemo(
    () => preset.shots.reduce((sum, s) => sum + s.durationInSeconds, 0) || 3.4,
    [preset]
  );
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  useEffect(() => {
    setSrcDoc(buildPresetStageDoc(preset));
  }, [preset]);
  const portrait = preset.height > preset.width;

  const pushSeek = (t: number) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'seek', time: t }, '*');
  };

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setIsPlaying(false);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w && h) setScale(Math.min(w / preset.width, h / preset.height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [preset]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (document.hidden) {
        lastTsRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      let next = timeRef.current + dt;
      if (next >= totalDuration) next = 0.05;
      timeRef.current = next;
      setCurrentTime(next);
      pushSeek(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalDuration]);

  const onLime = tone === 'lime';
  const w = preset.width * scale;
  const h = preset.height * scale;

  return (
    <div>
      <div
        ref={boxRef}
        className={`relative mx-auto w-full overflow-hidden bg-ground ${
          portrait ? 'h-[min(72svh,640px)] max-w-[min(100%,360px)]' : 'aspect-video'
        }`}
        style={portrait ? { aspectRatio: `${preset.width} / ${preset.height}` } : undefined}
      >
        {srcDoc && (
        <iframe
          ref={iframeRef}
          title={`MooScript template stage: ${preset.title[locale]}`}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          tabIndex={-1}
          onLoad={() => pushSeek(timeRef.current)}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: preset.width,
            height: preset.height,
            border: 0,
            pointerEvents: 'none',
            transformOrigin: '0 0',
            transform: `translate(${-w / 2}px, ${-h / 2}px) scale(${scale})`
          }}
        />
        )}
      </div>

      <div
        className="mt-4 flex items-center gap-4"
        style={{
          ['--track-on' as string]: onLime ? '#0e1e00' : '#f4f4f6',
          ['--track-off' as string]: onLime ? '#5f9510' : '#34343f',
          ['--thumb' as string]: onLime ? '#0e1e00' : '#84cc16'
        }}
      >
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          aria-pressed={isPlaying}
          className={`btn min-w-[104px] !min-h-[48px] !px-4 ${onLime ? 'btn-dark' : 'btn-ink'}`}
        >
          {isPlaying ? (locale === 'id' ? 'Jeda' : 'Pause') : locale === 'id' ? 'Putar' : 'Play'}
        </button>
        <div className="relative min-w-0 flex-1">
          <span
            className="playhead-fill"
            aria-hidden="true"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
          <input
            type="range"
            className="playhead"
            aria-label="Template timeline scrubber"
            min={0}
            max={totalDuration}
            step={0.02}
            value={currentTime}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setIsPlaying(false);
              timeRef.current = v;
              setCurrentTime(v);
              pushSeek(v);
            }}
          />
        </div>
        <span className="tabular hidden w-[96px] shrink-0 text-right text-[15px] sm:block">
          {currentTime.toFixed(2)}s
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a href={buildStudioUrl(preset.slug)} className={`btn ${onLime ? 'btn-dark' : 'btn-lime'}`}>
          {locale === 'id' ? 'Kustomisasi di MooScript Studio' : 'Customize in MooScript Studio'} &rarr;
        </a>
        <span className="tabular text-[15px] opacity-80">
          {preset.aspectRatio} &middot; {preset.width}x{preset.height} &middot; {preset.fps}fps
        </span>
      </div>
    </div>
  );
}
