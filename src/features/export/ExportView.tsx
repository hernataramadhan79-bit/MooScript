import React, { useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { exportMooProjectToMP4, type ExportProgress } from '../../engine/export/mp4Exporter';
import { generateSrt } from '../../engine/export/subtitleExporter';
import { buildCompositionDocument } from '../../engine/composition/buildDocument';

interface ExportViewProps {
  onBackStep?: () => void;
}

export const ExportView: React.FC<ExportViewProps> = ({ onBackStep }) => {
  const { project, addToast } = useMooStore();

  const [exportFormat, setExportFormat] = useState<'mp4' | 'html' | 'srt'>('mp4');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const formatOptions = [
    { value: 'mp4' as const, label: 'MP4 Video (WebCodecs)', icon: 'movie' },
    { value: 'html' as const, label: 'HTML Bundle Standalone', icon: 'html' },
    { value: 'srt' as const, label: 'Subtitle SRT', icon: 'subtitles' }
  ];

  const handleExport = async () => {
    if (exportFormat === 'html') {
      // Export single-file HTML bundle
      const htmlContent = buildCompositionDocument(project);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title || 'mooscript'}.html`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('HTML Standalone berhasil diunduh!', 'success');
      return;
    }

    if (exportFormat === 'srt') {
      // Export SRT subtitle
      const srtContent = generateSrt(project);
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title || 'mooscript'}.srt`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Subtitle SRT berhasil diunduh!', 'success');
      return;
    }

    // Export MP4 via zero-server WebCodecs
    setIsExporting(true);
    setProgress({ percent: 1, currentFrame: 0, totalFrames: 0, statusText: 'Memulai pipeline WebCodecs...' });

    try {
      const result = await exportMooProjectToMP4(project, (p) => {
        setProgress(p);
      });

      setDownloadUrl(result.objectUrl);
      addToast('MP4 Video berhasil diekspor langsung di browser!', 'success');

      // Trigger instant download
      const a = document.createElement('a');
      a.href = result.objectUrl;
      a.download = `${project.title || 'mooscript'}.mp4`;
      a.click();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Ekspor MP4 gagal: ${msg}`, 'error');
    } finally {
      setIsExporting(false);
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
              Satu berkas HTML mandiri berisi seluruh GSAP timeline, CSS, dan aset visual. Dapat dibuka langsung dengan klik ganda di browser apa pun tanpa koneksi server.
            </p>
          )}
          {exportFormat === 'srt' && (
            <p>
              File subtitle terformat standar dengan timestamp kata presisi untuk dipasangkan ke video player atau media sosial.
            </p>
          )}
        </div>

        {/* Progress Bar when exporting */}
        {isExporting && progress && (
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-2 border border-border">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-on-surface">{progress.statusText}</span>
              <span className="font-mono text-accent font-semibold">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150 rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-[11px] text-text-faint text-center mt-1">
              Mohon biarkan tab ini tetap terbuka sampai render frame selesai.
            </span>
          </div>
        )}

        {downloadUrl && !isExporting && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-accent-muted border border-accent/40 text-[13px] text-on-surface">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-accent text-[18px]">check_circle</span>
              <span>Video siap diunduh</span>
            </span>
            <a
              href={downloadUrl}
              download={`${project.title || 'mooscript'}.mp4`}
              className="font-semibold text-accent hover:underline"
            >
              Unduh Lagi
            </a>
          </div>
        )}

        <Button
          variant="primary"
          icon="download"
          isLoading={isExporting}
          disabled={isExporting}
          onClick={handleExport}
          className="w-full mt-1"
        >
          {isExporting ? 'Mengekspor Frame Video...' : `Ekspor ${exportFormat.toUpperCase()}`}
        </Button>
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
