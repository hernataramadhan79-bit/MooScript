import React, { useState, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { downloadSubtitleFile, type SubtitleCueMode } from '../../engine/export/subtitleExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const {
    project,
    isExporting,
    exportProgress,
    exportResult,
    audioStale,
    startExport,
    cancelExport,
    revokeExportResult,
    generateAudio,
    isGeneratingAudio,
    addToast
  } = useMooStore();

  const [exportWatermark, setExportWatermark] = useState(false);
  const [exportHud, setExportHud] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleCueMode>('phrase');

  useEffect(() => {
    return () => {
      revokeExportResult();
    };
  }, [revokeExportResult]);

  if (!isOpen) return null;

  const handleDownloadMp4 = () => {
    if (!exportResult) return;
    const a = document.createElement('a');
    a.href = exportResult.objectUrl;
    a.download = `${project.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${project.width}x${project.height}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast('MP4 video file downloaded successfully', 'success');
  };

  const stageLabel = () => {
    if (!exportProgress) return 'Preparing pipeline...';
    return exportProgress.statusText || 'Rendering video...';
  };

  const progressPercent = exportProgress ? Math.min(100, Math.max(0, Math.round(exportProgress.percent))) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#141417] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#18181c]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#84cc16]">download</span>
            <span className="font-bold text-sm text-white">Export Video</span>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-white/[0.04] hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
          {/* Target Format Specs */}
          <div className="p-3 rounded-lg bg-[#0e0e11] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-zinc-100 text-xs block">
                  {project.width}×{project.height} MP4 Video ({project.aspectRatio || '9:16'})
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  MP4 • {project.fps || 30} FPS • Audio Stereo
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/25 font-bold">
                Full HD
              </span>
            </div>

            {/* Quick Option Checkboxes */}
            <div className="flex items-center gap-4 pt-1 border-t border-white/[0.06] text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={exportWatermark}
                  onChange={(e) => setExportWatermark(e.target.checked)}
                  disabled={isExporting}
                  className="rounded border-zinc-700 bg-zinc-900 text-[#84cc16] focus:ring-0 cursor-pointer"
                />
                <span>Watermark</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400">
                <input
                  type="checkbox"
                  checked={exportHud}
                  onChange={(e) => setExportHud(e.target.checked)}
                  disabled={isExporting}
                  className="rounded border-zinc-700 bg-zinc-900 text-[#84cc16] focus:ring-0 cursor-pointer"
                />
                <span>Debug HUD</span>
              </label>
            </div>
          </div>

          {/* Audio Out of Sync Notice */}
          {audioStale && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-amber-300 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0">warning</span>
                <span>Narration text changed since last audio sync.</span>
              </div>
              <button
                type="button"
                disabled={isGeneratingAudio || isExporting}
                onClick={() => generateAudio()}
                className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold shrink-0 text-[10px]"
              >
                {isGeneratingAudio ? 'Syncing...' : 'Sync Voice'}
              </button>
            </div>
          )}

          {/* Export In Progress / Result State */}
          {isExporting ? (
            <div className="p-4 rounded-lg bg-[#0e0e11] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-zinc-200 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-[#84cc16] animate-spin">sync</span>
                  {stageLabel()}
                </span>
                <span className="font-mono font-bold text-[#84cc16]">{progressPercent}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-[#84cc16] transition-all duration-150 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={cancelExport}
                  className="px-3 py-1 rounded-md bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/80 text-xs font-semibold"
                >
                  Cancel Export
                </button>
              </div>
            </div>
          ) : exportResult ? (
            <div className="p-4 rounded-lg bg-[#84cc16]/10 border border-[#84cc16]/30 space-y-3">
              <div className="flex items-center gap-2 text-zinc-100">
                <span className="material-symbols-outlined text-[18px] text-[#84cc16]">check_circle</span>
                <span className="font-bold text-xs">Video Berhasil Dibuat</span>
              </div>
              <p className="text-[11px] text-zinc-300">
                Ukuran file: {(exportResult.blob.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMp4}
                  className="flex-1 h-8 rounded-md bg-[#84cc16] text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#a3e635] active:scale-95 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                  <span>Download MP4 Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startExport({ watermark: exportWatermark, hud: exportHud });
                  }}
                  className="px-3 h-8 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 font-semibold text-xs transition-colors"
                >
                  Re-Export
                </button>
              </div>
            </div>
          ) : null}

          {/* Subtitles Export (.SRT / .VTT) */}
          <div className="p-3 rounded-lg bg-[#0e0e11] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-200 text-[11px]">Subtitles (.SRT / .VTT)</span>
              <div className="flex rounded bg-black/40 p-0.5 border border-white/[0.06]">
                {(['phrase', 'scene', 'word'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
                      subtitleMode === m ? 'bg-[#84cc16] text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                    onClick={() => setSubtitleMode(m)}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={project.scenes.length === 0}
                onClick={() => {
                  downloadSubtitleFile(project, 'srt', { mode: subtitleMode });
                  addToast('SubRip (.srt) file downloaded', 'success');
                }}
                className="h-7 px-2 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[14px] text-amber-400">subtitles</span>
                <span>Download .SRT</span>
              </button>

              <button
                type="button"
                disabled={project.scenes.length === 0}
                onClick={() => {
                  downloadSubtitleFile(project, 'vtt', { mode: subtitleMode });
                  addToast('WebVTT (.vtt) file downloaded', 'success');
                }}
                className="h-7 px-2 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[14px] text-sky-400">closed_caption</span>
                <span>Download .VTT</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.08] bg-[#18181c]">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-3 h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            Close
          </button>

          {!exportResult && (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => startExport({ watermark: exportWatermark, hud: exportHud })}
              className="px-4 h-8 rounded-md bg-[#84cc16] text-black font-bold text-xs flex items-center gap-1.5 hover:bg-[#a3e635] active:scale-95 transition-all disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Start MP4 Export</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
