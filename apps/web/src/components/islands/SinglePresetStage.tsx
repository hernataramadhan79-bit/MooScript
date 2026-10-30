import { useEffect, useMemo, useRef, useState } from 'react';
import { getShowcasePreset, SHOWCASE_PRESETS } from '@mooscript/presets';
import { buildStudioUrl, type Locale } from '../../config/site';
import { buildPresetStageDoc } from '../../lib/stageDocBuilder';

interface Props {
  slug: string;
  locale: Locale;
}

export default function SinglePresetStage({ slug, locale }: Props) {
  const preset = useMemo(() => getShowcasePreset(slug) || SHOWCASE_PRESETS[0], [slug]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0.35);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0.35);

  const totalDuration = useMemo(
    () => preset.shots.reduce((sum, s) => sum + s.durationInSeconds, 0) || 3.4,
    [preset]
  );

  const srcDoc = useMemo(() => buildPresetStageDoc(preset), [preset]);

  const pushSeek = (t: number) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'seek', time: t }, '*');
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setIsPlaying(false);
    }
  }, []);

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

  return (
    <div data-ui className="ui-panel overflow-hidden bg-[#111116] p-4 text-[13px] text-[#f4f4f6]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <strong className="font-semibold text-[#f4f4f6]">{preset.title[locale]}</strong>
        <code className="text-[12px] text-[#a1a1aa]">
          {preset.aspectRatio} &middot; {preset.width}x{preset.height}
        </code>
      </div>

      <div className="ui-well relative flex h-[340px] w-full items-center justify-center overflow-hidden bg-[#070709] sm:h-[400px]">
        <iframe
          ref={iframeRef}
          title={`MooScript template stage: ${preset.title[locale]}`}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          onLoad={() => pushSeek(timeRef.current)}
          className="h-full w-full border-0"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          className="ui-chip min-h-[40px] min-w-[72px] cursor-pointer px-3 font-semibold text-[#f4f4f6]"
        >
          {isPlaying ? (locale === 'id' ? 'Jeda' : 'Pause') : locale === 'id' ? 'Putar' : 'Play'}
        </button>

        <input
          type="range"
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
          className="h-9 flex-1 cursor-pointer"
        />

        <a
          href={buildStudioUrl(preset.slug)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-md bg-[#84cc16] px-4 text-[13px] font-bold text-[#0e1e00] transition-colors hover:bg-[#9be022]"
        >
          {locale === 'id' ? 'Kustomisasi di MooScript Studio' : 'Customize in MooScript Studio'} &rarr;
        </a>
      </div>
    </div>
  );
}
