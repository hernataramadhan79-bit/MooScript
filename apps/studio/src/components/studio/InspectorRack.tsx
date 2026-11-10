import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { AssetManagerPanel } from './AssetManagerPanel';
import { ExportPanel } from './ExportPanel';
import { BrandKitPanel } from './BrandKitPanel';
import { ShotTemplatesPanel } from './ShotTemplatesPanel';
import type { ProceduralArchetype } from '../../engine/composition/proceduralCompiler';
import type { InspectorShared } from './inspector/shared';
import { L, t } from '../../i18n';

// One chunk per tab: the rack opens on Mograph, and the others load the first time they are opened.
const StyleTab = lazy(() => import('./inspector/StyleTab').then((m) => ({ default: m.StyleTab })));
const MographTab = lazy(() => import('./inspector/MographTab').then((m) => ({ default: m.MographTab })));
const SubtitleTab = lazy(() => import('./inspector/SubtitleTab').then((m) => ({ default: m.SubtitleTab })));
const AudioTab = lazy(() => import('./inspector/AudioTab').then((m) => ({ default: m.AudioTab })));

export type InspectorTab = 'mograph' | 'style' | 'asset' | 'audio' | 'subtitle' | 'ekspor';


export const INSPECTOR_TABS: { id: InspectorTab; label: string; icon: string }[] = [
  { id: 'mograph', label: L('Mograph'), icon: 'movie_filter' },
  { id: 'style', label: L('Gaya'), icon: 'tune' },
  { id: 'asset', label: L('Aset'), icon: 'perm_media' },
  { id: 'audio', label: L('Audio'), icon: 'graphic_eq' },
  { id: 'subtitle', label: L('Subtitel'), icon: 'subtitles' },
  { id: 'ekspor', label: L('Ekspor'), icon: 'download' }
];

export interface InspectorRackProps {
  className?: string;
  defaultTab?: InspectorTab;
  activeTab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  onOpenCodeInspector?: (beatId: string) => void;
}

export const InspectorRack: React.FC<InspectorRackProps> = ({
  className = '',
  defaultTab = 'mograph',
  activeTab: controlledTab,
  onTabChange,
  onOpenCodeInspector
}) => {
  const [internalTab, setInternalTab] = useState<InspectorTab>(defaultTab);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = (tab: InspectorTab) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // A layer belongs to its shot: picking another shot drops the selection.
  const activeSceneKey = useMooStore((s) => (s.project.scenes.find((sc) => sc.id === s.activeSceneId) || s.project.scenes[0])?.id);
  const setSelectedLayerId = useMooStore((s) => s.setSelectedLayerId);
  useEffect(() => {
    setSelectedLayerId(null);
  }, [activeSceneKey, setSelectedLayerId]);

  const [revisionPrompt, setRevisionPrompt] = useState<string>('');
  const [selectedArchetype, setSelectedArchetype] = useState<ProceduralArchetype>('auto');
  const [isDownloadingLocalVoice, setIsDownloadingLocalVoice] = useState<boolean>(false);
  const [localVoiceDownloadProgress, setLocalVoiceDownloadProgress] = useState<number>(0);
  const shared: InspectorShared = {
    revisionPrompt,
    setRevisionPrompt,
    selectedArchetype,
    setSelectedArchetype,
    isDownloadingLocalVoice,
    setIsDownloadingLocalVoice,
    localVoiceDownloadProgress,
    setLocalVoiceDownloadProgress
  };

  return (
    <div
      className={`w-full flex flex-col bg-surface-1 border border-border rounded-2xl overflow-hidden select-none ${className}`}
    >
      {/* 1. Tab header (desktop; on mobile the bottom navigation switches tabs) */}
      <div className="hidden lg:block p-2 border-b border-border bg-surface-1/90 backdrop-blur-sm shrink-0">
        <div className="grid grid-cols-6 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
          {INSPECTOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`py-1.5 px-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95 ${
                activeTab === tab.id
                  ? 'bg-surface-3 text-accent shadow-sm'
                  : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
              <span className="tracking-tight truncate max-w-full">{t(tab.label)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Isi Panel Tab */}
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
        <Suspense fallback={<div className="py-10 text-center text-[12px] text-text-muted">{t('Memuat panel…')}</div>}>
          {activeTab === 'style' && <StyleTab shared={shared} />}
          {activeTab === 'mograph' && <MographTab shared={shared} onOpenCodeInspector={onOpenCodeInspector} />}
          {activeTab === 'subtitle' && <SubtitleTab />}
          {activeTab === 'audio' && <AudioTab shared={shared} />}
        </Suspense>

        {activeTab === 'asset' && (
          <div className="flex flex-col gap-4">
            <BrandKitPanel />
            <AssetManagerPanel />
            <ShotTemplatesPanel />
          </div>
        )}

        {activeTab === 'ekspor' && <ExportPanel />}
      </div>
    </div>
  );
};
