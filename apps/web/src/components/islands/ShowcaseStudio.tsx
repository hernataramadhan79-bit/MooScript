import { useMemo, useState } from 'react';
import { SHOWCASE_PRESETS } from '@mooscript/presets';
import { buildStudioUrl, localizePath, type Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';
import LiveStage from './LiveStage';

interface Props {
  locale: Locale;
}

export default function ShowcaseStudio({ locale }: Props) {
  const copy = HOME_COPY[locale].showcase;
  const [slug, setSlug] = useState<string>(SHOWCASE_PRESETS[0].slug);
  const [broll, setBroll] = useState(true);

  const preset = useMemo(() => SHOWCASE_PRESETS.find((p) => p.slug === slug) || SHOWCASE_PRESETS[0], [slug]);
  const portrait = preset.height > preset.width;

  return (
    <div>
      <h2 className="t-title max-w-[20ch]">{copy.heading}</h2>
      <div className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-5">
        <p className="t-lead max-w-[40ch]">{copy.lead}</p>

        <ul className="mt-10 flex flex-col" role="tablist" aria-label={copy.heading}>
          {SHOWCASE_PRESETS.map((p) => {
            const selected = p.slug === slug;
            return (
              <li key={p.slug}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSlug(p.slug)}
                  className={`t-sub group flex min-h-[64px] w-full cursor-pointer items-baseline justify-between gap-4 py-2.5 text-left transition-[opacity,transform] duration-200 ${
                    selected ? 'opacity-100 lg:translate-x-3' : 'opacity-60 hover:translate-x-1.5 hover:opacity-100'
                  }`}
                >
                  <span>{p.title[locale]}</span>
                  <span className="tabular shrink-0 font-sans text-[15px] font-bold">{p.aspectRatio}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="lg:col-span-7">
        <div className="flex h-[min(76svh,720px)] min-h-[420px] w-full items-center justify-center bg-ground p-4 sm:p-6">
          <div
            key={`${slug}-${broll}`}
            className="relative overflow-hidden bg-ground"
            style={{
              aspectRatio: `${preset.width} / ${preset.height}`,
              height: portrait ? '100%' : 'auto',
              width: portrait ? 'auto' : '100%',
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          >
            {broll && (
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/media/stars-rise-over-la-silla-poster.jpg"
                aria-hidden="true"
                data-ambient-video
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src="/media/stars-rise-over-la-silla.webm" type="video/webm" />
              </video>
            )}
            <LiveStage
              slug={slug}
              clear={broll}
              fit="contain"
              title={`${copy.stageLabel}: ${preset.title[locale]}`}
              className="absolute inset-0"
            />
          </div>
        </div>

        <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.55]">{preset.summary[locale]}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={buildStudioUrl(preset.slug)} className="btn btn-dark">
            {copy.openPreset} &rarr;
          </a>
          <button
            type="button"
            aria-pressed={broll}
            onClick={() => setBroll((v) => !v)}
            className="btn bg-on-lime/15 text-on-lime hover:bg-on-lime/25"
          >
            {broll ? copy.brollOn : copy.brollOff}
          </button>
          <a
            href={localizePath(`/templates/${preset.slug}`, locale)}
            className="inline-flex min-h-[52px] items-center text-[17px] font-bold underline decoration-2 underline-offset-4"
          >
            {copy.viewBreakdown}
          </a>
        </div>
      </div>
      </div>
    </div>
  );
}
