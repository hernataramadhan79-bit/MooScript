import type { StateCreator } from 'zustand';
import type { MooStoreState, PlaybackSlice } from '../types';
import { getProjectDuration } from '../../utils/projectDuration';

let playbackAudioElement: HTMLAudioElement | null = null;
let playbackRafId: number | null = null;
let playbackStartTime = 0;
let playbackStartFrame = 0;
let isAudioMasterActive = false;

function cancelPlaybackRaf() {
  if (playbackRafId !== null) {
    cancelAnimationFrame(playbackRafId);
    playbackRafId = null;
  }
}

export function stopPlaybackAudio(): void {
  cancelPlaybackRaf();
  isAudioMasterActive = false;
  if (playbackAudioElement) {
    try {
      playbackAudioElement.pause();
      playbackAudioElement.currentTime = 0;
      playbackAudioElement.src = '';
    } catch (err) {
      console.warn('Error resetting playbackAudioElement:', err);
    }
    playbackAudioElement = null;
  }
}

/** The loop range in frames, clamped to the film; null when there is no usable range. */
function loopFrames(
  range: { start: number; end: number } | null,
  fps: number,
  maxFrames: number
): { start: number; end: number } | null {
  if (!range) return null;
  const start = Math.max(0, Math.min(maxFrames, Math.round(range.start * fps)));
  const end = Math.max(0, Math.min(maxFrames, Math.round(range.end * fps)));
  return end - start >= 1 ? { start, end } : null;
}

