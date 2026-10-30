import React, { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMooStore } from '../../store/useMooStore';
import { DEFAULT_BRAND_KIT } from '../../engine/brand/brandKit';
import type { BrandKit, CustomFont, WatermarkPosition } from '../../types';

const MAX_LOGO_BYTES = 1024 * 1024;
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const FONT_FORMATS: Record<string, CustomFont['format']> = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: '↖' },
  { id: 'top-right', label: '↗' },
  { id: 'bottom-left', label: '↙' },
  { id: 'bottom-right', label: '↘' }
];

const PALETTE_KEYS: { key: keyof BrandKit['palette']; label: string }[] = [
  { key: 'bg', label: 'Latar' },
  { key: 'primary', label: 'Utama' },
  { key: 'accent', label: 'Aksen' },
  { key: 'text', label: 'Teks' }
];

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const label = 'text-[10px] font-bold text-text-muted uppercase tracking-wider';
const smallBtn =
  'h-8 px-2.5 rounded-lg bg-surface-1 border border-border text-[11px] font-semibold text-text-muted hover:text-accent hover:border-accent/40 flex items-center gap-1 transition-colors';

/**
 * The creator's brand, kept for every project: name, palette, logo, typeface, watermark and the
 * intro / outro cards. "Terapkan" copies it into the open project.
 */
