import React, { useState } from 'react';
import { useMooStore } from '../store/useMooStore';
import { ProjectManagerModal } from './ProjectManagerModal';

export const Header: React.FC = () => {
  const { project, settings, setActiveTab, activeTab } = useMooStore();
  const [showProjectModal, setShowProjectModal] = useState(false);

  const hasApiKey = Boolean(settings.apiKeys.gemini || settings.apiKeys.openai || settings.apiKeys.groq);

  return (
    <>
      <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="h-14 px-4 max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Mascot */}
          <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => setActiveTab('studio')}>
            <img alt="MooScript Logo" className="w-8 h-8 shrink-0 rounded-lg shadow-sm" src="/logo.svg" />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[15px] tracking-tight text-white">MooScript</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60 hidden sm:inline">
                v0.1.0
              </span>
            </div>
          </div>

          {/* Project Switcher Trigger */}
          <button
            type="button"
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-200 transition-all shrink min-w-0 active:scale-95 shadow-sm"
            title="Manage & switch projects"
          >
            <span className="material-symbols-outlined text-[15px] text-primary shrink-0">video_library</span>
            <span className="truncate max-w-[110px] sm:max-w-[200px] md:max-w-[280px]">{project.title}</span>
            <span className="material-symbols-outlined text-[15px] text-zinc-400 shrink-0">unfold_more</span>
          </button>

        {/* Status & Quick Settings */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors"
            onClick={() => setActiveTab('settings')}
            title="Click to manage BYOK API keys"
          >
            <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-primary animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-[11px] font-mono text-zinc-300 font-medium">
              {hasApiKey ? 'BYOK Connected' : 'Offline / BGM Mode'}
            </span>
          </div>

          <button
            aria-label="Settings"
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
              activeTab === 'settings'
                ? 'bg-primary text-black border-primary'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('settings')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
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
