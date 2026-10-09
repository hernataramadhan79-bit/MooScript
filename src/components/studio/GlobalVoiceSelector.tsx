import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import { LOCAL_VOICES } from '../../engine/ai/localTts';

export const GlobalVoiceSelector: React.FC = () => {
  const { settings, updateSettings, auditionVoice, isGeneratingAudio, generateAudio, audioStale } = useMooStore();

  const OPENAI_VOICES = [
    { id: 'alloy', name: 'OpenAI: Marcus (Alloy - Tech)' },
    { id: 'nova', name: 'OpenAI: Nova (Dynamic)' },
    { id: 'onyx', name: 'OpenAI: Onyx (Deep Baritone)' },
    { id: 'shimmer', name: 'OpenAI: Shimmer (Chill Storyteller)' },
    { id: 'fable', name: 'OpenAI: Fable (Expressive)' },
    { id: 'echo', name: 'OpenAI: Alfie (Echo - Conversational)' }
  ];

  const ELEVENLABS_VOICES = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'ElevenLabs: Rachel (Calm Narration)' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'ElevenLabs: Domi (Energetic)' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'ElevenLabs: Bella (Expressive)' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'ElevenLabs: Antoni (Authoritative)' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'ElevenLabs: Josh (Deep Podcast)' }
  ];

  const provider = settings.selectedTTSProvider;
  const currentVoiceId =
    provider === 'local'
      ? settings.voiceIds?.local || 'id_ID-news_tts'
      : provider === 'elevenlabs'
      ? settings.voiceIds?.elevenlabs || '21m00Tcm4TlvDq8ikWAM'
      : provider === 'openai'
      ? settings.voiceIds?.openai || 'alloy'
      : 'fallback';

  const selectedCompositeValue = `${provider}:${currentVoiceId}`;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [newProvider, newVoiceId] = e.target.value.split(':');
    if (newProvider === 'local') {
      updateSettings({
        selectedTTSProvider: 'local',
        voiceIds: { ...settings.voiceIds, local: newVoiceId }
      });
    } else if (newProvider === 'openai') {
      updateSettings({
        selectedTTSProvider: 'openai',
        voiceIds: { ...settings.voiceIds, openai: newVoiceId }
      });
    } else if (newProvider === 'elevenlabs') {
      updateSettings({
        selectedTTSProvider: 'elevenlabs',
        voiceIds: { ...settings.voiceIds, elevenlabs: newVoiceId }
      });
    } else {
      updateSettings({ selectedTTSProvider: 'fallback' });
    }
  };

  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-[#141417] border border-white/[0.08] text-xs">
      <span className="material-symbols-outlined text-[15px] text-[#84cc16] shrink-0">record_voice_over</span>
      <select
        value={selectedCompositeValue}
        onChange={handleChange}
        className="flex-1 bg-[#18181c] text-zinc-200 border border-white/[0.08] rounded h-7 px-2 text-[11px] font-medium focus:outline-none focus:border-[#84cc16]/50 cursor-pointer min-w-0"
      >
        <optgroup label="Suara Offline (Lokal)">
          {LOCAL_VOICES.map((v) => (
            <option key={v.id} value={`local:${v.id}`}>
              {v.name} ({v.language.toUpperCase()})
            </option>
          ))}
        </optgroup>
        <optgroup label="OpenAI">
          {OPENAI_VOICES.map((v) => (
            <option key={v.id} value={`openai:${v.id}`}>
              {v.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="ElevenLabs">
          {ELEVENLABS_VOICES.map((v) => (
            <option key={v.id} value={`elevenlabs:${v.id}`}>
              {v.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Browser">
          <option value="fallback:fallback">Suara Standar Browser</option>
        </optgroup>
      </select>

      {/* Audition Button */}
      <button
        type="button"
        onClick={() => auditionVoice(provider, currentVoiceId)}
        title="Audition Selected Voice"
        className="w-7 h-7 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white flex items-center justify-center shrink-0 transition-colors active:scale-95"
      >
        <span className="material-symbols-outlined text-[14px]">volume_up</span>
      </button>

      {/* Sync Audio Button */}
      <button
        type="button"
        disabled={isGeneratingAudio}
        onClick={() => generateAudio()}
        title={audioStale ? 'Narration changed - sync voice now' : 'Re-render voiceover'}
        className={`h-7 px-2 rounded font-bold text-[10px] font-mono flex items-center gap-1 shrink-0 transition-all ${
          audioStale
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
            : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08]'
        }`}
      >
        <span className={`material-symbols-outlined text-[13px] ${isGeneratingAudio ? 'animate-spin' : ''}`}>
          {isGeneratingAudio ? 'sync' : 'graphic_eq'}
        </span>
        <span className="hidden sm:inline">{isGeneratingAudio ? 'Syncing' : audioStale ? 'Sync' : 'Voice'}</span>
      </button>
    </div>
  );
};
