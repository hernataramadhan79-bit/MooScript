import React, { useState, useEffect, useRef } from 'react';
import { useMooStore } from '../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import type { MooProject } from '../types';
import { ConfirmModal } from './ui/ConfirmModal';
import { flushPendingSave } from '../store/slices/projectSlice';
import { loadProjectFromDb } from '../db/mooDb';
import { MAX_BACKUP_BYTES, parseProjectBackup, serializeProjectBackup } from '../db/projectBackup';
import { safeFileName, triggerFileDownload } from '../utils/fileUtils';
import { isFromModalDialog } from '../utils/hooks';
import { PROJECT_TEMPLATES } from '../engine/templates/projectTemplates';
import { getProjectDuration } from '../utils/projectDuration';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    project: activeProject,
    projectsList,
    createNewProject,
    createProjectFromTemplate,
    switchProject,
    duplicateProject,
    deleteProject,
    renameProject,
    importProject,
    addToast
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      projectsList: s.projectsList,
      createNewProject: s.createNewProject,
      createProjectFromTemplate: s.createProjectFromTemplate,
      switchProject: s.switchProject,
      duplicateProject: s.duplicateProject,
      deleteProject: s.deleteProject,
      renameProject: s.renameProject,
      importProject: s.importProject,
      addToast: s.addToast
    }))
  );

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<MooProject | null>(null);
  // Escape closes the rename field; the blur that follows must not save the typed title.
  const renameCancelledRef = useRef(false);
  // Work that belongs to the open project and stops when another project is opened.
  const runningJob = useMooStore((s) =>
    s.isExporting
      ? 'Ekspor video'
      : s.isCompilingMograph || s.revisingSceneId
        ? 'Pembuatan visual AI'
        : s.isGeneratingScript
          ? 'Penyusunan naskah AI'
          : s.isGeneratingAudio
            ? 'Pembuatan suara'
            : null
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingId && !isFromModalDialog(e)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingId, onClose]);

  if (!isOpen) return null;

  const handleStartRename = (p: MooProject) => {
    renameCancelledRef.current = false;
    setEditingId(p.id);
    setEditingTitle(p.title);
  };

  const handleSaveRename = async (p: MooProject) => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (trimmed && trimmed !== p.title) {
      await renameProject(p.id, trimmed);
    }
  };

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      await createNewProject();
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      setIsCreating(true);
      await createProjectFromTemplate(templateId);
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitch = async (id: string) => {
    if (id !== activeProject.id) {
      await switchProject(id);
    }
    onClose();
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await duplicateProject(id);
  };

  const handleExport = async (e: React.MouseEvent, p: MooProject) => {
    e.stopPropagation();
    try {
      await flushPendingSave();
      const full = p.id === activeProject.id ? activeProject : await loadProjectFromDb(p.id);
      if (!full) {
        addToast('Proyek tidak ditemukan.', 'error');
        return;
      }
      const blob = new Blob([serializeProjectBackup(full)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, `${safeFileName(full.title)}.mooscript.json`);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengunduh cadangan.', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      addToast('Berkas terlalu besar (maks 20 MB).', 'error');
      return;
    }
    try {
      await importProject(parseProjectBackup(await file.text()));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengimpor proyek.', 'error');
    }
  };

  const handleDelete = (e: React.MouseEvent, p: MooProject) => {
    e.stopPropagation();
    if (projectsList.length <= 1) {
      return;
    }
    setProjectToDelete(p);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Baru';
    const date = new Date(ts);
    return date.toLocaleDateString('id-ID', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#141416] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">video_library</span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-white">Daftar Proyek</h2>
              <span className="text-[11px] font-mono text-zinc-500">
                {projectsList.length} proyek
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="px-3 h-8 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95">
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Impor</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="px-3 h-8 rounded-lg bg-primary hover:bg-lime-300 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Proyek Baru</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Tutup modal"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {runningJob && (
          <div
            role="status"
            className="mx-4 mt-3 p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[11px] leading-relaxed flex gap-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] shrink-0">info</span>
            <span>
              {runningJob} sedang berjalan. Proses itu dibatalkan jika Anda membuka atau membuat proyek lain.
            </span>
          </div>
        )}

        {/* Template starters */}
        <div className="px-4 pt-3 pb-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Mulai dari template</span>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROJECT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={isCreating}
                onClick={() => handleCreateFromTemplate(tpl.id)}
                title={tpl.description}
                className="p-2.5 rounded-xl border border-zinc-800 bg-[#18181b]/70 hover:border-primary/60 hover:bg-[#18181b] text-left transition-all active:scale-[0.98] disabled:opacity-50 flex flex-col gap-1"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">{tpl.icon}</span>
                <span className="text-[12px] font-semibold text-zinc-100 leading-tight">{tpl.title}</span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {tpl.aspectRatio} · {tpl.scenes.length} adegan
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Project List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-zinc-800/40">
          {projectsList.map((p) => {
            const isActive = p.id === activeProject.id;
            const isEditing = editingId === p.id;
            const sceneCount = p.scenes?.length || 0;
            const duration = getProjectDuration(p);

            return (
              <div
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-zinc-800/90 border-primary shadow-sm shadow-primary/10'
                    : 'bg-[#18181b]/70 border-zinc-800 hover:border-zinc-700 hover:bg-[#18181b]'
                }`}
              >
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveRename(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            renameCancelledRef.current = true;
                            setEditingId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-black border border-primary px-2 py-0.5 rounded text-xs text-white font-bold focus:outline-none"
                      />
                    ) : (
                      <span className="font-bold text-[13px] text-white truncate max-w-[240px]">
                        {p.title}
                      </span>
                    )}

                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                        Aktif
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-zinc-400">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-zinc-500">movie</span>
                      {sceneCount} adegan
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-zinc-500">timer</span>
                      {duration.toFixed(1)}s
                    </span>
                    <span>•</span>
                    <span>{formatTimestamp(p.updatedAt || p.createdAt)}</span>
                  </div>
                </div>

                {/* Right action buttons */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => handleStartRename(p)}
                      title="Ubah nama proyek"
                      className="w-7 h-7 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleExport(e, p)}
                    title="Unduh cadangan proyek"
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDuplicate(e, p.id)}
                    title="Duplikat proyek"
                    className="w-8 h-8 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, p)}
                    disabled={projectsList.length <= 1}
                    title={projectsList.length <= 1 ? 'Tidak dapat menghapus proyek satu-satunya' : 'Hapus proyek'}
                    className="w-8 h-8 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Penyimpanan Lokal</span>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Kebijakan Privasi
          </a>
        </div>
      </div>

      {/* Konfirmasi Hapus Proyek */}
      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirm={async () => {
          if (projectToDelete) {
            await deleteProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        title="Hapus Proyek"
        description={`Apakah Anda yakin ingin menghapus proyek "${projectToDelete?.title || ''}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Proyek"
        cancelLabel="Batal"
        variant="danger"
        icon="delete_forever"
      />
    </div>
  );
};
