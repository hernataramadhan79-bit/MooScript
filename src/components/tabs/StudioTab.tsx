import React, { useEffect, useRef, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { CanvasRenderer } from '../../engine/renderer/canvasRenderer';
import type { MotionPreset } from '../../types';

export const StudioTab: React.FC = () => {
  const {
    project,
    currentFrame,
    isPlaying,
    togglePlay,
    seekFrame,
    updateThemeFont,
    updateThemeHighlight,
    setSceneMotionPreset,
    isExporting,
    exportProgress,
    exportResult,
    startExport,
    cancelExport
  } = useMooStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const [showSafeZone, setShowSafeZone] = useState(false);

  const fps = project.fps || 30;
  const totalDuration = project.audioDuration || 10;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  // Initialize CanvasRenderer once on mount
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, []);

  // Re-draw canvas whenever frame or project changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.draw(currentFrame, totalFrames, project);
    }
  }, [currentFrame, totalFrames, project]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (!exportResult) return;
    const a = document.createElement('a');
    a.href = exportResult.objectUrl;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_1080p.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-12 max-w-xl mx-auto w-full">
      {/* 9:16 Canvas Viewport & Safe Zone */}
      <div className="relative flex justify-center items-center py-1">
        <div className="relative aspect-[9/16] w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-800 bg-[#09090b] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1920}
            className="w-full h-full object-contain"
          />

          {/* Optional Instagram/TikTok Safe Zone Overlay */}
          {showSafeZone && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 border border-dashed border-red-500/50">
              <div className="w-full h-14 bg-red-500/10 border-b border-red-500/30 flex items-center justify-center text-[10px] font-mono text-red-400">
                Top UI Header Zone
              </div>
              <div className="w-full h-24 bg-red-500/10 border-t border-red-500/30 flex items-center justify-center text-[10px] font-mono text-red-400">
                Bottom Caption & Sound Zone
              </div>
            </div>
          )}

          {/* Quick Safe Zone Toggle Button */}
          <button
            className={`absolute top-3 right-3 px-2 py-1 rounded-md text-[10px] font-mono border backdrop-blur-md transition-all ${
              showSafeZone
                ? 'bg-red-500/20 text-red-300 border-red-500/50'
                : 'bg-black/60 text-zinc-400 border-zinc-700/60 hover:text-white'
            }`}
            onClick={() => setShowSafeZone(!showSafeZone)}
            type="button"
          >
            Safe Zone: {showSafeZone ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Scrubbing & Transport Controls */}
      <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-200 font-bold">
            {formatSeconds(currentFrame / fps)} / {formatSeconds(totalDuration)}
          </span>
          <span className="text-zinc-500 text-[11px]">
            Frame {currentFrame} / {totalFrames}
          </span>
        </div>

        {/* Scrub Slider */}
        <input
          className="w-full accent-primary bg-zinc-800 h-2 rounded-lg cursor-pointer"
          max={totalFrames}
          min={0}
          step={1}
          type="range"
          value={currentFrame}
          onChange={(e) => seekFrame(parseInt(e.target.value))}
        />

        {/* Playback Buttons */}
        <div className="flex items-center justify-between pt-1">
          <button
            className="w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
            onClick={() => seekFrame(Math.max(0, currentFrame - fps))}
            title="Step Back 1s"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">replay_10</span>
          </button>

          <button
            className="h-10 px-6 rounded-xl bg-primary text-black font-bold flex items-center justify-center gap-2 hover:bg-lime-300 active:scale-95 transition-all shadow-md shadow-primary/20"
            onClick={togglePlay}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span className="text-xs uppercase tracking-wider">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            className="w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
            onClick={() => seekFrame(Math.min(totalFrames, currentFrame + fps))}
            title="Step Forward 1s"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">forward_10</span>
          </button>
        </div>
      </div>

      {/* Style & Captions Customization Card */}
      <div className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">format_paint</span>
            <span className="text-xs font-semibold text-white tracking-tight">Style & Captions</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">Pure Vector Math</span>
        </div>

        {/* Font Family selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Font Family</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['Jakarta', 'Mono', 'Impact'] as const).map((font) => {
              const isSelected = project.theme.fontFamily === font;
              return (
                <button
                  key={font}
                  className={`h-8 rounded-lg text-xs font-semibold border active:scale-95 transition-all ${
                    isSelected
                      ? 'bg-zinc-800 text-primary border-primary/50'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => updateThemeFont(font)}
                  type="button"
                >
                  {font === 'Jakarta' ? 'Jakarta' : font === 'Mono' ? 'JetBrains Mono' : 'Impact Bold'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Highlight Color & Global Motion Preset */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Highlight Color */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400">Highlight Accent</span>
            <div className="flex items-center gap-2 h-8 px-1">
              {[
                { hex: '#84cc16', label: 'Neon Lime' },
                { hex: '#4ae176', label: 'Mint Green' },
                { hex: '#f59e0b', label: 'Warm Amber' },
                { hex: '#ffedd5', label: 'Soft Cream' }
              ].map((c) => {
                const isSelected = project.theme.textHighlight === c.hex;
                return (
                  <button
                    key={c.hex}
                    aria-label={c.label}
                    className={`w-6 h-6 rounded-full transition-all ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => updateThemeHighlight(c.hex)}
                    title={c.label}
                    type="button"
                  />
                );
              })}
            </div>
          </div>

          {/* Global Motion Preset Dropdown */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400">Apply Preset to All</span>
            <select
              className="w-full h-8 bg-zinc-950 text-zinc-200 border border-zinc-800 text-xs rounded-lg px-2.5 focus:outline-none focus:border-zinc-700"
              onChange={(e) => {
                const p = e.target.value as MotionPreset;
                project.scenes.forEach((s) => setSceneMotionPreset(s.id, p));
              }}
            >
              <option value="punch_zoom">Punch Zoom</option>
              <option value="slide_split">Slide Split</option>
              <option value="fade_float">Fade Float</option>
              <option value="kinetic_shake">Kinetic Shake</option>
            </select>
          </div>
        </div>

        {/* Video specs tag */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">video_settings</span>
            <span>MP4 • 1080×1920 (9:16)</span>
          </div>
          <span className="text-zinc-300">WebCodecs Hardware</span>
        </div>
      </div>

      {/* Main Export CTA */}
      <button
        className="w-full h-12 text-sm font-bold rounded-xl bg-primary text-black hover:bg-lime-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(132,204,22,0.25)] disabled:opacity-50"
        disabled={isExporting}
        onClick={startExport}
        type="button"
      >
        <span className="material-symbols-outlined text-[20px]">
          {isExporting ? 'hourglass_top' : 'arrow_downward'}
        </span>
        <span>{isExporting ? 'Encoding Video...' : 'Export Video (1080x1920 MP4)'}</span>
      </button>

      {/* Active Exporting Progress Panel */}
      {isExporting && exportProgress && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-primary/50 space-y-3 animate-pulse">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-primary font-bold">{exportProgress.statusText}</span>
            <span className="text-white font-bold">{exportProgress.percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-150"
              style={{ width: `${exportProgress.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-400 font-mono">
              Frame {exportProgress.currentFrame} of {exportProgress.totalFrames}
            </span>
            <button
              className="text-xs text-red-400 hover:text-red-300 font-medium"
              onClick={cancelExport}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Video Ready to Download Card */}
      {exportResult && (
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-primary/40 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
              </div>
              <h3 className="text-xs font-bold text-white">Video Ready to Download</h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              {(exportResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Compiled with WebCodecs at 1080×1920 (6 Mbps AVC/H.264) directly on your device. Ready for TikTok, Reels, or YouTube Shorts.
          </p>

          {/* Quick Preview Player */}
          <div className="aspect-[9/16] max-h-56 mx-auto rounded-lg overflow-hidden border border-zinc-800 bg-black">
            <video
              className="w-full h-full object-contain"
              controls
              playsInline
              src={exportResult.objectUrl}
            />
          </div>

          <button
            className="w-full h-10 rounded-lg bg-primary text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-lime-300 active:scale-95 transition-all shadow-md shadow-primary/20"
            onClick={handleDownload}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download MP4 File</span>
          </button>
        </div>
      )}
    </div>
  );
};
