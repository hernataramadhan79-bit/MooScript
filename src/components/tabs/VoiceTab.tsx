import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { TTSProvider } from '../../types';

export const VoiceTab: React.FC = () => {
  const {
    project,
    settings,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    auditionVoice,
    currentFrame,
    isPlaying,
    togglePlay,
    seekTime,
    setActiveTab
  } = useMooStore();

  const fps = project.fps || 30;
  const currentTimeSec = currentFrame / fps;
  const totalDurationSec = project.audioDuration || 10;

  const voices = [
    { id: 'alloy', name: 'Marcus', character: 'Tech Explainer', tag: 'Deep & Crisp', pacing: '1.05x' },
    { id: 'nova', name: 'Nova', character: 'Viral Dynamic', tag: 'Upbeat', pacing: '1.15x' },
    { id: 'onyx', name: 'Onyx', character: 'Authoritative', tag: 'Rich Baritone', pacing: '1.00x' },
    { id: 'shimmer', name: 'Echo', character: 'Chill Storyteller', tag: 'Smooth & Warm', pacing: '0.95x' }
  ];

  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-5 px-4 pt-3 pb-8 max-w-xl mx-auto w-full">
      {/* TTS Engine Provider Selector */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">record_voice_over</span>
            TTS Engine Provider
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Audio Generation</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'fallback' as TTSProvider, label: 'Smart Fallback', sub: 'Zero-API Ambient' },
            { id: 'openai' as TTSProvider, label: 'OpenAI TTS', sub: 'tts-1 Natural' },
            { id: 'elevenlabs' as TTSProvider, label: 'ElevenLabs', sub: 'Timestamps API' }
          ].map((engine) => {
            const isSelected = settings.selectedTTSProvider === engine.id;
            return (
              <button
                key={engine.id}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                  isSelected
                    ? 'bg-zinc-800/90 border-primary shadow-sm shadow-primary/10'
                    : 'bg-[#18181b] border-zinc-800 hover:border-zinc-700'
                }`}
                onClick={() => updateSettings({ selectedTTSProvider: engine.id })}
                type="button"
              >
                <span className={`text-[12px] font-bold ${isSelected ? 'text-primary' : 'text-zinc-200'}`}>
                  {engine.label}
                </span>
                <span className="text-[10px] text-zinc-400">{engine.sub}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Voice Selection Cards */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">spatial_audio</span>
            Voice Persona
          </span>
          <span className="text-[10px] font-mono text-zinc-500">Character profile</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {voices.map((v) => {
            const isSelected = settings.voiceId === v.id;
            return (
              <div
                key={v.id}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#18181b] border-primary shadow-sm shadow-primary/10'
                    : 'bg-[#18181b]/70 border-zinc-800 hover:border-zinc-700'
                }`}
                onClick={() => updateSettings({ voiceId: v.id })}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-semibold text-[13px] text-white leading-tight">{v.name}</span>
                    <span className="text-[10px] text-zinc-400">{v.character}</span>
                  </div>
                  <button
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-primary/20 text-primary hover:bg-primary hover:text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      auditionVoice(v.name);
                    }}
                    title="Audition Voice Sample"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">volume_up</span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                  <span className="font-mono text-[10px] text-zinc-400">Pacing: {v.pacing}</span>
                  <span
                    className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-primary/15 text-primary' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {v.tag}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pacing & Modulation Sliders */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3.5 shadow-sm">
        {/* Speed Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">speed</span>
              Speed / Pacing
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-zinc-400">
                {Math.round((settings.speed || 1.05) * 140)} WPM
              </span>
              <span className="font-mono text-[11px] text-primary font-bold px-1.5 py-0.5 rounded bg-zinc-800">
                {(settings.speed || 1.05).toFixed(2)}x
              </span>
            </div>
          </div>
          <input
            className="w-full accent-primary bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            max="1.50"
            min="0.80"
            step="0.05"
            type="range"
            value={settings.speed || 1.05}
            onChange={(e) => updateSettings({ speed: parseFloat(e.target.value) })}
          />
        </div>

        {/* Vocal Stability Slider */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-emerald-400">graphic_eq</span>
              Vocal Stability
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] px-1 rounded bg-zinc-800 text-zinc-300">Smooth</span>
              <span className="font-mono text-[11px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-zinc-800">
                {settings.stability || 85}%
              </span>
            </div>
          </div>
          <input
            className="w-full accent-emerald-400 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
            max="100"
            min="20"
            step="1"
            type="range"
            value={settings.stability || 85}
            onChange={(e) => updateSettings({ stability: parseInt(e.target.value) })}
          />
        </div>
      </section>

      {/* Audio & Word Synchronization Card */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">equalizer</span>
            AUDIO & WORD SYNCHRONIZATION
          </span>
          <span className="text-zinc-400 font-medium">{formatTimecode(totalDurationSec)} Total</span>
        </div>

        {/* Transport Bar */}
        <div className="flex items-center justify-between bg-[#111113] p-2.5 rounded-lg border border-zinc-800">
          <div className="flex items-center gap-2.5">
            <button
              className="h-9 w-9 rounded-lg bg-primary text-black flex items-center justify-center active:scale-95 shadow transition-transform"
              onClick={togglePlay}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <div className="flex flex-col">
              <span className="font-mono text-[13px] font-bold text-white tracking-tight">
                {formatTimecode(currentTimeSec)}
              </span>
              <span className="font-mono text-[10px] text-primary flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full bg-primary inline-block ${isPlaying ? 'animate-pulse' : ''}`}></span>
                {isPlaying ? 'Playing Audio' : 'Paused'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center active:scale-95 transition-all"
              onClick={() => seekTime(Math.max(0, currentTimeSec - 5))}
              title="Replay 5s"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">replay_5</span>
            </button>
            <button
              className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center active:scale-95 transition-all"
              onClick={() => seekTime(Math.min(totalDurationSec, currentTimeSec + 5))}
              title="Skip 5s"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">forward_5</span>
            </button>
          </div>
        </div>

        {/* Generate / Re-sync Audio CTA */}
        <button
          className="w-full h-10 rounded-lg bg-primary text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-lime-300 active:scale-[0.99] transition-all shadow-md shadow-primary/10 disabled:opacity-50"
          disabled={isGeneratingAudio}
          onClick={generateAudio}
          type="button"
        >
          <span className={`material-symbols-outlined text-[18px] ${isGeneratingAudio ? 'animate-spin' : ''}`}>
            {isGeneratingAudio ? 'progress_activity' : 'graphic_eq'}
          </span>
          <span>
            {isGeneratingAudio
              ? 'Synthesizing & Aligning...'
              : project.audioBlob
              ? 'Re-Generate Audio & Word Alignment'
              : 'Generate Audio & Align Words'}
          </span>
        </button>

        {/* Word Timeline Alignment Visualizer */}
        <div className="space-y-2 pt-1 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>WORD-LEVEL TIMESTAMPS</span>
            <span>{project.scenes.reduce((acc, s) => acc + (s.wordTimestamps?.length || 0), 0)} words</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {project.scenes.map((scene, sIdx) => {
              return (
                <div key={scene.id} className="p-2 bg-[#111113] rounded-lg border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span className="text-primary font-bold">Scene #{sIdx + 1}</span>
                    <span>{scene.durationInSeconds.toFixed(1)}s</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {scene.wordTimestamps?.map((wt, wIdx) => {
                      const isCurrentlySpoken =
                        currentTimeSec >= wt.start && currentTimeSec <= wt.end;
                      return (
                        <div
                          key={`${wt.word}-${wIdx}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
                            isCurrentlySpoken
                              ? 'bg-primary text-black font-bold scale-105'
                              : 'bg-zinc-800/80 text-zinc-300'
                          }`}
                          onClick={() => seekTime(wt.start)}
                        >
                          <span>{wt.word}</span>
                          <span className="text-[8px] opacity-70">
                            {wt.start.toFixed(1)}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Continue Action */}
      <div className="pt-2">
        <button
          className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
          onClick={() => setActiveTab('studio')}
          type="button"
        >
          <span>Continue to Studio & Export</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
