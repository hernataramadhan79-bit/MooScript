import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import type { BgmPreset, TTSProvider } from '../../types';

interface VoiceViewProps {
  onBackStep?: () => void;
  onNextStep?: () => void;
}

export const VoiceView: React.FC<VoiceViewProps> = ({ onBackStep, onNextStep }) => {
  const {
    project,
    settings,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    audioStale,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio
  } = useMooStore();

  const providerOptions: { value: TTSProvider; label: string; icon?: string }[] = [
    { value: 'openai', label: 'OpenAI TTS' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'local', label: 'Local (Kokoro)' },
    { value: 'fallback', label: 'Fallback Timer' }
  ];

  const bgmOptions: { value: BgmPreset; label: string }[] = [
    { value: 'none', label: 'Tanpa BGM' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'lofi', label: 'Lofi Chill' },
    { value: 'ambient', label: 'Ambient' },
    { value: 'hiphop', label: 'High Energy' }
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 max-w-2xl mx-auto w-full">
      {/* 1. Voice TTS Generator */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
            Voiceover & Narasi
          </span>
          {audioStale && (
            <span className="text-[12px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Naskah berubah, generate ulang
            </span>
          )}
        </div>

        <Field label="Engine Voice AI">
          <SegmentedControl<TTSProvider>
            options={providerOptions}
            value={settings.selectedTTSProvider || 'openai'}
            onChange={(val) => updateSettings({ selectedTTSProvider: val })}
          />
        </Field>

        <Button
          variant="primary"
          icon="mic"
          isLoading={isGeneratingAudio}
          disabled={isGeneratingAudio}
          onClick={generateAudio}
          className="w-full mt-1"
        >
          {isGeneratingAudio ? 'Men-generate Voiceover...' : 'Generate Voice & Sinkronisasi Kata'}
        </Button>
      </div>

      {/* 2. Background Music & Ducking */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-1 border border-border flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-accent">music_note</span>
          Musik Latar (BGM) & Ducking
        </span>

        <Field label="Pilihan Mood BGM">
          <SegmentedControl<BgmPreset>
            options={bgmOptions}
            value={project.bgm?.preset || 'none'}
            onChange={(val) => updateBgmPreset(val)}
          />
        </Field>

        {project.bgm?.preset !== 'none' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <Field
              label={`Volume Musik (${Math.round((project.bgm?.level ?? 0.18) * 100)}%)`}
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={project.bgm?.level ?? 0.18}
                onChange={(e) => updateBgmLevel(parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>

            <Field
              label={`Ducking saat VO Bicara (${Math.round((1 - (project.bgm?.duckRatio ?? 0.15)) * 100)}%)`}
              hint="Otomatis mengecilkan musik"
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={project.bgm?.duckRatio ?? 0.15}
                onChange={(e) => updateBgmDuckRatio(parseFloat(e.target.value))}
                className="w-full"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Navigasi Langkah */}
      <div className="flex items-center justify-between pt-2">
        {onBackStep ? (
          <Button variant="secondary" icon="arrow_back" onClick={onBackStep}>
            Kembali ke Gaya
          </Button>
        ) : <div />}
        {onNextStep && (
          <Button variant="primary" icon="arrow_forward" iconPosition="right" onClick={onNextStep}>
            Lanjut ke Ekspor Video
          </Button>
        )}
      </div>
    </div>
  );
};
