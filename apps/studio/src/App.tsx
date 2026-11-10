import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { CompositionStage } from './components/studio/CompositionStage';
import { TimelineBar } from './components/studio/TimelineBar';
import { SceneDeck } from './components/studio/SceneDeck';
import { InspectorRack, type InspectorTab } from './components/studio/InspectorRack';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';
import { WelcomeModal } from './components/WelcomeModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { useMediaQuery } from './utils/hooks';
import { useKeyboardShortcuts } from './utils/useKeyboardShortcuts';
import { t, useLocale } from './i18n';
import { InstallDialog } from './components/InstallApp';

// Opened on demand, so keep them out of the initial bundle.
const CodeInspectorModal = lazy(() =>
  import('./features/scene/CodeInspectorModal').then((m) => ({ default: m.CodeInspectorModal }))
);
const SettingsDrawer = lazy(() =>
  import('./components/SettingsDrawer').then((m) => ({ default: m.SettingsDrawer }))
);

export type MobileTab = 'naskah' | 'mograph' | 'style' | 'asset' | 'audio' | 'subtitle' | 'ekspor';
export type { InspectorTab };

export const App: React.FC = () => {
  // Re-renders App on a language change; the keyed workspace below remounts so every label, including
  // ones computed once per mount, switches together. Project data lives in the store and survives it.
  const locale = useLocale();
  const initStore = useMooStore((s) => s.initStore);
  const focusScene = useMooStore((s) => s.focusScene);
  const isSettingsOpen = useMooStore((s) => s.isSettingsOpen);
  const isStageCollapsed = useMooStore((s) => s.previewMode === 'ticker');
  const selectedLayerId = useMooStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useMooStore((s) => s.setSelectedLayerId);
  // Tailwind lg breakpoint. Only one layout is mounted so stage/timeline/inspector exist once.
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('mograph');
  const [mobileTab, setMobileTab] = useState<MobileTab>('naskah');
  const [inspectingBeatId, setInspectingBeatId] = useState<string | null>(null);

  useEffect(() => {
    initStore().catch((err) => console.error('Failed to init store', err));
  }, [initStore]);

  useEffect(() => {
    document.title = t('MooScript Studio: Generator Motion Graphics Tanpa Server');
  }, [locale]);

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

  // Five destinations fit a phone's bottom bar with room for a thumb. Look, assets and subtitles are
  // one destination ("Gaya") with a switch at the top of the panel; the list on each entry says which panels it holds.
  const mobileTabs: { id: MobileTab; label: string; icon: string; tabs: MobileTab[] }[] = [
    { id: 'naskah', label: t('Naskah'), icon: 'edit_note', tabs: ['naskah'] },
    { id: 'mograph', label: t('Mograph'), icon: 'movie_filter', tabs: ['mograph'] },
    { id: 'style', label: t('Gaya'), icon: 'tune', tabs: ['style', 'asset', 'subtitle'] },
    { id: 'audio', label: t('Audio'), icon: 'graphic_eq', tabs: ['audio'] },
    { id: 'ekspor', label: t('Ekspor'), icon: 'download', tabs: ['ekspor'] }
  ];
  const lookTabs: { id: MobileTab; label: string }[] = [
    { id: 'style', label: t('Gaya & Layer') },
    { id: 'asset', label: t('Aset') },
    { id: 'subtitle', label: t('Subtitel') }
  ];
  const isLookTab = lookTabs.some((tab) => tab.id === mobileTab);

  // Swipe left/right on the mobile workspace to move between tabs. Gestures that start on
  // fields, sliders or horizontally scrolling rows are left alone.
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handleSwipeStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      e.touches.length !== 1 ||
      target.closest('input, textarea, select, [role="slider"], [data-no-swipe], .overflow-x-auto')
    ) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - start.t > 600) return;
    // Swiping walks every panel in order, including the three inside "Gaya".
    const order = mobileTabs.flatMap((t) => t.tabs);
    const next = order.indexOf(mobileTab) + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < order.length) setMobileTab(order[next]);
  };

  // Jump to the layer controls once the Gaya tab has rendered. The tab itself switches
  // instantly, so the scroll does too.
  const [layerJumpRequest, setLayerJumpRequest] = useState(0);
  useEffect(() => {
    if (layerJumpRequest === 0 || mobileTab !== 'style') return;
    document.getElementById('layer-inspector')?.scrollIntoView({ block: 'start' });
  }, [layerJumpRequest, mobileTab]);

  const openLayerEditor = () => {
    setMobileTab('style');
    setLayerJumpRequest((n) => n + 1);
  };

  return (
    <>
      <div key={locale} className="h-app w-full flex flex-col bg-background text-on-surface font-sans selection:bg-accent selection:text-on-accent overflow-hidden">
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
              <div
                className="flex flex-1 flex-col min-h-0 bg-surface-1 overflow-hidden"
                onTouchStart={handleSwipeStart}
                onTouchEnd={handleSwipeEnd}
              >
                <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${mobileTab === 'naskah' ? '' : 'hidden'}`}>
                  <SceneDeck
                    onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                    onEditScene={handleEditScene}
                    onOpenAssets={handleOpenAssets}
                  />
                </div>
                <div className={`flex-1 min-h-0 overflow-hidden ${mobileTab === 'naskah' ? 'hidden' : 'flex flex-col'}`}>
                  {isLookTab && (
                    <div role="group" aria-label={t('Bagian Gaya')} className="shrink-0 grid grid-cols-3 gap-1 m-2 mb-0 p-1 rounded-xl bg-surface-2 border border-border">
                      {lookTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          aria-pressed={mobileTab === tab.id}
                          onClick={() => setMobileTab(tab.id)}
                          className={`min-h-[36px] rounded-lg text-[12px] font-semibold transition-colors ${
                            mobileTab === tab.id ? 'bg-surface-3 text-accent' : 'text-text-muted hover:text-on-surface'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <InspectorRack
                    activeTab={mobileTab === 'naskah' ? 'mograph' : mobileTab}
                    onTabChange={(t) => setMobileTab(t)}
                    onOpenCodeInspector={(beatId) => setInspectingBeatId(beatId)}
                    className="h-full border-0 rounded-none shadow-none"
                  />
                </div>

                {/* A layer picked on the stage: one tap to its controls in the Gaya tab */}
                {selectedLayerId && mobileTab !== 'style' && (
                  <div className="shrink-0 px-2 pt-2 animate-fadeIn">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-3 border border-accent/40 shadow-lg">
                      <button
                        type="button"
                        onClick={openLayerEditor}
                        className="flex-1 min-w-0 min-h-[40px] px-2.5 rounded-lg flex items-center gap-2 text-left hover:bg-surface-hover"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-accent">layers</span>
                        <span className="flex-1 min-w-0 text-[12px] text-on-surface truncate">
                          {t('Layer')} <strong className="font-mono text-accent">{selectedLayerId}</strong>
                        </span>
                        <span className="text-[12px] font-semibold text-accent shrink-0">{t('Edit')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLayerId(null)}
                        aria-label={t('Batalkan pilihan layer')}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-on-surface hover:bg-surface-hover"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Mobile bottom navigation (swipe the panel above to move between tabs) */}
                <nav
                  aria-label={t('Panel studio')}
                  className="shrink-0 border-t border-border bg-surface-1 px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-0.5 select-none"
                >
                  {mobileTabs.map((tab) => {
                    const isActive = tab.tabs.includes(mobileTab);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMobileTab(tab.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`min-h-[48px] py-1 px-0 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
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
              key={inspectingBeatId}
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

        {/* 6. Welcome */}
        <WelcomeModal />

        {/* 7. Keyboard shortcut reference (?) */}
        <ShortcutsModal />
      </div>

      {/* Outside the keyed workspace: the service worker registers once, the dialogs keep their state */}
      <PwaReloadPrompt />
      <InstallDialog />
    </>
  );
};
