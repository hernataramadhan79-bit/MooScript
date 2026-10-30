import { useEffect, useMemo, useRef, useState } from 'react';
import { SHOWCASE_PRESETS, type MooShowcasePreset } from '@mooscript/presets';
import { buildStudioUrl, localizePath, type Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';
import { buildPresetStageDoc } from '../../lib/stageDocBuilder';

interface Props {
  locale: Locale;
}

export default function PresetShowcase({ locale }: Props) {
  const copy = HOME_COPY[locale].showcase;
  const [selectedSlug, setSelectedSlug] = useState<string>(SHOWCASE_PRESETS[0]?.slug || 'kinetic-typography');
  const [brollEnabled, setBrollEnabled] = useState<boolean>(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0.25);

  const activePreset: MooShowcasePreset = useMemo(
    () => SHOWCASE_PRESETS.find((p) => p.slug === selectedSlug) || SHOWCASE_PRESETS[0],
    [selectedSlug]
  );

  const totalDuration = useMemo(
    () => activePreset.shots.reduce((sum, s) => sum + s.durationInSeconds, 0) || 3.4,
    [activePreset]
  );

  const srcDoc = useMemo(
    () => buildPresetStageDoc(activePreset, { clearBackgrounds: brollEnabled }),
    [activePreset, brollEnabled]
  );

  useEffect(() => {
    timeRef.current = 0.25;
    lastTsRef.current = null;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
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
      iframeRef.current?.contentWindow?.postMessage({ type: 'seek', time: next }, '*');
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [activePreset, brollEnabled, totalDuration]);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
      {/* Output Index (Columns 1-5) */}
      <div className="lg:col-span-5">
        <h2 className="text-[28px] font-bold text-[#f4f4f6] md:text-[32px]">{copy.heading}</h2>
        <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-[#d4d4d8]">{copy.lead}</p>

        <div className="mt-8 flex flex-col gap-2">
          {SHOWCASE_PRESETS.map((preset) => {
            const active = preset.slug === activePreset.slug;
            return (
              <button
                key={preset.slug}
                type="button"
                onClick={() => setSelectedSlug(preset.slug)}
                className={`flex min-h-[52px] cursor-pointer items-baseline justify-between rounded-lg px-4 py-3 text-left transition-colors ${
                  active ? 'bg-[#181820] text-[#f4f4f6]' : 'bg-transparent text-[#a1a1aa] hover:bg-[#111116] hover:text-[#f4f4f6]'
                }`}
              >
                <span className="text-[20px] font-bold tracking-tight md:text-[24px]">
                  {preset.title[locale]}
                </span>
                <code className="ml-3 shrink-0 text-[13px] text-[#84cc16]">{preset.aspectRatio}</code>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setBrollEnabled((v) => !v)}
            className={`min-h-[44px] cursor-pointer rounded-md px-4 text-[15px] font-semibold transition-colors ${
              brollEnabled ? 'bg-[#84cc16] text-[#0e1e00]' : 'bg-[#181820] text-[#f4f4f6] hover:bg-[#22222d]'
            }`}
          >
            {brollEnabled ? copy.brollToggleOn : copy.brollToggleOff}
          </button>

          <a
            href={localizePath(`/templates/${activePreset.slug}`, locale)}
            className="inline-flex min-h-[44px] items-center rounded-md bg-[#181820] px-4 text-[15px] font-semibold text-[#f4f4f6] transition-colors hover:bg-[#22222d]"
          >
            {copy.viewBreakdown}
          </a>
        </div>
      </div>

      {/* Live Sheet Stage (Columns 6-12) */}
      <div className="lg:col-span-7">
        <div data-ui className="ui-panel overflow-hidden bg-[#111116] p-4 md:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#84cc16]" />
              <strong className="font-semibold text-[#f4f4f6]">{activePreset.title[locale]}</strong>
            </div>
            <code className="text-[12px] text-[#a1a1aa]">
              {activePreset.width}x{activePreset.height} &middot; {brollEnabled ? 'VP9 Alpha + B-Roll' : 'MooTween SVG'}
            </code>
          </div>

          <div className="ui-well relative flex h-[390px] w-full items-center justify-center overflow-hidden bg-[#070709] md:h-[440px]">
            <video
              data-ambient-video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/media/stars-rise-over-la-silla-poster.jpg"
              width={854}
              height={480}
              aria-hidden="true"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                brollEnabled ? 'opacity-55' : 'opacity-0 pointer-events-none'
              }`}
            >
              <source src="/media/stars-rise-over-la-silla.webm" type="video/webm" />
            </video>

            <iframe
              ref={iframeRef}
              title={`Preset preview: ${activePreset.title[locale]}`}
              srcDoc={srcDoc}
              sandbox="allow-scripts"
              className="relative z-10 h-full w-full border-0 bg-transparent"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[44ch] text-[14px] text-[#a1a1aa]">{activePreset.summary[locale]}</p>
            <a
              href={buildStudioUrl(activePreset.slug)}
              className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-md bg-[#84cc16] px-4 text-[14px] font-bold text-[#0e1e00] transition-colors hover:bg-[#9be022]"
            >
              {copy.openPreset} &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
