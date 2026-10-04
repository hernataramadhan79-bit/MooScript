import React, { useEffect, useState } from 'react';
import { useMooStore } from './store/useMooStore';
import { Header } from './components/Header';
import { CanvasStage } from './components/studio/CanvasStage';
import { TimelineBar } from './components/studio/TimelineBar';
import { ExportModal } from './components/studio/ExportModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ToastContainer } from './components/ToastContainer';
import { PwaReloadPrompt } from './components/PwaReloadPrompt';
import { IdeaView } from './features/idea/IdeaView';
import { StyleView } from './features/style/StyleView';
import { VisualEditorView } from './features/editor/VisualEditorView';
import { ExportView } from './features/export/ExportView';
import { CodeInspectorModal } from './features/scene/CodeInspectorModal';

export type StudioStep = 'ide' | 'mograph' | 'edit' | 'ekspor';

export const App: React.FC = () => {
  const { initStore, togglePlay } = useMooStore();

  const [currentStep, setCurrentStep] = useState<StudioStep>('ide');
  const [showExportModal, setShowExportModal] = useState(false);
  const [inspectingBeatId, setInspectingBeatId] = useState<string | null>(null);

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

  const studioSteps: { id: StudioStep; label: string; icon: string }[] = [
    { id: 'ide', label: '1. Ide', icon: 'lightbulb' },
    { id: 'mograph', label: '2. Mograph', icon: 'movie_filter' },
    { id: 'edit', label: '3. Edit', icon: 'tune' },
    { id: 'ekspor', label: '4. Ekspor', icon: 'download' }
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-on-surface font-sans selection:bg-accent selection:text-on-accent overflow-hidden">
      {/* 1. Header Minimalis Pro */}
      <Header onOpenExport={() => setCurrentStep('ekspor')} />

      {/* 2. Main Studio Split Layout */}
      <main className="flex-1 pt-14 flex flex-col lg:flex-row overflow-hidden">
        {/* Kolom Kiri: Workflow Alur Kerja (45% Desktop, Bawah di Mobile) */}
        <section className="order-2 lg:order-1 flex-1 lg:flex-none lg:w-[48%] xl:w-[44%] max-w-[680px] lg:border-r border-border flex flex-col min-h-0 bg-surface-1 overflow-hidden">
          {/* Segmented Flow Bar: Ide -> Mograph -> Edit -> Ekspor */}
          <div className="sticky top-0 z-20 px-4 py-2.5 bg-surface-1/95 backdrop-blur-md border-b border-border">
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
              {studioSteps.map((step) => {
                const isActive = currentStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className={`py-2 px-1 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                      isActive
                        ? 'bg-surface-3 text-accent shadow-sm'
                        : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">{step.icon}</span>
                    <span className="truncate">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Flow Panel */}
          <div className="flex-1 overflow-y-auto">
            {currentStep === 'ide' && (
              <IdeaView
                onNextStep={() => setCurrentStep('mograph')}
                onOpenCodeInspector={(id) => setInspectingBeatId(id)}
              />
            )}
            {currentStep === 'mograph' && (
              <StyleView
                onBackStep={() => setCurrentStep('ide')}
                onNextStep={() => setCurrentStep('edit')}
              />
            )}
            {currentStep === 'edit' && (
              <VisualEditorView
                onBackStep={() => setCurrentStep('mograph')}
                onNextStep={() => setCurrentStep('ekspor')}
                onOpenCodeInspector={(id) => setInspectingBeatId(id)}
              />
            )}
            {currentStep === 'ekspor' && (
              <ExportView onBackStep={() => setCurrentStep('edit')} />
            )}
          </div>
        </section>

        {/* Kolom Kanan: Canvas / Composition Stage + Transport Timeline (55% Desktop) */}
        <section className="order-1 lg:order-2 flex-none lg:flex-1 h-[48vh] sm:h-[50vh] lg:h-auto flex flex-col justify-between bg-[#040406] relative overflow-hidden border-b lg:border-b-0 border-border">
          {/* Stage Preview Container */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0 relative">
            <CanvasStage className="w-full h-full" />
          </div>

          {/* Master Transport Timeline Bar */}
          <div className="w-full shrink-0 p-2 sm:p-3 sm:pt-0 bg-surface-1/40 backdrop-blur-sm border-t border-border/40">
            <TimelineBar
              onSelectScene={() => {
                setCurrentStep('ide');
              }}
            />
          </div>
        </section>
      </main>

      {/* 3. Code Inspector Modal for Power Users */}
      <CodeInspectorModal
        beatId={inspectingBeatId}
        isOpen={Boolean(inspectingBeatId)}
        onClose={() => setInspectingBeatId(null)}
      />

      {/* 4. Legacy Export Modal (jika dipicu langsung dari modal fallback) */}
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

      {/* 5. Settings Drawer */}
      <SettingsDrawer />

      {/* 6. Toast Notifications */}
      <ToastContainer />

      {/* 7. PWA Reload Prompt */}
      <PwaReloadPrompt />
    </div>
  );
};
