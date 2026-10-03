import React, { useEffect, useState } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { CanvasStage } from './components/studio/CanvasStage';
import { TimelineBar } from './components/studio/TimelineBar';
import { ActionDeck } from './components/studio/ActionDeck';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';

export const App: React.FC = () => {
  const { initStore, setDeckTab, previewMode } = useMooStore();

  const [showSafeZone, setShowSafeZone] = useState(false);
  const [showDebugHud, setShowDebugHud] = useState(false);

  useEffect(() => {
    initStore().catch((err) => console.error('Failed to init store', err));
  }, [initStore]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-on-surface font-sans selection:bg-primary selection:text-black overflow-hidden select-none">
      {/* 1. Fixed Cyber Header */}
      <Header />

      {/* 2. Unified Studio Workstation */}
      <main className="flex-1 pt-11 sm:pt-14 flex flex-col lg:flex-row overflow-hidden">
        {/* DESKTOP: Left Column Workbench (~440px-480px) */}
        {/* MOBILE: Order-2 Bottom Action Deck (Gets ~75-80% height in compact mode!) */}
        <section className="order-2 lg:order-1 flex-1 lg:flex-none lg:w-[440px] xl:w-[480px] lg:border-r lg:border-white/[0.08] flex flex-col min-h-0 bg-[#0e0e12] overflow-hidden">
          <ActionDeck
            className="flex-1 min-h-0"
            showSafeZone={showSafeZone}
            setShowSafeZone={setShowSafeZone}
            showDebugHud={showDebugHud}
            setShowDebugHud={setShowDebugHud}
          />
        </section>

        {/* DESKTOP: Right Column Expansive Stage + Timeline */}
        {/* MOBILE: Order-1 Pinned Top Canvas + Mini-Console (Ultra Compact ~110px or 36px Ticker) */}
        <section
          className={`order-1 lg:order-2 flex-none lg:flex-1 flex flex-col justify-between bg-[#060608] relative overflow-hidden transition-all duration-200 ${
            previewMode === 'theater'
              ? 'h-[50vh] sm:h-[56vh] border-b border-white/[0.08] lg:border-b-0 lg:h-auto'
              : 'border-b border-white/[0.08] lg:border-b-0'
          }`}
        >
          {/* Subtle Radial Darkroom Studio Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(158,233,57,0.03)_0%,_transparent_70%)] pointer-events-none" />

          {/* Unified Canvas & Mobile Timeline Area */}
          <div
            className={`w-full relative z-10 ${
              previewMode === 'theater'
                ? 'flex-1 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0'
                : previewMode === 'compact'
                ? 'flex items-center gap-2 p-2 lg:flex-col lg:items-center lg:justify-center lg:p-6 lg:flex-1'
                : 'lg:flex-1 lg:flex lg:items-center lg:justify-center lg:p-6'
            }`}
          >
            <CanvasStage
              showSafeZone={showSafeZone}
              setShowSafeZone={setShowSafeZone}
              showDebugHud={showDebugHud}
              setShowDebugHud={setShowDebugHud}
            />

            {/* In compact mode on mobile, render TimelineBar in compact console alongside the mini-monitor */}
            {previewMode === 'compact' && (
              <TimelineBar
                compact
                className="lg:hidden"
                onSelectScene={() => setDeckTab('storyboard')}
              />
            )}
          </div>

          {/* In theater mode, ticker mode, or on desktop (lg:), render the full-width timeline */}
          <div
            className={`w-full shrink-0 relative z-10 ${
              previewMode === 'compact' ? 'hidden lg:block lg:p-4 lg:pt-0' : 'lg:p-4 lg:pt-0'
            }`}
          >
            <TimelineBar
              onSelectScene={() => {
                setDeckTab('storyboard');
              }}
            />
          </div>
        </section>
      </main>

      {/* 3. Slide-Over Settings & BYOK Keys Drawer */}
      <SettingsDrawer />

      {/* 4. Global Toast Notifications */}
      <ToastContainer />

      {/* 5. PWA Service Worker Prompt */}
      <PwaReloadPrompt />
    </div>
  );
};
