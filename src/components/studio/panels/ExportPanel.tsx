import React, { useState, useEffect } from 'react';
import { useMooStore } from '../../../store/useMooStore';
import { downloadSubtitleFile, type SubtitleCueMode } from '../../../engine/export/subtitleExporter';

export const ExportPanel: React.FC = () => {
  const {
    project,
    isExporting,
    exportProgress,
    exportResult,
    audioStale,
    startExport,
    cancelExport,
    revokeExportResult,
    addToast
  } = useMooStore();

  const [exportWatermark, setExportWatermark] = useState(false);
  const [exportHud, setExportHud] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleCueMode>('phrase');

  // Revoke export Object URL on unmount to prevent leaks
  useEffect(() => {
    return () => {
      revokeExportResult();
    };
  }, [revokeExportResult]);

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
    <div className="flex flex-col gap-2.5 sm:gap-4 p-2.5 sm:p-4 text-xs">
      {/* 1. Format & Hardware Output Specs */}
      <div className="p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2 sm:space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-primary">video_file</span>
            <div>
              <span className="font-bold text-white text-[11px] sm:text-xs block">1080×1920 MP4 Video (9:16)</span>
              <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono">AVC H.264 • 30 FPS • AAC Audio</span>
            </div>
          </div>
          <span className="text-[8px] sm:text-[9px] font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
            WebCodecs
          </span>
        </div>

        {/* Export Configuration Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[10px] sm:text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 select-none">
            <input
              type="checkbox"
              checked={exportWatermark}
              onChange={(e) => setExportWatermark(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0 cursor-pointer"
            />
            <span>Watermark MooScript</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={exportHud}
              onChange={(e) => setExportHud(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0 cursor-pointer"
            />
            <span>Debug HUD</span>
          </label>
        </div>
      </div>

      {/* 2. Standalone Subtitles & Captions (.SRT / .VTT) */}
      <div className="p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between font-mono text-[9px] sm:text-[10px]">
          <span className="uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">closed_caption</span>
            Subtitles (.SRT / .VTT)
          </span>
          <span className="text-zinc-500 font-mono hidden sm:inline">TikTok & Shorts Ready</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 text-[11px]">Cue Pacing Mode:</span>
          <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/[0.06]">
            {(
              [
                { id: 'phrase', label: 'Phrase' },
                { id: 'scene', label: 'Scene' },
                { id: 'word', label: 'Word' }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`px-2 py-0.5 text-[10px] rounded-md font-medium transition-all ${
                  subtitleMode === m.id
                    ? 'bg-primary text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                onClick={() => setSubtitleMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={project.scenes.length === 0}
            onClick={() => {
              downloadSubtitleFile(project, 'srt', { mode: subtitleMode });
              addToast('SubRip (.srt) file downloaded', 'success');
            }}
            className="h-8 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-400">subtitles</span>
            <span>Download .SRT</span>
          </button>

          <button
            type="button"
            disabled={project.scenes.length === 0}
            onClick={() => {
              downloadSubtitleFile(project, 'vtt', { mode: subtitleMode });
              addToast('WebVTT (.vtt) file downloaded', 'success');
            }}
            className="h-8 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[15px] text-sky-400">closed_caption</span>
            <span>Download .VTT</span>
          </button>
        </div>
      </div>

      {/* 3. Outdated Audio Alert */}
      {audioStale && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
          <span className="material-symbols-outlined text-[18px] text-amber-400 shrink-0">warning</span>
          <span className="flex-1 font-medium leading-relaxed">
            Audio belum disinkronkan setelah ada perubahan teks scene. Video tetap dapat diekspor, namun timing kata mungkin berbeda.
          </span>
        </div>
      )}

      {/* 4. Main Export CTA */}
      <button
        type="button"
        disabled={isExporting}
        onClick={() => {
          if (audioStale) {
            const confirmed = window.confirm(
              'Audio belum disinkronkan dengan teks terbaru. Tetap lanjutkan ekspor dengan audio yang ada?'
            );
            if (!confirmed) return;
          }
          startExport({ hud: exportHud, watermark: exportWatermark });
        }}
        className="w-full h-11 text-xs font-bold uppercase tracking-wider rounded-xl bg-primary text-black hover:bg-lime-300 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(158,233,57,0.25)] disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-[18px]">
          {isExporting ? 'hourglass_top' : 'arrow_downward'}
        </span>
        <span>{isExporting ? 'Encoding Hardware Video...' : 'Render & Export 1080p MP4'}</span>
      </button>

      {/* 5. Active Exporting Progress Panel */}
      {isExporting && exportProgress && (
        <div className="p-4 rounded-xl bg-black/80 border border-primary/50 space-y-2.5 shadow-2xl animate-pulse">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-primary font-bold">{exportProgress.statusText}</span>
            <span className="text-white font-bold">{exportProgress.percent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-150 shadow-[0_0_10px_#9ee939]"
              style={{ width: `${exportProgress.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-400 font-mono">
              Frame {exportProgress.currentFrame} of {exportProgress.totalFrames}
            </span>
            <button
              type="button"
              onClick={cancelExport}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 6. Video Ready to Download Card */}
      {exportResult && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-primary/40 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
              </div>
              <h3 className="text-xs font-bold text-white">Video Ready to Download</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                  exportResult.hasAudio
                    ? 'text-lime-400 bg-lime-950/40 border-lime-800/60'
                    : 'text-amber-400 bg-amber-950/40 border-amber-800/60'
                }`}
              >
                {exportResult.hasAudio ? 'AVC + AAC' : 'Video Only'}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-2 py-0.5 rounded border border-white/[0.06]">
                {(exportResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          </div>

          {/* Quick Preview Player */}
          <div className="aspect-[9/16] max-h-52 mx-auto rounded-xl overflow-hidden border border-white/[0.1] bg-black shadow-lg">
            <video className="w-full h-full object-contain" controls playsInline src={exportResult.objectUrl} />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 h-9 rounded-xl bg-primary text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-lime-300 active:scale-95 transition-all shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download MP4 File</span>
            </button>
            <button
              type="button"
              onClick={revokeExportResult}
              title="Dismiss & free memory"
              className="px-3 h-9 rounded-xl bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1] text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
