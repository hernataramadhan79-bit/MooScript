import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMooStore } from '../../store/useMooStore';
import type { AspectRatio } from '../../types';
import { DEFAULT_EXPORT_SETTINGS } from '../../types';
import type { ReframeMode } from '../../engine/export/reframe';
import { safeFileName, triggerFileDownload } from '../../utils/fileUtils';

const ASPECTS: { id: AspectRatio; label: string }[] = [
  { id: '9:16', label: '9:16 Reels / TikTok' },
  { id: '1:1', label: '1:1 Feed' },
  { id: '16:9', label: '16:9 YouTube' }
];

const STATUS_LABEL = {
  waiting: 'Menunggu',
  rendering: 'Merender…',
  done: 'Selesai',
  error: 'Gagal',
  cancelled: 'Dibatalkan'
} as const;

const optionClass = (selected: boolean) =>
  `py-2 px-2.5 rounded-xl border text-[11px] font-semibold text-center transition-all ${
    selected ? 'bg-surface-3 border-accent text-accent' : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
  }`;

/** The same film in several frame shapes in one go, and a cover image from the playhead. */
export const MultiFormatExport: React.FC = () => {
  const { project, isExporting, queue, startQueue, clearQueue, currentFrame, addToast } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      isExporting: s.isExporting,
      queue: s.exportQueue,
      startQueue: s.startExportQueue,
      clearQueue: s.clearExportQueue,
      currentFrame: s.currentFrame,
      addToast: s.addToast
    }))
  );
  const [picked, setPicked] = useState<AspectRatio[]>(ASPECTS.map((a) => a.id).filter((a) => a !== project.aspectRatio));
  const [mode, setMode] = useState<ReframeMode>('fit');
  const [isCovering, setIsCovering] = useState(false);
  const settings = { ...DEFAULT_EXPORT_SETTINGS, ...project.exportSettings };
  const base = safeFileName(project.title);

  const toggle = (id: AspectRatio) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const downloadCover = async (aspect: AspectRatio) => {
    setIsCovering(true);
    try {
      const { renderCoverPng } = await import('../../engine/export/cover');
      const blob = await renderCoverPng(project, currentFrame / (project.fps || 30), { aspect, mode });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, `${base}-cover-${aspect.replace(':', 'x')}.png`);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      addToast(`Gagal membuat cover: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsCovering(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 pt-1 border-t border-border">
      <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Banyak Format Sekaligus</span>
      <div className="grid grid-cols-3 gap-1.5">
        {ASPECTS.map((a) => (
          <button key={a.id} type="button" aria-pressed={picked.includes(a.id)} onClick={() => toggle(a.id)} className={optionClass(picked.includes(a.id))}>
            {a.label}
            {a.id === project.aspectRatio && <span className="block text-[9px] font-normal opacity-70">asli</span>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" aria-pressed={mode === 'fit'} onClick={() => setMode('fit')} className={optionClass(mode === 'fit')}>
          Muat utuh
          <span className="block text-[9px] font-normal opacity-70">latar blur</span>
        </button>
        <button type="button" aria-pressed={mode === 'crop'} onClick={() => setMode('crop')} className={optionClass(mode === 'crop')}>
          Potong tengah
          <span className="block text-[9px] font-normal opacity-70">penuh, tepi terpotong</span>
        </button>
      </div>
      <p className="text-[10px] text-text-faint leading-snug">
        Setiap format dirender dari frame {project.aspectRatio} proyek ini. Untuk tata letak yang benar-benar disusun ulang, ganti rasio
        proyek lalu render biasa.
      </p>
      <button
        type="button"
        disabled={isExporting || picked.length === 0 || project.scenes.length === 0}
        onClick={() =>
          startQueue(
            ASPECTS.map((a) => a.id).filter((a) => picked.includes(a)),
            mode,
            { format: settings.format, fps: settings.fps, quality: settings.quality }
          )
        }
        className="w-full min-h-[40px] px-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">video_library</span>
        Render {picked.length} format
      </button>

      {queue.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {queue.map((item) => {
            const ext = item.result?.blob.type === 'video/webm' ? 'webm' : 'mp4';
            return (
              <li key={item.aspect} className="flex items-center gap-2 p-2 rounded-xl bg-surface-2 border border-border text-[11px]">
                <span className="font-mono text-on-surface w-10">{item.aspect}</span>
                <span className={`flex-1 truncate ${item.status === 'error' ? 'text-rose-300' : 'text-text-muted'}`} title={item.error}>
                  {STATUS_LABEL[item.status]}
                  {item.result && ` · ${(item.result.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                </span>
                {item.result && (
                  <button
                    type="button"
                    onClick={() => triggerFileDownload(item.result!.objectUrl, `${base}-${item.aspect.replace(':', 'x')}.${ext}`)}
                    className="h-7 px-2 rounded-lg bg-accent text-on-accent font-semibold"
                  >
                    Unduh
                  </button>
                )}
              </li>
            );
          })}
          {!isExporting && (
            <button type="button" onClick={clearQueue} className="self-end text-[10px] text-text-muted hover:text-rose-300">
              Bersihkan daftar
            </button>
          )}
        </ul>
      )}

      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Cover / Thumbnail (PNG)</span>
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={isCovering || project.scenes.length === 0}
              onClick={() => downloadCover(a.id)}
              className="py-2 rounded-xl bg-surface-2 border border-border text-[11px] font-semibold text-text-muted hover:text-accent disabled:opacity-50"
            >
              {a.id}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-text-faint">Diambil dari frame di posisi playhead.</span>
      </div>
    </div>
  );
};