export const BrandKitPanel: React.FC = () => {
  const { kit, updateSettings, projectBrand, applyBrandToProject, removeBrandFromProject, addToast } = useMooStore(
    useShallow((s) => ({
      kit: s.settings.brandKit,
      updateSettings: s.updateSettings,
      projectBrand: s.project.brand,
      applyBrandToProject: s.applyBrandToProject,
      removeBrandFromProject: s.removeBrandFromProject,
      addToast: s.addToast
    }))
  );
  const brand = kit || DEFAULT_BRAND_KIT;
  const logoRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  const save = (patch: Partial<BrandKit>) => updateSettings({ brandKit: { ...brand, ...patch } });

  const pickLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) return addToast('Logo harus berupa gambar (PNG, SVG, WebP, JPG).', 'error');
    if (file.size > MAX_LOGO_BYTES) return addToast('Ukuran logo melebihi 1 MB.', 'error');
    save({ logoDataUrl: await readDataUrl(file) });
  };

  const pickFont = async (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const format = FONT_FORMATS[ext];
    if (!format) return addToast('Format font belum didukung. Pakai .woff2, .woff, .ttf atau .otf.', 'error');
    if (file.size > MAX_FONT_BYTES) return addToast('Ukuran font melebihi 2 MB.', 'error');
    const base64 = (await readDataUrl(file)).split(',')[1] || '';
    const family = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Brand';
    save({ font: { id: 'brand-font', family, format, dataUrl: `data:font/${ext};base64,${base64}` } });
  };

  return (
    <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
          <span aria-hidden="true" className="material-symbols-outlined text-[17px] text-accent">verified</span>
          Brand Kit
        </span>
        {projectBrand && (
          <span className="text-[10px] font-mono text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25">
            Terpasang
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className={label}>Nama brand</span>
        <input
          type="text"
          value={brand.name}
          maxLength={60}
          onChange={(e) => save({ name: e.target.value })}
          placeholder="Misal: Kamu Tahu?"
          className="h-9 px-2.5 rounded-lg bg-surface-1 border border-border focus:border-accent text-[12px] text-on-surface focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Warna</span>
        <div className="grid grid-cols-4 gap-1.5">
          {PALETTE_KEYS.map(({ key, label: name }) => (
            <label key={key} className="flex flex-col items-center gap-1 text-[10px] text-text-muted">
              <input
                type="color"
                value={brand.palette[key]}
                onChange={(e) => save({ palette: { ...brand.palette, [key]: e.target.value } })}
                aria-label={`Warna ${name}`}
                className="w-full h-8 rounded-lg bg-transparent border border-border cursor-pointer p-0"
              />
              {name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => logoRef.current?.click()} className={smallBtn}>
          {brand.logoDataUrl ? (
            <img src={brand.logoDataUrl} alt="" className="h-5 w-auto max-w-[40px] object-contain" />
          ) : (
            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">image</span>
          )}
          {brand.logoDataUrl ? 'Ganti logo' : 'Unggah logo'}
        </button>
        {brand.logoDataUrl && (
          <button type="button" onClick={() => save({ logoDataUrl: undefined })} className={smallBtn} aria-label="Hapus logo">
            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        )}
        <button type="button" onClick={() => fontRef.current?.click()} className={smallBtn}>
          <span aria-hidden="true" className="material-symbols-outlined text-[15px]">font_download</span>
          {brand.font ? brand.font.family : 'Font brand'}
        </button>
        {brand.font && (
          <button type="button" onClick={() => save({ font: undefined })} className={smallBtn} aria-label="Hapus font brand">
            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">close</span>
          </button>
        )}
        <input
          ref={logoRef}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) pickLogo(f);
          }}
        />
        <input
          ref={fontRef}
          type="file"
          accept=".woff2,.woff,.ttf,.otf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) pickFont(f);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
        <label className="flex items-center justify-between text-[11px] text-on-surface">
          <span>Watermark logo</span>
          <input
            type="checkbox"
            checked={brand.watermark.enabled}
            onChange={(e) => save({ watermark: { ...brand.watermark, enabled: e.target.checked } })}
            className="w-4 h-4 accent-accent"
          />
        </label>
        {brand.watermark.enabled && (
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-1 border border-border" role="group" aria-label="Posisi watermark">
              {POSITIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={brand.watermark.position === p.id}
                  onClick={() => save({ watermark: { ...brand.watermark, position: p.id } })}
                  className={`w-7 h-7 rounded text-[13px] ${
                    brand.watermark.position === p.id ? 'bg-surface-3 text-accent font-bold' : 'text-text-muted hover:text-on-surface'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="flex-1 flex flex-col gap-0.5 text-[10px] text-text-muted">
              Ukuran {brand.watermark.size}%
              <input
                type="range"
                min={6}
                max={30}
                step={1}
                value={brand.watermark.size}
                onChange={(e) => save({ watermark: { ...brand.watermark, size: parseInt(e.target.value, 10) } })}
                className="w-full accent-accent h-1"
              />
            </label>
          </div>
        )}
        <label className="flex items-center justify-between text-[11px] text-on-surface">
          <span>Kartu pembuka (logo + nama)</span>
          <input type="checkbox" checked={brand.intro} onChange={(e) => save({ intro: e.target.checked })} className="w-4 h-4 accent-accent" />
        </label>
        <label className="flex items-center justify-between text-[11px] text-on-surface">
          <span>Kartu penutup</span>
          <input
            type="checkbox"
            checked={brand.outro.enabled}
            onChange={(e) => save({ outro: { ...brand.outro, enabled: e.target.checked } })}
            className="w-4 h-4 accent-accent"
          />
        </label>
        {brand.outro.enabled && (
          <input
            type="text"
            value={brand.outro.text}
            maxLength={80}
            onChange={(e) => save({ outro: { ...brand.outro, text: e.target.value } })}
            placeholder="Ajakan di akhir video"
            aria-label="Teks kartu penutup"
            className="h-8 px-2.5 rounded-lg bg-surface-1 border border-border focus:border-accent text-[12px] text-on-surface focus:outline-none"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={applyBrandToProject}
          className="min-h-[40px] px-3 rounded-xl bg-accent text-on-accent text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-accent-hover active:scale-[0.98]"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">brush</span>
          {projectBrand ? 'Terapkan ulang' : 'Terapkan ke proyek'}
        </button>
        <button
          type="button"
          onClick={removeBrandFromProject}
          disabled={!projectBrand}
          className="min-h-[40px] px-3 rounded-xl bg-surface-1 border border-border text-text-muted text-[12px] font-medium hover:text-rose-300 disabled:opacity-40"
        >
          Lepas dari proyek
        </button>
      </div>
      <p className="text-[10px] text-text-faint leading-snug">
        Brand Kit tersimpan untuk semua proyek. Warnanya juga dipakai AI saat menyusun storyboard baru.
      </p>
    </div>
  );
};
