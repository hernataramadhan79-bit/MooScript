import React, { useState, useEffect } from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { TTSProvider, BgmPreset } from '../../types';
import { LOCAL_VOICES, isLocalModelCached, downloadLocalModel, type DownloadProgress } from '../../engine/ai/localTts';

export const VoiceTab: React.FC = () => {
  const {
    project,
    settings,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    cancelAudioGeneration,
    audioProgress,
    auditionVoice,
    audioStale,
    currentFrame,
    isPlaying,
    togglePlay,
    seekTime,
    setActiveTab,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio
  } = useMooStore();

  const fps = project.fps || 30;
  const currentTimeSec = currentFrame / fps;
  const totalDurationSec = project.audioDuration || 10;

  const OPENAI_VOICES = [
    { id: 'alloy', name: 'Marcus', character: 'Tech Explainer', tag: 'Deep & Crisp', pacing: '1.05x' },
    { id: 'nova', name: 'Nova', character: 'Viral Dynamic', tag: 'Upbeat', pacing: '1.15x' },
    { id: 'onyx', name: 'Onyx', character: 'Authoritative', tag: 'Rich Baritone', pacing: '1.00x' },
    { id: 'shimmer', name: 'Echo', character: 'Chill Storyteller', tag: 'Smooth & Warm', pacing: '0.95x' },
    { id: 'fable', name: 'Fable', character: 'British Dynamic', tag: 'Expressive Actor', pacing: '1.00x' },
    { id: 'echo', name: 'Alfie', character: 'Conversational', tag: 'Balanced Tone', pacing: '1.00x' }
  ];

  const ELEVENLABS_VOICES = [
    {
      id: '21m00Tcm4TlvDq8ikWAM',
      name: 'Rachel',
      character: 'Calm & Professional',
      tag: 'Natural Narration',
      pacing: '1.00x'
    },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', character: 'Energetic & Young', tag: 'Viral Pace', pacing: '1.10x' },
    {
      id: 'EXAVITQu4vr4xnSDxMaL',
      name: 'Bella',
      character: 'Expressive & Bright',
      tag: 'High Energy',
      pacing: '1.05x'
    },
    {
      id: 'ErXwobaYiN019PkySvjV',
      name: 'Antoni',
      character: 'Authoritative & Warm',
      tag: 'Deep Storyteller',
      pacing: '1.00x'
    },
    {
      id: 'MF3mGyEYCl7XYWbV9V6O',
      name: 'Elli',
      character: 'Emotional & Storyteller',
      tag: 'Clear & Vibrant',
      pacing: '1.00x'
    },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', character: 'Deep Baritone', tag: 'Podcast Narrative', pacing: '0.95x' }
  ];

  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});
  const [downloadingVoiceId, setDownloadingVoiceId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all(
      LOCAL_VOICES.map(async (v) => {
        const cached = await isLocalModelCached(v.id);
        return [v.id, cached] as const;
      })
    ).then((results) => {
      if (mounted) {
        setCachedModels(Object.fromEntries(results));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleDownloadModel = async (voiceId: string) => {
    try {
      setDownloadingVoiceId(voiceId);
      await downloadLocalModel(voiceId, (p) => {
        setDownloadProgress(p);
      });
      setCachedModels((prev) => ({ ...prev, [voiceId]: true }));
      setDownloadingVoiceId(null);
      setDownloadProgress(null);
    } catch (err: unknown) {
      setDownloadingVoiceId(null);
      setDownloadProgress(null);
      console.error(err);
    }
  };

  const activeProvider = settings.selectedTTSProvider;
  const currentVoiceId =
    activeProvider === 'local'
      ? settings.voiceIds?.local || 'id_ID-news_tts'
      : activeProvider === 'elevenlabs'
      ? settings.voiceIds?.elevenlabs || '21m00Tcm4TlvDq8ikWAM'
      : settings.voiceIds?.openai || 'alloy';

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'local' as TTSProvider, label: 'Local TTS', sub: 'Zero-API Offline' },
            { id: 'fallback' as TTSProvider, label: 'Smart Fallback', sub: 'Ambient Synth' },
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
          <span className="text-[10px] font-mono text-zinc-500">
            {activeProvider === 'local'
              ? 'Local Piper ONNX Models'
              : activeProvider === 'elevenlabs'
              ? 'ElevenLabs Library'
              : activeProvider === 'openai'
                ? 'OpenAI Voices'
                : 'Synthesizer Mode'}
          </span>
        </div>

        {activeProvider === 'local' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {LOCAL_VOICES.map((v) => {
              const isSelected = currentVoiceId === v.id;
              const isCached = cachedModels[v.id];
              const isDownloading = downloadingVoiceId === v.id;

              return (
                <div
                  key={v.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#18181b] border-primary shadow-sm shadow-primary/10'
                      : 'bg-[#18181b]/70 border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => {
                    updateSettings({ voiceIds: { ...settings.voiceIds, local: v.id } });
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[13px] text-white leading-tight">{v.name}</span>
                        {isCached ? (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[11px]">check_circle</span>
                            Offline Ready
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                            ~{v.sizeMb}MB
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-0.5">{v.description}</span>
                    </div>
                    <button
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ml-2 ${
                        isSelected
                          ? 'bg-primary/20 text-primary hover:bg-primary hover:text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        auditionVoice('local', v.id);
                      }}
                      title="Test Voice Sample"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">volume_up</span>
                    </button>
                  </div>

                  {isDownloading ? (
                    <div className="space-y-1 pt-1 border-t border-zinc-800/80">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                        <span>Mengunduh model...</span>
                        <span>{downloadProgress?.percent || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${downloadProgress?.percent || 0}%` }}
                        />
                      </div>
                    </div>
                  ) : !isCached ? (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                      <span className="text-[10px] text-zinc-500 font-mono">{v.languageLabel}</span>
                      <button
                        className="text-[10px] font-semibold text-primary hover:text-lime-300 bg-primary/10 hover:bg-primary/20 border border-primary/30 px-2 py-0.5 rounded transition-all flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadModel(v.id);
                        }}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[12px]">download</span>
                        <span>Pre-cache Model</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                      <span className="font-mono text-[10px] text-zinc-400">{v.languageLabel}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{v.sampleRate} Hz ONNX</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : activeProvider === 'fallback' ? (
          <div className="p-4 rounded-xl border border-zinc-800 bg-[#18181b]/70 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">music_note</span>
                Algorithmic Ambient Synth & Chimes
              </span>
              <p className="text-[11px] text-zinc-400">
                Generates harmonic procedural ambient audio matching your scene durations without any external API keys.
              </p>
            </div>
            <button
              className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1 shrink-0 ml-3"
              onClick={() => auditionVoice('fallback')}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">volume_up</span>
              <span>Preview</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {(activeProvider === 'elevenlabs' ? ELEVENLABS_VOICES : OPENAI_VOICES).map((v) => {
              const isSelected = currentVoiceId === v.id;
              return (
                <div
                  key={v.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#18181b] border-primary shadow-sm shadow-primary/10'
                      : 'bg-[#18181b]/70 border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => {
                    if (activeProvider === 'elevenlabs') {
                      updateSettings({ voiceIds: { ...settings.voiceIds, elevenlabs: v.id } });
                    } else {
                      updateSettings({ voiceIds: { ...settings.voiceIds, openai: v.id } });
                    }
                  }}
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
                        auditionVoice(activeProvider, v.id);
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
        )}
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

      {/* Background Music (BGM) Card */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-sky-400">library_music</span>
            BACKGROUND MUSIC
          </span>
          <span className="text-zinc-500 font-mono text-[10px]">Procedural • No Upload Needed</span>
        </div>

        {/* BGM Preset Picker */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400">BGM Preset</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {(
              [
                { id: 'none', label: 'Off', icon: 'music_off', color: 'text-zinc-400' },
                { id: 'ambient', label: 'Ambient', icon: 'waves', color: 'text-sky-400' },
                { id: 'hiphop', label: 'Hip-Hop', icon: 'piano', color: 'text-violet-400' },
                { id: 'cinematic', label: 'Cinematic', icon: 'movie', color: 'text-amber-400' },
                { id: 'lofi', label: 'Lo-Fi', icon: 'headphones', color: 'text-rose-400' }
              ] as { id: BgmPreset; label: string; icon: string; color: string }[]
            ).map(({ id, label, icon, color }) => {
              const isSelected = (project.bgm?.preset || 'none') === id;
              return (
                <button
                  key={id}
                  className={`h-14 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${
                    isSelected
                      ? 'bg-zinc-800 border-primary/50'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                  onClick={() => updateBgmPreset(id)}
                  type="button"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-primary' : color}`}>
                    {icon}
                  </span>
                  <span className={isSelected ? 'text-primary' : 'text-zinc-300'}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BGM Level + Ducking Sliders — only visible when BGM is active */}
        {project.bgm?.preset && project.bgm.preset !== 'none' && (
          <>
            {/* BGM Volume Slider */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-sky-400">volume_up</span>
                  BGM Volume
                </span>
                <span className="font-mono text-[11px] text-sky-400 font-bold px-1.5 py-0.5 rounded bg-zinc-800">
                  {Math.round((project.bgm.level ?? 0.18) * 100)}%
                </span>
              </div>
              <input
                className="w-full accent-sky-400 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                max="0.60"
                min="0.02"
                step="0.01"
                type="range"
                value={project.bgm.level ?? 0.18}
                onChange={(e) => updateBgmLevel(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                <span>2%</span>
                <span>Background mix</span>
                <span>60%</span>
              </div>
            </div>

            {/* Ducking Ratio Slider */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-400">arrow_downward</span>
                  Duck During Voice
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[9px] px-1 rounded bg-zinc-800 text-zinc-400">
                    {Math.round((project.bgm.duckRatio ?? 0.15) * 100)}% vol
                  </span>
                </div>
              </div>
              <input
                className="w-full accent-amber-400 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                max="1.00"
                min="0.00"
                step="0.05"
                type="range"
                value={project.bgm.duckRatio ?? 0.15}
                onChange={(e) => updateBgmDuckRatio(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                <span>Mute BGM</span>
                <span>← duck amount →</span>
                <span>No duck</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-relaxed pt-0.5">
              <span className="material-symbols-outlined text-[12px] align-middle text-amber-400/70">info</span>{' '}
              BGM is applied at export time. Re-generate audio after changing BGM settings.
            </p>
          </>
        )}
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
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-primary inline-block ${isPlaying ? 'animate-pulse' : ''}`}
                ></span>
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

        {/* Audio Outdated Warning Banner */}
        {audioStale && !isGeneratingAudio && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs">
            <span className="material-symbols-outlined text-[18px] text-amber-400">warning</span>
            <span className="flex-1 font-medium">
              Audio outdated — script or scene timings changed. Regenerate to sync timeline.
            </span>
          </div>
        )}

        {/* Active Audio Generation Progress Panel */}
        {isGeneratingAudio && audioProgress && (
          <div className="p-3.5 rounded-xl bg-[#111113] border border-primary/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5 truncate max-w-[280px]">
                <span className="material-symbols-outlined text-[16px] text-primary animate-spin shrink-0">
                  progress_activity
                </span>
                <span className="truncate">{audioProgress.statusText}</span>
              </span>
              <span className="font-mono text-primary font-bold text-[11px] shrink-0">
                Scene {audioProgress.currentScene} / {audioProgress.totalScenes}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-200"
                style={{
                  width: `${audioProgress.totalScenes > 0 ? (audioProgress.currentScene / audioProgress.totalScenes) * 100 : 0}%`
                }}
              />
            </div>
            <div className="flex justify-end pt-0.5">
              <button
                className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                onClick={cancelAudioGeneration}
                type="button"
              >
                Cancel Generation
              </button>
            </div>
          </div>
        )}

        {/* Generate / Re-sync Audio CTA */}
        <button
          className={`w-full h-10 rounded-lg text-black font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 ${
            audioStale && !isGeneratingAudio
              ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/20'
              : 'bg-primary hover:bg-lime-300 shadow-primary/10'
          }`}
          disabled={isGeneratingAudio}
          onClick={generateAudio}
          type="button"
        >
          <span className={`material-symbols-outlined text-[18px] ${isGeneratingAudio ? 'animate-spin' : ''}`}>
            {isGeneratingAudio ? 'progress_activity' : audioStale ? 'sync_problem' : 'graphic_eq'}
          </span>
          <span>
            {isGeneratingAudio
              ? audioProgress?.statusText || 'Synthesizing Audio...'
              : audioStale
                ? 'Regenerate Audio (Audio Outdated)'
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
                      const isCurrentlySpoken = currentTimeSec >= wt.start && currentTimeSec <= wt.end;
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
                          <span className="text-[8px] opacity-70">{wt.start.toFixed(1)}s</span>
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
