import { useEffect } from 'react';
import { useMooStore } from '../store/useMooStore';
import { getProjectDuration } from './projectDuration';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable ||
    Boolean(target.closest('[role="slider"], [role="dialog"], dialog, .cm-editor'))
  );
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing into input, textarea, slider, or inside an active modal dialog
      if (isEditableTarget(e.target)) return;

      const {
        isPlaying,
        play,
        pause,
        togglePlay,
        seekFrame,
        currentFrame,
        project,
        activeSceneId,
        setActiveSceneId,
        focusScene,
        duplicateScene,
        removeScene,
        addToast,
        undo,
        redo
      } = useMooStore.getState();
      const fps = project.fps || 30;
      const scenes = project.scenes;
      const totalDuration = getProjectDuration(project);
      const totalFrames = Math.max(1, Math.round(totalDuration * fps));

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

      if (e.key === '?') {
        e.preventDefault();
        useMooStore.getState().setShortcutsOpen(true);
        return;
      }

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

        // Loop range in / out at the playhead, X clears it
        case 'KeyI':
          e.preventDefault();
          useMooStore.getState().setLoopPoint('start', currentFrame / fps);
          break;
        case 'KeyO':
          e.preventDefault();
          useMooStore.getState().setLoopPoint('end', currentFrame / fps);
          break;
        case 'KeyX':
          if (useMooStore.getState().loopRange) {
            e.preventDefault();
            useMooStore.getState().clearLoopRange();
          }
          break;

        // Split the shot under the playhead
        case 'KeyS': {
          const t = currentFrame / fps;
          let acc = 0;
          const target = scenes.find((s) => {
            const end = acc + (s.durationInSeconds > 0 ? s.durationInSeconds : 3);
            const hit = t >= acc && t < end;
            acc = end;
            return hit;
          });
          if (target) {
            e.preventDefault();
            useMooStore.getState().splitSceneAt(target.id, t);
          }
          break;
        }

        // Marker at the playhead
        case 'KeyM':
          if (totalDuration > 0) {
            e.preventDefault();
            useMooStore.getState().addMarker(currentFrame / fps);
            addToast(`Marker ditambahkan di ${(currentFrame / fps).toFixed(1)} dtk.`, 'info', 2000);
          }
          break;

        // Jump to start / end
        case 'Home':
          e.preventDefault();
          seekFrame(0);
          break;
        case 'End':
          e.preventDefault();
          seekFrame(totalFrames);
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
          focusScene(scenes[prevIdx].id);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (scenes.length === 0) return;
          const curIdx = scenes.findIndex((s) => s.id === activeSceneId);
          const nextIdx = curIdx >= 0 && curIdx < scenes.length - 1 ? curIdx + 1 : 0;
          focusScene(scenes[nextIdx].id);
          break;
        }

        // Delete active scene (only if more than 1 scene exists)
        case 'Delete':
        case 'Backspace': {
          if (activeSceneId && scenes.length > 1) {
            e.preventDefault();
            const idx = scenes.findIndex((s) => s.id === activeSceneId);
            removeScene(activeSceneId);
            const remaining = useMooStore.getState().project.scenes;
            const next = remaining[Math.min(Math.max(0, idx), remaining.length - 1)];
            if (next) focusScene(next.id);
            addToast(`Adegan #${idx + 1} dihapus. Tekan Ctrl+Z untuk mengembalikan.`, 'info');
          }
          break;
        }

        // Escape: drop the layer selection first, then the scene selection. Theater mode closes
        // itself on Escape and keeps both.
        case 'Escape': {
          const { previewMode, selectedLayerId, setSelectedLayerId } = useMooStore.getState();
          if (previewMode === 'theater') break;
          if (selectedLayerId) {
            setSelectedLayerId(null);
          } else {
            setActiveSceneId(null);
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
