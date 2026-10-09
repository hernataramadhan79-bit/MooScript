import React, { useState, useMemo } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { downloadSubtitleFile } from '../../engine/export/subtitleExporter';
import type {
  ThemeTokens,
  CaptionPosition,
  CaptionStyle,
  BgmPreset
} from '../../types';

export interface InspectorRackProps {
  className?: string;
  defaultTab?: 'gaya' | 'suara' | 'ekspor';
  activeTab?: 'gaya' | 'suara' | 'ekspor';
  onTabChange?: (tab: 'gaya' | 'suara' | 'ekspor') => void;
}

interface ThemePresetItem {
  id: string;
  name: string;
  previewColors: { bg: string; primary: string; accent: string };
  tokens: ThemeTokens;
}

const THEME_PRESETS: ThemePresetItem[] = [
  {
    id: 'dark-minimal',
    name: 'Dark Minimal',
    previewColors: { bg: '#09090b', primary: '#f4f4f5', accent: '#a1a1aa' },
    tokens: {
      id: 'dark-minimal',
      name: 'Dark Minimal',
      bg: '#09090b',
      surface: '#18181b',
      primary: '#f4f4f5',
      accent: '#ffffff',
      text: '#fafafa',
      muted: '#71717a'
    }
  },
  {
    id: 'lime-cyber',
    name: 'Lime Cyber',
    previewColors: { bg: '#0d0d0e', primary: '#84cc16', accent: '#a3e635' },
    tokens: {
      id: 'lime-cyber',
      name: 'Lime Cyber',
      bg: '#0d0d0e',
      surface: '#18181b',
      primary: '#84cc16',
      accent: '#a3e635',
      text: '#f4f4f5',
      muted: '#71717a'
    }
  },
  {
    id: 'mono-swiss',
    name: 'Mono Swiss',
    previewColors: { bg: '#000000', primary: '#ffffff', accent: '#e4e4e7' },
    tokens: {
      id: 'mono-swiss',
      name: 'Mono Swiss',
      bg: '#000000',
      surface: '#121212',
      primary: '#ffffff',
      accent: '#e4e4e7',
      text: '#ffffff',
      muted: '#a1a1aa'
    }
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    previewColors: { bg: '#1c1017', primary: '#f43f5e', accent: '#fb923c' },
    tokens: {
      id: 'warm-editorial',
      name: 'Warm Editorial',
      bg: '#1c1017',
      surface: '#2c1824',
      primary: '#f43f5e',
      accent: '#fb923c',
      text: '#fff1f2',
      muted: '#fda4af'
    }
  }
];

function safeFileName(title?: string): string {
  if (!title) return 'mooscript';
  const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return cleaned || 'mooscript';
}

function triggerFileDownload(url: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (typeof document !== 'undefined' && document.body && document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 100);
}

