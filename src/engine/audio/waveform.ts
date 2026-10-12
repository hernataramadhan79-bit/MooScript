/**
 * Extract normalized amplitude peaks (0.0 to 1.0) from an audio Blob.
 * Uses Web Audio API AudioContext with fallback for headless/SSR environments.
 */
export async function extractWaveformPeaks(blob: Blob, count = 64): Promise<number[]> {
  if (typeof window === 'undefined' || typeof blob.arrayBuffer !== 'function') {
    return [];
  }
  const webkitAudio = 'webkitAudioContext' in window ? (window.webkitAudioContext as typeof AudioContext) : undefined;
  const AudioCtx = window.AudioContext || webkitAudio;
  if (!AudioCtx) {
    return [];
  }
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    const step = Math.max(1, Math.floor(channelData.length / count));
    const peaks: number[] = [];

    for (let i = 0; i < count; i++) {
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      let max = 0;
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(Math.min(1, Math.max(0, max)));
    }

    await ctx.close().catch(() => {});
    return peaks;
  } catch (err) {
    console.warn('extractWaveformPeaks error:', err);
    return [];
  }
}
