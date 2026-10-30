import { useState } from 'react';
import type { Locale } from '../../config/site';
import { HOME_COPY } from '../../data/homeCopy';

interface Props {
  locale: Locale;
}

export default function EngineInspectorPlate({ locale }: Props) {
  const copy = HOME_COPY[locale].enginePlate;
  const [focusedModule, setFocusedModule] = useState<string | null>(null);
  const [codec, setCodec] = useState<'mp4' | 'webm' | 'gif'>('mp4');
  const [ratios, setRatios] = useState<Record<string, boolean>>({
    '9:16': true,
    '16:9': true,
    '1:1': false
  });
  const [autoSfx, setAutoSfx] = useState<boolean>(true);
  const [beatSnap, setBeatSnap] = useState<boolean>(true);

  const leftNotes = copy.notes.filter((n) => n.side === 'left');
  const rightNotes = copy.notes.filter((n) => n.side === 'right');

  const toggleRatio = (r: string) => {
    setRatios((prev) => ({ ...prev, [r]: !prev[r] }));
  };

  const moduleOpacity = (id: string) => {
    if (!focusedModule || focusedModule === id) return 'opacity-100';
    return 'opacity-35';
  };

  return (
    <div>
      <div className="mb-12 max-w-[60ch]">
        <h2 className="text-[28px] font-bold text-[#f4f4f6] md:text-[32px]">{copy.heading}</h2>
        <p className="mt-3 text-[17px] leading-[1.6] text-[#d4d4d8]">{copy.lead}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Margin Notes */}
        <div className="flex flex-col gap-7 lg:col-span-4 lg:items-end lg:text-right">
          {leftNotes.map((note) => {
            const active = focusedModule === note.id;
            return (
              <button
                key={note.id}
                type="button"
                onMouseEnter={() => setFocusedModule(note.id)}
                onMouseLeave={() => setFocusedModule(null)}
                onFocus={() => setFocusedModule(note.id)}
                onBlur={() => setFocusedModule(null)}
                onClick={() => setFocusedModule(active ? null : note.id)}
                className="max-w-[30ch] cursor-pointer rounded-lg p-2 text-left transition-colors hover:bg-[#111116] lg:text-right"
              >
                <div className={`text-[20px] font-bold ${active ? 'text-[#84cc16]' : 'text-[#f4f4f6]'}`}>
                  {note.title}
                </div>
                <p className="mt-1 text-[15px] leading-[1.5] text-[#a1a1aa]">{note.body}</p>
              </button>
            );
          })}
        </div>

        {/* True-Size Studio Inspector & Export Rack */}
        <div className="flex justify-center lg:col-span-4">
          <div data-ui className="ui-panel w-full max-w-[390px] bg-[#111116] p-4 text-[13px] text-[#f4f4f6]">
            {/* 1. MooTween Engine Module */}
            <div className={`ui-well mb-2.5 p-3 transition-opacity ${moduleOpacity('mootween')}`}>
              <div className="flex items-center justify-between">
                <strong className="font-semibold text-[#f4f4f6]">MooTween Seek Clock</strong>
                <code className="text-[12px] text-[#84cc16]">GSAP-Free</code>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-[#a1a1aa]">
                <code>seek(t = 1.400s)</code>
                <code>spring(1.1, 0.72)</code>
              </div>
            </div>

            {/* 2. WebCodecs Format Selector */}
            <div className={`ui-well mb-2.5 p-3 transition-opacity ${moduleOpacity('codecs')}`}>
              <div className="mb-2 flex items-center justify-between">
                <strong className="font-semibold text-[#f4f4f6]">WebCodecs Output</strong>
                <code className="text-[12px] text-[#a1a1aa]">GPU Hardware</code>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['mp4', 'MP4 H.264'],
                    ['webm', 'WebM Alpha'],
                    ['gif', 'GIF LZW']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCodec(key)}
                    className={`min-h-[36px] cursor-pointer px-2 text-[12px] font-semibold transition-colors ${
                      codec === key ? 'ui-chip-active' : 'ui-chip text-[#d4d4d8]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Multi-Format Export Queue */}
            <div className={`ui-well mb-2.5 p-3 transition-opacity ${moduleOpacity('queue')}`}>
              <div className="mb-2 flex items-center justify-between">
                <strong className="font-semibold text-[#f4f4f6]">Multi-Format Queue</strong>
                <code className="text-[12px] text-[#84cc16]">+ Cover PNG</code>
              </div>
              <div className="flex items-center gap-2">
                {['9:16', '16:9', '1:1'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRatio(r)}
                    className={`min-h-[36px] flex-1 cursor-pointer text-[12px] font-semibold transition-colors ${
                      ratios[r] ? 'ui-chip-active' : 'ui-chip text-[#a1a1aa]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. B-Roll & Brand Kit */}
            <div className={`ui-well mb-2.5 p-3 transition-opacity ${moduleOpacity('broll')}`}>
              <div className="flex items-center justify-between">
                <strong className="font-semibold text-[#f4f4f6]">B-Roll &amp; Brand Kit</strong>
                <code className="text-[12px] text-[#a1a1aa]">148 / 300 MB</code>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px] text-[#d4d4d8]">
                <code>la-silla-night.webm</code>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#84cc16]" />
                  <span>Intro + Watermark</span>
                </span>
              </div>
            </div>

            {/* 5. Audio Rack */}
            <div className={`ui-well mb-2.5 p-3 transition-opacity ${moduleOpacity('audio')}`}>
              <div className="mb-2 flex items-center justify-between">
                <strong className="font-semibold text-[#f4f4f6]">Voice, SFX &amp; Beat Grid</strong>
                <code className="text-[12px] text-[#84cc16]">Piper ONNX</code>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoSfx((v) => !v)}
                  className={`min-h-[34px] flex-1 cursor-pointer px-2 text-[12px] font-medium transition-colors ${
                    autoSfx ? 'ui-chip-active' : 'ui-chip text-[#a1a1aa]'
                  }`}
                >
                  Auto-SFX {autoSfx ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setBeatSnap((v) => !v)}
                  className={`min-h-[34px] flex-1 cursor-pointer px-2 text-[12px] font-medium transition-colors ${
                    beatSnap ? 'ui-chip-active' : 'ui-chip text-[#a1a1aa]'
                  }`}
                >
                  Snap 124 BPM
                </button>
              </div>
            </div>

            {/* 6. Local Privacy Meter */}
            <div className={`ui-well p-3 transition-opacity ${moduleOpacity('privacy')}`}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-[#f4f4f6]">IndexedDB Vault</span>
                <code className="text-[#84cc16]">0 KB Cloud Upload</code>
              </div>
            </div>
          </div>
        </div>

        {/* Right Margin Notes */}
        <div className="flex flex-col gap-7 lg:col-span-4 lg:items-start">
          {rightNotes.map((note) => {
            const active = focusedModule === note.id;
            return (
              <button
                key={note.id}
                type="button"
                onMouseEnter={() => setFocusedModule(note.id)}
                onMouseLeave={() => setFocusedModule(null)}
                onFocus={() => setFocusedModule(note.id)}
                onBlur={() => setFocusedModule(null)}
                onClick={() => setFocusedModule(active ? null : note.id)}
                className="max-w-[30ch] cursor-pointer rounded-lg p-2 text-left transition-colors hover:bg-[#111116]"
              >
                <div className={`text-[20px] font-bold ${active ? 'text-[#84cc16]' : 'text-[#f4f4f6]'}`}>
                  {note.title}
                </div>
                <p className="mt-1 text-[15px] leading-[1.5] text-[#a1a1aa]">{note.body}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
