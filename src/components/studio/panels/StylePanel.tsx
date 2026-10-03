import React from 'react';
import { useMooStore } from '../../../store/useMooStore';
import type { CaptionStyle, CaptionPosition, MotionPreset } from '../../../types';

interface StylePanelProps {
  showSafeZone?: boolean;
  setShowSafeZone?: (val: boolean | ((prev: boolean) => boolean)) => void;
  showDebugHud?: boolean;
  setShowDebugHud?: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const StylePanel: React.FC<StylePanelProps> = ({
  showSafeZone,
  setShowSafeZone,
  showDebugHud,
  setShowDebugHud
}) => {
  const {
    project,
    updateThemeFont,
    updateThemeHighlight,
    updateThemeCaptionStyle,
    updateThemeCaptionPosition,
    setSceneMotionPreset
  } = useMooStore();

  const curatedColors = [
    { hex: '#84cc16', label: 'Neon Lime' },
    { hex: '#4ae176', label: 'Mint Green' },
    { hex: '#38bdf8', label: 'Hyper Cyan' },
    { hex: '#a855f7', label: 'Cyber Violet' },
    { hex: '#f59e0b', label: 'Warm Amber' },
    { hex: '#ffedd5', label: 'Soft Cream' }
  ];

  const captionStyles: { id: CaptionStyle; label: string; desc: string; icon: string }[] = [
    { id: 'boxed', label: 'Boxed Pill', desc: 'Badge kontras tinggi', icon: 'title' },
    { id: 'karaoke', label: 'Karaoke', desc: 'Highlight kata per kata', icon: 'lyrics' },
    { id: 'bold-pop', label: 'Bold Pop', desc: 'Pop bounce energetik', icon: 'format_bold' },
    { id: 'minimal', label: 'Minimal', desc: 'Clean typography', icon: 'text_fields' }
  ];

  const positions: { id: CaptionPosition; label: string; icon: string }[] = [
    { id: 'top', label: 'Top', icon: 'vertical_align_top' },
    { id: 'center', label: 'Center', icon: 'vertical_align_center' },
    { id: 'bottom', label: 'Bottom', icon: 'vertical_align_bottom' }
  ];

  return (
    <div className="flex flex-col gap-2.5 sm:gap-4 p-2.5 sm:p-4 text-xs">
      {/* 1. Typography Font Family */}
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">font_download</span>
            Typography Font Family
          </span>
          <span className="text-[9px] text-zinc-500 font-mono hidden sm:inline">Vector Render</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(['Jakarta', 'Mono', 'Impact'] as const).map((font) => {
            const isSelected = project.theme.fontFamily === font;
            return (
              <button
                key={font}
                type="button"
                onClick={() => updateThemeFont(font)}
                className={`h-8 sm:h-11 rounded-lg sm:rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/20'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] text-zinc-300'
                }`}
              >
                <span
                  className={`text-[11px] sm:text-xs ${
                    font === 'Jakarta'
                      ? 'font-sans font-bold'
                      : font === 'Mono'
                        ? 'font-mono font-bold'
                        : 'font-sans font-black tracking-wide'
                  }`}
                >
                  {font === 'Jakarta' ? 'Jakarta' : font === 'Mono' ? 'JetBrains' : 'Impact'}
                </span>
                <span className="hidden sm:block text-[8px] sm:text-[9px] text-zinc-500 font-mono">
                  {font === 'Jakarta' ? 'Sans-serif' : font === 'Mono' ? 'Monospace' : 'Bold Display'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Caption Style Visual Presets */}
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">subtitles</span>
            Caption Style Preset
          </span>
          <span className="text-[9px] text-zinc-500 font-mono hidden sm:inline">Kinetic Effect</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {captionStyles.map(({ id, label, desc, icon }) => {
            const isSelected = (project.theme.captionStyle || 'boxed') === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => updateThemeCaptionStyle(id)}
                className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl border flex items-center gap-2 sm:gap-2.5 transition-all active:scale-[0.98] text-left ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-sm shadow-primary/20'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-primary text-black' : 'bg-white/[0.06] text-zinc-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] sm:text-[16px]">{icon}</span>
                </div>
                <div className="min-w-0">
                  <span
                    className={`font-semibold text-[11px] sm:text-xs block leading-tight ${
                      isSelected ? 'text-primary' : 'text-zinc-200'
                    }`}
                  >
                    {label}
                  </span>
                  <span className="hidden sm:block text-[9px] text-zinc-400 truncate mt-0.5">{desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Caption Position Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">align_vertical_center</span>
            Caption Vertical Position
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Screen Alignment</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {positions.map(({ id, label, icon }) => {
            const isSelected = (project.theme.captionPosition || 'center') === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => updateThemeCaptionPosition(id)}
                className={`h-9 rounded-xl border flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm shadow-primary/20'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] text-zinc-300'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{icon}</span>
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Highlight Accent Color & Global Motion Preset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Highlight Color */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-primary">palette</span>
            Kinetic Accent Color
          </span>

          <div className="flex items-center gap-2 h-9 px-2 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            {curatedColors.map((c) => {
              const isSelected = project.theme.textHighlight === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => updateThemeHighlight(c.hex)}
                  className={`w-5 h-5 rounded-full transition-all ${
                    isSelected
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110 shadow-lg'
                      : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Global Motion Preset Batch */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-primary">motion_photos_on</span>
            Apply Preset to All Scenes
          </span>

          <select
            className="w-full h-9 bg-black/50 text-zinc-200 border border-white/[0.08] text-xs rounded-xl px-2.5 focus:outline-none focus:border-primary transition-colors cursor-pointer"
            onChange={(e) => {
              const p = e.target.value as MotionPreset;
              project.scenes.forEach((s) => setSceneMotionPreset(s.id, p));
            }}
          >
            <option value="punch_zoom">🎯 Punch Zoom (Semua)</option>
            <option value="slide_split">↔ Slide Split (Semua)</option>
            <option value="fade_float">☁ Fade Float (Semua)</option>
            <option value="kinetic_shake">⚡ Kinetic Shake (Semua)</option>
          </select>
        </div>
      </div>

      {/* 5. Canvas Overlays & Hardware Specs */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 border-b border-white/[0.06] pb-1.5">
          <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
            <span className="material-symbols-outlined text-[15px] text-primary">videocam</span>
            <span>MP4 Canvas Specs: 1080×1920 (9:16)</span>
          </div>
          <span className="text-primary font-bold">WebCodecs Hardware</span>
        </div>

        <div className="flex items-center justify-between text-xs pt-0.5">
          {setShowSafeZone && (
            <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={Boolean(showSafeZone)}
                onChange={(e) => setShowSafeZone(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Safe Zone Overlay (TikTok/Reels)</span>
            </label>
          )}

          {setShowDebugHud && (
            <label className="flex items-center gap-2 cursor-pointer text-zinc-400 text-[11px] select-none">
              <input
                type="checkbox"
                checked={Boolean(showDebugHud)}
                onChange={(e) => setShowDebugHud(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0 cursor-pointer"
              />
              <span>Vector Debug HUD</span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
};
