import React, { useState } from 'react';
import { useMooStore } from '../store/useMooStore';
import { ProjectManagerModal } from './ProjectManagerModal';

export const Header: React.FC = () => {
  const { project, settings, setSettingsOpen, previewMode, setPreviewMode } = useMooStore();
  const [showProjectModal, setShowProjectModal] = useState(false);

  const hasApiKey = Boolean(settings.apiKeys.gemini || settings.apiKeys.openai || settings.apiKeys.groq);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-11 sm:h-14 bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.08] select-none">
        <div className="h-full px-2.5 sm:px-4 max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Brand & Mascot */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="relative flex items-center justify-center">
              <img
                alt="MooScript Logo"
                className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-lg shadow-sm"
                src="/logo.svg"
              />
              <div className="absolute -inset-0.5 rounded-lg bg-primary/20 blur-sm -z-10" />
            </div>

            <div className="flex items-center gap-1">
              <span className="font-extrabold text-[13px] sm:text-[15px] tracking-tight text-white font-sans">
                MooScript
              </span>
              <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25 uppercase tracking-wider hidden sm:inline">
                Studio
              </span>
            </div>
          </div>

          {/* Project Switcher Trigger */}
          <button
            type="button"
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] text-[11px] sm:text-xs font-semibold text-zinc-200 transition-all shrink min-w-0 active:scale-95 shadow-sm"
            title="Kelola & pindah proyek"
          >
            <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-primary shrink-0">
              video_library
            </span>
            <span className="truncate max-w-[100px] sm:max-w-[200px] md:max-w-[280px]">
              {project.title}
            </span>
            <span className="material-symbols-outlined text-[13px] sm:text-[15px] text-zinc-400 shrink-0">
              unfold_more
            </span>
          </button>

          {/* Status, Mobile Preview Switcher & Settings Drawer Trigger */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Viewport Mode Switcher */}
            <button
              type="button"
              onClick={() => {
                setPreviewMode(
                  previewMode === 'compact'
                    ? 'theater'
                    : previewMode === 'theater'
                    ? 'ticker'
                    : 'compact'
                );
              }}
              className="lg:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.1] text-[10px] font-mono text-zinc-300 hover:text-white transition-all active:scale-95"
              title={`Mode Pratinjau: ${previewMode}. Ketuk untuk ganti.`}
            >
              <span className="material-symbols-outlined text-[13px] text-primary">
                {previewMode === 'theater'
                  ? 'fullscreen_exit'
                  : previewMode === 'compact'
                  ? 'aspect_ratio'
                  : 'visibility_off'}
              </span>
              <span className="capitalize">{previewMode}</span>
            </button>

            {/* BYOK Connection Pill */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.08] transition-all cursor-pointer"
              title="Klik untuk membuka Pengaturan & BYOK Keys"
            >
              <span
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  hasApiKey ? 'bg-primary shadow-[0_0_8px_#9ee939] animate-pulse' : 'bg-amber-400 shadow-[0_0_6px_#f59e0b]'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-mono text-zinc-300 font-medium hidden md:inline">
                {hasApiKey ? 'BYOK Connected' : 'Offline / BGM'}
              </span>
            </button>

            {/* Settings Drawer Button */}
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-primary/40 text-zinc-400 hover:text-white flex items-center justify-center transition-all active:scale-95"
              title="Open Settings"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">tune</span>
            </button>
          </div>
        </div>
      </header>

      <ProjectManagerModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
      />
    </>
  );
};
