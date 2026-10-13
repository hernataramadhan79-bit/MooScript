import React, { useState, useEffect } from 'react';
import { useMooStore } from '../store/useMooStore';
import { exportSkillToJson, importSkillFromJson, addCustomSkill, deleteSkill } from '../engine/skills/skillManager';
import { checkStoragePersistence, requestPersistentStorage } from '../db/mooDb';
import { testProviderApiKey, fetchAvailableModels, DEFAULT_PROVIDER_MODELS, type ProviderModelInfo } from '../engine/ai/llm';
import {
  checkDeviceCapabilities,
  getCachedLocalModelsSizeBytes,
  purgeAllLocalModels,
  LOCAL_VOICES,
  isLocalModelCached,
  downloadLocalModel,
  purgeLocalModel,
  type LocalVoice,
  type DeviceCapabilities
} from '../engine/ai/localTts';
import type { LLMProvider, PersonaSkill } from '../types';
import { ConfirmModal } from './ui/ConfirmModal';

interface ProviderModelSelectorProps {
  provider: LLMProvider;
  apiKey: string;
  currentModel: string;
  models: ProviderModelInfo[];
  isScanning: boolean;
  onSelectModel: (modelId: string) => void;
  onScan: () => void;
}

const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
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
          <span className="text-zinc-400 font-medium shrink-0">Model Aktif:</span>
          <span
            className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/25 truncate max-w-[160px] sm:max-w-[220px]"
            title={`Model aktif: ${currentModel}`}
          >
            {currentModel}
          </span>
          {!isKnown && currentModel && (
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Custom
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={isScanning || !apiKey.trim()}
          onClick={onScan}
          title={apiKey.trim() ? 'Pindai model aktif langsung dari API provider' : 'Masukkan API Key terlebih dahulu'}
          className="text-[10px] font-mono text-zinc-300 hover:text-primary flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors disabled:opacity-30 shrink-0"
        >
          <span className={`material-symbols-outlined text-[12px] ${isScanning ? 'animate-spin' : ''}`}>
            {isScanning ? 'progress_activity' : 'sync'}
          </span>
          <span>
            {isScanning
              ? 'Memindai...'
              : models.length > 0
                ? `Pindai API (${models.length})`
                : 'Pindai API'}
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
              <option value={currentModel}>Custom: {currentModel}</option>
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
          title="Ketik manual model ID"
        >
          {showCustom ? '✕ Tutup' : '+ Model Kustom'}
        </button>
      </div>

      {/* Custom Model Input */}
      {showCustom && (
        <div className="flex items-center gap-1.5 pt-1 animate-fadeIn">
          <input
            type="text"
            placeholder="Ketik ID model (misal: gemini-2.5-flash)..."
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
            Pakai
          </button>
        </div>
      )}
    </div>
  );
};

