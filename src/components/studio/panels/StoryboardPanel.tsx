import React from 'react';
import { useMooStore } from '../../../store/useMooStore';
import type { CameraMovement, MotionPreset, SceneTransition } from '../../../types';
import { cleanWord } from '../../../utils/textUtils';
import { GlobalVoiceSelector } from '../GlobalVoiceSelector';
import { resolveSkillIcon } from '../../../engine/skills/skillManager';

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
    updateSceneVisualIntent,
    updateSceneVisualConcept,
    updateSceneCamera,
    toggleSceneSubtitles,
    addScene,
    duplicateScene,
    removeScene,
    reorderScenes,
    activeSceneId,
    setActiveSceneId
  } = useMooStore();

  const presets: { id: MotionPreset; label: string; icon: string }[] = [
    { id: 'punch_zoom', label: 'Punch Zoom', icon: 'zoom_in' },
    { id: 'slide_split', label: 'Slide Split', icon: 'splitscreen' },
    { id: 'fade_float', label: 'Fade Float', icon: 'cloud' },
    { id: 'kinetic_shake', label: 'Shake', icon: 'vibration' }
  ];

  const transitions: { id: SceneTransition; label: string }[] = [
    { id: 'fade', label: 'Fade' },
    { id: 'slide', label: 'Slide' },
    { id: 'cut', label: 'Cut' }
  ];

  const cameraOptions: { id: CameraMovement; label: string }[] = [
    { id: 'steady_drift', label: 'Drift' },
    { id: 'push_in', label: 'Push In' },
    { id: 'pull_out', label: 'Pull Out' },
    { id: 'snap_zoom', label: 'Snap Zoom' },
    { id: 'whip_pan', label: 'Whip Pan' }
  ];

  const quickIdeas = [
    'WebCodecs Zero-Server Motion Graphics',
    'Why Rust Memory Safety Beats C++',
    'How Modern AI Agents Orchestrate Tools',
    'Deterministic Canvas Video Engine'
  ];

  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      {/* 1. Global Voice Selector Dropdown */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-zinc-400 font-semibold uppercase tracking-wider block">
          Global Voice & Narration
        </span>
        <GlobalVoiceSelector />
      </div>

      {/* 2. AI Motion Director Input */}
      <div className="p-3 rounded-lg bg-[#141417] border border-white/[0.08] space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-[#84cc16]">auto_awesome</span>
            AI Motion Director
          </span>
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/[0.06]">
            {(['id', 'en', 'auto'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => updateSettings({ outputLanguage: lang })}
                className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${
                  (settings.outputLanguage || 'id') === lang
                    ? 'bg-[#84cc16] text-black font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Tone pills */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {skills.map((skill) => {
            const isSelected = skill.id === activeSkillId;
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => setActiveSkillId(skill.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 transition-colors flex items-center gap-1 ${
                  isSelected
                    ? 'bg-[#84cc16]/15 border-[#84cc16] text-[#84cc16] font-bold'
                    : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {resolveSkillIcon(skill.icon)}
                </span>
                <span>{skill.name}</span>
              </button>
            );
          })}
        </div>

        <textarea
          className="w-full h-14 bg-black/50 text-zinc-100 placeholder-zinc-500 text-xs rounded-md p-2 border border-white/[0.08] focus:outline-none focus:border-[#84cc16]/60 resize-none leading-relaxed"
          placeholder="Enter concept, topic, or raw script for AI Motion Director..."
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
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] transition-colors"
            >
              + {idea}
            </button>
          ))}
        </div>

        {/* Action Button: Generate */}
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={isGeneratingScript || !scriptPrompt.trim()}
            onClick={generateScript}
            className="flex-1 h-8 rounded-md bg-[#84cc16] text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#a3e635] active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-[16px] ${isGeneratingScript ? 'animate-spin' : ''}`}>
              {isGeneratingScript ? 'sync' : 'auto_awesome'}
            </span>
            <span>{isGeneratingScript ? 'Generating Storyboard...' : 'Generate Motion Shots with AI'}</span>
          </button>

          {isGeneratingScript && (
            <button
              type="button"
              onClick={cancelGenerateScript}
              className="px-3 h-8 rounded-md bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/80 text-xs font-semibold"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* 3. Storyboard Scenes List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-[#84cc16]">movie</span>
            Scenes ({project.scenes.length})
          </span>

          <div className="flex items-center gap-1.5">
            {previousScenesSnapshot && previousScenesSnapshot.length > 0 && (
              <button
                type="button"
                onClick={undoGenerateScript}
                title="Undo AI generation"
                className="text-[10px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20"
              >
                <span className="material-symbols-outlined text-[12px]">undo</span>
                <span>Undo</span>
              </button>
            )}

            <button
              type="button"
              onClick={addScene}
              className="text-[10px] font-semibold text-[#84cc16] hover:text-lime-300 flex items-center gap-1 bg-[#84cc16]/10 hover:bg-[#84cc16]/20 border border-[#84cc16]/25 px-2 py-0.5 rounded transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">add</span>
              <span>Add Scene</span>
            </button>
          </div>
        </div>

        {/* High-Density Scene Cards Stack */}
        <div className="space-y-2">
          {project.scenes.map((scene, idx) => {
            const rawSceneText = (scene.narrationText || scene.text || '').trim();
            const words = rawSceneText.split(/\s+/).filter((w) => w.length > 0);
            const focusSet = new Set((scene.focusWords || []).map((w) => cleanWord(w)));
            const isCardActive = activeSceneId === scene.id;
            const currentCamera = scene.camera || 'steady_drift';
            const showSceneSubs = scene.showSubtitles ?? project.theme.showSubtitles ?? false;

            return (
              <div
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                className={`p-2.5 rounded-lg border space-y-2 transition-all ${
                  isCardActive
                    ? 'bg-[#18181c] border-[#84cc16]/50 shadow-sm'
                    : 'bg-[#141417] border-white/[0.07] hover:border-white/[0.12]'
                }`}
              >
                {/* Header Row: Index + Layout Selector + Camera + Captions Pill + Controls */}
                <div className="flex items-center justify-between gap-1.5 border-b border-white/[0.06] pb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Scene Index */}
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-[#84cc16] shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Visual Intent Indicator */}
                    <span className="text-[10px] font-mono text-zinc-300 font-semibold truncate max-w-[140px]" title={scene.visualIntent}>
                      {scene.visualIntent || `Scene #${idx + 1}`}
                    </span>

                    {/* Camera Movement Dropdown */}
                    <select
                      value={currentCamera}
                      onChange={(e) => updateSceneCamera(scene.id, e.target.value as CameraMovement)}
                      className="bg-[#0e0e11] text-zinc-300 border border-white/[0.08] rounded h-6 px-1.5 text-[10px] font-mono focus:outline-none focus:border-[#84cc16]/50 cursor-pointer shrink-0"
                      title="Camera Movement Transform"
                    >
                      {cameraOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          Cam: {c.label}
                        </option>
                      ))}
                    </select>

                    {/* Subtitle Toggle for this scene */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSceneSubtitles(scene.id);
                      }}
                      title="Toggle subtitle overlay for this scene"
                      className={`h-6 px-1.5 rounded text-[9px] font-mono border flex items-center gap-0.5 transition-colors shrink-0 ${
                        showSceneSubs
                          ? 'bg-[#84cc16]/15 text-[#84cc16] border-[#84cc16]/40 font-bold'
                          : 'bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[11px]">closed_caption</span>
                      <span>{showSceneSubs ? 'Sub: ON' : 'Sub: OFF'}</span>
                    </button>
                  </div>

                  {/* Actions: Duration + Move + Duplicate + Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono text-zinc-400 mr-0.5">
                      {scene.durationInSeconds.toFixed(1)}s
                    </span>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderScenes(idx, idx - 1);
                      }}
                      title="Move Up"
                      className="w-5 h-5 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-20"
                    >
                      <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                    </button>

                    <button
                      type="button"
                      disabled={idx === project.scenes.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderScenes(idx, idx + 1);
                      }}
                      title="Move Down"
                      className="w-5 h-5 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-20"
                    >
                      <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateScene(scene.id);
                      }}
                      title="Duplicate Scene"
                      className="w-5 h-5 rounded bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[11px]">content_copy</span>
                    </button>

                    {project.scenes.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeScene(scene.id);
                        }}
                        title="Delete Scene"
                        className="w-5 h-5 rounded bg-white/[0.03] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[12px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Voiceover / Narration Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Voiceover Narration (Spoken by TTS):</span>
                  </div>
                  <textarea
                    className="w-full bg-black/50 text-zinc-100 text-xs rounded p-1.5 border border-white/[0.08] focus:outline-none focus:border-[#84cc16]/60 resize-none leading-relaxed"
                    rows={2}
                    placeholder="Enter narration text for this shot..."
                    value={scene.narrationText || scene.text || ''}
                    onChange={(e) => updateSceneText(scene.id, e.target.value)}
                  />
                </div>

                {/* Visual Intent & Concept */}
                <div className="p-2 rounded bg-black/40 border border-white/[0.05] space-y-1.5">
                  <div>
                    <label className="text-[9px] text-zinc-400 block mb-0.5">Visual Intent (What is shown):</label>
                    <input
                      type="text"
                      value={scene.visualIntent || ''}
                      onChange={(e) => updateSceneVisualIntent(scene.id, e.target.value)}
                      placeholder="e.g. Airplane enters while airflow lines stream over the wing"
                      className="w-full bg-[#18181c] border border-white/[0.08] rounded h-6 px-1.5 text-xs text-white focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-400 block mb-0.5">Visual Concept (Metaphor / Details):</label>
                    <input
                      type="text"
                      value={scene.visualConcept || ''}
                      onChange={(e) => updateSceneVisualConcept(scene.id, e.target.value)}
                      placeholder="e.g. Technical HUD diagram with glowing vector arrows"
                      className="w-full bg-[#18181c] border border-white/[0.08] rounded h-6 px-1.5 text-xs text-white focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div className="p-2 rounded bg-black/40 border border-white/[0.05] space-y-1.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#84cc16]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">motion_mode</span>
                        <span>MOTION & EMPHASIS</span>
                      </span>
                    </div>

                    {/* Preset and transition pills */}
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div className="flex flex-wrap gap-1">
                        {presets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSceneMotionPreset(scene.id, p.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 ${
                              scene.motionPreset === p.id
                                ? 'bg-[#84cc16] text-black font-bold'
                                : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[10px]">{p.icon}</span>
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-0.5 bg-black/40 p-0.5 rounded border border-white/[0.04]">
                        {transitions.map((tr) => (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => setSceneTransition(scene.id, tr.id)}
                            className={`px-1 py-0.5 rounded text-[8px] font-mono ${
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

                    {/* Word chips for focus keyframe punch */}
                    <div className="space-y-0.5 pt-1">
                      <span className="text-[9px] font-mono text-zinc-400 block">
                        Tap words to punch focus badge (★):
                      </span>
                      <div className="flex flex-wrap gap-1">
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
                                  ? 'bg-[#84cc16] text-black font-bold shadow-sm'
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
