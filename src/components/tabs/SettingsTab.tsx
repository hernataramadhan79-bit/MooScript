import React, { useState, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { exportSkillToJson, importSkillFromJson, addCustomSkill, deleteSkill } from '../../engine/skills/skillManager';
import { checkStoragePersistence, requestPersistentStorage } from '../../db/mooDb';
import { testProviderApiKey } from '../../engine/ai/llm';
import {
  checkDeviceCapabilities,
  getCachedLocalModelsSizeBytes,
  purgeAllLocalModels,
  type DeviceCapabilities
} from '../../engine/ai/localTts';
import type { LLMProvider, PersonaSkill } from '../../types';

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings, updateApiKey, skills, refreshSkills, cacheSizeBytes, clearCache, addToast } =
    useMooStore();

  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testingKey, setTestingKey] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<{ persisted: boolean; supported: boolean } | null>(null);
  const [deviceCaps, setDeviceCaps] = useState<DeviceCapabilities | null>(null);
  const [localModelsSizeBytes, setLocalModelsSizeBytes] = useState<number>(0);

  useEffect(() => {
    checkStoragePersistence().then(setPersistenceStatus);
    checkDeviceCapabilities().then(setDeviceCaps);
    getCachedLocalModelsSizeBytes().then(setLocalModelsSizeBytes);
  }, []);

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
    addToast(result.message, result.success ? 'success' : 'error');
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

  // New Skill form state
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillIcon, setNewSkillIcon] = useState('sparkles');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillPrompt, setNewSkillPrompt] = useState('');

  const toggleVisibility = (provider: string) => {
    setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSave = () => {
    setSaveSuccess(true);
    addToast('Settings saved to local IndexedDB!', 'success');
    setTimeout(() => setSaveSuccess(false), 2000);
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
    <div className="flex flex-col gap-5 px-4 pt-3 pb-24 max-w-xl mx-auto w-full">
      {/* BYOK API Keys Section */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">key</span>
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              BYOK API Keys (Stored Locally)
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Zero Server</span>
        </div>

        {/* API Key Storage Security Mode */}
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#111113] border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-300">Key Storage Security Mode</span>
            <span className="text-[10px] font-mono text-zinc-500">
              {settings.apiKeyStorage === 'session' ? '🔒 Session Only' : '💾 Persistent'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                settings.apiKeyStorage !== 'session'
                  ? 'bg-zinc-800 text-primary border-primary/50'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => updateSettings({ apiKeyStorage: 'persistent' })}
              type="button"
            >
              Persistent (IndexedDB)
            </button>
            <button
              className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                settings.apiKeyStorage === 'session'
                  ? 'bg-zinc-800 text-primary border-primary/50'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
              onClick={() => updateSettings({ apiKeyStorage: 'session' })}
              type="button"
            >
              Session Only (RAM/Session)
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 pt-1 leading-relaxed">
            {settings.apiKeyStorage === 'session' ? (
              <span className="text-emerald-400">
                🔒 Keys are held in memory/sessionStorage during this active tab session and will be cleared when the
                tab is closed. Nothing is written to permanent IndexedDB storage.
              </span>
            ) : (
              <span className="text-amber-400">
                ⚠️ Notice: Keys are saved in your browser&apos;s local IndexedDB for your convenience. Do not use on
                public or shared computers.
              </span>
            )}
          </p>
        </div>

        {/* Active LLM Provider Selector */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Primary Scripting Engine</span>
          <div className="grid grid-cols-3 gap-2">
            {(['gemini', 'openai', 'groq'] as LLMProvider[]).map((prov) => {
              const isSelected = settings.selectedLLMProvider === prov;
              return (
                <button
                  key={prov}
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold border capitalize transition-all ${
                    isSelected
                      ? 'bg-zinc-800 text-primary border-primary/50'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => updateSettings({ selectedLLMProvider: prov })}
                  type="button"
                >
                  {prov === 'gemini' ? 'Google Gemini' : prov === 'openai' ? 'OpenAI GPT' : 'Groq Llama'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Key Inputs */}
        <div className="space-y-3.5 pt-1">
          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Gemini API Key</span>
              <a
                className="text-[10px] text-primary hover:underline"
                href="https://aistudio.google.com/app/apikey"
                rel="noreferrer"
                target="_blank"
              >
                Get Key ↗
              </a>
            </div>
            <div className="relative flex items-center bg-[#111113] rounded-lg border border-zinc-800 px-3 py-2">
              <input
                className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                placeholder="AIzaSy..."
                type={visibleKeys.gemini ? 'text' : 'password'}
                value={settings.apiKeys.gemini || ''}
                onChange={(e) => updateApiKey('gemini', e.target.value)}
              />
              <button
                className="p-1 text-zinc-400 hover:text-white"
                onClick={() => toggleVisibility('gemini')}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {visibleKeys.gemini ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <button
                className="px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 disabled:opacity-50"
                disabled={testingKey.gemini || !settings.apiKeys.gemini}
                onClick={() => handleTestKey('gemini')}
                type="button"
              >
                <span className={`material-symbols-outlined text-[13px] ${testingKey.gemini ? 'animate-spin' : ''}`}>
                  {testingKey.gemini ? 'progress_activity' : 'network_check'}
                </span>
                <span>{testingKey.gemini ? 'Verifying...' : 'Test Key'}</span>
              </button>
              {testResults.gemini && (
                <span
                  className={`text-[10px] font-mono ${testResults.gemini.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[300px]`}
                >
                  {testResults.gemini.success ? '✓ Valid' : '✗ ' + testResults.gemini.message}
                </span>
              )}
            </div>
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">OpenAI API Key (GPT & TTS)</span>
              <a
                className="text-[10px] text-primary hover:underline"
                href="https://platform.openai.com/api-keys"
                rel="noreferrer"
                target="_blank"
              >
                Get Key ↗
              </a>
            </div>
            <div className="relative flex items-center bg-[#111113] rounded-lg border border-zinc-800 px-3 py-2">
              <input
                className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                placeholder="sk-proj-..."
                type={visibleKeys.openai ? 'text' : 'password'}
                value={settings.apiKeys.openai || ''}
                onChange={(e) => updateApiKey('openai', e.target.value)}
              />
              <button
                className="p-1 text-zinc-400 hover:text-white"
                onClick={() => toggleVisibility('openai')}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {visibleKeys.openai ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <button
                className="px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 disabled:opacity-50"
                disabled={testingKey.openai || !settings.apiKeys.openai}
                onClick={() => handleTestKey('openai')}
                type="button"
              >
                <span className={`material-symbols-outlined text-[13px] ${testingKey.openai ? 'animate-spin' : ''}`}>
                  {testingKey.openai ? 'progress_activity' : 'network_check'}
                </span>
                <span>{testingKey.openai ? 'Verifying...' : 'Test Key'}</span>
              </button>
              {testResults.openai && (
                <span
                  className={`text-[10px] font-mono ${testResults.openai.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[300px]`}
                >
                  {testResults.openai.success ? '✓ Valid' : '✗ ' + testResults.openai.message}
                </span>
              )}
            </div>
          </div>

          {/* Groq API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Groq API Key (Ultra-Fast)</span>
              <a
                className="text-[10px] text-primary hover:underline"
                href="https://console.groq.com/keys"
                rel="noreferrer"
                target="_blank"
              >
                Get Key ↗
              </a>
            </div>
            <div className="relative flex items-center bg-[#111113] rounded-lg border border-zinc-800 px-3 py-2">
              <input
                className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                placeholder="gsk_..."
                type={visibleKeys.groq ? 'text' : 'password'}
                value={settings.apiKeys.groq || ''}
                onChange={(e) => updateApiKey('groq', e.target.value)}
              />
              <button
                className="p-1 text-zinc-400 hover:text-white"
                onClick={() => toggleVisibility('groq')}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {visibleKeys.groq ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <button
                className="px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 disabled:opacity-50"
                disabled={testingKey.groq || !settings.apiKeys.groq}
                onClick={() => handleTestKey('groq')}
                type="button"
              >
                <span className={`material-symbols-outlined text-[13px] ${testingKey.groq ? 'animate-spin' : ''}`}>
                  {testingKey.groq ? 'progress_activity' : 'network_check'}
                </span>
                <span>{testingKey.groq ? 'Verifying...' : 'Test Key'}</span>
              </button>
              {testResults.groq && (
                <span
                  className={`text-[10px] font-mono ${testResults.groq.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[300px]`}
                >
                  {testResults.groq.success ? '✓ Valid' : '✗ ' + testResults.groq.message}
                </span>
              )}
            </div>
          </div>

          {/* ElevenLabs API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">ElevenLabs API Key (Word Timestamps)</span>
              <a
                className="text-[10px] text-primary hover:underline"
                href="https://elevenlabs.io/app/settings/api-keys"
                rel="noreferrer"
                target="_blank"
              >
                Get Key ↗
              </a>
            </div>
            <div className="relative flex items-center bg-[#111113] rounded-lg border border-zinc-800 px-3 py-2">
              <input
                className="bg-transparent font-mono text-xs text-zinc-100 w-full focus:outline-none"
                placeholder="xi-api-key..."
                type={visibleKeys.elevenlabs ? 'text' : 'password'}
                value={settings.apiKeys.elevenlabs || ''}
                onChange={(e) => updateApiKey('elevenlabs', e.target.value)}
              />
              <button
                className="p-1 text-zinc-400 hover:text-white"
                onClick={() => toggleVisibility('elevenlabs')}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {visibleKeys.elevenlabs ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <button
                className="px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1 disabled:opacity-50"
                disabled={testingKey.elevenlabs || !settings.apiKeys.elevenlabs}
                onClick={() => handleTestKey('elevenlabs')}
                type="button"
              >
                <span
                  className={`material-symbols-outlined text-[13px] ${testingKey.elevenlabs ? 'animate-spin' : ''}`}
                >
                  {testingKey.elevenlabs ? 'progress_activity' : 'network_check'}
                </span>
                <span>{testingKey.elevenlabs ? 'Verifying...' : 'Test Key'}</span>
              </button>
              {testResults.elevenlabs && (
                <span
                  className={`text-[10px] font-mono ${testResults.elevenlabs.success ? 'text-emerald-400' : 'text-red-400'} truncate max-w-[300px]`}
                >
                  {testResults.elevenlabs.success ? '✓ Valid' : '✗ ' + testResults.elevenlabs.message}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Engine Preferences Card */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Engine Defaults</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-400">Aspect Ratio</span>
            <div className="flex items-center justify-between bg-[#111113] border border-primary/40 rounded-lg px-2.5 py-2">
              <span className="text-xs font-medium text-zinc-200">9:16 (Shorts/Reels)</span>
              <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-zinc-400">Default Framerate</span>
            <div className="flex items-center justify-between bg-[#111113] border border-primary/40 rounded-lg px-2.5 py-2">
              <span className="text-xs font-medium text-zinc-200">30 FPS</span>
              <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
            </div>
          </div>
        </div>

        {/* Ducking Slider */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Audio Ducking</span>
            <span className="font-mono text-xs font-semibold text-primary">{settings.duckingDb} dB</span>
          </div>
          <input
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
            max="0"
            min="-30"
            step="1"
            type="range"
            value={settings.duckingDb}
            onChange={(e) => updateSettings({ duckingDb: parseInt(e.target.value) })}
          />
        </div>
      </section>

      {/* Persona Skills Engine Management */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Persona Skills Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">file_upload</span>
              Import
              <input accept=".json" className="hidden" type="file" onChange={handleImportSkill} />
            </label>
            <button
              className="text-[10px] font-mono text-primary hover:text-lime-300 flex items-center gap-0.5"
              onClick={() => setShowAddSkillModal(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              New Skill
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {skills.map((s) => (
            <div
              key={s.id}
              className="p-2.5 rounded-lg bg-[#111113] border border-zinc-800 flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">{s.name}</span>
                  {s.isBuiltin && (
                    <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">Built-in</span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 truncate">{s.description}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="w-7 h-7 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors"
                  onClick={() => handleExportSkill(s)}
                  title="Export Skill JSON"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">file_download</span>
                </button>
                {!s.isBuiltin && (
                  <button
                    className="w-7 h-7 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 flex items-center justify-center transition-colors"
                    onClick={() => handleDeleteSkill(s.id)}
                    title="Delete Skill"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Local Storage & Cache Card */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-zinc-400 text-[18px]">storage</span>
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Local Storage & Dexie Cache
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-xs text-zinc-400">IndexedDB Audio & Project Cache:</span>
          <span className="font-mono text-xs font-semibold text-zinc-200">{cacheMb} MB</span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(5, (cacheSizeBytes / (50 * 1024 * 1024)) * 100))}%` }}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-zinc-500">Audio Blobs & Synthesized Previews</span>
          <button
            className="h-8 px-3 text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 active:scale-95 transition-all flex items-center gap-1"
            onClick={async () => {
              await clearCache();
              addToast('Storage cache cleared successfully!', 'info');
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
            <span>Clear Cache</span>
          </button>
        </div>

        {/* Browser Persistent Storage Status */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-zinc-400">verified_user</span>
            <span className="text-zinc-300 text-[11px]">Storage Eviction Protection</span>
          </div>
          {persistenceStatus?.persisted ? (
            <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded">
              Persisted (Safari/Disk Safe)
            </span>
          ) : (
            <button
              className="text-[10px] font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 px-2.5 py-1 rounded transition-colors flex items-center gap-1"
              onClick={handleRequestPersistence}
              type="button"
            >
              <span>Enable Persistent Mode</span>
            </button>
          )}
        </div>
      </section>

      {/* Client Hardware & AI Capabilities Card */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">memory</span>
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Client Hardware & AI Engine
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">100% Client-Side</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 flex flex-col items-center">
            <span className="text-[10px] text-zinc-400">Acceleration</span>
            <span
              className={`text-xs font-mono font-semibold mt-0.5 ${deviceCaps?.hasWebGpu ? 'text-primary' : 'text-amber-400'}`}
            >
              {deviceCaps?.hasWebGpu ? 'WebGPU' : 'WASM'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 flex flex-col items-center">
            <span className="text-[10px] text-zinc-400">RAM Perangkat</span>
            <span className="text-xs font-mono font-semibold text-zinc-200 mt-0.5">
              {deviceCaps?.deviceMemoryGb ? `~${deviceCaps.deviceMemoryGb} GB` : 'Standard'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 flex flex-col items-center">
            <span className="text-[10px] text-zinc-400">CPU Threads</span>
            <span className="text-xs font-mono font-semibold text-zinc-200 mt-0.5">
              {deviceCaps?.hardwareConcurrency || 4} Cores
            </span>
          </div>
        </div>

        {deviceCaps?.isLowEnd && deviceCaps.warningMessage && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0 mt-0.5">warning</span>
            <span>{deviceCaps.warningMessage}</span>
          </div>
        )}

        {/* Local TTS Models Cache Storage */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <div>
            <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-zinc-400">offline_bolt</span>
              <span>Local TTS Model Cache</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Disk Usage: {(localModelsSizeBytes / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
          <button
            className="h-7 px-2.5 text-[11px] font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 active:scale-95 transition-all flex items-center gap-1"
            onClick={handlePurgeLocalModels}
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            <span>Purge Model Cache</span>
          </button>
        </div>
      </section>

      {/* Sticky Bottom Save Action Bar */}
      <div className="fixed bottom-14 left-0 w-full z-40 px-4 py-2.5 bg-surface/90 backdrop-blur-md border-t border-zinc-800/80">
        <div className="max-w-xl mx-auto">
          <button
            className="w-full h-11 text-xs font-bold uppercase tracking-wider rounded-xl bg-primary text-black hover:bg-lime-300 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
            onClick={handleSave}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">{saveSuccess ? 'done_all' : 'check'}</span>
            <span>{saveSuccess ? 'Settings Saved to Local IndexedDB!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Add Custom Skill Modal */}
      {showAddSkillModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#18181b] border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-sm font-bold text-white">Create Custom Persona Skill</h3>
              <button
                className="text-zinc-400 hover:text-white"
                onClick={() => setShowAddSkillModal(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-zinc-400">Skill Name</label>
                <input
                  className="w-full bg-[#111113] border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary"
                  placeholder="e.g. 🚀 SaaS Launch Hook"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400">Skill Icon</label>
                <div className="flex gap-2 pt-1">
                  {['sparkles', 'zap', 'brain', 'flame', 'code', 'mascot'].map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewSkillIcon(icon)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border text-sm transition-colors ${
                        newSkillIcon === icon
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-zinc-800 bg-[#111113] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400">Short Description</label>
                <input
                  className="w-full bg-[#111113] border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary"
                  placeholder="e.g. High-conversion product demo script"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400">System Prompt Instructions</label>
                <textarea
                  className="w-full h-24 bg-[#111113] border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary resize-none"
                  placeholder="Instruct the director on tone, cadence, sentence structure, and vocabulary..."
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                onClick={() => setShowAddSkillModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-black hover:bg-lime-300"
                onClick={handleCreateSkill}
                type="button"
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
