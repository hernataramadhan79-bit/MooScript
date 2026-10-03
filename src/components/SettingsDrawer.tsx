import React, { useState, useEffect } from 'react';
import { useMooStore } from '../store/useMooStore';
import { exportSkillToJson, importSkillFromJson, addCustomSkill, deleteSkill } from '../engine/skills/skillManager';
import { checkStoragePersistence, requestPersistentStorage } from '../db/mooDb';
import { testProviderApiKey, fetchAvailableModels, DEFAULT_PROVIDER_MODELS, type ProviderModelInfo } from '../engine/ai/llm';
import {
  checkDeviceCapabilities,
  getCachedLocalModelsSizeBytes,
  purgeAllLocalModels,
  type DeviceCapabilities
} from '../engine/ai/localTts';
import type { LLMProvider, PersonaSkill } from '../types';

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

  return (
    <div className="pt-1.5 space-y-1.5 border-t border-white/[0.04]">
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-400 font-medium shrink-0">Model:</span>
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 truncate max-w-[150px] sm:max-w-[210px]"
            title={`Model aktif: ${currentModel}`}
          >
            {currentModel}
          </span>
        </div>

        <button
          type="button"
          disabled={isScanning || !apiKey.trim()}
          onClick={onScan}
          title={apiKey.trim() ? 'Pindai model aktif langsung dari API provider' : 'Masukkan API Key terlebih dahulu'}
          className="text-[9px] font-mono text-zinc-400 hover:text-primary flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors disabled:opacity-30 disabled:hover:text-zinc-400 shrink-0"
        >
          <span className={`material-symbols-outlined text-[11px] ${isScanning ? 'animate-spin' : ''}`}>
            {isScanning ? 'progress_activity' : 'sync'}
          </span>
          <span>{isScanning ? 'Memindai...' : 'Pindai API'}</span>
        </button>
      </div>

      {/* Small pill buttons row */}
      <div className="flex flex-wrap gap-1">
        {models.map((m) => {
          const isSelected = currentModel === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectModel(m.id)}
              title={m.description ? `${m.label} (${m.id})\n${m.description}` : `${m.label} (${m.id})`}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] font-mono border transition-all active:scale-95 flex items-center gap-1 ${
                isSelected
                  ? 'bg-primary/20 text-primary border-primary/60 font-semibold shadow-[0_0_8px_rgba(158,233,57,0.15)]'
                  : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]'
              }`}
            >
              {isSelected && <span className="text-[7px] text-primary">●</span>}
              <span className="truncate max-w-[140px]">{m.label}</span>
              {m.isRecommended && !isSelected && (
                <span className="text-[7px] font-sans px-1 rounded bg-primary/10 text-primary/80 uppercase tracking-tighter">
                  rec
                </span>
              )}
            </button>
          );
        })}

        {/* Custom button toggle */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
            showCustom || !isKnown
              ? 'bg-white/[0.1] text-zinc-200 border-white/[0.2]'
              : 'bg-white/[0.02] text-zinc-500 border-white/[0.04] hover:text-zinc-400'
          }`}
          title="Gunakan model ID kustom"
        >
          {showCustom ? '✕' : '+ Custom'}
        </button>
      </div>

      {/* Custom Model Input */}
      {showCustom && (
        <div className="flex items-center gap-1 pt-1 animate-fadeIn">
          <input
            type="text"
            placeholder="ID model (misal: gemini-2.5-pro)..."
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customVal.trim()) {
                onSelectModel(customVal.trim());
                setShowCustom(false);
              }
            }}
            className="flex-1 bg-black/60 rounded px-2 py-1 text-[10px] font-mono text-zinc-100 border border-white/[0.1] focus:outline-none focus:border-primary/50"
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
            className="px-2 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-mono font-bold border border-primary/40 disabled:opacity-40"
          >
            Pilih
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

  // Dynamic models state per provider
  const [providerModels, setProviderModels] = useState<Record<LLMProvider, ProviderModelInfo[]>>({
    gemini: DEFAULT_PROVIDER_MODELS.gemini,
    openai: DEFAULT_PROVIDER_MODELS.openai,
    groq: DEFAULT_PROVIDER_MODELS.groq
  });
  const [scanningModels, setScanningModels] = useState<Record<LLMProvider, boolean>>({
    gemini: false,
    openai: false,
    groq: false
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

      // Lazily inspect models from configured keys if available
      (['gemini', 'openai', 'groq'] as LLMProvider[]).forEach((prov) => {
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
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handlePurgeLocalModels = async () => {
    if (confirm('Hapus semua cache model suara lokal dari browser?')) {
      await purgeAllLocalModels();
      setLocalModelsSizeBytes(0);
      addToast('Semua cache model suara lokal berhasil dihapus!', 'info');
    }
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

  const handleDeleteSkill = async (id: string) => {
    if (confirm('Are you sure you want to delete this custom skill?')) {
      await deleteSkill(id);
      await refreshSkills();
    }
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
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">Studio Settings & BYOK Keys</h2>
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-4 text-xs">
          {/* 1. BYOK API Keys */}
          <section className="p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2.5 sm:space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[15px] sm:text-[17px]">key</span>
                <span className="text-[11px] sm:text-xs font-semibold text-white uppercase tracking-wider">
                  BYOK API Keys (Lokal)
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500">Zero Server</span>
            </div>

            {/* Storage Mode */}
            <div className="flex flex-col gap-1 p-2 sm:p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
              <span className="text-[10px] sm:text-[11px] font-medium text-zinc-300">Mode Penyimpanan Kunci</span>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => updateSettings({ apiKeyStorage: 'persistent' })}
                  className={`py-1 sm:py-1.5 px-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold border transition-all ${
                    settings.apiKeyStorage !== 'session'
                      ? 'bg-primary/10 text-primary border-primary/40'
                      : 'bg-white/[0.02] text-zinc-400 border-white/[0.06]'
                  }`}
                >
                  Persistent (IndexedDB)
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ apiKeyStorage: 'session' })}
                  className={`py-1 sm:py-1.5 px-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold border transition-all ${
                    settings.apiKeyStorage === 'session'
                      ? 'bg-primary/10 text-primary border-primary/40'
                      : 'bg-white/[0.02] text-zinc-400 border-white/[0.06]'
                  }`}
                >
                  Session Only (RAM)
                </button>
              </div>
            </div>

            {/* Primary Scripting Engine */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] sm:text-[11px] font-medium text-zinc-400">Primary Scripting Engine</span>
              <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                {(['gemini', 'openai', 'groq'] as LLMProvider[]).map((prov) => {
                  const isSelected = settings.selectedLLMProvider === prov;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => updateSettings({ selectedLLMProvider: prov })}
                      className={`py-1 sm:py-1.5 px-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold border capitalize transition-all ${
                        isSelected
                          ? 'bg-primary/10 text-primary border-primary/40'
                          : 'bg-white/[0.02] text-zinc-400 border-white/[0.06]'
                      }`}
                    >
                      {prov === 'gemini' ? 'Gemini' : prov === 'openai' ? 'OpenAI' : 'Groq'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keys Input Form */}
            <div className="space-y-3 pt-1">
              {/* Gemini */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Gemini API Key</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    Dapatkan Kunci ↗
                  </a>
                </div>
                <div className="relative flex items-center bg-black/60 rounded-lg border border-white/[0.08] px-3 py-1.5">
                  <input
                    type={visibleKeys.gemini ? 'text' : 'password'}
                    value={settings.apiKeys.gemini || ''}
                    onChange={(e) => updateApiKey('gemini', e.target.value)}
                    placeholder="AIzaSy..."
                    className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility('gemini')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {visibleKeys.gemini ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    disabled={testingKey.gemini || !settings.apiKeys.gemini}
                    onClick={() => handleTestKey('gemini')}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08] flex items-center gap-1 disabled:opacity-40"
                  >
                    <span className={`material-symbols-outlined text-[12px] ${testingKey.gemini ? 'animate-spin' : ''}`}>
                      {testingKey.gemini ? 'progress_activity' : 'network_check'}
                    </span>
                    <span>{testingKey.gemini ? 'Verifying...' : 'Test Key'}</span>
                  </button>
                  {testResults.gemini && (
                    <span className={`text-[10px] font-mono ${testResults.gemini.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[200px]`}>
                      {testResults.gemini.success ? '✓ Valid' : '✗ ' + testResults.gemini.message}
                    </span>
                  )}
                </div>

                {/* Gemini Model Selector Pills */}
                <ProviderModelSelector
                  provider="gemini"
                  apiKey={settings.apiKeys.gemini || ''}
                  currentModel={settings.geminiModel}
                  models={providerModels.gemini}
                  isScanning={scanningModels.gemini}
                  onSelectModel={(modelId) => {
                    updateSettings({ geminiModel: modelId });
                    addToast(`Model Gemini diubah ke ${modelId}`, 'info');
                  }}
                  onScan={() => handleScanModels('gemini')}
                />
              </div>

              {/* OpenAI */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">OpenAI API Key (GPT & TTS)</span>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    Dapatkan Kunci ↗
                  </a>
                </div>
                <div className="relative flex items-center bg-black/60 rounded-lg border border-white/[0.08] px-3 py-1.5">
                  <input
                    type={visibleKeys.openai ? 'text' : 'password'}
                    value={settings.apiKeys.openai || ''}
                    onChange={(e) => updateApiKey('openai', e.target.value)}
                    placeholder="sk-proj-..."
                    className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility('openai')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {visibleKeys.openai ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    disabled={testingKey.openai || !settings.apiKeys.openai}
                    onClick={() => handleTestKey('openai')}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08] flex items-center gap-1 disabled:opacity-40"
                  >
                    <span className={`material-symbols-outlined text-[12px] ${testingKey.openai ? 'animate-spin' : ''}`}>
                      {testingKey.openai ? 'progress_activity' : 'network_check'}
                    </span>
                    <span>{testingKey.openai ? 'Verifying...' : 'Test Key'}</span>
                  </button>
                  {testResults.openai && (
                    <span className={`text-[10px] font-mono ${testResults.openai.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[200px]`}>
                      {testResults.openai.success ? '✓ Valid' : '✗ ' + testResults.openai.message}
                    </span>
                  )}
                </div>

                {/* OpenAI Model Selector Pills */}
                <ProviderModelSelector
                  provider="openai"
                  apiKey={settings.apiKeys.openai || ''}
                  currentModel={settings.openaiModel}
                  models={providerModels.openai}
                  isScanning={scanningModels.openai}
                  onSelectModel={(modelId) => {
                    updateSettings({ openaiModel: modelId });
                    addToast(`Model OpenAI diubah ke ${modelId}`, 'info');
                  }}
                  onScan={() => handleScanModels('openai')}
                />
              </div>

              {/* Groq */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Groq API Key (Ultra-Fast)</span>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    Dapatkan Kunci ↗
                  </a>
                </div>
                <div className="relative flex items-center bg-black/60 rounded-lg border border-white/[0.08] px-3 py-1.5">
                  <input
                    type={visibleKeys.groq ? 'text' : 'password'}
                    value={settings.apiKeys.groq || ''}
                    onChange={(e) => updateApiKey('groq', e.target.value)}
                    placeholder="gsk_..."
                    className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility('groq')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {visibleKeys.groq ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    disabled={testingKey.groq || !settings.apiKeys.groq}
                    onClick={() => handleTestKey('groq')}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08] flex items-center gap-1 disabled:opacity-40"
                  >
                    <span className={`material-symbols-outlined text-[12px] ${testingKey.groq ? 'animate-spin' : ''}`}>
                      {testingKey.groq ? 'progress_activity' : 'network_check'}
                    </span>
                    <span>{testingKey.groq ? 'Verifying...' : 'Test Key'}</span>
                  </button>
                  {testResults.groq && (
                    <span className={`text-[10px] font-mono ${testResults.groq.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[200px]`}>
                      {testResults.groq.success ? '✓ Valid' : '✗ ' + testResults.groq.message}
                    </span>
                  )}
                </div>

                {/* Groq Model Selector Pills */}
                <ProviderModelSelector
                  provider="groq"
                  apiKey={settings.apiKeys.groq || ''}
                  currentModel={settings.groqModel}
                  models={providerModels.groq}
                  isScanning={scanningModels.groq}
                  onSelectModel={(modelId) => {
                    updateSettings({ groqModel: modelId });
                    addToast(`Model Groq diubah ke ${modelId}`, 'info');
                  }}
                  onScan={() => handleScanModels('groq')}
                />
              </div>

              {/* ElevenLabs */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">ElevenLabs API Key (Word Timestamps)</span>
                  <a
                    href="https://elevenlabs.io/app/settings/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    Dapatkan Kunci ↗
                  </a>
                </div>
                <div className="relative flex items-center bg-black/60 rounded-lg border border-white/[0.08] px-3 py-1.5">
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
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {visibleKeys.elevenlabs ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    disabled={testingKey.elevenlabs || !settings.apiKeys.elevenlabs}
                    onClick={() => handleTestKey('elevenlabs')}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08] flex items-center gap-1 disabled:opacity-40"
                  >
                    <span className={`material-symbols-outlined text-[12px] ${testingKey.elevenlabs ? 'animate-spin' : ''}`}>
                      {testingKey.elevenlabs ? 'progress_activity' : 'network_check'}
                    </span>
                    <span>{testingKey.elevenlabs ? 'Verifying...' : 'Test Key'}</span>
                  </button>
                  {testResults.elevenlabs && (
                    <span className={`text-[10px] font-mono ${testResults.elevenlabs.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[200px]`}>
                      {testResults.elevenlabs.success ? '✓ Valid' : '✗ ' + testResults.elevenlabs.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Persona Skills Engine */}
          <section className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[17px]">psychology</span>
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Persona Skills Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">file_upload</span>
                  Import
                  <input accept=".json" className="hidden" type="file" onChange={handleImportSkill} />
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddSkillModal(true)}
                  className="text-[10px] font-mono text-primary hover:text-lime-300 flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  New
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {skills.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs truncate">{s.name}</span>
                      {s.isBuiltin && (
                        <span className="text-[9px] font-mono px-1 rounded bg-white/[0.06] text-zinc-400">Built-in</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 truncate block">{s.description}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportSkill(s)}
                      title="Export Skill JSON"
                      className="w-6 h-6 rounded text-zinc-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">file_download</span>
                    </button>
                    {!s.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(s.id)}
                        title="Delete Skill"
                        className="w-6 h-6 rounded text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Local Storage & Models Cache */}
          <section className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-zinc-400 text-[17px]">storage</span>
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  IndexedDB Storage & Cache
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Audio Blobs & Project Cache:</span>
              <span className="font-mono text-zinc-200 font-semibold">{cacheMb} MB</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={async () => {
                  await clearCache();
                  addToast('Cache audio & project berhasil dibersihkan!', 'info');
                }}
                className="h-7 px-2.5 text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-300 rounded-lg hover:bg-white/[0.1] active:scale-95 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                <span>Bersihkan Cache Audio</span>
              </button>

              <button
                type="button"
                onClick={handlePurgeLocalModels}
                className="h-7 px-2.5 text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-red-300 rounded-lg hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                <span>Purge Model Piper ({(localModelsSizeBytes / (1024 * 1024)).toFixed(1)} MB)</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
              <span className="text-zinc-400 text-[11px]">Storage Eviction Protection:</span>
              {persistenceStatus?.persisted ? (
                <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded">
                  Persisted (Safe)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPersistence}
                  className="text-[10px] font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 rounded transition-colors"
                >
                  Enable Persistent Mode
                </button>
              )}
            </div>
          </section>

          {/* 4. Hardware & AI Stats */}
          <section className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">Client Hardware Stats</span>
              <span className="text-[10px] font-mono text-zinc-500">100% Client-Side</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col items-center">
                <span className="text-[10px] text-zinc-400">Akselerasi</span>
                <span className={`text-xs font-mono font-bold mt-0.5 ${deviceCaps?.hasWebGpu ? 'text-primary' : 'text-amber-400'}`}>
                  {deviceCaps?.hasWebGpu ? 'WebGPU' : 'WASM'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col items-center">
                <span className="text-[10px] text-zinc-400">RAM Perangkat</span>
                <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                  {deviceCaps?.deviceMemoryGb ? `~${deviceCaps.deviceMemoryGb} GB` : 'Standard'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col items-center">
                <span className="text-[10px] text-zinc-400">CPU Threads</span>
                <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5">
                  {deviceCaps?.hardwareConcurrency || 4} Cores
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
    </div>
  );
};
