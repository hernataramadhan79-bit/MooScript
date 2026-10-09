import type { StateCreator } from 'zustand';
import type { MooStoreState, PlaybackSlice } from '../types';

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

export const createPlaybackSlice: StateCreator<MooStoreState, [], [], PlaybackSlice> = (set, get) => ({
  currentFrame: 0,
  isPlaying: false,
  isLooping: false,

  toggleLoop: () => {
    set((state) => ({ isLooping: !state.isLooping }));
  },

  seekFrame: (currentFrame) => {
    const fps = get().project.fps || 30;
    const totalDuration = get().project.audioDuration || 10;
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
    const totalDuration = state.project.audioDuration || 10;
    const maxFrames = Math.max(1, Math.round(totalDuration * fps));

    let startFrame = state.currentFrame;
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
    const blobUrl = state.audioBlobUrl;
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
      const currentTotalDuration = get().project.audioDuration || 10;
      const currentMaxFrames = Math.max(1, Math.round(currentTotalDuration * currentFps));

      let targetFrame: number;
      if (isAudioMasterActive && playbackAudioElement && !playbackAudioElement.paused && !playbackAudioElement.ended) {
        // Master clock: audio currentTime
        targetFrame = Math.floor(playbackAudioElement.currentTime * currentFps);
      } else {
        // Fallback clock: absolute performance.now()
        const elapsedSec = (performance.now() - playbackStartTime) / 1000;
        targetFrame = playbackStartFrame + Math.floor(elapsedSec * currentFps);
      }

      // Check if finished
      if (targetFrame >= currentMaxFrames || (isAudioMasterActive && playbackAudioElement?.ended)) {
        if (get().isLooping) {
          playbackStartTime = performance.now();
          playbackStartFrame = 0;
          set({ currentFrame: 0 });
          if (playbackAudioElement) {
            try {
              playbackAudioElement.currentTime = 0;
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