export const SettingsDrawer: React.FC = () => {
  const {
    isSettingsOpen,
    setSettingsOpen,
    settings,
    updateSettings,
    updateApiKey,
    skills,
    refreshSkills,
    cacheSizeBytes,
    clearCache,
    addToast
  } = useMooStore();

  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testingKey, setTestingKey] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<{ persisted: boolean; supported: boolean } | null>(null);
  const [deviceCaps, setDeviceCaps] = useState<DeviceCapabilities | null>(null);
  const [localModelsSizeBytes, setLocalModelsSizeBytes] = useState<number>(0);
  const [confirmPurgeModels, setConfirmPurgeModels] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null);
  const [modelCacheMap, setModelCacheMap] = useState<Record<string, boolean>>({});
  const [downloadingVoiceId, setDownloadingVoiceId] = useState<string | null>(null);
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, number>>({});
  const [expandedProvider, setExpandedProvider] = useState<LLMProvider | null>(
    settings.selectedLLMProvider || 'gemini'
  );

  const refreshModelStatuses = async () => {
    const statuses: Record<string, boolean> = {};
    for (const v of LOCAL_VOICES) {
      statuses[v.id] = await isLocalModelCached(v.id);
    }
    setModelCacheMap(statuses);
    const size = await getCachedLocalModelsSizeBytes();
    setLocalModelsSizeBytes(size);
  };

  const handleDownloadVoice = async (voice: LocalVoice) => {
    setDownloadingVoiceId(voice.id);
    setDownloadProgressMap((prev) => ({ ...prev, [voice.id]: 0 }));
    try {
      await downloadLocalModel(voice.id, (p) => {
        setDownloadProgressMap((prev) => ({ ...prev, [voice.id]: p.percent }));
      });
      addToast(`Model suara "${voice.name}" berhasil diunduh dan siap digunakan offline!`, 'success');
      await refreshModelStatuses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal mengunduh model: ${msg}`, 'error');
    } finally {
      setDownloadingVoiceId(null);
    }
  };

  const handleDeleteVoice = async (voice: LocalVoice) => {
    try {
      await purgeLocalModel(voice.id);
      addToast(`Model suara "${voice.name}" dihapus dari cache.`, 'info');
      await refreshModelStatuses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal menghapus model: ${msg}`, 'error');
    }
  };

  // Dynamic models state per provider
  const [providerModels, setProviderModels] = useState<Record<LLMProvider, ProviderModelInfo[]>>({
    gemini: DEFAULT_PROVIDER_MODELS.gemini,
    openai: DEFAULT_PROVIDER_MODELS.openai,
    groq: DEFAULT_PROVIDER_MODELS.groq,
    anthropic: DEFAULT_PROVIDER_MODELS.anthropic,
    openrouter: DEFAULT_PROVIDER_MODELS.openrouter
  });
  const [scanningModels, setScanningModels] = useState<Record<LLMProvider, boolean>>({
    gemini: false,
    openai: false,
    groq: false,
    anthropic: false,
    openrouter: false
  });

  // New Skill form state
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillIcon, setNewSkillIcon] = useState('sparkles');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillPrompt, setNewSkillPrompt] = useState('');

  useEffect(() => {
    if (isSettingsOpen) {
      checkStoragePersistence().then(setPersistenceStatus);
      checkDeviceCapabilities().then(setDeviceCaps);
      getCachedLocalModelsSizeBytes().then(setLocalModelsSizeBytes);
      refreshModelStatuses();

      // Lazily inspect models from configured keys if available
      (['gemini', 'openai', 'groq', 'anthropic', 'openrouter'] as LLMProvider[]).forEach((prov) => {
        const key = settings.apiKeys[prov];
        if (key && key.trim()) {
          fetchAvailableModels(prov, key).then((models) => {
            if (models && models.length > 0) {
              setProviderModels((prev) => ({ ...prev, [prov]: models }));
            }
          }).catch(() => {});
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, setSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handlePurgeLocalModels = () => {
    setConfirmPurgeModels(true);
  };

  const handleTestKey = async (provider: LLMProvider | 'elevenlabs') => {
    const key = settings.apiKeys[provider] || '';
    if (!key.trim()) {
      addToast(`Please enter an API Key for ${provider.toUpperCase()} before testing.`, 'warning');
      return;
    }
    setTestingKey((prev) => ({ ...prev, [provider]: true }));
    const result = await testProviderApiKey(provider, key);
    setTestingKey((prev) => ({ ...prev, [provider]: false }));
    setTestResults((prev) => ({ ...prev, [provider]: result }));
    if (result.models && provider !== 'elevenlabs') {
      setProviderModels((prev) => ({ ...prev, [provider]: result.models! }));
    }
    addToast(result.message, result.success ? 'success' : 'error');
  };

  const handleScanModels = async (provider: LLMProvider) => {
    const key = settings.apiKeys[provider] || '';
    if (!key.trim()) {
      addToast(`Masukkan API Key ${provider.toUpperCase()} terlebih dahulu.`, 'warning');
      return;
    }
    setScanningModels((prev) => ({ ...prev, [provider]: true }));
    try {
      const models = await fetchAvailableModels(provider, key);
      setProviderModels((prev) => ({ ...prev, [provider]: models }));
      addToast(`${models.length} model aktif terdeteksi dari ${provider.toUpperCase()}!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Gagal memindai model: ${msg}`, 'error');
    } finally {
      setScanningModels((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleRequestPersistence = async () => {
    const result = await requestPersistentStorage();
    setPersistenceStatus(result);
    if (result.persisted) {
      addToast('Persistent storage granted by browser!', 'success');
    } else if (!result.supported) {
      addToast('Storage persistence API is not supported in this browser.', 'warning');
    } else {
      addToast('Browser denied persistent storage request.', 'warning');
    }
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSave = () => {
    setSaveSuccess(true);
    addToast('Pengaturan berhasil disimpan!', 'success');
    setTimeout(() => {
      setSaveSuccess(false);
      setSettingsOpen(false);
    }, 1000);
  };

  const handleExportSkill = (skill: PersonaSkill) => {
    const jsonStr = exportSkillToJson(skill);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skill.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.mooskill.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSkill = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        await importSkillFromJson(text);
        await refreshSkills();
        addToast('Custom skill imported successfully!', 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`Failed to import skill: ${msg}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateSkill = async () => {
    if (!newSkillName.trim() || !newSkillPrompt.trim()) {
      addToast('Skill Name and System Prompt are required.', 'warning');
      return;
    }
    await addCustomSkill({
      name: newSkillName.trim(),
      icon: newSkillIcon,
      description: newSkillDesc.trim(),
      systemPrompt: newSkillPrompt.trim()
    });
    await refreshSkills();
    addToast('Custom skill created successfully!', 'success');
    setShowAddSkillModal(false);
    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillPrompt('');
  };

  const handleDeleteSkill = (id: string) => {
    setSkillToDelete(id);
  };

  const cacheMb = (cacheSizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click dismiss */}
      <div className="flex-1" onClick={() => setSettingsOpen(false)} />

      {/* Drawer Container */}
      <div className="w-full max-w-lg bg-[#0e0e12] border-l border-white/[0.08] shadow-2xl flex flex-col h-full overflow-hidden animate-slideLeft">
        {/* Drawer Header */}
        <div className="h-11 sm:h-14 px-3.5 sm:px-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px] sm:text-[20px]">tune</span>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">Pengaturan Studio</h2>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 text-xs">
          {/* KONTAINER 1: KONFIGURASI UTAMA AI */}
          <section className="p-3.5 sm:p-4 rounded-2xl bg-[#14141b] border border-white/[0.09] space-y-3.5 shadow-md">
            <div className="flex flex-col gap-0.5 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">neurology</span>
                <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                  1. Konfigurasi Utama AI
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400">
                Pilih penyedia AI utama yang digunakan untuk menyusun naskah & kode Mograph.
              </p>
            </div>

            {/* Primary AI Provider */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-300 block">Penyedia AI Utama</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {(['gemini', 'openai', 'groq', 'anthropic', 'openrouter'] as LLMProvider[]).map((prov) => {
                  const isSelected = settings.selectedLLMProvider === prov;
                  const hasKey = Boolean(settings.apiKeys[prov]?.trim());
                  const label =
                    prov === 'gemini'
                      ? 'Gemini'
                      : prov === 'openai'
                        ? 'OpenAI'
                        : prov === 'groq'
                          ? 'Groq'
                          : prov === 'anthropic'
                            ? 'Anthropic'
                            : 'OpenRouter';
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => {
                        updateSettings({ selectedLLMProvider: prov });
                        setExpandedProvider(prov);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-between sm:justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary/15 text-primary border-primary/50 shadow-sm'
                          : 'bg-black/40 text-zinc-400 border-white/[0.07] hover:text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate">{label}</span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          hasKey ? 'bg-emerald-400' : 'bg-zinc-600'
                        }`}
                        title={hasKey ? 'API Key sudah diisi' : 'API Key belum diisi'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Storage Mode */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">Mode Penyimpanan Kunci API</span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {settings.apiKeyStorage === 'session' ? 'Sementara (RAM)' : 'Lokal Browser'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateSettings({ apiKeyStorage: 'persistent' })}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    settings.apiKeyStorage !== 'session'
                      ? 'bg-primary/15 text-primary border-primary/40'
                      : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-zinc-200'
                  }`}
                >
                  Permanen (Tersimpan)
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ apiKeyStorage: 'session' })}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    settings.apiKeyStorage === 'session'
                      ? 'bg-primary/15 text-primary border-primary/40'
                      : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-zinc-200'
                  }`}
                >
                  Sesi Ini Saja
                </button>
              </div>
            </div>

            {/* Token Output Budget (Max Output Tokens) */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">data_thresholding</span>
                  Batas Panjang Respons (Max Tokens)
                </span>
                <span className="font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[11px]">
                  {settings.maxOutputTokens || 2048} tok
                </span>
              </div>
              <input
                type="range"
                min={512}
                max={8192}
                step={256}
                value={settings.maxOutputTokens || 2048}
                onChange={(e) => updateSettings({ maxOutputTokens: parseInt(e.target.value, 10) })}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[1024, 2048, 4096, 8192].map((tokenPreset) => {
                  const isCurrent = (settings.maxOutputTokens || 2048) === tokenPreset;
                  return (
                    <button
                      key={tokenPreset}
                      type="button"
                      onClick={() => updateSettings({ maxOutputTokens: tokenPreset })}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
                        isCurrent
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-200'
                      }`}
                    >
                      {tokenPreset}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* KONTAINER 2: KUNCI API & MODEL PER PROVIDER (KARTU TERPISAH & AKORDEON RAPI) */}
          <section className="p-3.5 sm:p-4 rounded-2xl bg-[#14141b] border border-white/[0.09] space-y-3 shadow-md">
            <div className="flex flex-col gap-0.5 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">key</span>
                <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                  2. Kunci API & Model per Provider
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400">
                Ketuk salah satu kartu penyedia AI di bawah untuk memasukkan API Key dan memilih model.
              </p>
            </div>

            <div className="space-y-2.5">
              {([
                {
                  id: 'gemini' as LLMProvider,
                  title: 'Google Gemini',
                  subtitle: 'Cepat & Multimodal',
                  placeholder: 'AIzaSy...',
                  url: 'https://aistudio.google.com/app/apikey',
                  currentModel: settings.geminiModel,
                  onSelectModel: (m: string) => {
                    updateSettings({ geminiModel: m });
                    addToast(`Model Gemini diubah ke ${m}`, 'info');
                  }
                },
                {
                  id: 'openai' as LLMProvider,
                  title: 'OpenAI (GPT & TTS)',
                  subtitle: 'GPT-4o & Suara OpenAI',
                  placeholder: 'sk-proj-...',
                  url: 'https://platform.openai.com/api-keys',
                  currentModel: settings.openaiModel,
                  onSelectModel: (m: string) => {
                    updateSettings({ openaiModel: m });
                    addToast(`Model OpenAI diubah ke ${m}`, 'info');
                  }
                },
                {
                  id: 'groq' as LLMProvider,
                  title: 'Groq Cloud',
                  subtitle: 'Inferensi LPU Ultra-Cepat',
                  placeholder: 'gsk_...',
                  url: 'https://console.groq.com/keys',
                  currentModel: settings.groqModel,
                  onSelectModel: (m: string) => {
                    updateSettings({ groqModel: m });
                    addToast(`Model Groq diubah ke ${m}`, 'info');
                  }
                },
                {
                  id: 'anthropic' as LLMProvider,
                  title: 'Anthropic Claude',
                  subtitle: 'Claude Sonnet & Haiku',
                  placeholder: 'sk-ant-api03-...',
                  url: 'https://console.anthropic.com/settings/keys',
                  currentModel: settings.anthropicModel || 'claude-3-7-sonnet-20250219',
                  onSelectModel: (m: string) => {
                    updateSettings({ anthropicModel: m });
                    addToast(`Model Anthropic diubah ke ${m}`, 'info');
                  }
                },
                {
                  id: 'openrouter' as LLMProvider,
                  title: 'OpenRouter',
                  subtitle: 'Akses Multi-Model Terpadu',
                  placeholder: 'sk-or-v1-...',
                  url: 'https://openrouter.ai/keys',
                  currentModel: settings.openrouterModel || 'anthropic/claude-3.7-sonnet',
                  onSelectModel: (m: string) => {
                    updateSettings({ openrouterModel: m });
                    addToast(`Model OpenRouter diubah ke ${m}`, 'info');
                  }
                }
              ]).map((p) => {
                const isPrimary = settings.selectedLLMProvider === p.id;
                const isExpanded = expandedProvider === p.id;
                const keyVal = settings.apiKeys[p.id] || '';
                const hasKey = Boolean(keyVal.trim());
                const testRes = testResults[p.id];

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isPrimary
                        ? 'bg-primary/[0.04] border-primary/40 shadow-sm'
                        : isExpanded
                          ? 'bg-black/50 border-white/[0.14]'
                          : 'bg-black/35 border-white/[0.07] hover:border-white/[0.12]'
                    }`}
                  >
                    {/* Card Header (Accordion Toggle) */}
                    <button
                      type="button"
                      onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-xs font-bold text-white">{p.title}</span>
                        {isPrimary && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/40">
                            Utama
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            hasKey
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-zinc-500/10 text-zinc-400 border-white/[0.06]'
                          }`}
                        >
                          {hasKey ? '✓ Kunci Terisi' : 'Belum Diatur'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="hidden sm:inline font-mono text-[10px] text-zinc-400 truncate max-w-[120px]">
                          {p.currentModel}
                        </span>
                        <span className="material-symbols-outlined text-[18px] text-zinc-400">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </button>

                    {/* Card Body */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1.5 border-t border-white/[0.06] space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">{p.subtitle}</span>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                          >
                            <span>Dapatkan Kunci API</span>
                            <span>↗</span>
                          </a>
                        </div>

                        {/* Input + Inline Test Key Button */}
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1 flex items-center bg-black/70 rounded-lg border border-white/[0.1] px-2.5 py-1.5 focus-within:border-primary/50">
                            <input
                              type={visibleKeys[p.id] ? 'text' : 'password'}
                              value={keyVal}
                              onChange={(e) => updateApiKey(p.id, e.target.value)}
                              onBlur={() => {
                                if (keyVal.trim()) handleScanModels(p.id);
                              }}
                              placeholder={p.placeholder}
                              className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => toggleVisibility(p.id)}
                              className="p-0.5 text-zinc-400 hover:text-white shrink-0 ml-1"
                              title={visibleKeys[p.id] ? 'Sembunyikan kunci' : 'Tampilkan kunci'}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {visibleKeys[p.id] ? 'visibility_off' : 'visibility'}
                              </span>
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={testingKey[p.id] || !hasKey}
                            onClick={() => handleTestKey(p.id)}
                            className="h-8 px-2.5 text-[10px] font-mono font-semibold rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.1] flex items-center gap-1 disabled:opacity-40 shrink-0 transition-colors"
                          >
                            <span className={`material-symbols-outlined text-[13px] ${testingKey[p.id] ? 'animate-spin' : ''}`}>
                              {testingKey[p.id] ? 'progress_activity' : 'network_check'}
                            </span>
                            <span>{testingKey[p.id] ? 'Uji...' : 'Test Key'}</span>
                          </button>
                        </div>

                        {testRes && (
                          <div
                            className={`text-[10px] font-mono px-2 py-1 rounded bg-black/40 border ${
                              testRes.success
                                ? 'text-emerald-400 border-emerald-500/30'
                                : 'text-red-400 border-red-500/30'
                            }`}
                          >
                            {testRes.success ? '✓ Kunci API Valid & Aktif' : '✗ ' + testRes.message}
                          </div>
                        )}

                        {/* Model Selector */}
                        <ProviderModelSelector
                          provider={p.id}
                          apiKey={keyVal}
                          currentModel={p.currentModel}
                          models={providerModels[p.id]}
                          isScanning={scanningModels[p.id]}
                          onSelectModel={p.onSelectModel}
                          onScan={() => handleScanModels(p.id)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* KONTAINER 3: KUNCI API SUARA CLOUD (ELEVENLABS) */}
          <section className="p-3.5 sm:p-4 rounded-2xl bg-[#14141b] border border-white/[0.09] space-y-3 shadow-md">
            <div className="flex flex-col gap-0.5 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">graphic_eq</span>
                  <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                    3. Kunci API Suara Cloud (ElevenLabs)
                  </h3>
                </div>
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Dapatkan Kunci ↗
                </a>
              </div>
              <p className="text-[11px] text-zinc-400">
                Opsional — Digunakan khusus jika Anda memilih penyedia suara ElevenLabs di Tab Suara.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 flex items-center bg-black/70 rounded-lg border border-white/[0.1] px-2.5 py-1.5 focus-within:border-primary/50">
                <input
                  type={visibleKeys.elevenlabs ? 'text' : 'password'}
                  value={settings.apiKeys.elevenlabs || ''}
                  onChange={(e) => updateApiKey('elevenlabs', e.target.value)}
                  placeholder="xi-api-key..."
                  className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility('elevenlabs')}
                  className="p-0.5 text-zinc-400 hover:text-white shrink-0 ml-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {visibleKeys.elevenlabs ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                disabled={testingKey.elevenlabs || !settings.apiKeys.elevenlabs}
                onClick={() => handleTestKey('elevenlabs')}
                className="h-8 px-2.5 text-[10px] font-mono font-semibold rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.1] flex items-center gap-1 disabled:opacity-40 shrink-0 transition-colors"
              >
                <span className={`material-symbols-outlined text-[13px] ${testingKey.elevenlabs ? 'animate-spin' : ''}`}>
                  {testingKey.elevenlabs ? 'progress_activity' : 'network_check'}
                </span>
                <span>{testingKey.elevenlabs ? 'Uji...' : 'Test Key'}</span>
              </button>
            </div>

            {testResults.elevenlabs && (
              <div
                className={`text-[10px] font-mono px-2 py-1 rounded bg-black/40 border ${
                  testResults.elevenlabs.success
                    ? 'text-emerald-400 border-emerald-500/30'
                    : 'text-red-400 border-red-500/30'
                }`}
              >
                {testResults.elevenlabs.success ? '✓ Kunci ElevenLabs Valid' : '✗ ' + testResults.elevenlabs.message}
              </div>
            )}
          </section>

          {/* KONTAINER 4: MODEL SUARA LOKAL (OFFLINE PIPER TTS) */}
          <section className="p-3.5 sm:p-4 rounded-2xl bg-[#14141b] border border-white/[0.09] space-y-3 shadow-md">
            <div className="flex flex-col gap-0.5 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">record_voice_over</span>
                  <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                    4. Model Suara Lokal (Offline TTS)
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-300 border border-white/[0.08]">
                  Zero-Server
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Unduh model suara sekali ke cache browser untuk membuat voiceover 100% lokal tanpa kuota API.
              </p>
            </div>

            <div className="space-y-2">
              {LOCAL_VOICES.map((v) => {
                const isCached = modelCacheMap[v.id];
                const isDownloading = downloadingVoiceId === v.id;
                const progress = downloadProgressMap[v.id] || 0;

                return (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-black/40 border border-white/[0.07] flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white">{v.name}</span>
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                            {v.languageLabel}
                          </span>
                          {isCached ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">check_circle</span>
                              Siap Offline
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
                              Belum Diunduh
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">{v.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">~{v.sizeMb} MB</span>
                    </div>

                    {isDownloading ? (
                      <div className="flex flex-col gap-1 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-primary">
                          <span>Mengunduh bobot ONNX...</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-200 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-white/[0.05]">
                        {isCached ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteVoice(v)}
                            className="text-[11px] text-zinc-400 hover:text-red-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.06] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[13px]">delete</span>
                            <span>Hapus dari Cache</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDownloadVoice(v)}
                            className="text-[11px] font-semibold text-black bg-primary hover:bg-lime-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                            <span>Unduh Model ({v.sizeMb} MB)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* KONTAINER 5: GAYA PENULISAN (PERSONA SKILLS) */}
          <section className="p-3.5 sm:p-4 rounded-2xl bg-[#14141b] border border-white/[0.09] space-y-3 shadow-md">
            <div className="flex flex-col gap-0.5 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
                  <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                    5. Gaya Penulisan Naskah (Persona)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:text-white cursor-pointer flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-[13px]">file_upload</span>
                    <span>Impor</span>
                    <input accept=".json" className="hidden" type="file" onChange={handleImportSkill} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddSkillModal(true)}
                    className="text-[10px] font-mono px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 flex items-center gap-1 font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                    <span>Buat Baru</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400">
                Preset instruksi karakter sutradara AI saat menghasilkan storyboard naskah.
              </p>
            </div>

            <div className="space-y-1.5">
              {skills.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs truncate">{s.name}</span>
                      {s.isBuiltin && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400">
                          Bawaan
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 truncate block mt-0.5">{s.description}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportSkill(s)}
                      title="Ekspor Skill JSON"
                      className="w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">file_download</span>
                    </button>
                    {!s.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(s.id)}
                        title="Hapus Skill"
                        className="w-7 h-7 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* KONTAINER 6: PENYIMPANAN, CACHE & PERANGKAT */}
          <section className="p-3.5 sm:p-4 rounded-2xl bg-[#14141b] border border-white/[0.09] space-y-3 shadow-md">
            <div className="flex flex-col gap-0.5 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">storage</span>
                <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                  6. Penyimpanan, Cache & Perangkat
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400">
                Kelola memori cache lokal browser dan status kemampuan perangkat keras Anda.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Ukuran Cache Audio TTS:</span>
                <span className="font-mono text-zinc-200 font-semibold">{cacheMb} MB</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Ukuran Model Suara Lokal:</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {(localModelsSizeBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    await clearCache();
                    addToast('Cache suara berhasil dibersihkan!', 'info');
                  }}
                  className="py-2 px-3 text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-200 rounded-xl hover:bg-white/[0.1] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                  <span>Bersihkan Cache Audio</span>
                </button>

                <button
                  type="button"
                  onClick={handlePurgeLocalModels}
                  className="py-2 px-3 text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-red-300 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  <span>Hapus Model Suara Lokal</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                <span className="text-zinc-400 text-[11px]">Proteksi Penyimpanan Browser:</span>
                {persistenceStatus?.persisted ? (
                  <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-md">
                    ✓ Aktif
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestPersistence}
                    className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 rounded-md transition-colors"
                  >
                    Aktifkan Proteksi
                  </button>
                )}
              </div>
            </div>

            {/* Hardware Stats */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col items-center">
                <span className="text-[10px] text-zinc-400">Akselerasi GPU</span>
                <span className={`text-xs font-mono font-bold mt-0.5 ${deviceCaps?.hasWebGpu ? 'text-primary' : 'text-zinc-200'}`}>
                  {deviceCaps?.hasWebGpu ? 'WebGPU Aktif' : 'Standar'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col items-center">
                <span className="text-[10px] text-zinc-400">Memori Sistem</span>
                <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                  {deviceCaps?.deviceMemoryGb ? `~${deviceCaps.deviceMemoryGb} GB` : 'Standar'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col items-center">
                <span className="text-[10px] text-zinc-400">Inti CPU</span>
                <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                  {deviceCaps?.hardwareConcurrency || 4} Core
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Sticky Save Action at Bottom */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0e0e12]/95 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="w-full h-10 rounded-xl bg-primary text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-lime-300 active:scale-[0.99] transition-all shadow-md shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[17px]">{saveSuccess ? 'done_all' : 'check'}</span>
            <span>{saveSuccess ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </div>

      {/* Add Custom Skill Modal */}
      {showAddSkillModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141418] border border-white/[0.1] rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <h3 className="text-sm font-bold text-white">Create Custom Persona Skill</h3>
              <button
                type="button"
                onClick={() => setShowAddSkillModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Skill Name</label>
                <input
                  type="text"
                  placeholder="e.g. 🚀 SaaS Launch Hook"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="w-full bg-black/60 border border-white/[0.08] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Skill Icon</label>
                <div className="flex gap-1.5 pt-0.5">
                  {['sparkles', 'zap', 'brain', 'flame', 'code', 'mascot'].map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewSkillIcon(icon)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs transition-colors ${
                        newSkillIcon === icon
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-white/[0.08] bg-black/40 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Short Description</label>
                <input
                  type="text"
                  placeholder="e.g. High-conversion product demo script"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  className="w-full bg-black/60 border border-white/[0.08] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">System Prompt Instructions</label>
                <textarea
                  placeholder="Instruct the director on tone, cadence, sentence structure, and vocabulary..."
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                  className="w-full h-20 bg-black/60 border border-white/[0.08] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowAddSkillModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSkill}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-black hover:bg-lime-300"
              >
                Save Skill
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Konfirmasi Bersihkan Cache Model Suara */}
      <ConfirmModal
        isOpen={confirmPurgeModels}
        onClose={() => setConfirmPurgeModels(false)}
        onConfirm={async () => {
          await purgeAllLocalModels();
          setLocalModelsSizeBytes(0);
          addToast('Semua cache model suara lokal berhasil dihapus!', 'info');
        }}
        title="Hapus Cache Model Suara"
        description="Apakah Anda yakin ingin menghapus semua cache model suara lokal dari browser? Model akan diunduh ulang saat dibutuhkan."
        confirmLabel="Hapus Cache"
        cancelLabel="Batal"
        variant="danger"
        icon="delete_sweep"
      />

      {/* Konfirmasi Hapus Custom Skill */}
      <ConfirmModal
        isOpen={Boolean(skillToDelete)}
        onClose={() => setSkillToDelete(null)}
        onConfirm={async () => {
          if (skillToDelete) {
            await deleteSkill(skillToDelete);
            await refreshSkills();
            setSkillToDelete(null);
            addToast('Custom persona skill berhasil dihapus!', 'info');
          }
        }}
        title="Hapus Custom Persona Skill"
        description="Apakah Anda yakin ingin menghapus custom persona skill ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Skill"
        cancelLabel="Batal"
        variant="danger"
        icon="delete"
      />
    </div>
  );
};
