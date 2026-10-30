import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SHOWCASE_PRESETS, type MooShowcasePreset } from '@mooscript/presets';
import { buildStudioUrl, type Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';
import { buildPresetStageDoc } from '../../lib/stageDocBuilder';

interface Props {
  locale: Locale;
}

const HERO_SLUGS = ['kinetic-typography', 'data-chart-animation', 'ai-code-walkthrough'];

export default function HeroPlayground({ locale }: Props) {
  const copy = HOME_COPY[locale].playground;
  const presets = useMemo(
    () =>
      HERO_SLUGS.map((slug) => SHOWCASE_PRESETS.find((p) => p.slug === slug)).filter(
        (p): p is MooShowcasePreset => Boolean(p)
      ),
    []
  );

  const [activeSlug, setActiveSlug] = useState<string>(presets[0]?.slug || 'kinetic-typography');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0.45);
  const [mobileView, setMobileView] = useState<'stage' | 'code'>('stage');
  const [pointerCoords, setPointerCoords] = useState<{ x: number; y: number }>({ x: 540, y: 960 });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0.45);

  const activePreset = useMemo(
    () => presets.find((p) => p.slug === activeSlug) || presets[0],
    [presets, activeSlug]
  );

  const totalDuration = useMemo(
    () => activePreset.shots.reduce((sum, s) => sum + s.durationInSeconds, 0) || 3.4,
    [activePreset]
  );

  const srcDoc = useMemo(() => buildPresetStageDoc(activePreset), [activePreset]);

  const pushSeek = (t: number) => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage({ type: 'seek', time: t }, '*');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    timeRef.current = 0.35;
    setCurrentTime(0.35);
    lastTsRef.current = null;
    const id = window.setTimeout(() => pushSeek(0.35), 90);
    return () => window.clearTimeout(id);
  }, [activeSlug]);

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
  }, [isPlaying, totalDuration, activeSlug]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setIsPlaying(false);
    timeRef.current = val;
    setCurrentTime(val);
    pushSeek(val);
  };

  const handleStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setPointerCoords({
      x: Math.round(rx * activePreset.width),
      y: Math.round(ry * activePreset.height)
    });
  };

  const fps = activePreset.fps || 30;
  const frameNumber = String(Math.floor(currentTime * fps)).padStart(3, '0');
  const totalFrames = String(Math.floor(totalDuration * fps)).padStart(3, '0');
  const codeSample = activePreset.shots[0]?.buildJs || '';

  return (
    <div data-ui className="ui-panel w-full overflow-hidden text-[13px] text-[#f4f4f6]">
      {/* Preset Tabs */}
      <div className="ui-row-divider flex flex-wrap items-center justify-between gap-2 bg-[#14141b] px-3 py-2.5">
        <div role="tablist" aria-label="MooScript preset tabs" className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => {
            const selected = preset.slug === activePreset.slug;
            return (
              <button
                key={preset.slug}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setActiveSlug(preset.slug)}
                className={`min-h-[38px] cursor-pointer px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  selected ? 'ui-chip-active' : 'ui-chip text-[#d4d4d8] hover:text-[#f4f4f6]'
                }`}
              >
                {preset.tabLabel[locale]}
              </button>
            );
          })}
        </div>

        {/* Mobile view switch */}
        <div className="flex items-center gap-1 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileView('stage')}
            className={`min-h-[36px] rounded px-2.5 text-[13px] font-medium ${
              mobileView === 'stage' ? 'bg-[#272733] text-[#f4f4f6]' : 'text-[#a1a1aa]'
            }`}
          >
            {copy.stageTab}
          </button>
          <button
            type="button"
            onClick={() => setMobileView('code')}
            className={`min-h-[36px] rounded px-2.5 text-[13px] font-medium ${
              mobileView === 'code' ? 'bg-[#272733] text-[#f4f4f6]' : 'text-[#a1a1aa]'
            }`}
          >
            {copy.codeTab}
          </button>
        </div>

        <code className="hidden text-[12px] text-[#a1a1aa] sm:inline">
          {activePreset.aspectRatio} &middot; {activePreset.width}x{activePreset.height} &middot; 60fps
        </code>
      </div>

      {/* Split Workspace: Code (Left) + Live MooTween Stage (Right) */}
      <div className="grid grid-cols-1 sm:grid-cols-12">
        <div
          className={`bg-[#0b0b0f] p-3.5 sm:col-span-6 sm:block ${
            mobileView === 'code' ? 'block' : 'hidden'
          }`}
        >
          <div className="mb-2 flex items-center justify-between text-[12px] text-[#a1a1aa]">
            <span>{copy.codeTab}</span>
            <code>(shot, root, ctx, MooTween)</code>
          </div>
          <pre className="ui-well max-h-[270px] overflow-auto p-3 text-[12px] leading-[1.55] text-[#e4e4e7]">
            <code>{codeSample}</code>
          </pre>
        </div>

        <div
          onPointerMove={handleStagePointer}
          className={`flex flex-col justify-between bg-[#111116] p-3.5 sm:col-span-6 sm:flex ${
            mobileView === 'stage' ? 'flex' : 'hidden'
          }`}
        >
          <div className="mb-2 flex items-center justify-between text-[12px] text-[#a1a1aa]">
            <span>{copy.stageTab}</span>
            <code>
              {copy.pointerReadout} {pointerCoords.x},{pointerCoords.y}
            </code>
          </div>

          <div className="ui-well relative flex h-[240px] w-full items-center justify-center overflow-hidden bg-[#070709]">
            <iframe
              ref={iframeRef}
              title={`MooScript live stage: ${activePreset.title[locale]}`}
              srcDoc={srcDoc}
              sandbox="allow-scripts"
              onLoad={() => pushSeek(timeRef.current)}
              className="h-full w-full border-0"
            />
          </div>

          <div className="mt-2.5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="ui-chip min-h-[40px] min-w-[68px] cursor-pointer px-3 text-[13px] font-semibold text-[#f4f4f6] transition-colors hover:bg-[#242432]"
            >
              {isPlaying ? copy.pauseLabel : copy.playLabel}
            </button>
            <input
              type="range"
              aria-label="Timeline frame scrubber"
              min={0}
              max={totalDuration}
              step={0.02}
              value={currentTime}
              onChange={handleScrub}
              className="h-9 flex-1 cursor-pointer"
            />
            <code className="text-[12px] text-[#d4d4d8]">
              {frameNumber}/{totalFrames}
            </code>
          </div>
        </div>
      </div>

      {/* Deep-Link Action Footer */}
      <div className="ui-top-divider flex flex-wrap items-center justify-between gap-3 bg-[#14141b] px-3.5 py-2.5">
        <code className="text-[12px] text-[#a1a1aa]">?template={activePreset.slug}</code>
        <a
          href={buildStudioUrl(activePreset.slug)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-md bg-[#84cc16] px-3.5 text-[13px] font-bold text-[#0e1e00] transition-colors hover:bg-[#9be022]"
        >
          {copy.openInStudio} &rarr;
        </a>
      </div>
    </div>
  );
}
