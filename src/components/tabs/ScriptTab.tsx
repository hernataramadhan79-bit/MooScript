import React from 'react';
import { useMooStore } from '../../store/useMooStore';
import type { MotionPreset, SceneTransition } from '../../types';
import { cleanWord } from '../../utils/textUtils';

export const ScriptTab: React.FC = () => {
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
    removeScene,
    setActiveTab,
    updateTitle
  } = useMooStore();

  const presets: { id: MotionPreset; label: string }[] = [
    { id: 'punch_zoom', label: 'Punch Zoom' },
    { id: 'slide_split', label: 'Slide Split' },
    { id: 'fade_float', label: 'Fade Float' },
    { id: 'kinetic_shake', label: 'Kinetic Shake' }
  ];

  const icons = ['mascot', 'zap', 'brain', 'sparkles', 'flame', 'code'];

  const quickIdeas = [
    'WebCodecs Zero-Server Video Generation',
    'Why Rust Memory Safety Beats C++',
    'How Modern AI Agents Orchestrate Tools',
    'Deterministic Canvas Motion Graphics'
  ];

  return (
    <div className="flex flex-col gap-5 px-4 pt-3 pb-8 max-w-xl mx-auto w-full">
      {/* Project Title Bar */}
      <section className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-zinc-800 shadow-sm focus-within:border-primary/50 transition-colors">
        <span className="material-symbols-outlined text-[18px] text-primary shrink-0">edit_note</span>
        <input
          type="text"
          value={project.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Project Title..."
          className="bg-transparent text-xs font-bold text-white flex-1 focus:outline-none placeholder-zinc-500"
        />
        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
          {project.scenes.length} {project.scenes.length === 1 ? 'scene' : 'scenes'}
        </span>
      </section>

      {/* Content Style / Persona Skill Selector */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">psychology</span>
            Persona Skill
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Selects prompt tone</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {skills.map((skill) => {
            const isSelected = skill.id === activeSkillId;
            return (
              <button
                key={skill.id}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  isSelected
                    ? 'bg-zinc-800/90 border-primary shadow-sm shadow-primary/10'
                    : 'bg-[#18181b] border-zinc-800 hover:border-zinc-700'
                }`}
                onClick={() => setActiveSkillId(skill.id)}
                type="button"
              >
                <span className={`text-[12px] font-bold truncate ${isSelected ? 'text-primary' : 'text-zinc-200'}`}>
                  {skill.name}
                </span>
                <span className="text-[10px] text-zinc-400 line-clamp-1 leading-snug">{skill.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* AI Concept & Script Input */}
      <section className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">edit_note</span>
            Topic or Raw Script
          </span>
          <span className="text-[10px] font-mono text-zinc-500">Structured Output</span>
        </div>

        <textarea
          className="w-full h-24 bg-[#111113] text-zinc-100 placeholder-zinc-500 text-xs rounded-lg p-3 border border-zinc-800 focus:outline-none focus:border-primary resize-none leading-relaxed"
          placeholder="Enter an idea, script, or bullet points..."
          value={scriptPrompt}
          onChange={(e) => setScriptPrompt(e.target.value)}
        />

        {/* Quick prompt suggestions */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {quickIdeas.map((idea) => (
            <button
              key={idea}
              className="text-[10px] font-mono px-2 py-1 rounded bg-[#201f22] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors border border-zinc-800"
              onClick={() => setScriptPrompt(idea)}
              type="button"
            >
              + {idea}
            </button>
          ))}
        </div>

        {/* Output Language Selector */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-mono text-zinc-400">Output Language:</span>
          <div className="flex items-center gap-1 bg-[#111113] p-0.5 rounded-lg border border-zinc-800">
            {(['id', 'en', 'auto'] as const).map((lang) => (
              <button
                key={lang}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  (settings.outputLanguage || 'id') === lang
                    ? 'bg-primary text-black font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                onClick={() => updateSettings({ outputLanguage: lang })}
                type="button"
              >
                {lang === 'id' ? '🇮🇩 ID' : lang === 'en' ? '🇬🇧 EN' : '🌐 Auto'}
              </button>
            ))}
          </div>
        </div>

        {/* Generate / Cancel Actions */}
        <div className="flex gap-2">
          <button
            className="flex-1 h-10 rounded-lg bg-primary text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-lime-300 active:scale-[0.99] transition-all shadow-md shadow-primary/10 disabled:opacity-50"
            disabled={isGeneratingScript || !scriptPrompt.trim()}
            onClick={generateScript}
            type="button"
          >
            <span className={`material-symbols-outlined text-[18px] ${isGeneratingScript ? 'animate-spin' : ''}`}>
              {isGeneratingScript ? 'progress_activity' : 'auto_awesome'}
            </span>
            <span>{isGeneratingScript ? 'Directing Storyboard...' : 'Generate Scenes with AI'}</span>
          </button>
          {isGeneratingScript && (
            <button
              className="px-3 h-10 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/80 text-xs font-semibold flex items-center gap-1 transition-all"
              onClick={cancelGenerateScript}
              title="Cancel Generation"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              <span>Cancel</span>
            </button>
          )}
        </div>
      </section>

      {/* Storyboard Scenes List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">movie</span>
            Scenes ({project.scenes.length})
          </span>
          <div className="flex items-center gap-2">
            {previousScenesSnapshot && previousScenesSnapshot.length > 0 && (
              <button
                className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60 transition-colors"
                onClick={undoGenerateScript}
                title="Revert to scenes before last generation"
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">undo</span>
                <span>Undo Generate</span>
              </button>
            )}
            <button
              className="text-[11px] font-medium text-primary hover:text-lime-300 flex items-center gap-1"
              onClick={addScene}
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              Add Scene
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {project.scenes.map((scene, idx) => {
            const words = scene.text
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0);
            const focusSet = new Set((scene.focusWords || []).map((w) => cleanWord(w)));

            return (
              <div
                key={scene.id}
                className="p-3.5 rounded-xl bg-[#18181b] border border-zinc-800 space-y-3 shadow-sm hover:border-zinc-700 transition-colors"
              >
                {/* Scene Controls Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">{scene.durationInSeconds.toFixed(1)}s</span>

                    {/* Icon selector */}
                    <div className="flex items-center gap-1 bg-[#111113] p-1 rounded-lg border border-zinc-800 shrink-0">
                      {icons.map((ic) => (
                        <button
                          key={ic}
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] transition-colors ${
                            scene.icon === ic ? 'bg-primary text-black font-bold' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                          onClick={() => setSceneIcon(scene.id, ic)}
                          title={`Icon: ${ic}`}
                          type="button"
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Motion Preset dropdown */}
                    <select
                      className="h-7 bg-[#111113] text-zinc-300 border border-zinc-800 text-[11px] rounded-lg px-2 focus:outline-none focus:border-zinc-700"
                      value={scene.motionPreset}
                      onChange={(e) => setSceneMotionPreset(scene.id, e.target.value as MotionPreset)}
                      title="Motion Preset"
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    {/* Scene Transition dropdown */}
                    <select
                      className="h-7 bg-[#111113] text-zinc-300 border border-zinc-800 text-[11px] rounded-lg px-2 focus:outline-none focus:border-zinc-700"
                      value={scene.transition ?? 'fade'}
                      onChange={(e) => setSceneTransition(scene.id, e.target.value as SceneTransition)}
                      title="Scene Transition"
                    >
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="cut">Cut</option>
                    </select>

                    {project.scenes.length > 1 && (
                      <button
                        className="w-7 h-7 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 flex items-center justify-center transition-colors"
                        onClick={() => removeScene(scene.id)}
                        title="Delete Scene"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Editable Scene Script Text */}
                <textarea
                  className="w-full bg-[#111113] text-zinc-200 text-xs rounded-lg p-2.5 border border-zinc-800/90 focus:outline-none focus:border-primary resize-none leading-relaxed"
                  rows={2}
                  value={scene.text}
                  onChange={(e) => updateSceneText(scene.id, e.target.value)}
                />

                {/* Interactive Kinetic Word Chips */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-primary">touch_app</span>
                      Click words to toggle visual highlight (★ Keyframe):
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {words.map((w, wIdx) => {
                      const clean = cleanWord(w);
                      const isFocus = focusSet.has(clean);

                      return (
                        <button
                          key={`${w}-${wIdx}`}
                          className={`px-2 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1 ${
                            isFocus
                              ? 'bg-primary text-black font-bold shadow-sm shadow-primary/20 scale-105'
                              : 'bg-[#27272a] hover:bg-zinc-700 text-zinc-300'
                          }`}
                          onClick={() => toggleWordFocus(scene.id, w)}
                          type="button"
                        >
                          {isFocus && <span>★</span>}
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
      </section>

      {/* Continue Action */}
      <div className="pt-2">
        <button
          className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
          onClick={() => setActiveTab('voice')}
          type="button"
        >
          <span>Continue to Voice & Alignment</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
