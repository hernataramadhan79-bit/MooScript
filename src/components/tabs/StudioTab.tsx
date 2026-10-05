import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useMooStore } from '../../store/useMooStore';
import { CanvasRenderer } from '../../engine/renderer/canvasRenderer';
import { BUILTIN_THEMES, resolveTheme } from '../../types';
import type { MotionNode, ThemeTokens } from '../../types';

export const StudioTab: React.FC = () => {
  const {
    project,
    currentFrame,
    seekTime,
    activeSceneId,
    setActiveSceneId,
    selectedNodeId,
    setSelectedNodeId,
    updateSceneNode,
    shufflePalette,
    setThemeTokens,
    updateThemeToken,
    startExport,
    audioStale,
    addToast
  } = useMooStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const [showColorModal, setShowColorModal] = useState(false);
  const [showOutdatedConfirm, setShowOutdatedConfirm] = useState(false);

  const fps = project.fps || 30;
  const totalDuration = project.audioDuration || 10;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  // Determine scene at current playback time
  const sceneAtPlaybackTime = useMemo(() => {
    const t = currentFrame / fps;
    let accumulated = 0;
    for (const s of project.scenes) {
      const dur = s.durationInSeconds > 0 ? s.durationInSeconds : 3;
      if (t >= accumulated && t < accumulated + dur) {
        return s;
      }
      accumulated += dur;
    }
    return project.scenes[project.scenes.length - 1] || null;
  }, [project.scenes, currentFrame, fps]);

  // Determine active scene
  const activeScene = useMemo(() => {
    if (activeSceneId) {
      const found = project.scenes.find((s) => s.id === activeSceneId);
      if (found) return found;
    }
    return sceneAtPlaybackTime || project.scenes[0] || null;
  }, [project.scenes, activeSceneId, sceneAtPlaybackTime]);

  const handleSceneSelect = (sceneId: string) => {
    setActiveSceneId(sceneId);
    let time = 0;
    for (const s of project.scenes) {
      if (s.id === sceneId) break;
      time += s.durationInSeconds > 0 ? s.durationInSeconds : 3;
    }
    seekTime(time);
  };

  // Active theme
  const activeTheme = useMemo(() => {
    return resolveTheme(project, activeScene || undefined);
  }, [project, activeScene]);

  // Recursively find selected node in active scene's node tree
  const selectedNode = useMemo((): MotionNode | null => {
    if (!selectedNodeId || !activeScene?.nodes) return null;
    const findInNodes = (nodes: MotionNode[]): MotionNode | null => {
      for (const n of nodes) {
        if (n.id === selectedNodeId) return n;
        if (n.children && n.children.length > 0) {
          const childMatch = findInNodes(n.children);
          if (childMatch) return childMatch;
        }
      }
      return null;
    };
    return findInNodes(activeScene.nodes);
  }, [selectedNodeId, activeScene?.nodes]);

  // Setup renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, []);

  // Render on frame / project change
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.draw(currentFrame, totalFrames, project);
    }
  }, [currentFrame, totalFrames, project]);

  // Hit-test click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = (project.width || 1080) / rect.width;
    const scaleY = (project.height || 1920) / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const hitId = renderer.hitTestNode(canvasX, canvasY);
    setSelectedNodeId(hitId);
  };

  const handleExportClick = () => {
    if (audioStale) {
      setShowOutdatedConfirm(true);
      return;
    }
    startExport().catch((err) => {
      addToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    });
  };

  const confirmExportAnyway = () => {
    setShowOutdatedConfirm(false);
    startExport().catch((err) => {
      addToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-white overflow-hidden select-none">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          {/* Preset Selector */}
          <select
            value={activeTheme.id}
            onChange={(e) => {
              const selected = BUILTIN_THEMES.find((t) => t.id === e.target.value);
              if (selected) {
                setThemeTokens(selected, activeScene?.id);
                addToast(`Theme set to ${selected.name}`, 'info', 2000);
              }
            }}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-200 focus:outline-none focus:border-lime-500 cursor-pointer"
          >
            {BUILTIN_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>

          {/* Shuffle Palette Button */}
          <button
            type="button"
            onClick={() => {
              shufflePalette(activeScene?.id);
              addToast('Palette shuffled!', 'info', 1500);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-all active:scale-95"
            title="Cycle to next color theme"
          >
            <span className="material-symbols-outlined text-[15px] text-lime-400">casino</span>
            <span>Shuffle Palette</span>
          </button>

          {/* Token Colors Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowColorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-medium transition-all active:scale-95"
            title="Edit Semantic Color Tokens"
          >
            <span className="material-symbols-outlined text-[15px] text-cyan-400">palette</span>
            <span>Tokens</span>
          </button>
        </div>

        {/* Scene Switcher & Export */}
        <div className="flex items-center gap-2">
          <select
            value={activeScene?.id || ''}
            onChange={(e) => handleSceneSelect(e.target.value)}
            className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-200 focus:outline-none focus:border-lime-500 cursor-pointer"
          >
            {project.scenes.map((s, idx) => (
              <option key={s.id} value={s.id}>
                Scene {idx + 1}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-lime-500 hover:bg-lime-400 text-black font-semibold rounded-lg text-xs transition-all active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>Export MP4</span>
          </button>
        </div>
      </div>

      {/* 2. Canvas Stage Workspace */}
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 bg-[#040406]">
        <div
          className="relative h-full max-h-[75vh] rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black flex items-center justify-center"
          style={{ aspectRatio: `${project.width || 1080} / ${project.height || 1920}` }}
        >
          <canvas
            ref={canvasRef}
            width={project.width || 1080}
            height={project.height || 1920}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Canvas Hit-Testing Hint */}
          {!selectedNode && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-zinc-400 font-mono">
              Click any element on canvas to inspect & edit
            </div>
          )}
        </div>

        {/* 3. Floating In-Place Property Bar for Selected Node */}
        {selectedNode && activeScene && (
          <div className="absolute bottom-6 inset-x-6 max-w-xl mx-auto z-40 bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lime-400 text-[18px]">
                  {selectedNode.type === 'text'
                    ? 'title'
                    : selectedNode.type === 'badge'
                    ? 'verified'
                    : selectedNode.type === 'metric'
                    ? 'monitoring'
                    : selectedNode.type === 'code'
                    ? 'terminal'
                    : 'dashboard'}
                </span>
                <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Node: {selectedNode.type} (#{selectedNode.id.slice(0, 6)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="w-6 h-6 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Content Text Edit */}
            {selectedNode.content !== undefined && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Content Text</label>
                <input
                  type="text"
                  value={selectedNode.content}
                  onChange={(e) =>
                    updateSceneNode(activeScene.id, selectedNode.id, {
                      content: e.target.value
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-lime-500"
                />
              </div>
            )}

            {/* Transform Sliders (Position X/Y & Font Size) */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Pos X</span>
                  <span className="font-mono text-zinc-300">
                    {Math.round(selectedNode.transform.x)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={selectedNode.transform.x}
                  onChange={(e) =>
                    updateSceneNode(activeScene.id, selectedNode.id, {
                      transform: {
                        ...selectedNode.transform,
                        x: parseFloat(e.target.value)
                      }
                    })
                  }
                  className="w-full accent-lime-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Pos Y</span>
                  <span className="font-mono text-zinc-300">
                    {Math.round(selectedNode.transform.y)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={selectedNode.transform.y}
                  onChange={(e) =>
                    updateSceneNode(activeScene.id, selectedNode.id, {
                      transform: {
                        ...selectedNode.transform,
                        y: parseFloat(e.target.value)
                      }
                    })
                  }
                  className="w-full accent-lime-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Font Size</span>
                  <span className="font-mono text-zinc-300">
                    {selectedNode.style.fontSize || 32}px
                  </span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="140"
                  step="2"
                  value={selectedNode.style.fontSize || 32}
                  onChange={(e) =>
                    updateSceneNode(activeScene.id, selectedNode.id, {
                      style: {
                        ...selectedNode.style,
                        fontSize: parseInt(e.target.value, 10)
                      }
                    })
                  }
                  className="w-full accent-lime-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
                />
              </div>
            </div>

            {/* Animation Preset & Color Token */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-400">Enter Animation</label>
                <select
                  value={selectedNode.animation?.enter?.type || 'spring_pop'}
                  onChange={(e) =>
                    updateSceneNode(activeScene.id, selectedNode.id, {
                      animation: {
                        ...selectedNode.animation,
                        enter: {
                          type: e.target.value as 'spring_pop' | 'wipe_up' | 'blur_in' | 'typewriter',
                          startAtSecond: selectedNode.animation?.enter?.startAtSecond || 0,
                          duration: selectedNode.animation?.enter?.duration || 0.6
                        }
                      }
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-lime-500"
                >
                  <option value="spring_pop">Spring Pop</option>
                  <option value="wipe_up">Wipe Up</option>
                  <option value="blur_in">Blur In</option>
                  <option value="typewriter">Typewriter</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[11px] font-medium text-zinc-400">
                  <span>Color / Token</span>
                  {selectedNode.style.customFill && (
                    <span className="text-[10px] font-mono text-lime-400">Custom Hex</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedNode.style.customFill ? 'custom' : (selectedNode.style.fillToken || 'text')}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        updateSceneNode(activeScene.id, selectedNode.id, {
                          style: {
                            ...selectedNode.style,
                            customFill: selectedNode.style.customFill || activeTheme.primary
                          }
                        });
                      } else {
                        updateSceneNode(activeScene.id, selectedNode.id, {
                          style: {
                            ...selectedNode.style,
                            fillToken: e.target.value as any,
                            customFill: undefined
                          }
                        });
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-lime-500"
                  >
                    <option value="primary">Primary ({activeTheme.primary})</option>
                    <option value="accent">Accent ({activeTheme.accent})</option>
                    <option value="surface">Surface ({activeTheme.surface})</option>
                    <option value="text">Text ({activeTheme.text})</option>
                    <option value="muted">Muted ({activeTheme.muted})</option>
                    <option value="custom">Custom Hex...</option>
                  </select>

                  <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg shrink-0">
                    <input
                      type="color"
                      value={
                        selectedNode.style.customFill ||
                        (selectedNode.style.fillToken ? (activeTheme as any)[selectedNode.style.fillToken] : activeTheme.text) ||
                        '#ffffff'
                      }
                      onChange={(e) => {
                        updateSceneNode(activeScene.id, selectedNode.id, {
                          style: {
                            ...selectedNode.style,
                            customFill: e.target.value,
                            fillToken: undefined
                          }
                        });
                      }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                      title="Custom Hex Color Picker"
                    />
                    <input
                      type="text"
                      value={selectedNode.style.customFill || ''}
                      placeholder="#hex"
                      onChange={(e) => {
                        updateSceneNode(activeScene.id, selectedNode.id, {
                          style: {
                            ...selectedNode.style,
                            customFill: e.target.value,
                            fillToken: undefined
                          }
                        });
                      }}
                      className="w-16 px-1 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-lime-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Token Color Picker Modal */}
      {showColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-lime-400 text-[18px]">palette</span>
                Theme Token Editor ({activeTheme.name})
              </h3>
              <button
                type="button"
                onClick={() => setShowColorModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {(
                [
                  ['bg', 'Background'],
                  ['surface', 'Surface'],
                  ['primary', 'Primary'],
                  ['accent', 'Accent'],
                  ['text', 'Text'],
                  ['muted', 'Muted']
                ] as const
              ).map(([tokenKey, label]) => (
                <div key={tokenKey} className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-zinc-400">{label} Token</span>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl">
                    <input
                      type="color"
                      value={activeTheme[tokenKey as keyof ThemeTokens] || '#ffffff'}
                      onChange={(e) =>
                        updateThemeToken(tokenKey as keyof ThemeTokens, e.target.value, activeScene?.id)
                      }
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs font-mono text-zinc-200">
                      {activeTheme[tokenKey as keyof ThemeTokens]}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowColorModal(false)}
                className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-black text-xs font-semibold rounded-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Audio Outdated Guard Modal */}
      {showOutdatedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-zinc-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-amber-400">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h4 className="text-sm font-bold">Audio Outdated</h4>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Audio is outdated because the script was edited. Would you like to proceed with export anyway?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOutdatedConfirm(false)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExportAnyway}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg"
              >
                Export Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
