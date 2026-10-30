import { useState } from 'react';
import { getOfficialMooScriptPrompt } from '@mooscript/presets';
import type { Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';

interface Props {
  locale: Locale;
}

const PROMPT_LINES = [
  'ROLE: MooScript Motion Director',
  'ENGINE: HTML/SVG + Scoped CSS + MooTween',
  'RULES:',
  '- Paint the primary subject at t = 0',
  "- Drive camera via ctx.camera({ move: 'push' })",
  '- Sync spoken beats via ctx.wordBeat(sel, word)'
];

function PromptFragment({ locale }: { locale: Locale }) {
  const copy = HOME_COPY[locale].how;
  const [copied, setCopied] = useState(false);
  const copy_ = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(getOfficialMooScriptPrompt(locale));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };
  return (
    <div data-ui className="ui-panel w-full max-w-[470px] p-5 text-[15px] text-ink">
      <div className="flex items-center justify-between gap-3">
        <strong className="font-semibold">System prompt</strong>
        <span className="text-[15px] text-muted">Claude · ChatGPT · Gemini</span>
      </div>
      <pre className="ui-well mt-4 overflow-x-auto p-4 text-[15px] leading-[1.7] text-soft">
        <code>{PROMPT_LINES.join('\n')}</code>
      </pre>
      <button type="button" onClick={copy_} className="btn btn-lime mt-4 w-full !min-h-[48px]">
        {copied ? copy.copiedPrompt : copy.copyPrompt}
      </button>
    </div>
  );
}

