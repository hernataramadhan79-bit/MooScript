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

  const projectId = project.id;
  useEffect(() => {
    if (!isExporting) {
      revokeExportResult();
    }
  }, [projectId, isExporting, revokeExportResult]);

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
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(project.title)}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      addToast('HTML Standalone berhasil diunduh!', 'success');
      return;
    }

    if (exportFormat === 'srt') {
      const srtContent = generateSrt(project);
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(project.title)}.srt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      addToast('Subtitle SRT berhasil diunduh!', 'success');
      return;
    }

    // Export MP4 via zero-server WebCodecs store slice
    await startExport();
    const result = useMooStore.getState().exportResult;
    if (result && result.objectUrl) {
      addToast('MP4 Video berhasil diekspor langsung di browser!', 'success');
      const a = document.createElement('a');
      a.href = result.objectUrl;
      a.download = `${safeFileName(project.title)}.mp4`;
      a.click();
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

        {/* Download Ready Banner */}
        {exportResult?.objectUrl && !isExporting && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-accent-muted border border-accent/40 text-[13px] text-on-surface">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-accent text-[18px]">check_circle</span>
              <span>Video siap diunduh</span>
            </span>
            <a
              href={exportResult.objectUrl}
              download={`${safeFileName(project.title)}.mp4`}
              className="font-semibold text-accent hover:underline"
            >
              Unduh Lagi
            </a>
          </div>
        )}

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
