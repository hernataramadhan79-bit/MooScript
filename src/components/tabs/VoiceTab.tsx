import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import { ELEVENLABS_MODELS, DEFAULT_ELEVENLABS_MODEL } from '../../engine/ai/tts';

export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' }
];

export const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'nova', name: 'Nova' },
  { id: 'shimmer', name: 'Shimmer' }
];

export const VoiceTab: React.FC = () => {
  const {
    isGeneratingAudio,
    generateAudio,
    cancelAudioGeneration,
    audioProgress,
    audioStale,
    settings,
    updateSettings,
    addToast
  } = useMooStore();

  const currentProvider = settings.selectedTTSProvider;

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Voice & Narration</h2>
        {audioStale && (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
            Audio outdated
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-zinc-400">Provider</label>
        <div className="flex gap-2">
          {(['openai', 'elevenlabs', 'local'] as const).map((prov) => (
            <button
              key={prov}
              type="button"
              onClick={() => updateSettings({ selectedTTSProvider: prov })}
              className={`px-3 py-1.5 rounded text-xs font-medium border ${
                currentProvider === prov
                  ? 'bg-lime-500/20 text-lime-400 border-lime-500/50'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              {prov.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {currentProvider === 'openai' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-400">OpenAI Voice</label>
          <select
            value={settings.voiceIds.openai}
            onChange={(e) =>
              updateSettings({
                voiceIds: { ...settings.voiceIds, openai: e.target.value }
              })
            }
            className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm"
          >
            {OPENAI_VOICES.map((v: { id: string; name: string }) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentProvider === 'elevenlabs' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-400">ElevenLabs Voice</label>
          <select
            value={settings.voiceIds.elevenlabs}
            onChange={(e) =>
              updateSettings({
                voiceIds: { ...settings.voiceIds, elevenlabs: e.target.value }
              })
            }
            className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm"
          >
            {ELEVENLABS_VOICES.map((v: { id: string; name: string }) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-zinc-400 mt-1">ElevenLabs Model (kuota gratis)</label>
          <select
            value={settings.elevenLabsModel || DEFAULT_ELEVENLABS_MODEL}
            onChange={(e) => updateSettings({ elevenLabsModel: e.target.value })}
            className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm"
          >
            {ELEVENLABS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Flash v2.5 paling hemat (~0.5 kredit/karakter) dan termasuk kuota gratis 10rb kredit/bulan. Multilingual v2
            premium (~1 kredit/karakter) menghabiskan kuota 2x lebih cepat.
          </p>
        </div>
      )}

      {isGeneratingAudio && audioProgress && (
        <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 flex flex-col gap-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Generating audio...</span>
            <span>
              Scene {audioProgress.currentScene} / {audioProgress.totalScenes}
            </span>
          </div>
          <button
            type="button"
            onClick={cancelAudioGeneration}
            className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded text-xs"
          >
            Cancel Generation
          </button>
        </div>
      )}

      {!isGeneratingAudio && (
        <button
          type="button"
          onClick={() => generateAudio().catch((e) => addToast(String(e), 'error'))}
          className="px-4 py-2 bg-lime-500 text-black font-semibold rounded-lg text-sm"
        >
          Generate Audio
        </button>
      )}
    </div>
  );
};
