import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMooStore } from '../../store/useMooStore';
import { safeFileName, triggerFileDownload } from '../../utils/fileUtils';
import { downloadSubtitleFile } from '../../engine/export/subtitleExporter';
import { EXPORT_FPS_CHOICES, type ExportQuality } from '../../engine/export/exportOptions';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';
import { syncComposition } from '../../engine/composition/sync';
import { sceneHasRenderableCode } from '../../engine/composition/legacyScenes';
import { DEFAULT_EXPORT_SETTINGS } from '../../types';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const optionClass = (selected: boolean) =>
  `py-2.5 px-3 rounded-xl border text-[12px] font-semibold text-center transition-all active:scale-95 ${
    selected
      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent/30 shadow-sm'
      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
  }`;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{children}</span>
);

export const ExportPanel: React.FC = () => {
  const {
    project,
    audioStale,
    isExporting,
    exportProgress,
    exportResult,
    startExport,
    cancelExport,
    revokeExportResult,
    updateResolution,
    updateExportSettings,
    addToast
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      audioStale: s.audioStale,
      isExporting: s.isExporting,
      exportProgress: s.exportProgress,
      exportResult: s.exportResult,
      startExport: s.startExport,
      cancelExport: s.cancelExport,
      revokeExportResult: s.revokeExportResult,
      updateResolution: s.updateResolution,
      updateExportSettings: s.updateExportSettings,
      addToast: s.addToast
    }))
  );

  // Export choices are remembered per project.
  const exportSettings = { ...DEFAULT_EXPORT_SETTINGS, ...project.exportSettings };
  const { format, fps, quality, watermark, hud } = exportSettings;

  const scenes = project.scenes || [];
  const hasProjectAudio = Boolean(project.audioBlob);
  const currentResolution: '1080p' | '720p' =
    project.resolution || (project.width === 1080 || project.height === 1080 ? '1080p' : '720p');
  // Mirrors exporter logic: watermark/HUD only apply to the legacy canvas renderer.
  const isCompositionExport =
    (project.renderMode || 'composition') === 'composition' &&
    Boolean(project.composition?.scenes?.some(sceneHasRenderableCode));

  // A finished video is only valid for the exact project and options it was rendered with.
  // Drop it as soon as anything that affects the output changes.
  const exportSnapshotRef = useRef<unknown[] | null>(null);
  useEffect(() => {
    const snapshot = [
      project.scenes,
      project.composition,
      project.audioBlob,
      project.width,
      project.height,
      project.theme,
      project.bgm,
      format,
      fps,
      quality,
      watermark,
      hud
    ];
    const prev = exportSnapshotRef.current;
    exportSnapshotRef.current = snapshot;
    if (!prev || prev.every((v, i) => v === snapshot[i])) return;
    if (useMooStore.getState().isExporting) return;
    if (useMooStore.getState().exportResult) revokeExportResult();
  }, [
    project.scenes,
    project.composition,
    project.audioBlob,
    project.width,
    project.height,
    project.theme,
    project.bgm,
    format,
    fps,
    quality,
    watermark,
    hud,
    revokeExportResult
  ]);

  // The exporter may switch to WebM when the browser has no H.264 encoder, so name the file by its real type.
  const resultExt = exportResult?.blob.type === 'video/webm' ? 'webm' : 'mp4';
  const resultFileName = `${safeFileName(project.title)}.${resultExt}`;

  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    if (!exportResult || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
      setCanShareFiles(false);
      return;
    }
    try {
      const file = new File([exportResult.blob], resultFileName, { type: exportResult.blob.type });
      setCanShareFiles(navigator.canShare({ files: [file] }));
    } catch {
      setCanShareFiles(false);
    }
  }, [exportResult, resultFileName]);

  const handleExport = async () => {
    if (isExporting || scenes.length === 0) return;
    await startExport({ format, fps, quality, watermark, hud });
    if (useMooStore.getState().exportResult) {
      addToast('Video selesai dirender. Tonton pratinjaunya lalu unduh.', 'success');
    }
  };

  const handleDownload = () => {
    if (!exportResult) return;
    triggerFileDownload(exportResult.objectUrl, resultFileName);
    addToast(`Mengunduh ${resultFileName}...`, 'success');
  };

  const handleShare = async () => {
    if (!exportResult) return;
    try {
      const file = new File([exportResult.blob], resultFileName, { type: exportResult.blob.type });
      await navigator.share({ files: [file], title: project.title });
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        addToast('Gagal membagikan video. Coba unduh saja.', 'error');
      }
    }
  };

  const handleExportHtml = async () => {
    const projectToExport = project.composition ? project : syncComposition(project);
    let audioDataUrl: string | undefined;
    if (project.audioBlob) {
      try {
        audioDataUrl = await blobToDataUrl(project.audioBlob);
      } catch {
        // Continue without audio if read fails
      }
    }
    const htmlContent = buildCompositionDocument(projectToExport, { standalone: true, audioDataUrl });
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerFileDownload(url, `${safeFileName(project.title)}.html`);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    addToast('HTML Standalone Mograph berhasil diunduh!', 'success');
  };

  const isPortrait = project.height > project.width;

  return (
    <div className="flex flex-col gap-5">
      {/* Pratinjau hasil ekspor */}
      {exportResult && !isExporting && (
        <div className="p-3 rounded-2xl bg-surface-2/60 border border-accent/40 flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-on-surface flex items-center gap-1.5">
              <span aria-hidden="true" className="material-symbols-outlined text-[17px] text-accent">
                check_circle
              </span>
              Video siap
            </span>
            <span className="text-[11px] font-mono text-text-muted">
              {resultExt.toUpperCase()} · {formatBytes(exportResult.fileSizeBytes)} ·{' '}
              {formatDuration(exportResult.durationSeconds)}
              {!exportResult.hasAudio && ' · tanpa suara'}
            </span>
          </div>

          <video
            key={exportResult.objectUrl}
            src={exportResult.objectUrl}
            controls
            playsInline
            preload="metadata"
            className={`w-full rounded-xl bg-black border border-border ${isPortrait ? 'max-h-[360px] object-contain' : ''}`}
          />

          {exportResult.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-[11px] text-amber-300/90 leading-relaxed">
              {exportResult.warnings.map((w) => (
                <li key={w} className="flex gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px] shrink-0 mt-px">
                    warning
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={`grid gap-2 ${canShareFiles ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={handleDownload}
              className={`${canShareFiles ? 'col-span-1' : ''} min-h-[44px] px-3 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-1.5 hover:bg-accent-hover active:scale-[0.98] transition-all`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">download</span>
              Unduh
            </button>
            {canShareFiles && (
              <button
                type="button"
                onClick={handleShare}
                className="min-h-[44px] px-3 rounded-xl bg-surface-2 border border-border text-on-surface font-semibold text-[13px] flex items-center justify-center gap-1.5 hover:bg-surface-3 active:scale-[0.98] transition-all"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">share</span>
                Bagikan
              </button>
            )}
            <button
              type="button"
              onClick={revokeExportResult}
              className="min-h-[44px] px-3 rounded-xl bg-surface-2 border border-border text-text-muted font-medium text-[13px] flex items-center justify-center gap-1.5 hover:text-rose-300 hover:border-rose-500/40 active:scale-[0.98] transition-all"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">delete</span>
              Buang
            </button>
          </div>
        </div>
      )}

      {/* Resolusi Video */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Resolusi</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => updateResolution('1080p')} className={optionClass(currentResolution === '1080p')}>
            1080p (Full HD)
          </button>
          <button type="button" onClick={() => updateResolution('720p')} className={optionClass(currentResolution === '720p')}>
            720p (HD)
          </button>
        </div>
      </div>

      {/* Format Video Kontainer */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Format Video</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => updateExportSettings({ format: 'mp4' })} className={optionClass(format === 'mp4')}>
            MP4 (H.264)
          </button>
          <button type="button" onClick={() => updateExportSettings({ format: 'webm' })} className={optionClass(format === 'webm')}>
            WebM (VP9)
          </button>
        </div>
        <span className="text-[10px] text-text-muted">MP4 paling cocok untuk diunggah ke medsos.</span>
      </div>

      {/* Frame Rate */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Frame Rate</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {EXPORT_FPS_CHOICES.map((value) => (
            <button key={value} type="button" onClick={() => updateExportSettings({ fps: value })} className={optionClass(fps === value)}>
              {value} fps
            </button>
          ))}
        </div>
        {fps === 60 && (
          <span className="text-[10px] text-text-muted">60 fps memakan waktu render dua kali lebih lama dan lebih berat di HP.</span>
        )}
      </div>

      {/* Kualitas */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Kualitas</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['compact', 'Hemat'],
              ['standard', 'Standar'],
              ['high', 'Tinggi']
            ] as [ExportQuality, string][]
          ).map(([value, label]) => (
            <button key={value} type="button" onClick={() => updateExportSettings({ quality: value })} className={optionClass(quality === value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Opsi Overlay Ekspor: hanya berlaku untuk render legacy (canvas) */}
      {!isCompositionExport && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Opsi Ekspor</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-border cursor-pointer hover:bg-surface-3 transition-colors">
              <input
                type="checkbox"
                checked={watermark}
                onChange={(e) => updateExportSettings({ watermark: e.target.checked })}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-on-surface">Watermark</span>
                <span className="text-[10px] text-text-muted">Logo MooScript</span>
              </div>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-border cursor-pointer hover:bg-surface-3 transition-colors">
              <input
                type="checkbox"
                checked={hud}
                onChange={(e) => updateExportSettings({ hud: e.target.checked })}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-on-surface">Info FPS</span>
                <span className="text-[10px] text-text-muted">Overlay teknis</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Peringatan audio sebelum ekspor */}
      {!hasProjectAudio && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
          Audio belum dibuat, video akan diekspor tanpa suara. Buka tab Audio untuk membuat suara.
        </div>
      )}
      {hasProjectAudio && audioStale && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
          Naskah berubah sejak suara dibuat. Buat ulang suara di tab Audio agar video sesuai naskah.
        </div>
      )}

      {/* Render */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || scenes.length === 0}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
        >
          <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
            {isExporting ? 'progress_activity' : exportResult ? 'refresh' : 'movie'}
          </span>
          <span>
            {isExporting
              ? 'Merender Video...'
              : scenes.length === 0
                ? 'Tambahkan adegan dulu'
                : exportResult
                  ? 'Render Ulang'
                  : `Render Video ${format.toUpperCase()}`}
          </span>
        </button>

        {isExporting && (
          <button
            type="button"
            onClick={() => cancelExport()}
            className="w-full py-2 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-rose-400 text-[12px] font-medium transition-colors"
          >
            Batalkan Ekspor
          </button>
        )}

        {isExporting && exportProgress && (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-2 border border-border" aria-live="polite">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-muted truncate">{exportProgress.statusText || 'Sedang memproses...'}</span>
              <span className="font-mono text-accent font-bold">{exportProgress.percent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, exportProgress.percent))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Unduh Bundle Mograph Web HTML */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border">
        <SectionLabel>Bundle Web Mograph</SectionLabel>
        <button
          type="button"
          onClick={handleExportHtml}
          className="py-2.5 px-3 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-accent">html</span>
          <span>Unduh HTML Standalone Web</span>
        </button>
      </div>

      {/* Subtitle */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border">
        <SectionLabel>Subtitle</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {(['srt', 'vtt'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                downloadSubtitleFile(project, kind);
                addToast(`Mengunduh subtitle (.${kind})...`, 'success');
              }}
              className="py-2.5 px-2.5 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-text-muted shrink-0">subtitles</span>
              <span className="truncate">Subtitle (.{kind})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
