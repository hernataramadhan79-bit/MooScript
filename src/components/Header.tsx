import React, { useState } from 'react';
import { useMooStore } from '../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { ProjectManagerModal } from './ProjectManagerModal';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';

interface HeaderProps {
  onOpenExport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExport }) => {
  const { project, settings, setSettingsOpen, setShortcutsOpen, updateTitle, canUndo, canRedo, undo, redo } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      settings: s.settings,
      setSettingsOpen: s.setSettingsOpen,
      setShortcutsOpen: s.setShortcutsOpen,
      updateTitle: s.updateTitle,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      undo: s.undo,
      redo: s.redo
    }))
  );

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(project.title);
  // Escape leaves the field; the blur that may follow must not save the typed title.
  const titleCancelledRef = React.useRef(false);

  React.useEffect(() => {
    if (!editingTitle) {
      setTitleInput(project.title);
    }
  }, [project.id, project.title, editingTitle]);

  const hasApiKey = Boolean(
    settings.apiKeys.gemini ||
    settings.apiKeys.openai ||
    settings.apiKeys.groq ||
    settings.apiKeys.anthropic ||
    settings.apiKeys.openrouter
  );

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    if (titleCancelledRef.current) {
      titleCancelledRef.current = false;
      return;
    }
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== project.title) {
      updateTitle(trimmed);
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-[var(--header-h)] pt-[env(safe-area-inset-top)] bg-surface-1/95 backdrop-blur-xl border-b border-border select-none">
        <div className="h-full px-2.5 sm:px-4 max-w-[1920px] mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Sisi Kiri: Logo + Judul Proyek */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 shrink-0">
              <svg
                aria-label="MooScript Logo"
                className="w-7 h-7 rounded-lg shrink-0 shadow-sm"
                fill="none"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect fill="#09090b" height="100" rx="22" width="100" />
                <rect fill="none" height="98" rx="21" stroke="#27272a" strokeWidth="1.5" width="98" x="1" y="1" />
                <path d="M22 24 L38 32 L34 42 L20 34 Z" fill="#84cc16" />
                <path d="M78 24 L62 32 L66 42 L80 34 Z" fill="#84cc16" />
                <path d="M30 36 H70 L74 54 H26 Z" fill="#84cc16" />
                <rect fill="#84cc16" height="24" rx="12" width="52" x="24" y="58" />
                <rect fill="#09090b" height="7" rx="1.5" width="7" x="36" y="42" />
                <rect fill="#09090b" height="7" rx="1.5" width="7" x="57" y="42" />
                <rect fill="#09090b" height="8" rx="3" width="6" x="38" y="66" />
                <rect fill="#09090b" height="8" rx="3" width="6" x="56" y="66" />
              </svg>
              <span className="font-extrabold text-[15px] tracking-tight text-on-surface hidden sm:inline">
                MooScript<span className="text-accent ml-0.5">Studio</span>
              </span>
            </div>

            <div className="h-4 w-[1px] bg-border hidden sm:block shrink-0" />

            {/* Title Renamer & Switcher */}
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 sm:flex-initial">
              {editingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      titleCancelledRef.current = true;
                      setTitleInput(project.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="bg-surface-2 border border-accent rounded-lg px-2.5 h-8 text-[13px] font-semibold text-on-surface focus:outline-none w-full min-w-[120px] sm:w-[220px]"
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      titleCancelledRef.current = false;
                      setTitleInput(project.title);
                      setEditingTitle(true);
                    }}
                    title="Klik untuk mengubah nama proyek"
                    className="flex items-center justify-between gap-1.5 px-2.5 h-8 rounded-lg bg-surface-2/60 sm:bg-transparent hover:bg-surface-2 border border-border/60 sm:border-transparent text-[13px] font-semibold text-on-surface transition-colors min-w-0 flex-1 sm:flex-initial sm:max-w-[240px]"
                  >
                    <span className="truncate">{project.title}</span>
                    <span className="material-symbols-outlined text-[14px] text-text-faint shrink-0">edit</span>
                  </button>

                  <IconButton
                    icon="folder_open"
                    aria-label="Kelola Proyek"
                    size="sm"
                    onClick={() => setShowProjectModal(true)}
                  />
                </>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Riwayat, Status & Aksi Utama */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {!editingTitle && (
              <div className="flex items-center gap-0.5 bg-surface-2/60 sm:bg-transparent border border-border/60 sm:border-0 rounded-lg p-0.5 sm:p-0">
                <IconButton
                  icon="undo"
                  aria-label="Batalkan (Ctrl+Z)"
                  size="sm"
                  disabled={!canUndo}
                  onClick={undo}
                />
                <IconButton
                  icon="redo"
                  aria-label="Ulangi (Ctrl+Y)"
                  size="sm"
                  disabled={!canRedo}
                  onClick={redo}
                />
              </div>
            )}

            <IconButton
              icon="keyboard"
              aria-label="Shortcut keyboard (?)"
              size="sm"
              onClick={() => setShortcutsOpen(true)}
              className="hidden lg:inline-flex"
            />

            {/* Status Kunci API / Mode Lokal */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 h-8 rounded-lg bg-surface-2 border border-border text-[12px] font-medium text-text-muted hover:text-on-surface transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-accent' : 'bg-amber-400'}`} />
              <span>{hasApiKey ? 'Kunci API Aktif' : 'Mode Lokal'}</span>
            </button>

            {onOpenExport && (
              <Button
                variant="primary"
                size="sm"
                icon="file_download"
                aria-label="Ekspor Video"
                title="Ekspor Video"
                onClick={onOpenExport}
                className="!px-2.5 sm:!px-3"
              >
                <span className="hidden sm:inline">Ekspor</span>
              </Button>
            )}

            <IconButton
              icon="tune"
              aria-label="Pengaturan API & Studio"
              size="sm"
              badge={!hasApiKey}
              onClick={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </header>

      <ProjectManagerModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} />
    </>
  );
};