export const createPlaybackSlice: StateCreator<MooStoreState, [], [], PlaybackSlice> = (set, get) => ({
  currentFrame: 0,
  isPlaying: false,
  isLooping: false,
  loopRange: null,

  toggleLoop: () => {
    set((state) => ({ isLooping: !state.isLooping }));
  },

  setLoopPoint: (edge, timeSec) => {
    const total = getProjectDuration(get().project);
    const t = Math.max(0, Math.min(total, timeSec));
    const prev = get().loopRange || { start: 0, end: total };
    let next = edge === 'start' ? { start: t, end: prev.end } : { start: prev.start, end: t };
    // Setting one edge past the other starts a fresh range from that point to the film's end/start.
    if (next.end <= next.start) next = edge === 'start' ? { start: t, end: total } : { start: 0, end: t };
    set({ loopRange: next.end - next.start >= 0.1 ? next : null, isLooping: true });
  },

  clearLoopRange: () => set({ loopRange: null }),

  seekFrame: (currentFrame) => {
    const fps = get().project.fps || 30;
    const totalDuration = getProjectDuration(get().project);
    const maxFrames = Math.max(1, Math.round(totalDuration * fps));
    const clamped = Math.max(0, Math.min(currentFrame, maxFrames));

    if (clamped !== get().currentFrame) {
      set({ currentFrame: clamped });
    }

    if (playbackAudioElement) {
      try {
        playbackAudioElement.currentTime = clamped / fps;
      } catch (err) {
        console.warn('Could not set audio currentTime on seek:', err);
      }
    }

    // Re-sync start reference when scrubbing during playback or pause
    playbackStartTime = performance.now();
    playbackStartFrame = clamped;
  },

  seekTime: (timeSec) => {
    const fps = get().project.fps || 30;
    get().seekFrame(Math.round(timeSec * fps));
  },

  play: () => {
    // Idempotent: cancel existing loop before creating a new one
    cancelPlaybackRaf();

    const state = get();
    const fps = state.project.fps || 30;
    const totalDuration = getProjectDuration(state.project);
    // Nothing to play in an empty project.
    if (totalDuration <= 0) return;
    const maxFrames = Math.max(1, Math.round(totalDuration * fps));

    let startFrame = state.currentFrame;
    // Looping over a range always plays inside it.
    const range = state.isLooping ? loopFrames(state.loopRange, fps, maxFrames) : null;
    if (range && (startFrame < range.start || startFrame >= range.end)) {
      startFrame = range.start;
      set({ currentFrame: startFrame });
    }
    // If playback reached the end, restart from frame 0
    if (startFrame >= maxFrames) {
      startFrame = 0;
      set({ currentFrame: 0 });
      if (playbackAudioElement) {
        playbackAudioElement.currentTime = 0;
      }
    }

    playbackStartTime = performance.now();
    playbackStartFrame = startFrame;
    isAudioMasterActive = false;

    set({ isPlaying: true });

    // Sync audio if available
    let blobUrl = state.audioBlobUrl;
    if (!blobUrl && state.project.audioBlob) {
      try {
        blobUrl = URL.createObjectURL(state.project.audioBlob);
        set({ audioBlobUrl: blobUrl });
      } catch {
        // ignore
      }
    }
    if (blobUrl) {
      if (!playbackAudioElement) {
        playbackAudioElement = new Audio(blobUrl);
      } else if (playbackAudioElement.src !== blobUrl) {
        playbackAudioElement.src = blobUrl;
      }

      try {
        playbackAudioElement.currentTime = startFrame / fps;
      } catch (err) {
        console.warn('Could not set audio currentTime on play:', err);
      }

      const playPromise = playbackAudioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Activate audio master clock only if playback is still active
            if (get().isPlaying) {
              isAudioMasterActive = true;
            }
          })
          .catch((e) => {
            // Autoplay policy or error: gracefully fallback to performance.now() without crashing
            console.warn('Audio play restricted or failed, falling back to performance.now clock:', e);
            isAudioMasterActive = false;
          });
      }
    } else if (playbackAudioElement) {
      playbackAudioElement.pause();
    }

    const tick = () => {
      if (!get().isPlaying) {
        cancelPlaybackRaf();
        return;
      }

      const currentFps = get().project.fps || 30;
      const currentTotalDuration = getProjectDuration(get().project);
      const currentMaxFrames = Math.max(1, Math.round(currentTotalDuration * currentFps));

      // A voice-over shorter than the scenes ends early: keep the picture running on the clock.
      if (isAudioMasterActive && playbackAudioElement?.ended) {
        isAudioMasterActive = false;
        playbackStartTime = performance.now();
        playbackStartFrame = get().currentFrame;
      }

      let targetFrame: number;
      if (isAudioMasterActive && playbackAudioElement && !playbackAudioElement.paused && !playbackAudioElement.ended) {
        // Master clock: audio currentTime
        targetFrame = Math.floor(playbackAudioElement.currentTime * currentFps);
      } else {
        // Fallback clock: absolute performance.now()
        const elapsedSec = (performance.now() - playbackStartTime) / 1000;
        targetFrame = playbackStartFrame + Math.floor(elapsedSec * currentFps);
      }

      // Check if finished (or past the end of the loop range)
      const loopRange = get().isLooping ? loopFrames(get().loopRange, currentFps, currentMaxFrames) : null;
      const endFrame = loopRange ? loopRange.end : currentMaxFrames;
      if (targetFrame >= endFrame) {
        if (get().isLooping) {
          const restart = loopRange ? loopRange.start : 0;
          playbackStartTime = performance.now();
          playbackStartFrame = restart;
          set({ currentFrame: restart });
          if (playbackAudioElement) {
            try {
              playbackAudioElement.currentTime = restart / currentFps;
              playbackAudioElement.play().catch(() => {});
            } catch (err) {
              console.warn('Loop audio rewind failed:', err);
            }
          }
          playbackRafId = requestAnimationFrame(tick);
          return;
        }

        cancelPlaybackRaf();
        isAudioMasterActive = false;
        set({ currentFrame: 0, isPlaying: false });
        if (playbackAudioElement) {
          playbackAudioElement.pause();
          playbackAudioElement.currentTime = 0;
        }
        return;
      }

      // Avoid unnecessary setState if frame hasn't changed
      if (targetFrame !== get().currentFrame) {
        set({ currentFrame: targetFrame });
      }

      playbackRafId = requestAnimationFrame(tick);
    };

    playbackRafId = requestAnimationFrame(tick);
  },

  pause: () => {
    cancelPlaybackRaf();
    isAudioMasterActive = false;
    set({ isPlaying: false });
    if (playbackAudioElement) {
      playbackAudioElement.pause();
    }
  },

  togglePlay: () => {
    if (get().isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  }
});