function LintFragment() {
  const rows: Array<[string, string, boolean]> = [
    ['Static slide layout', 'rejected', false],
    ['Frame 0 is a full poster', 'pass', true],
    ['Camera travel', 'push 1.08x to 1.00x', true],
    ['Word beats', '6 synced', true],
    ['Editable layers', '7 extracted', true]
  ];
  return (
    <div data-ui className="ui-panel w-full max-w-[470px] p-5 text-[15px] text-ink">
      <div className="flex items-center justify-between gap-3">
        <strong className="font-semibold">Anti-Slide Linter</strong>
        <span className="ui-chip-active px-2.5 py-0.5 text-[15px] font-bold">Score 0 · PASS</span>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map(([name, result, ok]) => (
          <li key={name} className="ui-well flex items-center justify-between gap-3 px-3.5 py-3">
            <span className={ok ? 'text-ink' : 'text-muted line-through'}>{name}</span>
            <span className={`tabular text-[15px] font-semibold ${ok ? 'text-lime' : 'text-[#ff8a7a]'}`}>{result}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BeatFragment() {
  const heights = [34, 58, 26, 72, 40, 84, 30, 62, 44, 78, 28, 66, 38, 90, 32, 70, 46, 80, 30, 60];
  const snaps = new Set([0, 5, 9, 13, 17]);
  return (
    <div data-ui className="ui-panel w-full max-w-[470px] p-5 text-[15px] text-ink">
      <div className="flex items-center justify-between gap-3">
        <strong className="font-semibold">Beat-sync timeline</strong>
        <span className="tabular text-[15px] text-lime">Locked 124 BPM</span>
      </div>
      <div className="ui-well mt-4 p-4">
        <div className="flex h-[96px] items-end gap-[5px]">
          {heights.map((h, i) => (
            <span
              key={i}
              className={`flex-1 ${snaps.has(i) ? 'bg-lime' : 'bg-[#34343f]'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-3 flex h-[34px] gap-[5px]">
          <span className="flex-[5] bg-[#2a3b0f] px-2.5 text-[15px] font-semibold leading-[34px] text-lime">Shot 1</span>
          <span className="flex-[4] bg-lime px-2.5 text-[15px] font-bold leading-[34px] text-on-lime">Shot 2</span>
          <span className="flex-[4] bg-[#2a3b0f] px-2.5 text-[15px] font-semibold leading-[34px] text-lime">Shot 3</span>
        </div>
      </div>
      <p className="mt-3 text-[15px] text-muted">Auto-SFX on · whoosh at 0.00s · impact at 2.50s</p>
    </div>
  );
}

function RenderFragment({ locale }: { locale: Locale }) {
  const formats = HOME_COPY[locale].how.formats;
  const rows: Array<[string, string, number]> = [
    ['9:16', '1080 x 1920', 100],
    ['16:9', '1920 x 1080', 72],
    ['1:1', '1080 x 1080', 31]
  ];
  return (
    <div data-ui className="ui-panel w-full max-w-[470px] p-5 text-[15px] text-ink">
      <div className="flex items-center justify-between gap-3">
        <strong className="font-semibold">WebCodecs export queue</strong>
        <span className="text-[15px] text-muted">GPU · local</span>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map(([ratio, size, pct]) => (
          <li key={ratio} className="ui-well px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{ratio}</span>
              <span className="tabular text-[15px] text-muted">{size}</span>
              <span className="tabular text-[15px] text-lime">{pct === 100 ? 'Done' : `${pct}%`}</span>
            </div>
            <div className="mt-2.5 h-[6px] bg-[#2a2a35]">
              <div className="h-full bg-lime" style={{ width: `${pct}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {formats.map((f) => (
          <span key={f} className="ui-chip px-2.5 py-1 text-[15px]">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HowSlider({ locale }: Props) {
  const copy = HOME_COPY[locale].how;
  const [stage, setStage] = useState(0);
  const last = copy.steps.length - 1;
  const step = copy.steps[stage];

  return (
    <div className="grid min-h-[min(88svh,860px)] grid-cols-1 lg:grid-cols-2">
      <div className="field-paper order-2 flex flex-col justify-between gap-10 px-[var(--page-x)] pb-10 pt-12 lg:order-1 lg:pb-12 lg:pt-16 lg:pl-[max(var(--page-x),calc((100vw-1480px)/2+var(--page-x)))]">
        <div>
          <h2 className="t-title max-w-[11em]">{copy.heading}</h2>
          <div key={stage} className="mt-8 max-w-[34ch] animate-[rise_320ms_var(--ease-out-expo)_both]">
            <p className="t-sub">
              {step.clause}
            </p>
            <p className="mt-4 text-[17px] leading-[1.55]">{step.note}</p>
          </div>
        </div>

        <div>
          <div className="relative" style={{ ['--track-on' as string]: '#0d0f0a', ['--track-off' as string]: '#c3c9b8' }}>
            <span
              className="playhead-fill"
              aria-hidden="true"
              style={{ width: `${(stage / last) * 100}%` }}
            />
            <input
              type="range"
              className="playhead"
              aria-label={copy.sliderLabel}
              aria-valuetext={step.name}
              min={0}
              max={last}
              step={1}
              value={stage}
              onChange={(e) => setStage(parseInt(e.target.value, 10))}
              style={{ ['--thumb' as string]: '#0d0f0a' }}
            />
          </div>
          <div className="mt-3 grid grid-cols-4 text-[17px] font-semibold">
            {copy.steps.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setStage(i)}
                aria-current={i === stage}
                className={`min-h-[44px] cursor-pointer whitespace-nowrap text-left transition-opacity ${
                  i === stage ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                } ${i === last ? 'text-right' : i > 0 ? 'text-center' : ''}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field-ground order-1 flex min-h-[46svh] items-center justify-center px-[var(--page-x)] py-12 lg:order-2">
        <div key={stage} className="w-full max-w-[470px] animate-[rise_320ms_var(--ease-out-expo)_both]">
          {stage === 0 && <PromptFragment locale={locale} />}
          {stage === 1 && <LintFragment />}
          {stage === 2 && <BeatFragment />}
          {stage === 3 && <RenderFragment locale={locale} />}
        </div>
      </div>
    </div>
  );
}
