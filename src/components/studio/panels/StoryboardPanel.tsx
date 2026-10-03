import React from 'react';
import { useMooStore } from '../../../store/useMooStore';
import type { MotionPreset, SceneTransition } from '../../../types';
import { cleanWord } from '../../../utils/textUtils';

export const StoryboardPanel: React.FC = () => {
  const {
    project,
    settings,
    updateSettings,
    skills,
    activeSkillId,
    setActiveSkillId,
    scriptPrompt,
    setScriptPrompt,
    isGeneratingScript,
    generateScript,
    cancelGenerateScript,
    previousScenesSnapshot,
    undoGenerateScript,
    updateSceneText,
    toggleWordFocus,
    setSceneMotionPreset,
    setSceneTransition,
    setSceneIcon,
    addScene,
    duplicateScene,
    removeScene,
    reorderScenes,
    updateTitle,
    activeSceneId,
    setActiveSceneId
  } = useMooStore();

  const presets: { id: MotionPreset; label: string; icon: string }[] = [
    { id: 'punch_zoom', label: 'Punch Zoom', icon: 'zoom_in' },
    { id: 'slide_split', label: 'Slide Split', icon: 'splitscreen' },
    { id: 'fade_float', label: 'Fade Float', icon: 'cloud' },
    { id: 'kinetic_shake', label: 'Kinetic Shake', icon: 'vibration' }
  ];

  const transitions: { id: SceneTransition; label: string }[] = [
    { id: 'fade', label: 'Fade' },
    { id: 'slide', label: 'Slide' },
    { id: 'cut', label: 'Cut' }
  ];

  const icons = ['mascot', 'zap', 'brain', 'sparkles', 'flame', 'code'];

  const quickIdeas = [
    'WebCodecs Zero-Server Motion Graphics',
    'Why Rust Memory Safety Beats C++',
    'How Modern AI Agents Orchestrate Tools',
    'Deterministic Canvas Video Engine'
  ];

  return (
    <div className="flex flex-col gap-2.5 sm:gap-4 p-2.5 sm:p-4 text-xs">
      {/* 1. Project Title & Scene Count Header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/[0.03] border border-white/[0.08] focus-within:border-primary/50 transition-colors">
        <span className="material-symbols-outlined text-[15px] sm:text-[17px] text-primary shrink-0">edit_note</span>
        <input
          type="text"
          value={project.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Untitled Motion Project..."
          className="bg-transparent font-bold text-zinc-100 flex-1 focus:outline-none placeholder-zinc-500 text-xs sm:text-sm"
        />
        <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/[0.04] shrink-0">
          {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'}
        </span>
      </div>

      {/* 2. Persona Skill Tone Pills */}
      <div className="space-y-1 sm:space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">psychology</span>
            Director Tone
          </span>
          <span className="text-[9px] text-zinc-500 font-mono hidden sm:inline">Persona Skill</span>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-3 no-scrollbar">
          {skills.map((skill) => {
            const isSelected = skill.id === activeSkillId;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => setActiveSkillId(skill.id)}
                className={`px-2.5 py-1 sm:p-2 rounded-lg sm:rounded-xl border shrink-0 text-left flex flex-col gap-0.5 transition-all active:scale-[0.98] ${
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
                  {skill.name}
                </span>
                <span className="hidden sm:block text-[9px] text-zinc-400 line-clamp-1 leading-snug">
                  {skill.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. AI Concept & Script Input */}
      <div className="p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2 sm:space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] sm:text-[14px] text-primary">auto_awesome</span>
            AI Script Director
          </span>
          <span className="text-[9px] font-mono text-zinc-500 hidden sm:inline">Structured Storyboard</span>
        </div>

        <textarea
          className="w-full h-14 sm:h-20 bg-black/50 text-zinc-100 placeholder-zinc-500 text-xs rounded-lg p-2 border border-white/[0.08] focus:outline-none focus:border-primary/60 resize-none leading-relaxed transition-colors"
          placeholder="Tulis ide pokok, naskah mentah, atau topik video yang ingin dibuat..."
          value={scriptPrompt}
          onChange={(e) => setScriptPrompt(e.target.value)}
        />

        {/* Quick idea chips */}
        <div className="flex flex-wrap gap-1">
          {quickIdeas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setScriptPrompt(idea)}
              className="text-[8px] sm:text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] transition-colors border border-white/[0.06]"
            >
              + {idea}
            </button>
          ))}
        </div>

        {/* Output Language Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
          <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400">Bahasa Output:</span>
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md sm:rounded-lg border border-white/[0.06]">
            {(['id', 'en', 'auto'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => updateSettings({ outputLanguage: lang })}
                className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono rounded transition-colors ${
                  (settings.outputLanguage || 'id') === lang
                    ? 'bg-primary text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {lang === 'id' ? '🇮🇩 ID' : lang === 'en' ? '🇬🇧 EN' : '🌐 Auto'}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Generate & Cancel */}
        <div className="flex gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={isGeneratingScript || !scriptPrompt.trim()}
            onClick={generateScript}
            className="flex-1 h-8 sm:h-9 rounded-lg sm:rounded-xl bg-primary text-black font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-lime-300 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(158,233,57,0.2)] disabled:opacity-40"
          >
            <span
              className={`material-symbols-outlined text-[15px] sm:text-[17px] ${
                isGeneratingScript ? 'animate-spin' : ''
              }`}
            >
              {isGeneratingScript ? 'progress_activity' : 'auto_awesome'}
            </span>
            <span>{isGeneratingScript ? 'Directing...' : 'Generate Scenes with AI'}</span>
          </button>

          {isGeneratingScript && (
            <button
              type="button"
              onClick={cancelGenerateScript}
              className="px-2.5 sm:px-3 h-8 sm:h-9 rounded-lg sm:rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/80 text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">cancel</span>
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Storyboard Scenes List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">movie</span>
            Story Scenes ({project.scenes.length})
          </span>

          <div className="flex items-center gap-2">
            {previousScenesSnapshot && previousScenesSnapshot.length > 0 && (
              <button
                type="button"
                onClick={undoGenerateScript}
                title="Kembalikan scene sebelum generasi terakhir"
                className="text-[10px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[13px]">undo</span>
                <span>Undo</span>
              </button>
            )}

            <button
              type="button"
              onClick={addScene}
              className="text-[10px] font-semibold text-primary hover:text-lime-300 flex items-center gap-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-0.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add Scene</span>
            </button>
          </div>
        </div>

        {/* Scene Cards Stack */}
        <div className="space-y-2 sm:space-y-2.5">
          {project.scenes.map((scene, idx) => {
            const words = scene.text
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0);
            const focusSet = new Set((scene.focusWords || []).map((w) => cleanWord(w)));
            const isCardActive = activeSceneId === scene.id;

            return (
              <div
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl border space-y-1.5 sm:space-y-2 transition-all ${
                  isCardActive
                    ? 'bg-white/[0.04] border-primary/60 shadow-[0_0_15px_rgba(158,233,57,0.1)]'
                    : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.12]'
                }`}
              >
                {/* Scene Controls & Actions Bar */}
                <div className="flex items-center justify-between gap-1 border-b border-white/[0.06] pb-1.5">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {/* Scene Tag */}
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-primary">
                      #{idx + 1}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400">
                      {scene.durationInSeconds.toFixed(1)}s
                    </span>

                    {/* Icon Picker */}
                    <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-md border border-white/[0.06]">
                      {icons.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setSceneIcon(scene.id, ic)}
                          title={`Icon: ${ic}`}
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center text-[9px] sm:text-[10px] transition-colors ${
                            scene.icon === ic
                              ? 'bg-primary text-black font-bold'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {ic === 'mascot'
                            ? '🐮'
                            : ic === 'zap'
                              ? '⚡'
                              : ic === 'brain'
                                ? '🧠'
                                : ic === 'sparkles'
                                  ? '✨'
                                  : ic === 'flame'
                                    ? '🔥'
                                    : '💻'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Move Up/Down, Duplicate, Delete Action Buttons */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderScenes(idx, idx - 1);
                      }}
                      title="Move Scene Up"
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[12px] sm:text-[14px]">arrow_upward</span>
                    </button>

                    <button
                      type="button"
                      disabled={idx === project.scenes.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderScenes(idx, idx + 1);
                      }}
                      title="Move Scene Down"
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[12px] sm:text-[14px]">arrow_downward</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateScene(scene.id);
                      }}
                      title="Duplicate Scene"
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-[11px] sm:text-[13px]">content_copy</span>
                    </button>

                    {project.scenes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeScene(scene.id);
                        }}
                        title="Delete Scene"
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-white/[0.03] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[12px] sm:text-[14px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Motion Preset & Transition Visual Pills */}
                <div className="flex flex-wrap items-center justify-between gap-1">
                  {/* Motion Preset Pills */}
                  <div className="flex flex-wrap gap-1">
                    {presets.map((p) => {
                      const isPresetActive = scene.motionPreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSceneMotionPreset(scene.id, p.id)}
                          className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono flex items-center gap-0.5 sm:gap-1 transition-all ${
                            isPresetActive
                              ? 'bg-primary text-black font-bold shadow-sm shadow-primary/20'
                              : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[10px] sm:text-[11px]">{p.icon}</span>
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Transition Pills */}
                  <div className="flex gap-0.5 bg-black/40 p-0.5 rounded border border-white/[0.04]">
                    {transitions.map((tr) => (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => setSceneTransition(scene.id, tr.id)}
                        className={`px-1 py-0.5 rounded text-[8px] font-mono transition-colors ${
                          (scene.transition ?? 'fade') === tr.id
                            ? 'bg-white/20 text-white font-bold'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editable Scene Script Textarea */}
                <textarea
                  className="w-full bg-black/50 text-zinc-100 text-xs rounded-lg p-1.5 sm:p-2 border border-white/[0.08] focus:outline-none focus:border-primary/60 resize-none leading-relaxed transition-colors"
                  rows={2}
                  value={scene.text}
                  onChange={(e) => updateSceneText(scene.id, e.target.value)}
                />

                {/* Interactive Kinetic Word Chips */}
                <div className="space-y-0.5 sm:space-y-1">
                  <span className="text-[8px] sm:text-[9px] font-mono text-zinc-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px] text-primary">touch_app</span>
                    Ketuk kata untuk toggle Kinetic Highlight (★ Keyframe):
                  </span>

                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {words.map((w, wIdx) => {
                      const clean = cleanWord(w);
                      const isFocus = focusSet.has(clean);

                      return (
                        <button
                          key={`${w}-${wIdx}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWordFocus(scene.id, w);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all flex items-center gap-0.5 active:scale-90 ${
                            isFocus
                              ? 'bg-primary text-black font-bold shadow-sm shadow-primary/20 scale-105'
                              : 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300'
                          }`}
                        >
                          {isFocus && <span className="text-[8px]">★</span>}
                          <span>{w}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
