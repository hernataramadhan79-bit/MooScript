import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { CompositionStage } from './components/studio/CompositionStage';
import { TimelineBar } from './components/studio/TimelineBar';
import { SceneDeck } from './components/studio/SceneDeck';
import { InspectorRack, type InspectorTab } from './components/studio/InspectorRack';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';
import { WelcomeModal } from './components/WelcomeModal';
import { useMediaQuery } from './utils/hooks';
import { useKeyboardShortcuts } from './utils/useKeyboardShortcuts';

// Opened on demand, so keep them out of the initial bundle.
const CodeInspectorModal = lazy(() =>
  import('./features/scene/CodeInspectorModal').then((m) => ({ default: m.CodeInspectorModal }))
);
const SettingsDrawer = lazy(() =>
  import('./components/SettingsDrawer').then((m) => ({ default: m.SettingsDrawer }))
);

export type MobileTab = 'naskah' | 'mograph' | 'style' | 'asset' | 'audio' | 'ekspor';
export type { InspectorTab };

export const App: React.FC = () => {
  const initStore = useMooStore((s) => s.initStore);
  const focusScene = useMooStore((s) => s.focusScene);
  const isSettingsOpen = useMooStore((s) => s.isSettingsOpen);
  const isStageCollapsed = useMooStore((s) => s.previewMode === 'ticker');
  // Tailwind lg breakpoint. Only one layout is mounted so stage/timeline/inspector exist once.
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('mograph');
  const [mobileTab, setMobileTab] = useState<MobileTab>('naskah');
  const [inspectingBeatId, setInspectingBeatId] = useState<string | null>(null);

  useEffect(() => {
    initStore().catch((err) => console.error('Failed to init store', err));
  }, [initStore]);

  // Global workstation keyboard shortcuts
  useKeyboardShortcuts();

  const handleOpenExport = () => {
    setInspectorTab('ekspor');
    setMobileTab('ekspor');
  };

  const handleEditScene = (sceneId: string) => {
    focusScene(sceneId);
    setInspectorTab('style');
    setMobileTab('style');
  };

  const handleOpenAssets = (sceneId?: string) => {
    if (sceneId) focusScene(sceneId);
    setInspectorTab('asset');
    setMobileTab('asset');
  };

  const mobileTabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'naskah', label: 'Naskah', icon: 'edit_note' },
    { id: 'mograph', label: 'Mograph', icon: 'movie_filter' },
    { id: 'style', label: 'Gaya', icon: 'tune' },
    { id: 'asset', label: 'Aset', icon: 'perm_media' },
    { id: 'audio', label: 'Audio', icon: 'graphic_eq' },
    { id: 'ekspor', label: 'Ekspor', icon: 'download' }
  ];

  return (
    <div className="h-screen h-dvh w-full flex flex-col bg-background text-on-surface font-sans selection:bg-accent selection:text-on-accent overflow-hidden">
      {/* 1. Header Minimalis Pro */}
      <Header onOpenExport={handleOpenExport} />

      {/* 2. Main Studio Workstation Layout: exactly one layout is mounted at a time */}
      <main className="flex-1 pt-[var(--header-h)] flex flex-col lg:flex-row overflow-hidden min-h-0">
        {isDesktop ? (
          <>
            {/* Zona 1: Storyboard / SceneDeck */}
            <aside className="flex w-[340px] xl:w-[380px] shrink-0 border-r border-border bg-surface-1 flex-col h-full overflow-hidden">
              <SceneDeck
                className="h-full overflow-y-auto"
                onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                onEditScene={handleEditScene}
                onOpenAssets={handleOpenAssets}
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
            {/* Mobile top: stage preview (can be collapsed to give the editor more room) + transport */}
            <div
              className={`flex flex-none flex-col bg-[#050507] border-b border-border ${
                isStageCollapsed ? '' : 'h-[44dvh] min-h-[260px] max-h-[520px]'
              }`}
            >
              <div
                className={`${isStageCollapsed ? 'hidden' : 'flex'} flex-1 min-h-0 relative items-center justify-center overflow-hidden`}
              >
                <CompositionStage className="w-full h-full" />
              </div>
              <div className="shrink-0 px-2 pb-2 pt-1">
                <TimelineBar compact />
              </div>
            </div>

            {/* Mobile bottom workspace. Both panels stay mounted so an AI generation, its cancel
                button and the export settings survive switching tabs. */}
            <div className="flex flex-1 flex-col min-h-0 bg-surface-1 overflow-hidden">
              <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${mobileTab === 'naskah' ? '' : 'hidden'}`}>
                <SceneDeck
                  onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                  onEditScene={handleEditScene}
                  onOpenAssets={handleOpenAssets}
                />
              </div>
              <div className={`flex-1 min-h-0 overflow-hidden ${mobileTab === 'naskah' ? 'hidden' : 'flex flex-col'}`}>
                <InspectorRack
                  activeTab={mobileTab === 'naskah' ? 'mograph' : mobileTab}
                  onTabChange={(t) => setMobileTab(t)}
                  onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                  className="h-full border-0 rounded-none shadow-none"
                />
              </div>

              {/* Mobile bottom navigation */}
              <nav
                aria-label="Panel studio"
                className="shrink-0 border-t border-border bg-surface-1 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-6 gap-1 select-none"
              >
                {mobileTabs.map((tab) => {
                  const isActive = mobileTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileTab(tab.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`min-h-[48px] py-1 px-0.5 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                        isActive ? 'bg-surface-3 text-accent' : 'text-text-muted hover:text-on-surface'
                      }`}
                    >
                      <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>
                        {tab.icon}
                      </span>
                      <span className="truncate max-w-full">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </section>
        )}
      </main>

      {/* 3. Code Inspector Modal */}
      <Suspense fallback={null}>
        {inspectingBeatId && (
          <CodeInspectorModal
            beatId={inspectingBeatId}
            isOpen
            onClose={() => setInspectingBeatId(null)}
          />
        )}

        {/* 4. Settings Drawer */}
        {isSettingsOpen && <SettingsDrawer />}
      </Suspense>

      {/* 5. Toast Notifications */}
      <ToastContainer />

      {/* 6. PWA Reload Prompt */}
      <PwaReloadPrompt />

      {/* 7. Welcome */}
      <WelcomeModal />
    </div>
  );
};
