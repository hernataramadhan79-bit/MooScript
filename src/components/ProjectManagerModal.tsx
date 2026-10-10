import React, { useState, useEffect } from 'react';
import { useMooStore } from '../store/useMooStore';
import type { MooProject } from '../types';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    project: activeProject,
    projectsList,
    createNewProject,
    switchProject,
    duplicateProject,
    deleteProject,
    renameProject
  } = useMooStore();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingId, onClose]);

  if (!isOpen) return null;

  const handleStartRename = (p: MooProject) => {
    setEditingId(p.id);
    setEditingTitle(p.title);
  };

  const handleSaveRename = async (p: MooProject) => {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== p.title) {
      await renameProject(p.id, trimmed);
    }
    setEditingId(null);
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

  const handleDelete = async (e: React.MouseEvent, p: MooProject) => {
    e.stopPropagation();
    if (projectsList.length <= 1) {
      return;
    }
    const confirmed = window.confirm(`Delete project "${p.title}"? This cannot be undone.`);
    if (confirmed) {
      await deleteProject(p.id);
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Recent';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
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

        {/* Project List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-zinc-800/40">
          {projectsList.map((p) => {
            const isActive = p.id === activeProject.id;
            const isEditing = editingId === p.id;
            const sceneCount = p.scenes?.length || 0;
            const duration = p.audioDuration || 0;

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
                          if (e.key === 'Enter') handleSaveRename(p);
                          if (e.key === 'Escape') setEditingId(null);
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
                    onClick={(e) => handleDuplicate(e, p.id)}
                    title="Duplikat proyek"
                    className="w-7 h-7 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, p)}
                    disabled={projectsList.length <= 1}
                    title={projectsList.length <= 1 ? 'Tidak dapat menghapus proyek satu-satunya' : 'Hapus proyek'}
                    className="w-7 h-7 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Penyimpanan Lokal</span>
          <span>Ganti proyek kapan saja</span>
        </div>
      </div>
    </div>
  );
};
