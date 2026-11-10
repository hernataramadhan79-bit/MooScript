import React, { useState } from 'react';
import { type ProviderModelInfo } from '../../engine/ai/llm';
import type { LLMProvider } from '../../types';
import { t } from '../../i18n';

interface ProviderModelSelectorProps {
  provider: LLMProvider;
  apiKey: string;
  currentModel: string;
  models: ProviderModelInfo[];
  isScanning: boolean;
  onSelectModel: (modelId: string) => void;
  onScan: () => void;
}

export const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
  apiKey,
  currentModel,
  models,
  isScanning,
  onSelectModel,
  onScan
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');

  const isKnown = models.some((m) => m.id === currentModel);
  const quickPills = models.slice(0, 5);

  return (
    <div className="pt-2.5 mt-2 space-y-2 border-t border-white/[0.06]">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-400 font-medium shrink-0">{t('Model Aktif:')}</span>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/25 truncate max-w-[160px] sm:max-w-[220px]"
            title={t('Model aktif: {0}', currentModel)}
          >
            {currentModel}
          </span>
          {!isKnown && currentModel && (
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {t('Custom')}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={isScanning || !apiKey.trim()}
          onClick={onScan}
          title={apiKey.trim() ? t('Pindai model aktif langsung dari API provider') : t('Masukkan API Key terlebih dahulu')}
          className="text-[10px] font-mono text-zinc-300 hover:text-primary flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors disabled:opacity-30 shrink-0"
        >
          <span className={`material-symbols-outlined text-[12px] ${isScanning ? 'animate-spin' : ''}`}>
            {isScanning ? 'progress_activity' : 'sync'}
          </span>
          <span>
            {isScanning
              ? t('Memindai...')
              : models.length > 0
                ? t('Pindai API ({0})', models.length)
                : t('Pindai API')}
          </span>
        </button>
      </div>

      {/* Dropdown select for all available models */}
      {models.length > 0 && (
        <div className="relative">
          <select
            value={currentModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className="w-full bg-black/70 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 border border-white/[0.1] focus:outline-none focus:border-primary/50 cursor-pointer appearance-none pr-7"
          >
            {!isKnown && currentModel && (
              <option value={currentModel}>{t('Custom:')} {currentModel}</option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.id}) {m.isRecommended ? '★' : ''}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
            <span className="material-symbols-outlined text-[15px]">expand_more</span>
          </div>
        </div>
      )}

      {/* Quick pill buttons row */}
      <div className="flex flex-wrap gap-1 pt-0.5">
        {quickPills.map((m) => {
          const isSelected = currentModel === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectModel(m.id)}
              title={m.description ? `${m.label} (${m.id})\n${m.description}` : `${m.label} (${m.id})`}
              className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono border transition-all active:scale-95 flex items-center gap-1 ${
                isSelected
                  ? 'bg-primary/20 text-primary border-primary/60 font-semibold'
                  : 'bg-white/[0.03] text-zinc-400 border-white/[0.07] hover:bg-white/[0.07] hover:text-zinc-200'
              }`}
            >
              {isSelected && <span className="text-[7px] text-primary">●</span>}
              <span className="truncate max-w-[130px]">{m.label}</span>
            </button>
          );
        })}

        {/* Custom button toggle */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono border transition-colors ${
            showCustom || !isKnown
              ? 'bg-white/[0.12] text-zinc-200 border-white/[0.25]'
              : 'bg-white/[0.03] text-zinc-400 border-white/[0.07] hover:text-zinc-200'
          }`}
          title={t('Ketik manual model ID')}
        >
          {showCustom ? t('✕ Tutup') : t('+ Model Kustom')}
        </button>
      </div>

      {/* Custom Model Input */}
      {showCustom && (
        <div className="flex items-center gap-1.5 pt-1 animate-fadeIn">
          <input
            type="text"
            placeholder={t('Ketik ID model (misal: gemini-2.5-flash)...')}
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customVal.trim()) {
                onSelectModel(customVal.trim());
                setShowCustom(false);
              }
            }}
            className="flex-1 bg-black/70 rounded-lg px-2.5 py-1 text-[11px] font-mono text-zinc-100 border border-white/[0.12] focus:outline-none focus:border-primary/50"
          />
          <button
            type="button"
            disabled={!customVal.trim()}
            onClick={() => {
              if (customVal.trim()) {
                onSelectModel(customVal.trim());
                setShowCustom(false);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-mono font-bold border border-primary/40 disabled:opacity-40"
          >
            {t('Pakai')}
          </button>
        </div>
      )}
    </div>
  );
};
