import React, { useState } from 'react';
import { useMooStore } from '../store/useMooStore';
import { ProjectManagerModal } from './ProjectManagerModal';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';

interface HeaderProps {
  onOpenExport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExport }) => {
  const { project, settings, setSettingsOpen, updateTitle } = useMooStore();

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(project.title);

  const hasApiKey = Boolean(
    settings.apiKeys.gemini ||
    settings.apiKeys.openai ||
    settings.apiKeys.groq ||
    settings.apiKeys.anthropic ||
    settings.apiKeys.openrouter
  );

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    if (titleInput.trim() && titleInput !== project.title) {
      updateTitle(titleInput.trim());
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-14 bg-surface-1/95 backdrop-blur-xl border-b border-border select-none">
        <div className="h-full px-4 max-w-[1920px] mx-auto flex items-center justify-between gap-3">
          {/* Sisi Kiri: Logo + Judul Proyek */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <img alt="MooScript Logo" className="w-7 h-7 rounded-lg" src="/logo.svg" />
              <span className="font-extrabold text-[15px] tracking-tight text-on-surface hidden sm:inline">
                MooScript<span className="text-accent ml-0.5">Studio</span>
              </span>
            </div>

            <div className="h-4 w-[1px] bg-border hidden sm:block shrink-0" />

            {/* Title Renamer & Switcher */}
            <div className="flex items-center gap-1.5 min-w-0">
              {editingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSubmit();
                    if (e.key === 'Escape') {
                      setTitleInput(project.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="bg-surface-2 border border-accent rounded-lg px-2.5 h-8 text-[13px] font-semibold text-on-surface focus:outline-none w-[160px] sm:w-[220px]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(project.title);
                    setEditingTitle(true);
                  }}
                  title="Klik untuk mengubah nama proyek"
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg hover:bg-surface-2 text-[13px] font-semibold text-on-surface transition-colors truncate max-w-[140px] sm:max-w-[220px]"
                >
                  <span className="truncate">{project.title}</span>
                  <span className="material-symbols-outlined text-[14px] text-text-faint shrink-0">edit</span>
                </button>
              )}

              <IconButton
                icon="folder_open"
                aria-label="Kelola Proyek"
                size="sm"
                onClick={() => setShowProjectModal(true)}
              />
            </div>
          </div>

          {/* Sisi Kanan: Status & Aksi Utama */}
          <div className="flex items-center gap-2 shrink-0">
            {/* BYOK Status Badge */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 h-8 rounded-lg bg-surface-2 border border-border text-[12px] font-medium text-text-muted hover:text-on-surface transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-accent' : 'bg-amber-400'}`} />
              <span>{hasApiKey ? 'BYOK Terhubung' : 'Offline / Local'}</span>
            </button>

            {onOpenExport && (
              <Button variant="primary" size="sm" icon="file_download" onClick={onOpenExport}>
                Ekspor
              </Button>
            )}

            <IconButton
              icon="tune"
              aria-label="Pengaturan API & Studio"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </header>

      <ProjectManagerModal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} />
    </>
  );
};
