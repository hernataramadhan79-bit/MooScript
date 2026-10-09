import React, { useEffect, useState } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { CompositionStage } from './components/studio/CompositionStage';
import { TimelineBar } from './components/studio/TimelineBar';
import { SceneDeck } from './components/studio/SceneDeck';
import { InspectorRack } from './components/studio/InspectorRack';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';

export type MobileTab = 'naskah' | 'gaya' | 'suara' | 'ekspor';
export type InspectorTab = 'gaya' | 'suara' | 'ekspor';

export const App: React.FC = () => {
  const { initStore, togglePlay, project } = useMooStore();

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('gaya');
  const [mobileTab, setMobileTab] = useState<MobileTab>('naskah');

  useEffect(() => {
    initStore().catch((err) => console.error('Failed to init store', err));
  }, [initStore]);

  // Global spacebar listener for playback transport
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
          return;
        }
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  const handleOpenExport = () => {
    setInspectorTab('ekspor');
    setMobileTab('ekspor');
  };

  const mobileTabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'naskah', label: 'Naskah', icon: 'movie_filter' },
    { id: 'gaya', label: 'Gaya', icon: 'palette' },
    { id: 'suara', label: 'Suara', icon: 'graphic_eq' },
    { id: 'ekspor', label: 'Ekspor', icon: 'download' }
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-on-surface font-sans selection:bg-accent selection:text-on-accent overflow-hidden">
      {/* 1. Header Minimalis Pro */}
      <Header onOpenExport={handleOpenExport} />

      {/* 2. Main Studio Workstation Layout */}
      <main className="flex-1 pt-14 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* ================= DESKTOP 3-ZONE LAYOUT ================= */}

        {/* Zona Kiri: Scene Deck (Storyboard & Scene Manager) - Desktop Only */}
        <aside className="hidden lg:flex w-[340px] xl:w-[380px] shrink-0 border-r border-border bg-surface-1 flex-col h-full overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-1/90 backdrop-blur-sm flex items-center justify-between shrink-0 select-none">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-accent">movie_filter</span>
              Naskah & Adegan
            </span>
            <span className="text-[11px] font-mono text-text-muted px-2 py-0.5 rounded-full bg-surface-2 border border-border">
              {project.scenes?.length || 0} Adegan
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <SceneDeck />
          </div>
        </aside>

        {/* Zona Tengah: Center Stage (Canvas Viewport + Master Timeline) - Desktop & Mobile */}
        <section className="flex-1 flex flex-col h-full bg-[#050507] overflow-hidden min-w-0">
          {/* Top Half on Mobile / Full Height Center on Desktop */}
          <div className="hidden lg:flex flex-1 min-h-0 relative items-center justify-center p-2 sm:p-4 overflow-hidden">
            <CompositionStage className="w-full h-full" />
          </div>

          {/* Desktop Master Timeline Bar */}
          <div className="hidden lg:block shrink-0 w-full p-2.5 sm:pt-0 bg-surface-1/40 backdrop-blur-sm border-t border-border/40">
            <TimelineBar />
          </div>

          {/* Mobile Top Viewport: Stage Preview + Compact Timeline */}
          <div className="flex lg:hidden flex-none h-[42vh] sm:h-[46vh] bg-[#050507] flex-col border-b border-border">
            <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 overflow-hidden">
              <CompositionStage className="w-full h-full" />
            </div>
            <div className="shrink-0 p-1.5 bg-surface-1/40 border-t border-border/30">
              <TimelineBar />
            </div>
          </div>

          {/* Mobile Bottom Workspace: Tabbed Drawer */}
          <div className="flex lg:hidden flex-1 flex-col min-h-0 bg-surface-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {mobileTab === 'naskah' && <SceneDeck className="h-full" />}
              {mobileTab === 'gaya' && (
                <InspectorRack
                  activeTab="gaya"
                  onTabChange={(t) => setMobileTab(t)}
                  className="h-full border-0 rounded-none shadow-none"
                />
              )}
              {mobileTab === 'suara' && (
                <InspectorRack
                  activeTab="suara"
                  onTabChange={(t) => setMobileTab(t)}
                  className="h-full border-0 rounded-none shadow-none"
                />
              )}
              {mobileTab === 'ekspor' && (
                <InspectorRack
                  activeTab="ekspor"
                  onTabChange={(t) => setMobileTab(t)}
                  className="h-full border-0 rounded-none shadow-none"
                />
              )}
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="shrink-0 border-t border-border bg-surface-1/95 backdrop-blur-md px-2 py-1.5 grid grid-cols-4 gap-1 select-none">
              {mobileTabs.map((tab) => {
                const isActive = mobileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMobileTab(tab.id)}
                    className={`py-1.5 px-1 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                      isActive
                        ? 'bg-surface-3 text-accent shadow-sm'
                        : 'text-text-muted hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </section>

        {/* Zona Kanan: Inspector Rack (Gaya, Suara, Ekspor) - Desktop Only */}
        <aside className="hidden lg:flex w-[340px] xl:w-[380px] shrink-0 border-l border-border bg-surface-1 flex-col h-full overflow-hidden">
          <InspectorRack
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            className="h-full border-0 rounded-none shadow-none"
          />
        </aside>
      </main>

      {/* 3. Settings Drawer */}
      <SettingsDrawer />

      {/* 4. Toast Notifications */}
      <ToastContainer />

      {/* 5. PWA Reload Prompt */}
      <PwaReloadPrompt />
    </div>
  );
};
