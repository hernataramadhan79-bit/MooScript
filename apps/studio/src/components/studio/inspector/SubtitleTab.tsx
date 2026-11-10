import React from 'react';
import { useMooStore } from '../../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import type {
  CaptionPosition,
  CaptionStyle
} from '../../../types';
import { t } from '../../../i18n';

export const SubtitleTab: React.FC = () => {
  const {
    project,
    updateThemeCaptionPosition,
    updateThemeCaptionStyle,
    updateSubtitleCustomization,
    toggleGlobalSubtitles
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      updateThemeCaptionPosition: s.updateThemeCaptionPosition,
      updateThemeCaptionStyle: s.updateThemeCaptionStyle,
      updateSubtitleCustomization: s.updateSubtitleCustomization,
      toggleGlobalSubtitles: s.toggleGlobalSubtitles
    }))
  );

  // Text position options
  const currentPosition = project.theme?.captionPosition || 'bottom';
  const positionOptions: { value: CaptionPosition; label: string }[] = [
    { value: 'top', label: t('Atas') },
    { value: 'center', label: t('Tengah') },
    { value: 'bottom', label: t('Bawah') }
  ];

  // Text style options
  const currentStyle = project.theme?.captionStyle || 'boxed';
  const styleOptions: { value: CaptionStyle; label: string }[] = [
    { value: 'boxed', label: t('Kotak (Klasik)') },
    { value: 'karaoke', label: t('Highlight (Neon)') },
    { value: 'bold-pop', label: t('Bold Pop (Viral)') },
    { value: 'minimal', label: t('Minimalis') },
    { value: 'outline', label: t('Kontras Outline') }
  ];

  const subCust = project.theme?.subtitleCustomization || {};
  const activeHighlightColor = subCust.activeColor || project.theme?.textHighlight || '#84cc16';

  return (
    <>
          <div className="flex flex-col gap-5">
            {/* ================= PENGATURAN SUBTITEL VIDEO ================= */}
            <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border flex flex-col gap-3">
              {/* Header & Toggle Utama */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-accent">subtitles</span>
                  {t('Pengaturan Subtitel Video')}
                </span>
                <button
                  type="button"
                  onClick={toggleGlobalSubtitles}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border flex items-center gap-1.5 transition-all select-none ${
                    project.theme.showSubtitles
                      ? 'bg-accent/15 border-accent text-accent font-semibold'
                      : 'bg-surface-1 border-border text-text-muted hover:text-on-surface'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      project.theme.showSubtitles ? 'bg-accent' : 'bg-zinc-600'
                    }`}
                  />
                  <span>{project.theme.showSubtitles ? t('Aktif') : t('Nonaktif')}</span>
                </button>
              </div>

              {/* Panel Kustomisasi Subtitel Terpadu */}
              {project.theme.showSubtitles && (
                <div className="flex flex-col gap-3.5 pt-1">
                  {/* 1. Live Subtitle Preview */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {t('Pratinjau Langsung')}
                    </span>
                    <div className="w-full h-16 rounded-xl bg-black/90 border border-border flex items-center justify-center p-2 overflow-hidden relative shadow-inner">
                      <div
                        className={`text-center font-bold transition-all ${
                          subCust.uppercase ? 'uppercase' : ''
                        }`}
                        style={{
                          fontSize: `${Math.round(14 * (subCust.fontScale || 1.0))}px`,
                          padding: currentStyle === 'boxed' ? '4px 12px' : '0',
                          borderRadius: currentStyle === 'boxed' ? '8px' : '0',
                          backgroundColor:
                            currentStyle === 'boxed'
                              ? `rgba(9, 9, 11, ${subCust.bgOpacity !== undefined ? subCust.bgOpacity : 0.65})`
                              : 'transparent',
                          textShadow:
                            currentStyle === 'outline'
                              ? '0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000'
                              : currentStyle === 'karaoke'
                                ? `0 0 12px ${activeHighlightColor}`
                                : '0 2px 8px rgba(0,0,0,0.8)'
                        }}
                      >
                        <span style={{ color: subCust.textColor || '#ffffff' }}>{t('MooScript')} </span>
                        <span
                          style={{
                            color: activeHighlightColor,
                            transform: currentStyle === 'bold-pop' ? 'scale(1.15)' : 'none',
                            display: 'inline-block'
                          }}
                        >
                          {t('Studio')}
                        </span>
                        <span style={{ color: subCust.textColor || '#ffffff' }}> AI</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Pilihan Gaya Tampilan (Style Presets) */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {t('Pilihan Gaya Tampilan')}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {styleOptions.map((opt) => {
                        const isSelected = currentStyle === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateThemeCaptionStyle(opt.value)}
                            className={`py-2 px-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all text-left ${
                              isSelected
                                ? 'bg-surface-3 border-accent text-accent font-semibold shadow-sm'
                                : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px] shrink-0">
                              {opt.value === 'boxed'
                                ? 'crop_7_5'
                                : opt.value === 'karaoke'
                                  ? 'music_note'
                                  : opt.value === 'bold-pop'
                                    ? 'bolt'
                                    : opt.value === 'outline'
                                      ? 'border_style'
                                      : 'short_text'}
                            </span>
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Tata Letak & Posisi */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {t('Tata Letak & Posisi')}
                    </span>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-1 border border-border">
                      {positionOptions.map((pos) => {
                        const isSelected = currentPosition === pos.value;
                        return (
                          <button
                            key={pos.value}
                            type="button"
                            onClick={() => updateThemeCaptionPosition(pos.value)}
                            className={`py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                              isSelected
                                ? 'bg-surface-3 text-accent font-bold shadow-sm'
                                : 'text-text-muted hover:text-on-surface'
                            }`}
                          >
                            {pos.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Tipografi & Ukuran */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted font-medium">{t('Ukuran Huruf')}</span>
                      <span className="font-mono text-on-surface font-semibold">
                        {Math.round((subCust.fontScale || 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.6"
                      step="0.05"
                      value={subCust.fontScale || 1.0}
                      onChange={(e) => updateSubtitleCustomization({ fontScale: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'S (80%)', val: 0.8 },
                        { label: 'M (100%)', val: 1.0 },
                        { label: 'L (125%)', val: 1.25 },
                        { label: 'XL (150%)', val: 1.5 }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => updateSubtitleCustomization({ fontScale: item.val })}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                            Math.abs((subCust.fontScale || 1.0) - item.val) < 0.05
                              ? 'bg-accent/15 border-accent text-accent font-bold'
                              : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-text-muted">{t('Huruf Besar (UPPERCASE)')}</span>
                      <button
                        type="button"
                        onClick={() => updateSubtitleCustomization({ uppercase: !subCust.uppercase })}
                        className={`w-9 h-5 rounded-full transition-colors relative ${
                          subCust.uppercase ? 'bg-accent' : 'bg-surface-3 border border-border'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                            subCust.uppercase ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 5. Warna Sorotan Kata */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {t('Warna Sorotan Kata')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { color: '#84cc16', name: 'Lime' },
                        { color: '#eab308', name: t('Kuning') },
                        { color: '#06b6d4', name: 'Cyan' },
                        { color: '#f97316', name: t('Oranye') },
                        { color: '#ec4899', name: 'Pink' },
                        { color: '#ffffff', name: t('Putih') }
                      ].map((c) => {
                        const isSelected = (subCust.activeColor || project.theme.textHighlight || '#84cc16') === c.color;
                        return (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => updateSubtitleCustomization({ activeColor: c.color })}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              isSelected ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        );
                      })}
                      <input
                        type="color"
                        value={subCust.activeColor || project.theme.textHighlight || '#84cc16'}
                        onChange={(e) => updateSubtitleCustomization({ activeColor: e.target.value })}
                        className="w-7 h-7 rounded-full bg-transparent border border-border cursor-pointer overflow-hidden p-0"
                        title={t('Pilih warna kustom')}
                      />
                    </div>
                  </div>

                  {/* 6. Ritme & Pacing Teks */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">{t('Ritme Kata per Frasa')}</span>
                      <div className="flex items-center gap-1">
                        {[
                          { label: t('3 kata'), count: 3 },
                          { label: t('4 kata'), count: 4 },
                          { label: t('5 kata'), count: 5 }
                        ].map((chunk) => {
                          const isSelected = (subCust.maxWordsPerChunk || 4) === chunk.count;
                          return (
                            <button
                              key={chunk.count}
                              type="button"
                              onClick={() => updateSubtitleCustomization({ maxWordsPerChunk: chunk.count })}
                              className={`py-1 px-2 rounded-lg text-[10px] border transition-all ${
                                isSelected
                                  ? 'bg-accent/15 border-accent text-accent font-bold'
                                  : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                              }`}
                            >
                              {chunk.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Opasitas Kotak (jika style boxed) */}
                    {currentStyle === 'boxed' && (
                      <div className="flex flex-col gap-1 pt-1 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-muted">{t('Opasitas Latar Kotak')}</span>
                          <span className="font-mono text-on-surface font-semibold">
                            {Math.round((subCust.bgOpacity !== undefined ? subCust.bgOpacity : 0.65) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={subCust.bgOpacity !== undefined ? subCust.bgOpacity : 0.65}
                          onChange={(e) => updateSubtitleCustomization({ bgOpacity: parseFloat(e.target.value) })}
                          className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
    </>
  );
};
