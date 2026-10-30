import React, { useRef } from 'react';
import type { CustomFont, LayerOverride } from '../../types';

const BUILTIN_FAMILIES = [
  { family: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { family: 'Syne', label: 'Syne Display' },
  { family: 'JetBrains Mono', label: 'JetBrains Mono' }
];

const WEIGHTS = [
  { value: 400, label: 'Reguler' },
  { value: 700, label: 'Tebal' },
  { value: 800, label: 'Ekstra' }
];

const CASES: { value: NonNullable<LayerOverride['textTransform']>; label: string; title: string }[] = [
  { value: 'none', label: 'Aa', title: 'Seperti ditulis' },
  { value: 'uppercase', label: 'AA', title: 'Huruf besar semua' },
  { value: 'lowercase', label: 'aa', title: 'Huruf kecil semua' }
];

interface TypographyControlsProps {
  override: LayerOverride;
  customFonts: CustomFont[];
  onChange: (patch: Partial<LayerOverride>) => void;
  onUploadFont: (file: File) => Promise<string | null>;
}

const segBtn = (selected: boolean) =>
  `flex-1 py-0.5 rounded text-[10px] font-medium transition-all ${
    selected ? 'bg-surface-3 text-accent font-bold shadow-xs' : 'text-text-muted hover:text-on-surface'
  }`;

/** Typeface, weight, tracking, leading and case for a text layer. */
export const TypographyControls: React.FC<TypographyControlsProps> = ({ override, customFonts, onChange, onUploadFont }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const tracking = override.letterSpacing ?? 0;
  const leading = override.lineHeight ?? 1.1;

  return (
    <div className="space-y-2 pt-1 border-t border-border/50">
      <div className="flex items-center gap-1.5">
        <select
          value={override.fontFamily || ''}
          onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
          aria-label="Jenis huruf"
          className="flex-1 min-w-0 h-7 px-1.5 rounded-lg bg-surface-1 border border-border text-[11px] text-on-surface focus:outline-none focus:border-accent"
        >
          <option value="">Huruf bawaan adegan</option>
          {BUILTIN_FAMILIES.map((f) => (
            <option key={f.family} value={f.family}>
              {f.label}
            </option>
          ))}
          {customFonts.length > 0 && (
            <optgroup label="Font unggahan">
              {customFonts.map((f) => (
                <option key={f.id} value={f.family}>
                  {f.family}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          title="Unggah font (.woff2, .woff, .ttf, .otf, maks 2 MB)"
          className="h-7 px-2 rounded-lg bg-surface-1 border border-border text-[10px] font-semibold text-text-muted hover:text-accent flex items-center gap-1 shrink-0"
        >
          <span className="material-symbols-outlined text-[14px]">upload</span>
          Font
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".woff2,.woff,.ttf,.otf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const family = await onUploadFont(file);
            if (family) onChange({ fontFamily: family });
          }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex flex-1 items-center gap-0.5 bg-surface-1 p-0.5 rounded-lg border border-border" role="group" aria-label="Ketebalan huruf">
          {WEIGHTS.map((w) => (
            <button
              key={w.value}
              type="button"
              aria-pressed={override.fontWeight === w.value}
              onClick={() => onChange({ fontWeight: override.fontWeight === w.value ? undefined : w.value })}
              className={segBtn(override.fontWeight === w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 bg-surface-1 p-0.5 rounded-lg border border-border" role="group" aria-label="Huruf besar kecil">
          {CASES.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.title}
              aria-pressed={(override.textTransform || 'none') === c.value}
              onClick={() => onChange({ textTransform: c.value === 'none' ? undefined : c.value })}
              className={`${segBtn((override.textTransform || 'none') === c.value)} px-1.5 font-mono`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="flex items-center justify-between text-[10px] font-mono text-text-muted">
          <span>Jarak huruf</span>
          <span className="text-accent">{tracking.toFixed(2)} em</span>
        </span>
        <input
          type="range"
          min={-0.1}
          max={0.4}
          step={0.01}
          value={tracking}
          onChange={(e) => onChange({ letterSpacing: parseFloat(e.target.value) })}
          className="w-full accent-accent h-1 cursor-pointer"
        />
      </label>

      <label className="block space-y-1">
        <span className="flex items-center justify-between text-[10px] font-mono text-text-muted">
          <span>Jarak baris</span>
          <span className="text-accent">{leading.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0.7}
          max={2}
          step={0.05}
          value={leading}
          onChange={(e) => onChange({ lineHeight: parseFloat(e.target.value) })}
          className="w-full accent-accent h-1 cursor-pointer"
        />
      </label>
    </div>
  );
};
