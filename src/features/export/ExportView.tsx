import React, { useState, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { generateSrt } from '../../engine/export/subtitleExporter';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';
import { syncComposition } from '../../engine/composition/sync';

export function safeFileName(title?: string): string {
  if (!title) return 'mooscript';
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return cleaned || 'mooscript';
}

export function triggerFileDownload(url: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (typeof document !== 'undefined' && document.body && document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 100);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ExportViewProps {
  onBackStep?: () => void;
}

export const ExportView: React.FC<ExportViewProps> = ({ onBackStep }) => {
  const project = useMooStore((s) => s.project);
  const addToast = useMooStore((s) => s.addToast);
  const isExporting = useMooStore((s) => s.isExporting);
  const exportProgress = useMooStore((s) => s.exportProgress);
  const exportResult = useMooStore((s) => s.exportResult);
  const startExport = useMooStore((s) => s.startExport);
  const cancelExport = useMooStore((s) => s.cancelExport);
  const revokeExportResult = useMooStore((s) => s.revokeExportResult);

  const [exportFormat, setExportFormat] = useState<'mp4' | 'html' | 'srt'>('mp4');

  // Only revoke export result when switching to a different project
  const prevProjectIdRef = React.useRef(project.id);
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      revokeExportResult();
    }
  }, [project.id, revokeExportResult]);

  useEffect(() => {
    return () => {
      if (!useMooStore.getState().isExporting) {
        useMooStore.getState().revokeExportResult();
      }
    };
  }, []);

  const formatOptions = [
    { value: 'mp4' as const, label: 'MP4 Video (WebCodecs)', icon: 'movie' },
    { value: 'html' as const, label: 'HTML Bundle Standalone', icon: 'html' },
    { value: 'srt' as const, label: 'Subtitle SRT', icon: 'subtitles' }
  ];

  const handleDownloadMp4 = () => {
    if (!exportResult?.objectUrl) return;
    triggerFileDownload(exportResult.objectUrl, `${safeFileName(project.title)}.mp4`);
    addToast('Mengunduh berkas MP4...', 'success');
  };

  const handleExport = async () => {
    if (exportFormat === 'html') {
      let projectToExport = project;
      if (!projectToExport.composition) {
        projectToExport = syncComposition(projectToExport);
      }

      let audioDataUrl: string | undefined;
      if (project.audioBlob) {
        try {
          audioDataUrl = await blobToDataUrl(project.audioBlob);
        } catch {
          // Proceed without embedded audio if reading fails
        }
      }

      const htmlContent = buildCompositionDocument(projectToExport, {
        standalone: true,
        audioDataUrl
      });
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, `${safeFileName(project.title)}.html`);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      addToast('HTML Standalone berhasil diunduh!', 'success');
      return;
    }

    if (exportFormat === 'srt') {
      const srtContent = generateSrt(project);
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, `${safeFileName(project.title)}.srt`);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      addToast('Subtitle SRT berhasil diunduh!', 'success');
      return;
    }

    // Export MP4 via zero-server WebCodecs store slice
    await startExport();
    const result = useMooStore.getState().exportResult;
    if (result && result.objectUrl) {
      addToast('MP4 Video berhasil diekspor langsung di browser!', 'success');
      triggerFileDownload(result.objectUrl, `${safeFileName(project.title)}.mp4`);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 max-w-2xl mx-auto w-full">
      {/* 1. Format Selection */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Format Ekspor Video
        </span>

        <Field label="Pilih Format Deliverable">
          <SegmentedControl
            options={formatOptions}
            value={exportFormat}
            onChange={(val) => setExportFormat(val)}
          />
        </Field>

        <div className="text-[13px] text-text-muted leading-relaxed bg-surface-2 p-3.5 rounded-xl border border-border">
          {exportFormat === 'mp4' && (
            <p>
              Hardware-accelerated MP4 rendering langsung di browser melalui browser native WebCodecs dan mediabunny. 100% zero-server, tanpa watermark atau kuota server.
            </p>
          )}
          {exportFormat === 'html' && (
            <p>
              Satu berkas HTML mandiri berisi seluruh GSAP timeline, CSS, aset visual, dan kontrol pemutar audio terintegrasi. Dapat dibuka langsung dengan klik ganda di browser apa pun tanpa server.
            </p>
          )}
          {exportFormat === 'srt' && (
            <p>
              File subtitle terformat standar dengan timestamp kata presisi untuk dipasangkan ke video player atau media sosial.
            </p>
          )}
        </div>

        {/* Progress Bar when exporting */}
        {isExporting && exportProgress && (
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-2 border border-border">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-on-surface">{exportProgress.statusText}</span>
              <span className="font-mono text-accent font-semibold">{exportProgress.percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150 rounded-full"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-text-faint">
                Mohon biarkan tab ini tetap terbuka sampai render frame selesai.
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon="close"
                onClick={cancelExport}
                className="text-error hover:text-error hover:bg-error/10"
              >
                Batalkan
              </Button>
            </div>
          </div>
        )}

        {/* Export Warnings List */}
        {exportResult?.warnings && exportResult.warnings.length > 0 && !isExporting && (
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[13px] text-amber-200">
            <span className="font-semibold flex items-center gap-1.5 text-amber-400">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Peringatan Ekspor:
            </span>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-300/90 pl-1">
              {exportResult.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Video Ready to Download Card */}
        {exportResult?.objectUrl && !isExporting ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-2 border-2 border-accent/40 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] font-bold">check_circle</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Video Berhasil Diekspor!</h3>
                  <p className="text-[11px] text-text-muted">Siap diunduh atau diputar langsung di bawah</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${
                    exportResult.hasAudio
                      ? 'text-lime-400 bg-lime-950/40 border-lime-700/50'
                      : 'text-amber-400 bg-amber-950/40 border-amber-700/50'
                  }`}
                >
                  {exportResult.hasAudio ? 'AVC + AAC' : 'Video Only'}
                </span>
                <span className="text-[11px] font-mono font-semibold text-accent bg-surface-3 px-2 py-0.5 rounded-md border border-border">
                  {(exportResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            {/* Quick Preview Video Player */}
            <div className="w-full max-w-sm mx-auto aspect-[9/16] max-h-72 rounded-xl overflow-hidden border border-border bg-black shadow-lg">
              <video
                className="w-full h-full object-contain"
                controls
                playsInline
                src={exportResult.objectUrl}
              />
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
              <Button
                variant="primary"
                icon="download"
                onClick={handleDownloadMp4}
                className="flex-1 min-h-[44px] text-sm font-bold shadow-md shadow-accent/20"
              >
                Unduh Video (.MP4) • {(exportResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
              </Button>
              <Button
                variant="secondary"
                icon="refresh"
                onClick={handleExport}
                className="min-h-[44px]"
              >
                Ekspor Ulang
              </Button>
              <Button
                variant="ghost"
                icon="close"
                onClick={revokeExportResult}
                title="Tutup pratinjau dan bebaskan memori browser"
                className="min-h-[44px] text-text-muted hover:text-on-surface"
              >
                Tutup
              </Button>
            </div>

            <p className="text-[11px] text-text-faint text-center">
              💡 Unduhan file otomatis dipicu saat render selesai. Jika browser Anda memblokir unduhan otomatis, tekan tombol hijau <strong>Unduh Video (.MP4)</strong> di atas.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="primary"
              icon="download"
              isLoading={isExporting}
              disabled={isExporting}
              onClick={handleExport}
              className="flex-1"
            >
              {isExporting ? 'Mengekspor Frame Video...' : `Ekspor ${exportFormat.toUpperCase()}`}
            </Button>
            {isExporting && (
              <Button
                variant="secondary"
                icon="cancel"
                onClick={cancelExport}
                className="text-error hover:text-error"
              >
                Batalkan
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigasi Langkah */}
      {onBackStep && (
        <div className="flex justify-start pt-2">
          <Button variant="secondary" icon="arrow_back" onClick={onBackStep}>
            Kembali ke Suara
          </Button>
        </div>
      )}
    </div>
  );
};
