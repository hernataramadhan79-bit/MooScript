import React, { useEffect, useState } from 'react';
import { useMooStore } from '../../store/useMooStore';

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings, addToast } = useMooStore();
  const [isPersisted, setIsPersisted] = useState(false);

  const checkStoragePersistence = async () => {
    if (navigator.storage && navigator.storage.persisted) {
      const persisted = await navigator.storage.persisted();
      setIsPersisted(persisted);
    }
  };

  const requestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      addToast(
        granted ? 'Persistent storage granted!' : 'Storage persistence not granted by browser.',
        granted ? 'success' : 'warning'
      );
    }
  };

  useEffect(() => {
    checkStoragePersistence().catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <h2 className="text-lg font-bold">Settings</h2>

      <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm">
          <span>Storage Persistence</span>
          <span className={`text-xs ${isPersisted ? 'text-lime-400' : 'text-zinc-400'}`}>
            {isPersisted ? 'Persisted' : 'Not Persisted'}
          </span>
        </div>
        {!isPersisted && (
          <button
            type="button"
            onClick={requestPersistentStorage}
            className="px-3 py-1.5 bg-lime-500 text-black text-xs font-semibold rounded"
          >
            Enable Persistent Storage
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-zinc-400">Selected LLM Provider</label>
        <select
          value={settings.selectedLLMProvider}
          onChange={(e) => updateSettings({ selectedLLMProvider: e.target.value as any })}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
        >
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="groq">Groq</option>
        </select>
      </div>
    </div>
  );
};
