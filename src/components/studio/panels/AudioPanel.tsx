import React, { useState, useEffect } from 'react';
import { useMooStore } from '../../../store/useMooStore';
import type { TTSProvider, BgmPreset } from '../../../types';
import {
  LOCAL_VOICES,
  isLocalModelCached,
  downloadLocalModel,
  type DownloadProgress
} from '../../../engine/ai/localTts';

export const AudioPanel: React.FC = () => {
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
    seekTime,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio
  } = useMooStore();

  const fps = project.fps || 30;
  const currentTimeSec = currentFrame / fps;
  const totalDurationSec = project.audioDuration || 10;

  const OPENAI_VOICES = [
    { id: 'alloy', name: 'Marcus', character: 'Tech Explainer', tag: 'Deep & Crisp', pacing: '1.05x' },
    { id: 'nova', name: 'Nova', character: 'Viral Dynamic', tag: 'Upbeat Pace', pacing: '1.15x' },
    { id: 'onyx', name: 'Onyx', character: 'Authoritative', tag: 'Rich Baritone', pacing: '1.00x' },
    { id: 'shimmer', name: 'Echo', character: 'Chill Storyteller', tag: 'Smooth & Warm', pacing: '0.95x' },
    { id: 'fable', name: 'Fable', character: 'British Dynamic', tag: 'Expressive', pacing: '1.00x' },
    { id: 'echo', name: 'Alfie', character: 'Conversational', tag: 'Balanced Tone', pacing: '1.00x' }
  ];

  const ELEVENLABS_VOICES = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', character: 'Calm & Professional', tag: 'Natural Narration', pacing: '1.00x' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', character: 'Energetic & Young', tag: 'Viral Pace', pacing: '1.10x' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', character: 'Expressive & Bright', tag: 'High Energy', pacing: '1.05x' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', character: 'Authoritative & Warm', tag: 'Deep Storyteller', pacing: '1.00x' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', character: 'Emotional & Storyteller', tag: 'Clear & Vibrant', pacing: '1.00x' },
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
      await downloadLocalModel(voiceId, (p) => setDownloadProgress(p));
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

  return (
    <div className="flex flex-col gap-2.5 sm:gap-4 p-2.5 sm:p-4 text-xs">
      {/* 1. TTS Engine Provider Selector */}
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">record_voice_over</span>
            TTS Engine Provider
          </span>
          <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">Audio Voiceover</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { id: 'local' as TTSProvider, label: 'Local Piper', sub: 'Zero-API Offline' },
            { id: 'fallback' as TTSProvider, label: 'Procedural Synth', sub: 'No Keys Ambient' },
            { id: 'openai' as TTSProvider, label: 'OpenAI TTS', sub: 'Natural tts-1' },
            { id: 'elevenlabs' as TTSProvider, label: 'ElevenLabs', sub: 'Word Timestamps' }
          ].map((engine) => {
            const isSelected = settings.selectedTTSProvider === engine.id;
            return (
              <button
                key={engine.id}
                type="button"
                onClick={() => updateSettings({ selectedTTSProvider: engine.id })}
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border text-center sm:text-left flex flex-col gap-0.5 transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-sm shadow-primary/15'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`text-[10px] sm:text-[11px] font-bold truncate ${
                    isSelected ? 'text-primary' : 'text-zinc-200'
                  }`}
                >
                  {engine.label}
                </span>
                <span className="hidden sm:block text-[9px] text-zinc-400">{engine.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Voice Personas */}
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">spatial_audio</span>
            Voice Persona
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {activeProvider === 'local'
              ? 'Local ONNX'
              : activeProvider === 'elevenlabs'
              ? 'ElevenLabs'
              : activeProvider === 'openai'
              ? 'OpenAI Speech'
              : 'Ambient Synthesizer'}
          </span>
        </div>

        {activeProvider === 'local' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LOCAL_VOICES.map((v) => {
              const isSelected = currentVoiceId === v.id;
              const isCached = cachedModels[v.id];
              const isDownloading = downloadingVoiceId === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => updateSettings({ voiceIds: { ...settings.voiceIds, local: v.id } })}
                  className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.04] border-primary shadow-sm shadow-primary/10'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">{v.name}</span>
                        {isCached ? (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1 py-0.2 rounded">
                            Offline Ready
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1 py-0.2 rounded">
                            ~{v.sizeMb}MB
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">{v.description}</span>
                    </div>

                    <button
                      type="button"
                      title="Audition Sample"
                      onClick={(e) => {
                        e.stopPropagation();
                        auditionVoice('local', v.id);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ml-1.5 ${
                        isSelected
                          ? 'bg-primary text-black hover:bg-lime-300'
                          : 'bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.12]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">volume_up</span>
                    </button>
                  </div>

                  {isDownloading ? (
                    <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                      <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                        <span>Downloading model...</span>
                        <span>{downloadProgress?.percent || 0}%</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${downloadProgress?.percent || 0}%` }}
                        />
                      </div>
                    </div>
                  ) : !isCached ? (
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                      <span className="text-[9px] text-zinc-500 font-mono">{v.languageLabel}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadModel(v.id);
                        }}
                        className="text-[9px] font-semibold text-primary hover:text-lime-300 bg-primary/10 hover:bg-primary/20 border border-primary/30 px-2 py-0.5 rounded transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[11px]">download</span>
                        <span>Pre-cache</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                      <span className="font-mono text-[9px] text-zinc-400">{v.languageLabel}</span>
                      <span className="text-[9px] font-mono text-zinc-500">{v.sampleRate} Hz ONNX</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : activeProvider === 'fallback' ? (
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">music_note</span>
                Algorithmic Ambient Synth & Chimes
              </span>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Generates harmonic procedural ambient chime audio matching your scene durations without any API keys.
              </p>
            </div>
            <button
              type="button"
              onClick={() => auditionVoice('fallback')}
              className="h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-xs font-medium flex items-center gap-1 shrink-0"
            >
              <span className="material-symbols-outlined text-[15px]">volume_up</span>
              <span>Preview</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(activeProvider === 'elevenlabs' ? ELEVENLABS_VOICES : OPENAI_VOICES).map((v) => {
              const isSelected = currentVoiceId === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    if (activeProvider === 'elevenlabs') {
                      updateSettings({ voiceIds: { ...settings.voiceIds, elevenlabs: v.id } });
                    } else {
                      updateSettings({ voiceIds: { ...settings.voiceIds, openai: v.id } });
                    }
                  }}
                  className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.04] border-primary shadow-sm shadow-primary/10'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-xs text-white block">{v.name}</span>
                      <span className="text-[9px] text-zinc-400">{v.character}</span>
                    </div>

                    <button
                      type="button"
                      title="Audition Sample"
                      onClick={(e) => {
                        e.stopPropagation();
                        auditionVoice(activeProvider, v.id);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-primary text-black hover:bg-lime-300'
                          : 'bg-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">volume_up</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                    <span className="font-mono text-[9px] text-zinc-400">Pace: {v.pacing}</span>
                    <span
                      className={`text-[8px] font-mono px-1 py-0.2 rounded ${
                        isSelected ? 'bg-primary/20 text-primary font-bold' : 'bg-white/[0.06] text-zinc-400'
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
      </div>

      {/* 3. Pacing & Modulation Sliders */}
      <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2 sm:space-y-2.5">
        {/* Speed Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5 text-[11px]">
              <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">speed</span>
              Speed / Pacing
            </span>
            <div className="flex items-center gap-1 font-mono">
              <span className="text-[8px] sm:text-[9px] text-zinc-400">
                {Math.round((settings.speed || 1.05) * 140)} WPM
              </span>
              <span className="text-[9px] sm:text-[10px] text-primary font-bold px-1.5 py-0.2 rounded bg-white/[0.06]">
                {(settings.speed || 1.05).toFixed(2)}x
              </span>
            </div>
          </div>
          <input
            className="w-full accent-primary h-1.5 cursor-pointer"
            max="1.50"
            min="0.80"
            step="0.05"
            type="range"
            value={settings.speed || 1.05}
            onChange={(e) => updateSettings({ speed: parseFloat(e.target.value) })}
          />
        </div>

        {/* Vocal Stability */}
        <div className="space-y-1 pt-1.5 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5 text-[11px]">
              <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-emerald-400">graphic_eq</span>
              Vocal Stability
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-white/[0.06]">
              {settings.stability || 85}%
            </span>
          </div>
          <input
            className="w-full accent-emerald-400 h-1.5 cursor-pointer"
            max="100"
            min="20"
            step="1"
            type="range"
            value={settings.stability || 85}
            onChange={(e) => updateSettings({ stability: parseInt(e.target.value, 10) })}
          />
        </div>
      </div>

      {/* 4. Background Music (BGM) Mood Cards & Ducking */}
      <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2 sm:space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-sky-400">library_music</span>
            Background Music (BGM)
          </span>
          <span className="text-zinc-500 font-mono text-[8px] sm:text-[9px] hidden sm:inline">Procedural • Instant Mix</span>
        </div>

        {/* BGM Mood Cards */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
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
                type="button"
                onClick={() => updateBgmPreset(id)}
                className={`py-1.5 px-0.5 sm:py-2 sm:px-1 rounded-lg sm:rounded-xl text-center flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95 border ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-sm shadow-primary/20'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] text-zinc-400 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] sm:text-[17px] ${isSelected ? 'text-primary' : color}`}>
                  {icon}
                </span>
                <span className="text-[8px] sm:text-[9px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Volume & Auto-Ducking Sliders */}
        {project.bgm?.preset && project.bgm.preset !== 'none' && (
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            {/* BGM Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 text-[11px] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-sky-400">volume_up</span>
                  BGM Level
                </span>
                <span className="font-mono text-[10px] text-sky-400 font-bold px-1.5 py-0.2 rounded bg-white/[0.06]">
                  {Math.round((project.bgm.level ?? 0.18) * 100)}%
                </span>
              </div>
              <input
                className="w-full accent-sky-400 h-1.5 cursor-pointer"
                max="0.60"
                min="0.02"
                step="0.01"
                type="range"
                value={project.bgm.level ?? 0.18}
                onChange={(e) => updateBgmLevel(parseFloat(e.target.value))}
              />
            </div>

            {/* Ducking Ratio */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 text-[11px] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-amber-400">arrow_downward</span>
                  Auto-Duck During Speech
                </span>
                <span className="font-mono text-[10px] text-amber-400 font-bold px-1.5 py-0.2 rounded bg-white/[0.06]">
                  {Math.round((project.bgm.duckRatio ?? 0.15) * 100)}% volume
                </span>
              </div>
              <input
                className="w-full accent-amber-400 h-1.5 cursor-pointer"
                max="1.00"
                min="0.00"
                step="0.05"
                type="range"
                value={project.bgm.duckRatio ?? 0.15}
                onChange={(e) => updateBgmDuckRatio(parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. Audio Sync Status & Generation CTA */}
      <div className="space-y-2">
        {audioStale && !isGeneratingAudio && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
            <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0">warning</span>
            <span className="flex-1 leading-snug">
              Naskah atau durasi scene telah diedit. Generate ulang audio agar timeline & kata tetap sinkron.
            </span>
          </div>
        )}

        {/* Generating Progress State */}
        {isGeneratingAudio && audioProgress && (
          <div className="p-3 rounded-xl bg-black/60 border border-primary/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5 truncate max-w-[260px]">
                <span className="material-symbols-outlined text-[15px] text-primary animate-spin shrink-0">
                  progress_activity
                </span>
                <span className="truncate">{audioProgress.statusText}</span>
              </span>
              <span className="font-mono text-primary font-bold text-[10px] shrink-0">
                Scene {audioProgress.currentScene} / {audioProgress.totalScenes}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-200"
                style={{
                  width: `${audioProgress.totalScenes > 0 ? (audioProgress.currentScene / audioProgress.totalScenes) * 100 : 0}%`
                }}
              />
            </div>
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={cancelAudioGeneration}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                Cancel Generation
              </button>
            </div>
          </div>
        )}

        {/* Generate Audio Button */}
        <button
          type="button"
          disabled={isGeneratingAudio}
          onClick={generateAudio}
          className={`w-full h-8 sm:h-9 rounded-lg sm:rounded-xl text-black font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.99] transition-all shadow-md disabled:opacity-40 ${
            audioStale && !isGeneratingAudio
              ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/20'
              : 'bg-primary hover:bg-lime-300 shadow-[0_0_15px_rgba(158,233,57,0.2)]'
          }`}
        >
          <span className={`material-symbols-outlined text-[15px] sm:text-[17px] ${isGeneratingAudio ? 'animate-spin' : ''}`}>
            {isGeneratingAudio ? 'progress_activity' : audioStale ? 'sync_problem' : 'graphic_eq'}
          </span>
          <span className="truncate">
            {isGeneratingAudio
              ? audioProgress?.statusText || 'Synthesizing...'
              : audioStale
                ? 'Regenerate Audio (Sync Timestamps)'
                : project.audioBlob
                  ? 'Re-Generate Audio'
                  : 'Generate Audio & Align Words'}
          </span>
        </button>
      </div>

      {/* 6. Word Timeline Alignment Visualizer */}
      <div className="space-y-2 pt-1 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>WORD-LEVEL TIMESTAMPS ({project.scenes.reduce((acc, s) => acc + (s.wordTimestamps?.length || 0), 0)} words)</span>
          <span>{totalDurationSec.toFixed(1)}s Total</span>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          {project.scenes.map((scene, sIdx) => {
            return (
              <div key={scene.id} className="p-2 bg-black/40 rounded-lg border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                  <span className="text-primary font-bold">Scene #{sIdx + 1}</span>
                  <span>{scene.durationInSeconds.toFixed(1)}s</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {scene.wordTimestamps?.map((wt, wIdx) => {
                    const isCurrentlySpoken = currentTimeSec >= wt.start && currentTimeSec <= wt.end;
                    return (
                      <button
                        key={`${wt.word}-${wIdx}`}
                        type="button"
                        onClick={() => seekTime(wt.start)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-all active:scale-95 ${
                          isCurrentlySpoken
                            ? 'bg-primary text-black font-bold scale-105 shadow-sm shadow-primary/30'
                            : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300'
                        }`}
                      >
                        <span>{wt.word}</span>
                        <span className="text-[8px] opacity-70">{wt.start.toFixed(1)}s</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
