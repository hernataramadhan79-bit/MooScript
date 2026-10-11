import React, { useEffect, useState } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { CompositionStage } from './components/studio/CompositionStage';
import { TimelineBar } from './components/studio/TimelineBar';
import { SceneDeck } from './components/studio/SceneDeck';
import { InspectorRack, type InspectorTab } from './components/studio/InspectorRack';
import { CodeInspectorModal } from './features/scene/CodeInspectorModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';
import { useMediaQuery } from './utils/hooks';

export type MobileTab = 'naskah' | 'mograph' | 'style' | 'audio' | 'ekspor';
export type { InspectorTab };

export const App: React.FC = () => {
  const { initStore, togglePlay, setActiveSceneId } = useMooStore();
  // Tailwind lg breakpoint. Only one layout is mounted so stage/timeline/inspector exist once.
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('mograph');
  const [mobileTab, setMobileTab] = useState<MobileTab>('naskah');
  const [inspectingBeatId, setInspectingBeatId] = useState<string | null>(null);

  useEffect(() => {
    initStore().catch((err) => console.error('Failed to init store', err));
  }, [initStore]);

  // Global spacebar listener for playback transport
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          tag === 'button' ||
          tag === 'a' ||
          target?.isContentEditable ||
          target?.closest?.('[role="slider"], [role="dialog"], .cm-editor')
        ) {
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

  const handleEditScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    setInspectorTab('style');
    setMobileTab('style');
  };

  const mobileTabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'naskah', label: 'Naskah', icon: 'edit_note' },
    { id: 'mograph', label: 'Mograph', icon: 'movie_filter' },
    { id: 'style', label: 'Gaya', icon: 'tune' },
    { id: 'audio', label: 'Audio', icon: 'graphic_eq' },
    { id: 'ekspor', label: 'Ekspor', icon: 'download' }
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-on-surface font-sans selection:bg-accent selection:text-on-accent overflow-hidden">
      {/* 1. Header Minimalis Pro */}
      <Header onOpenExport={handleOpenExport} />

      {/* 2. Main Studio Workstation Layout: exactly one layout is mounted at a time */}
      <main className="flex-1 pt-14 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {isDesktop ? (
          <>
            {/* Zona 1: Storyboard / SceneDeck */}
            <aside className="flex w-[340px] xl:w-[380px] shrink-0 border-r border-border bg-surface-1 flex-col h-full overflow-hidden">
              <SceneDeck
                className="h-full overflow-y-auto"
                onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                onEditScene={handleEditScene}
              />
            </aside>

            {/* Zona 2: Stage + Master Timeline */}
            <section className="flex-1 flex flex-col h-full bg-[#050507] overflow-hidden min-w-0">
              <div className="flex flex-1 min-h-0 relative items-center justify-center p-2 sm:p-4 overflow-hidden">
                <CompositionStage className="w-full h-full" />
              </div>
              <div className="shrink-0 w-full p-2.5 sm:pt-0 bg-surface-1/40 border-t border-border/40">
                <TimelineBar />
              </div>
            </section>

            {/* Zona 3: Inspector Rack */}
            <aside className="flex w-[340px] xl:w-[380px] shrink-0 border-l border-border bg-surface-1 flex-col h-full overflow-hidden">
              <InspectorRack
                activeTab={inspectorTab}
                onTabChange={setInspectorTab}
                onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                className="h-full border-0 rounded-none shadow-none"
              />
            </aside>
          </>
        ) : (
          <section className="flex-1 flex flex-col h-full bg-[#050507] overflow-hidden min-w-0">
            {/* Mobile Top Viewport: Stage Preview + Compact Timeline */}
            <div className="flex flex-none h-[42vh] sm:h-[46vh] bg-[#050507] flex-col border-b border-border">
              <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 overflow-hidden">
                <CompositionStage className="w-full h-full" />
              </div>
              <div className="shrink-0 p-1.5 bg-surface-1/40 border-t border-border/30">
                <TimelineBar />
              </div>
            </div>

            {/* Mobile Bottom Workspace: Tabbed Drawer */}
            <div className="flex flex-1 flex-col min-h-0 bg-surface-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {mobileTab === 'naskah' ? (
                  <SceneDeck
                    className="h-full overflow-y-auto"
                    onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                    onEditScene={handleEditScene}
                  />
                ) : (
                  <InspectorRack
                    activeTab={mobileTab}
                    onTabChange={(t) => setMobileTab(t)}
                    onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                    className="h-full border-0 rounded-none shadow-none"
                  />
                )}
              </div>

              {/* Mobile Bottom Navigation Bar (5 Tab) */}
              <nav className="shrink-0 border-t border-border bg-surface-1 px-1 py-1.5 grid grid-cols-5 gap-0.5 select-none">
                {mobileTabs.map((tab) => {
                  const isActive = mobileTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileTab(tab.id)}
                      className={`py-1.5 px-0.5 rounded-xl text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
                        isActive
                          ? 'bg-surface-3 text-accent shadow-sm'
                          : 'text-text-muted hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
                      <span className="truncate max-w-[45px]">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </section>
        )}
      </main>

      {/* 3. Code Inspector Modal */}
      <CodeInspectorModal
        beatId={inspectingBeatId}
        isOpen={Boolean(inspectingBeatId)}
        onClose={() => setInspectingBeatId(null)}
      />

      {/* 4. Settings Drawer */}
      <SettingsDrawer />

      {/* 5. Toast Notifications */}
      <ToastContainer />

      {/* 6. PWA Reload Prompt */}
      <PwaReloadPrompt />
    </div>
  );
};
