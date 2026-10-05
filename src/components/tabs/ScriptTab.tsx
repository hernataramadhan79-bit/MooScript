import React from 'react';
import { useMooStore } from '../../store/useMooStore';

export const ScriptTab: React.FC = () => {
  const { project, updateSceneText, isGeneratingScript, generateScript, scriptPrompt, setScriptPrompt, addToast } =
    useMooStore();

  return (
    <div className="flex flex-col gap-4 p-4 text-white">
      <h2 className="text-lg font-bold">Script & Storyboard</h2>

      <div className="flex flex-col gap-2">
        <textarea
          value={scriptPrompt}
          onChange={(e) => setScriptPrompt(e.target.value)}
          placeholder="Describe your video idea..."
          rows={3}
          className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
        />
        <button
          type="button"
          disabled={isGeneratingScript}
          onClick={() => generateScript().catch((e) => addToast(String(e), 'error'))}
          className="px-4 py-2 bg-lime-500 text-black font-semibold rounded-lg text-sm disabled:opacity-50"
        >
          {isGeneratingScript ? 'Generating...' : 'Generate Storyboard'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {project.scenes.map((s, idx) => (
          <div key={s.id} className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-lime-400">Scene {idx + 1}</span>
            <input
              type="text"
              value={s.text}
              onChange={(e) => updateSceneText(s.id, e.target.value)}
              className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
