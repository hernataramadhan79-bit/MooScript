import { useEffect } from 'react';
import { useMooStore } from '../store/useMooStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable ||
    Boolean(target.closest('[role="slider"], [role="dialog"], .cm-editor'))
  );
}

export function useKeyboardShortcuts(): void {
  const isPlaying = useMooStore((s) => s.isPlaying);
  const play = useMooStore((s) => s.play);
  const pause = useMooStore((s) => s.pause);
  const togglePlay = useMooStore((s) => s.togglePlay);
  const seekFrame = useMooStore((s) => s.seekFrame);
  const currentFrame = useMooStore((s) => s.currentFrame);
  const project = useMooStore((s) => s.project);
  const fps = project.fps || 30;
  const scenes = project.scenes;
  const totalDuration =
    project.audioDuration ||
    scenes.reduce((acc, sc) => acc + (sc.durationInSeconds || 3), 0);
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  const activeSceneId = useMooStore((s) => s.activeSceneId);
  const setActiveSceneId = useMooStore((s) => s.setActiveSceneId);
  const duplicateScene = useMooStore((s) => s.duplicateScene);
  const removeScene = useMooStore((s) => s.removeScene);
  const undo = useMooStore((s) => s.undo);
  const redo = useMooStore((s) => s.redo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing into input, textarea, slider, or inside an active modal dialog
      if (isEditableTarget(e.target)) return;

      const hasMetaOrCtrl = e.ctrlKey || e.metaKey;

      // Undo: Ctrl+Z / Cmd+Z (without shift)
      if (hasMetaOrCtrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        (hasMetaOrCtrl && (e.key === 'y' || e.key === 'Y')) ||
        (hasMetaOrCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // 1. Ctrl/Cmd + D: Duplikasi scene aktif
      if (hasMetaOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const targetId = activeSceneId || scenes[0]?.id;
        if (targetId) {
          duplicateScene(targetId);
        }
        return;
      }

      // Ignore any other shortcut if Ctrl/Alt/Meta is held (e.g. browser reloads, inspector)
      if (hasMetaOrCtrl || e.altKey) return;

      switch (e.code) {
        // Play / Pause
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;

        // J / K / L Shuttle Controls (NLE standard)
        case 'KeyJ':
          // Mundur 1 detik
          e.preventDefault();
          seekFrame(Math.max(0, currentFrame - fps));
          break;
        case 'KeyK':
          // Jeda seketika
          e.preventDefault();
          if (isPlaying) pause();
          break;
        case 'KeyL':
          // Maju 1 detik (atau play jika sedang pause)
          e.preventDefault();
          if (!isPlaying) {
            seekFrame(Math.min(totalFrames, currentFrame + fps));
          } else {
            play();
          }
          break;

        // Step 1 Frame Left / Right
        case 'ArrowLeft':
          e.preventDefault();
          seekFrame(Math.max(0, currentFrame - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekFrame(Math.min(totalFrames, currentFrame + 1));
          break;
        // Navigate between scenes (Arrow Up / Down)
        case 'ArrowUp': {
          e.preventDefault();
          if (scenes.length === 0) return;
          const curIdx = scenes.findIndex((s) => s.id === activeSceneId);
          const prevIdx = curIdx > 0 ? curIdx - 1 : scenes.length - 1;
          setActiveSceneId(scenes[prevIdx].id);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (scenes.length === 0) return;
          const curIdx = scenes.findIndex((s) => s.id === activeSceneId);
          const nextIdx = curIdx >= 0 && curIdx < scenes.length - 1 ? curIdx + 1 : 0;
          setActiveSceneId(scenes[nextIdx].id);
          break;
        }

        // Delete active scene (only if more than 1 scene exists)
        case 'Delete':
        case 'Backspace': {
          if (activeSceneId && scenes.length > 1) {
            e.preventDefault();
            removeScene(activeSceneId);
            const remaining = scenes.filter((s) => s.id !== activeSceneId);
            setActiveSceneId(remaining[0]?.id || null);
          }
          break;
        }

        // Escape: deselect scene
        case 'Escape':
          setActiveSceneId(null);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    play,
    pause,
    togglePlay,
    seekFrame,
    currentFrame,
    totalFrames,
    fps,
    scenes,
    activeSceneId,
    setActiveSceneId,
    duplicateScene,
    removeScene,
    undo,
    redo
  ]);
}
