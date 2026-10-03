import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { DeckTab } from '../../store/types';
import { StoryboardPanel } from './panels/StoryboardPanel';
import { AudioPanel } from './panels/AudioPanel';
import { StylePanel } from './panels/StylePanel';
import { ExportPanel } from './panels/ExportPanel';

interface ActionDeckProps {
  className?: string;
  showSafeZone?: boolean;
  setShowSafeZone?: (val: boolean | ((prev: boolean) => boolean)) => void;
  showDebugHud?: boolean;
  setShowDebugHud?: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const ActionDeck: React.FC<ActionDeckProps> = ({
  className = '',
  showSafeZone,
  setShowSafeZone,
  showDebugHud,
  setShowDebugHud
}) => {
  const { deckTab, setDeckTab, audioStale } = useMooStore();

  const tabs: { id: DeckTab; label: string; icon: string; badge?: boolean }[] = [
    { id: 'storyboard', label: 'Storyboard', icon: 'movie' },
    { id: 'audio', label: 'Voice & BGM', icon: 'graphic_eq', badge: audioStale },
    { id: 'style', label: 'Style & Motion', icon: 'palette' },
    { id: 'export', label: 'Export', icon: 'arrow_downward' }
  ];

  return (
    <div className={`flex flex-col bg-[#0e0e12] border-t lg:border-t-0 border-white/[0.08] ${className}`}>
      {/* 1. Fluid Segmented Pill Navigation Bar */}
      <div className="sticky top-0 z-20 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#0e0e12]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="grid grid-cols-4 gap-1 p-0.5 sm:p-1 rounded-lg sm:rounded-xl bg-black/60 border border-white/[0.08]">
          {tabs.map((tab) => {
            const isActive = deckTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDeckTab(tab.id)}
                className={`relative py-1 sm:py-1.5 px-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-white/[0.1] text-primary shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px] sm:text-[15px]">{tab.icon}</span>
                <span className="truncate hidden sm:inline">{tab.label}</span>
                <span className="truncate sm:hidden">
                  {tab.id === 'storyboard'
                    ? 'Story'
                    : tab.id === 'audio'
                      ? 'Audio'
                      : tab.id === 'style'
                        ? 'Style'
                        : 'Export'}
                </span>

                {/* Stale Audio Dot */}
                {tab.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Active Panel Container with Smooth Scrolling */}
      <div className="flex-1 overflow-y-auto">
        {deckTab === 'storyboard' && <StoryboardPanel />}
        {deckTab === 'audio' && <AudioPanel />}
        {deckTab === 'style' && (
          <StylePanel
            showSafeZone={showSafeZone}
            setShowSafeZone={setShowSafeZone}
            showDebugHud={showDebugHud}
            setShowDebugHud={setShowDebugHud}
          />
        )}
        {deckTab === 'export' && <ExportPanel />}
      </div>
    </div>
  );
};
