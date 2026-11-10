import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMooStore } from '../../../store/useMooStore';
import { useShallow } from 'zustand/react/shallow';
import { isLocalModelCached, downloadLocalModel, getLocalVoice, purgeLocalModel } from '../../../engine/ai/localTts';
import type {
  BgmPreset
} from '../../../types';
import { t } from '../../../i18n';
import { CommitSliderRow } from './controls';
import type { InspectorShared } from './shared';

export const AudioTab: React.FC<{ shared: InspectorShared }> = ({ shared }) => {
  const {
    project,
    settings,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    uploadCustomAudio,
    cancelAudioGeneration,
    deleteAudio,
    audioProgress,
    auditionVoice,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio,
    updateVoiceEdit,
    setSfxLevel,
    autoPlaceSfx,
    uploadCustomBgm,
    removeCustomBgm,
    audioStale,
    bgmOnlyAudio,
    addToast
  } = useMooStore(
    useShallow((s) => ({
      project: s.project,
      settings: s.settings,
      updateSettings: s.updateSettings,
      isGeneratingAudio: s.isGeneratingAudio,
      generateAudio: s.generateAudio,
      uploadCustomAudio: s.uploadCustomAudio,
      cancelAudioGeneration: s.cancelAudioGeneration,
      deleteAudio: s.deleteAudio,
      audioProgress: s.audioProgress,
      auditionVoice: s.auditionVoice,
      updateBgmPreset: s.updateBgmPreset,
      updateBgmLevel: s.updateBgmLevel,
      updateBgmDuckRatio: s.updateBgmDuckRatio,
      updateVoiceEdit: s.updateVoiceEdit,
      setSfxLevel: s.setSfxLevel,
      autoPlaceSfx: s.autoPlaceSfx,
      uploadCustomBgm: s.uploadCustomBgm,
      removeCustomBgm: s.removeCustomBgm,
      audioStale: s.audioStale,
      bgmOnlyAudio: s.bgmOnlyAudio,
      addToast: s.addToast
    }))
  );

  const hasRawVoice = useMooStore((s) => Boolean(s.rawVoiceBlob));
  const voiceEdit = project.voiceEdit || {};
  const voiceEditActive = Object.values(voiceEdit).some((v) => v !== undefined);

  // Active Scene & Layer States
  const scenes = useMemo(() => project.scenes || [], [project.scenes]);
  const customAudioInputRef = useRef<HTMLInputElement | null>(null);
  const customBgmInputRef = useRef<HTMLInputElement | null>(null);

  // Voice provider mapping
  const currentVoiceProvider = useMemo(() => {
    const p = settings.selectedTTSProvider;
    if (p === 'openai') return 'openai';
    if (p === 'elevenlabs') return 'elevenlabs';
    if (p === 'local') return 'local';
    return 'timer';
  }, [settings.selectedTTSProvider]);

  const voiceProviders = [
    { id: 'timer', label: t('Tanpa Suara (Timer)') },
    { id: 'openai', label: t('OpenAI') },
    { id: 'elevenlabs', label: t('ElevenLabs') },
    { id: 'local', label: t('Offline Lokal') }
  ];

  const OPENAI_VOICE_OPTIONS = [
    { id: 'alloy', label: t('Alloy') },
    { id: 'echo', label: t('Echo') },
    { id: 'fable', label: t('Fable') },
    { id: 'onyx', label: t('Onyx') },
    { id: 'nova', label: t('Nova') },
    { id: 'shimmer', label: t('Shimmer') }
  ];

  const ELEVENLABS_VOICE_OPTIONS = [
    { id: '21m00Tcm4TlvDq8ikWAM', label: t('Rachel') },
    { id: 'AZnzlk1XvdvUeBnXmlld', label: t('Domi') },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: t('Bella') },
    { id: 'ErXwobaYiN019PkySvjV', label: t('Antoni') },
    { id: 'TxGEqnHWrfWFTfGW9XjX', label: t('Josh') },
    { id: 'custom', label: t('Kustom') }
  ];

  const LOCAL_VOICE_OPTIONS = [
    { id: 'id_ID-news_tts', label: t('Ayu (id_ID) - Narasi Berita & Edukasi') },
    { id: 'en_US-lessac', label: t('Lessac (en_US) - Storyteller & Narasi') },
    { id: 'fallback', label: t('WebSpeech - Standar Suara Browser (Live)') }
  ];

  const currentOpenAIVoice = settings.voiceIds?.openai || 'alloy';
  const currentElevenLabsVoice = settings.voiceIds?.elevenlabs || '21m00Tcm4TlvDq8ikWAM';
  const isElevenLabsCustom =
    !ELEVENLABS_VOICE_OPTIONS.slice(0, 5).some((v) => v.id === currentElevenLabsVoice) ||
    currentElevenLabsVoice === 'custom';
  const currentLocalVoice = settings.voiceIds?.local || 'id_ID-news_tts';
  const [isLocalVoiceCached, setIsLocalVoiceCached] = useState<boolean>(true);
  const { isDownloadingLocalVoice, setIsDownloadingLocalVoice, localVoiceDownloadProgress, setLocalVoiceDownloadProgress } = shared;

  useEffect(() => {
    if (currentVoiceProvider === 'local' && currentLocalVoice && currentLocalVoice !== 'fallback') {
      isLocalModelCached(currentLocalVoice).then(setIsLocalVoiceCached).catch(() => setIsLocalVoiceCached(false));
    }
  }, [currentVoiceProvider, currentLocalVoice]);

  const handleDownloadCurrentLocalVoice = async () => {
    const voice = getLocalVoice(currentLocalVoice);
    if (!voice) return;
    setIsDownloadingLocalVoice(true);
    setLocalVoiceDownloadProgress(0);
    try {
      await downloadLocalModel(voice.id, (p) => {
        setLocalVoiceDownloadProgress(p.percent);
      });
      setIsLocalVoiceCached(true);
      addToast(t('Model suara {0} berhasil diunduh dan siap offline!', voice.name), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(t('Gagal mengunduh model: {0}', msg), 'error');
    } finally {
      setIsDownloadingLocalVoice(false);
    }
  };

  const handlePurgeCurrentLocalVoice = async () => {
    const voice = getLocalVoice(currentLocalVoice);
    if (!voice) return;
    try {
      await purgeLocalModel(voice.id);
      setIsLocalVoiceCached(false);
      addToast(t('Model suara {0} dihapus dari cache browser.', voice.name), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(t('Gagal menghapus model: {0}', msg), 'error');
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'timer') {
      updateSettings({ selectedTTSProvider: 'fallback' });
    } else if (val === 'openai') {
      updateSettings({ selectedTTSProvider: 'openai' });
    } else if (val === 'elevenlabs') {
      updateSettings({ selectedTTSProvider: 'elevenlabs' });
    } else if (val === 'local') {
      updateSettings({ selectedTTSProvider: 'local' });
    }
  };

  const handleAuditionVoice = async () => {
    if (currentVoiceProvider === 'openai') {
      await auditionVoice('openai', currentOpenAIVoice);
    } else if (currentVoiceProvider === 'elevenlabs') {
      await auditionVoice('elevenlabs', currentElevenLabsVoice);
    } else if (currentVoiceProvider === 'local') {
      if (currentLocalVoice === 'fallback') {
        await auditionVoice('fallback');
      } else {
        await auditionVoice('local', currentLocalVoice);
      }
    } else {
      await auditionVoice('fallback');
    }
  };

  // BGM Presets
  const currentBgmPreset = project.bgm?.preset || 'none';
  const bgmPresets: { value: BgmPreset; label: string }[] = [
    { value: 'none', label: t('Tanpa') },
    { value: 'ambient', label: t('Ambient') },
    { value: 'lofi', label: t('Lofi') },
    { value: 'cinematic', label: t('Cinematic') },
    { value: 'hiphop', label: t('Hiphop') },
    ...(project.bgm?.customName ? [{ value: 'custom' as BgmPreset, label: t('Kustom') }] : [])
  ];

  const bgmLevel = project.bgm?.level ?? 0.18;
  const duckRatio = project.bgm?.duckRatio ?? 0.15;

  const hasProjectAudio = Boolean(project.audioBlob);
  const hasNarration = scenes.some((s) => (s.narrationText || s.text || '').trim().length > 0);

  return (
    <>
          <div className="flex flex-col gap-5">
            {/* Vokal / Voiceover */}
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  {t('Penyedia Suara (TTS)')}
                </span>
                <div className="relative">
                  <select
                    value={currentVoiceProvider}
                    onChange={handleProviderChange}
                    className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                  >
                    {voiceProviders.map((vp) => (
                      <option key={vp.id} value={vp.id} className="bg-surface-1 text-on-surface">
                        {vp.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Karakter Suara Berdasarkan Provider */}
              {currentVoiceProvider === 'openai' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    {t('Karakter Suara OpenAI')}
                  </span>
                  <div className="relative">
                    <select
                      value={currentOpenAIVoice}
                      onChange={(e) =>
                        updateSettings({
                          voiceIds: { ...settings.voiceIds, openai: e.target.value }
                        })
                      }
                      className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                    >
                      {OPENAI_VOICE_OPTIONS.map((v) => (
                        <option key={v.id} value={v.id} className="bg-surface-1 text-on-surface">
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
              )}

              {currentVoiceProvider === 'elevenlabs' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    {t('Karakter Suara ElevenLabs')}
                  </span>
                  <div className="relative">
                    <select
                      value={isElevenLabsCustom ? 'custom' : currentElevenLabsVoice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          updateSettings({
                            voiceIds: {
                              ...settings.voiceIds,
                              elevenlabs: isElevenLabsCustom ? currentElevenLabsVoice : ''
                            }
                          });
                        } else {
                          updateSettings({
                            voiceIds: { ...settings.voiceIds, elevenlabs: val }
                          });
                        }
                      }}
                      className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                    >
                      {ELEVENLABS_VOICE_OPTIONS.map((v) => (
                        <option key={v.id} value={v.id} className="bg-surface-1 text-on-surface">
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>

                  {isElevenLabsCustom && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-muted font-medium">{t('Custom Voice ID')}</span>
                      <input
                        type="text"
                        placeholder={t('Masukkan Custom Voice ID ElevenLabs...')}
                        value={currentElevenLabsVoice === 'custom' ? '' : currentElevenLabsVoice}
                        onChange={(e) =>
                          updateSettings({
                            voiceIds: { ...settings.voiceIds, elevenlabs: e.target.value.trim() }
                          })
                        }
                        className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[12px] font-mono rounded-xl h-9 px-3 focus:outline-none transition-colors"
                      />
                    </div>
                  )}
                </div>
              )}

              {currentVoiceProvider === 'local' && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-text-muted uppercase tracking-wider">
                        {t('Karakter Suara Lokal (Offline)')}
                      </span>
                      <span className="font-mono text-[10px] text-accent">{t('Zero-API')}</span>
                    </div>
                    <div className="relative">
                      <select
                        value={currentLocalVoice}
                        onChange={(e) =>
                          updateSettings({
                            voiceIds: { ...settings.voiceIds, local: e.target.value }
                          })
                        }
                        className="w-full bg-surface-2 border border-border focus:border-accent text-on-surface text-[13px] font-medium rounded-xl h-10 px-3 pr-8 appearance-none cursor-pointer focus:outline-none transition-colors"
                      >
                        {LOCAL_VOICE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id} className="bg-surface-1 text-on-surface">
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-[18px] text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Status & Kontrol Unduh Model Piper */}
                  {currentLocalVoice !== 'fallback' && (
                    <div className="p-2.5 rounded-xl border transition-all text-[11px] flex flex-col gap-2 bg-surface-2/60 border-border">
                      {isLocalVoiceCached ? (
                        <div className="flex items-center justify-between text-emerald-400 font-medium">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>{t('Model siap offline')}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted">
                              {getLocalVoice(currentLocalVoice)?.sizeMb} MB
                            </span>
                            <button
                              type="button"
                              onClick={handlePurgeCurrentLocalVoice}
                              className="p-1 rounded hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors"
                              title={t('Hapus file model dari cache browser')}
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ) : isDownloadingLocalVoice ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono text-accent">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                              <span>{t('Mengunduh bobot ONNX...')}</span>
                            </span>
                            <span>{localVoiceDownloadProgress}%</span>
                          </div>
                          <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-accent h-full transition-all duration-200 rounded-full"
                              style={{ width: `${localVoiceDownloadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-1.5 text-text-muted leading-relaxed text-[11px]">
                            <span className="material-symbols-outlined text-[16px] text-accent shrink-0 mt-0.5">
                              download_for_offline
                            </span>
                            <span>
                              {t('Model ini (')}{getLocalVoice(currentLocalVoice)?.sizeMb} {t('MB) belum tersimpan di browser. Unduh sekali agar dapat bersuara tanpa internet.')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleDownloadCurrentLocalVoice}
                            className="w-full py-2 px-3 rounded-lg bg-accent text-on-accent text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[15px]">download</span>
                            <span>{t('Unduh Model (')}{getLocalVoice(currentLocalVoice)?.sizeMb} MB)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kustomisasi Akustik Piper ONNX */}
                  {currentLocalVoice !== 'fallback' && (
                    <div className="p-2.5 rounded-xl border border-border/80 bg-surface-2/40 flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                        {t('Kustomisasi Akustik Piper')}
                      </span>
                      <CommitSliderRow
                        size="sm"
                        label={t('Variasi Intonasi (Ekspresivitas)')}
                        value={settings.piperNoiseScale ?? 0.667}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        format={(v) => v.toFixed(2)}
                        onCommit={(v) => updateSettings({ piperNoiseScale: v })}
                      />
                      <CommitSliderRow
                        size="sm"
                        label={t('Variasi Ritme / Fonem')}
                        value={settings.piperNoiseW ?? 0.8}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        format={(v) => v.toFixed(2)}
                        onCommit={(v) => updateSettings({ piperNoiseW: v })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Slider Kecepatan Bicara (Speech Rate) */}
              <div className="flex flex-col gap-1.5 pt-0.5">
                <CommitSliderRow
                  label={t('Kecepatan Bicara')}
                  value={settings.speed ?? 1.05}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)}x`}
                  onCommit={(v) => updateSettings({ speed: v })}
                />
                {/* Preset Chips Kecepatan */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[0.8, 1.0, 1.25, 1.5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => updateSettings({ speed: spd })}
                      className={`flex-1 py-1 text-[10px] font-mono rounded-lg border transition-all ${
                        Math.abs((settings.speed ?? 1.05) - spd) < 0.03
                          ? 'bg-accent/15 border-accent text-accent font-bold'
                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Audisi & Generate Suara */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAuditionVoice}
                  disabled={currentVoiceProvider === 'timer'}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-surface-2 border border-border hover:bg-surface-3 text-on-surface font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                  title={currentVoiceProvider === 'timer' ? t('Mode tanpa suara tidak punya contoh suara') : t('Dengarkan contoh suara')}
                >
                  <span className="material-symbols-outlined text-[17px] text-accent">volume_up</span>
                  <span>{t('Coba Suara')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => generateAudio()}
                  disabled={isGeneratingAudio || !hasNarration}
                  title={!hasNarration ? t('Tulis naskah adegan terlebih dahulu') : undefined}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-accent text-on-accent font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
                >
                  {isGeneratingAudio ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      <span className="truncate">
                        {audioProgress?.currentScene
                          ? `(${audioProgress.currentScene}/${audioProgress.totalScenes})`
                          : t('Proses...')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
                      <span className="truncate">{t('Generate Suara')}</span>
                    </>
                  )}
                </button>
              </div>

              {isGeneratingAudio && (
                <button
                  type="button"
                  onClick={() => cancelAudioGeneration()}
                  className="w-full py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border text-rose-400 text-[12px] font-medium transition-colors"
                >
                  {t('Batalkan Pembuatan Suara')}
                </button>
              )}

              {/* Unggah File Audio / Voiceover Rekaman Sendiri */}
              <div className="pt-1">
                <input
                  ref={customAudioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadCustomAudio(file);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isGeneratingAudio}
                  onClick={() => customAudioInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-dashed border-border hover:border-accent/50 text-on-surface text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50"
                  title={t('Unggah rekaman voiceover atau musik MP3/WAV/M4A untuk disinkronkan otomatis ke adegan')}
                >
                  <span className="material-symbols-outlined text-[16px] text-accent">upload_file</span>
                  <span>{t('Unggah Audio / Voiceover Sendiri (MP3/WAV)')}</span>
                </button>
              </div>

              {/* Status audio proyek */}
              <div
                className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex flex-col gap-2 ${
                  !hasProjectAudio
                    ? 'bg-surface-2 border-border text-text-muted'
                    : audioStale
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-accent/10 border-accent/30 text-accent'
                }`}
                role="status"
              >
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0">
                    {!hasProjectAudio ? 'volume_off' : audioStale ? 'warning' : 'check_circle'}
                  </span>
                  <span className="flex-1">
                    {hasProjectAudio && bgmOnlyAudio
                      ? audioStale
                        ? t('Durasi adegan berubah. Tekan Generate Suara agar musik latar menyesuaikan.')
                        : t('Musik latar siap ({0} detik), tanpa narasi suara.', (project.audioDuration || 0).toFixed(1))
                      : currentVoiceProvider === 'timer' && !hasProjectAudio
                        ? t('Mode tanpa suara: hanya durasi adegan yang dihitung dari panjang naskah.')
                        : !hasProjectAudio
                          ? t('Suara belum dibuat.')
                          : audioStale
                            ? t('Naskah atau pengaturan berubah. Buat ulang suara agar sinkron.')
                            : t('Suara siap ({0} detik).', (project.audioDuration || 0).toFixed(1))}
                  </span>
                </div>

                {hasProjectAudio && (
                  <button
                    type="button"
                    onClick={() => deleteAudio()}
                    className="w-full py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
                    title={t('Hapus trek audio dari proyek')}
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    <span>{t('Hapus Suara Proyek')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Musik Latar (BGM) */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {t('Musik Latar')}
              </span>

              {/* Preset Musik */}
              <div
                className={`grid gap-1 p-1 rounded-xl bg-surface-2 border border-border ${
                  bgmPresets.length > 5 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-5'
                }`}
              >
                {bgmPresets.map((bp) => {
                  const isSelected = currentBgmPreset === bp.value;
                  return (
                    <button
                      key={bp.value}
                      type="button"
                      onClick={() => updateBgmPreset(bp.value)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {bp.label}
                    </button>
                  );
                })}
              </div>

              {/* Unggah musik sendiri */}
              <div className="flex flex-col gap-1.5">
                <input
                  ref={customBgmInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadCustomBgm(file);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isGeneratingAudio}
                  onClick={() => customBgmInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-dashed border-border hover:border-accent/50 text-on-surface text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] disabled:opacity-50"
                  title={t('Unggah musik latar sendiri (maks 25 MB). Musik diulang otomatis sampai video selesai.')}
                >
                  <span className="material-symbols-outlined text-[16px] text-accent">library_music</span>
                  <span>{project.bgm?.customName ? t('Ganti Musik Sendiri') : t('Unggah Musik Sendiri')}</span>
                </button>
                {project.bgm?.customName && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                    <span className="truncate" title={project.bgm.customName}>
                      {project.bgm.customName}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCustomBgm()}
                      className="shrink-0 text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      {t('Hapus')}
                    </button>
                  </div>
                )}
              </div>

              {/* Volume & ducking: the mix is rendered once, when the thumb is released */}
              <CommitSliderRow
                label={t('Volume')}
                value={bgmLevel}
                min={0}
                max={1}
                step={0.01}
                disabled={currentBgmPreset === 'none'}
                format={(v) => `${Math.round(v * 100)}%`}
                onCommit={(v) => updateBgmLevel(v)}
              />
              <CommitSliderRow
                label={t('Volume Musik Saat Ada Suara (Ducking)')}
                value={duckRatio}
                min={0}
                max={1}
                step={0.01}
                disabled={currentBgmPreset === 'none'}
                format={(v) => `${Math.round(v * 100)}%`}
                onCommit={(v) => updateBgmDuckRatio(v)}
              />
            </div>

            {/* Voice-over edit: trim, shift, fades and level, applied in the mix */}
            {hasRawVoice && (
              <div className="flex flex-col gap-3 pt-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{t('Edit Suara')}</span>
                  {voiceEditActive && (
                    <button
                      type="button"
                      onClick={() =>
                        updateVoiceEdit({ offset: undefined, trimStart: undefined, trimEnd: undefined, fadeIn: undefined, fadeOut: undefined, gain: undefined })
                      }
                      className="text-[10px] text-text-muted hover:text-rose-300"
                    >
                      {t('Reset')}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-text-faint leading-snug">
                  {t('Subtitel dan ketukan kata ikut bergeser bersama suara.')}
                </p>
                <CommitSliderRow
                  label={t('Geser suara')}
                  value={voiceEdit.offset ?? 0}
                  min={-2}
                  max={2}
                  step={0.05}
                  format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} dtk`}
                  onCommit={(v) => updateVoiceEdit({ offset: v })}
                />
                <CommitSliderRow
                  label={t('Potong awal')}
                  value={voiceEdit.trimStart ?? 0}
                  min={0}
                  max={3}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)} dtk`}
                  onCommit={(v) => updateVoiceEdit({ trimStart: v })}
                />
                <CommitSliderRow
                  label={t('Potong akhir')}
                  value={voiceEdit.trimEnd ?? 0}
                  min={0}
                  max={3}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)} dtk`}
                  onCommit={(v) => updateVoiceEdit({ trimEnd: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <CommitSliderRow
                    label={t('Fade masuk')}
                    value={voiceEdit.fadeIn ?? 0}
                    min={0}
                    max={2}
                    step={0.05}
                    size="sm"
                    format={(v) => `${v.toFixed(2)} dtk`}
                    onCommit={(v) => updateVoiceEdit({ fadeIn: v })}
                  />
                  <CommitSliderRow
                    label={t('Fade keluar')}
                    value={voiceEdit.fadeOut ?? 0}
                    min={0}
                    max={2}
                    step={0.05}
                    size="sm"
                    format={(v) => `${v.toFixed(2)} dtk`}
                    onCommit={(v) => updateVoiceEdit({ fadeOut: v })}
                  />
                </div>
                <CommitSliderRow
                  label={t('Volume suara')}
                  value={voiceEdit.gain ?? 1}
                  min={0}
                  max={2}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onCommit={(v) => updateVoiceEdit({ gain: v })}
                />
              </div>
            )}

            {/* Sound effects */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{t('Efek Suara (SFX)')}</span>
                <span className="text-[10px] font-mono text-text-muted">{(project.sfxCues || []).length} {t('cue')}</span>
              </div>
              <p className="text-[11px] text-text-faint leading-snug">
                {t('Whoosh di setiap potongan, pop dan hentakan di momen visual. Atur satu per satu di track SFX timeline.')}
              </p>
              <button
                type="button"
                disabled={scenes.length === 0}
                onClick={() => {
                  const n = autoPlaceSfx();
                  addToast(n > 0 ? t('{0} efek suara ditempatkan.', n) : t('Tidak ada titik baru untuk efek suara.'), 'info');
                }}
                className="w-full py-2 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
                {t('SFX otomatis')}
              </button>
              <CommitSliderRow
                label={t('Volume SFX')}
                value={project.sfxLevel ?? 0.8}
                min={0}
                max={1.5}
                step={0.05}
                disabled={(project.sfxCues || []).length === 0}
                format={(v) => `${Math.round(v * 100)}%`}
                onCommit={(v) => setSfxLevel(v)}
              />
            </div>
          </div>
    </>
  );
};