export const InspectorRack: React.FC<InspectorRackProps> = ({
  className = '',
  defaultTab = 'gaya',
  activeTab: controlledTab,
  onTabChange
}) => {
  const [internalTab, setInternalTab] = useState<'gaya' | 'suara' | 'ekspor'>(defaultTab);
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = (tab: 'gaya' | 'suara' | 'ekspor') => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const {
    project,
    settings,
    updateThemeFont,
    updateThemeCaptionPosition,
    updateThemeCaptionStyle,
    setThemeTokens,
    updateSettings,
    isGeneratingAudio,
    generateAudio,
    audioProgress,
    updateBgmPreset,
    updateBgmLevel,
    updateBgmDuckRatio,
    updateResolution,
    isExporting,
    exportProgress,
    exportResult,
    startExport,
    addToast
  } = useMooStore();

  // Active theme detection
  const isThemeActive = (theme: ThemePresetItem) => {
    const currentId = project.themeTokens?.id;
    const currentName = project.themeTokens?.name?.toLowerCase();
    if (currentId === theme.id) return true;
    if (currentName === theme.name.toLowerCase()) return true;
    if (theme.id === 'lime-cyber' && currentId === 'brutalist-lime') return true;
    if (theme.id === 'warm-editorial' && currentId === 'sunset-editorial') return true;
    if (theme.id === 'dark-minimal' && currentId === 'minimal-monochrome') return true;
    return false;
  };

  // Font options mapping
  const currentFont = project.theme?.fontFamily || 'Jakarta';
  const fontOptions: { value: 'Jakarta' | 'Mono' | 'Impact'; label: string }[] = [
    { value: 'Jakarta', label: 'Plus Jakarta' },
    { value: 'Mono', label: 'JetBrains Mono' },
    { value: 'Impact', label: 'Syne Bold' }
  ];

  // Text position options
  const currentPosition = project.theme?.captionPosition || 'center';
  const positionOptions: { value: CaptionPosition; label: string }[] = [
    { value: 'top', label: 'Atas' },
    { value: 'center', label: 'Tengah' },
    { value: 'bottom', label: 'Bawah' }
  ];

  // Text style options
  const currentStyle = project.theme?.captionStyle || 'boxed';
  const styleOptions: { value: CaptionStyle; label: string }[] = [
    { value: 'karaoke', label: 'Highlight Kata' },
    { value: 'boxed', label: 'Kotak' },
    { value: 'minimal', label: 'Bersih' }
  ];

  // Voice provider mapping
  const currentVoiceProvider = useMemo(() => {
    const p = settings.selectedTTSProvider;
    if (p === 'openai') return 'openai';
    if (p === 'elevenlabs') return 'elevenlabs';
    if (p === 'local') return 'local';
    return 'gemini';
  }, [settings.selectedTTSProvider]);

  const voiceProviders = [
    { id: 'gemini', label: 'Gemini Flash' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'elevenlabs', label: 'ElevenLabs' },
    { id: 'local', label: 'Offline Lokal' }
  ];

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'gemini') {
      updateSettings({ selectedTTSProvider: 'fallback' });
    } else if (val === 'openai') {
      updateSettings({ selectedTTSProvider: 'openai' });
    } else if (val === 'elevenlabs') {
      updateSettings({ selectedTTSProvider: 'elevenlabs' });
    } else if (val === 'local') {
      updateSettings({ selectedTTSProvider: 'local' });
    }
  };

  // BGM Presets
  const currentBgmPreset = project.bgm?.preset || 'none';
  const bgmPresets: { value: BgmPreset; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'ambient', label: 'Ambient' },
    { value: 'lofi', label: 'Lofi' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'hiphop', label: 'Hiphop' }
  ];

  const bgmLevel = project.bgm?.level ?? 0.18;
  const duckRatio = project.bgm?.duckRatio ?? 0.15;

  // Resolution
  const currentResolution: '1080p' | '720p' =
    project.resolution ||
    (project.width === 1080 || project.height === 1080 ? '1080p' : '720p');

  // MP4 Export trigger
  const handleExportMp4 = async () => {
    if (isExporting) return;
    if (exportResult?.objectUrl) {
      triggerFileDownload(exportResult.objectUrl, `${safeFileName(project.title)}.mp4`);
      addToast('Mengunduh video MP4...', 'success');
      return;
    }
    await startExport();
    const result = useMooStore.getState().exportResult;
    if (result?.objectUrl) {
      triggerFileDownload(result.objectUrl, `${safeFileName(project.title)}.mp4`);
      addToast('Video MP4 berhasil diunduh.', 'success');
    }
  };

  return (
    <div
      className={`w-full flex flex-col bg-surface-1 border border-border rounded-2xl overflow-hidden select-none ${className}`}
    >
      {/* 1. Header Tab Bersih */}
      <div className="p-2 border-b border-border bg-surface-1/90 backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('gaya')}
            className={`py-2 px-3 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 ${
              activeTab === 'gaya'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">palette</span>
            <span>Gaya</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suara')}
            className={`py-2 px-3 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 ${
              activeTab === 'suara'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">graphic_eq</span>
            <span>Suara</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ekspor')}
            className={`py-2 px-3 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 ${
              activeTab === 'ekspor'
                ? 'bg-surface-3 text-accent shadow-sm'
                : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Ekspor</span>
          </button>
        </div>
      </div>

      {/* 2. Isi Panel Tab */}
      <div className="p-4 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-220px)]">
        {/* ================= TAB GAYA ================= */}
        {activeTab === 'gaya' && (
          <div className="flex flex-col gap-5">
            {/* Tema Visual */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Tema
              </span>
              <div className="grid grid-cols-2 gap-2">
                {THEME_PRESETS.map((t) => {
                  const isActive = isThemeActive(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeTokens(t.tokens)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                        isActive
                          ? 'bg-surface-3 border-accent text-on-surface ring-1 ring-accent/30 shadow-sm'
                          : 'bg-surface-2 border-border text-text-muted hover:text-on-surface hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: t.previewColors.bg }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: t.previewColors.primary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm"
                          style={{ backgroundColor: t.previewColors.accent }}
                        />
                      </div>
                      <span className="text-[12px] font-medium truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipografi */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Tipografi
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
                {fontOptions.map((f) => {
                  const isSelected = currentFont === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => updateThemeFont(f.value)}
                      className={`py-2 px-1 rounded-lg text-[12px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Posisi Teks */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Posisi Teks
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
                {positionOptions.map((p) => {
                  const isSelected = currentPosition === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateThemeCaptionPosition(p.value)}
                      className={`py-2 px-1 rounded-lg text-[12px] font-medium text-center transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gaya Teks */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Gaya Teks
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-2 border border-border">
                {styleOptions.map((s) => {
                  const isSelected = currentStyle === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => updateThemeCaptionStyle(s.value)}
                      className={`py-2 px-1 rounded-lg text-[12px] font-medium text-center truncate transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-surface-3 text-accent font-semibold shadow-sm'
                          : 'text-text-muted hover:text-on-surface hover:bg-surface-2'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB SUARA ================= */}
        {activeTab === 'suara' && (
          <div className="flex flex-col gap-5">
            {/* Vokal / Voiceover */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Vokal
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

              <button
                type="button"
                onClick={() => generateAudio()}
                disabled={isGeneratingAudio}
                className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
              >
                {isGeneratingAudio ? (
                  <>
                    <span className="material-symbols-outlined text-[17px] animate-spin">
                      progress_activity
                    </span>
                    <span>
                      {audioProgress?.currentScene
                        ? `Memproses (${audioProgress.currentScene}/${audioProgress.totalScenes})`
                        : 'Menghasilkan Suara...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">record_voice_over</span>
                    <span>Generate Suara</span>
                  </>
                )}
              </button>
            </div>

            {/* Musik Latar (BGM) */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Musik Latar
              </span>

              {/* Preset Musik */}
              <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-surface-2 border border-border">
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

              {/* Slider Volume */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted font-medium">Volume</span>
                  <span className="font-mono text-on-surface font-semibold">
                    {Math.round(bgmLevel * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bgmLevel}
                  onChange={(e) => updateBgmLevel(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>

              {/* Slider Ducking */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted font-medium">Sensitivitas Ducking</span>
                  <span className="font-mono text-on-surface font-semibold">
                    {Math.round(duckRatio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={duckRatio}
                  onChange={(e) => updateBgmDuckRatio(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB EKSPOR ================= */}
        {activeTab === 'ekspor' && (
          <div className="flex flex-col gap-5">
            {/* Resolusi */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Resolusi
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateResolution('1080p')}
                  className={`py-2.5 px-3 rounded-xl border text-[12px] font-semibold text-center transition-all active:scale-95 ${
                    currentResolution === '1080p'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent/30 shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                  }`}
                >
                  1080p (Full HD)
                </button>
                <button
                  type="button"
                  onClick={() => updateResolution('720p')}
                  className={`py-2.5 px-3 rounded-xl border text-[12px] font-semibold text-center transition-all active:scale-95 ${
                    currentResolution === '720p'
                      ? 'bg-surface-3 border-accent text-accent ring-1 ring-accent/30 shadow-sm'
                      : 'bg-surface-2 border-border text-text-muted hover:text-on-surface'
                  }`}
                >
                  720p (HD)
                </button>
              </div>
            </div>

            {/* Tombol Utama Download Video MP4 */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleExportMp4}
                disabled={isExporting}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-accent text-on-accent font-semibold text-[13px] flex items-center justify-center gap-2 transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isExporting ? 'sync' : 'download'}
                </span>
                <span>{isExporting ? 'Mengekspor Video...' : 'Download Video MP4'}</span>
              </button>

              {/* Progress Bar Ekspor Elegan */}
              {isExporting && exportProgress && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-2 border border-border">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-muted truncate">
                      {exportProgress.statusText || 'Sedang memproses...'}
                    </span>
                    <span className="font-mono text-accent font-bold">
                      {exportProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-150 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, exportProgress.percent))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Subtitle */}
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Subtitle
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadSubtitleFile(project, 'srt');
                    addToast('Mengunduh subtitle (.srt)...', 'success');
                  }}
                  className="py-2.5 px-2.5 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[11px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">
                    subtitles
                  </span>
                  <span className="truncate">Unduh Subtitle (.srt)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadSubtitleFile(project, 'vtt');
                    addToast('Mengunduh subtitle (.vtt)...', 'success');
                  }}
                  className="py-2.5 px-2.5 rounded-xl bg-surface-2 border border-border hover:border-border-strong hover:bg-surface-3 text-on-surface text-[11px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">
                    subtitles
                  </span>
                  <span className="truncate">Unduh Subtitle (.vtt)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
