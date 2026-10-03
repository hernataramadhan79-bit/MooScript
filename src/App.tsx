import React, { useEffect } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ScriptTab } from './components/tabs/ScriptTab';
import { VoiceTab } from './components/tabs/VoiceTab';
import { StudioTab } from './components/tabs/StudioTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';

export const App: React.FC = () => {
  const { activeTab, initStore } = useMooStore();

  useEffect(() => {
    initStore().catch((err) => console.error('Failed to init store', err));
  }, [initStore]);

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface font-sans selection:bg-primary selection:text-black">
      {/* Sticky Header */}
      <Header />

      {/* Main Tab Screen Area */}
      <main className="flex-1 flex flex-col pt-14 pb-20 overflow-x-hidden">
        {activeTab === 'script' && <ScriptTab />}
        {activeTab === 'voice' && <VoiceTab />}
        {activeTab === 'studio' && <StudioTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Mobile Safe Bottom Navigation */}
      <BottomNav />

      {/* Global Toast Notifications */}
      <ToastContainer />

      {/* PWA Version Update & Offline Ready Prompt */}
      <PwaReloadPrompt />
    </div>
  );
};
