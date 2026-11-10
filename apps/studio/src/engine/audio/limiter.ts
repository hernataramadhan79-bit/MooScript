/**
 * Peak limiter for the final mix. Voice, music and sound effects are summed without headroom, so a
 * loud voice over a hit can pass full scale and clip in the exported file. Where the mix would pass
 * the ceiling the gain dips just enough to hold it there: it eases down ahead of the peak (attack) and
 * recovers after it (release), so the correction is not heard as a click. Everything below the
 * ceiling is left untouched.
 */
export interface LimiterOptions {
  /** Highest sample value allowed, 0-1. Default 0.97 (about -0.3 dBFS). */
  ceiling?: number;
  attackSec?: number;
  releaseSec?: number;
}

/** Limits the channels in place (all channels share one gain, so the stereo image holds). Returns the largest reduction applied, 1 = none. */
export function limitPeaks(channels: Float32Array[], sampleRate: number, options: LimiterOptions = {}): number {
  const ceiling = Math.max(0.05, Math.min(1, options.ceiling ?? 0.97));
  const length = channels.reduce((n, c) => Math.max(n, c.length), 0);
  if (length === 0) return 1;

  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) {
      const v = data[i] < 0 ? -data[i] : data[i];
      if (v > peak) peak = v;
    }
  }
  if (!(peak > ceiling)) return 1;

  // Gain each sample needs on its own.
  const gain = new Float32Array(length).fill(1);
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) {
      const v = data[i] < 0 ? -data[i] : data[i];
      if (v > ceiling) {
        const g = ceiling / v;
        if (g < gain[i]) gain[i] = g;
      }
    }
  }
  // Release: after a dip the gain climbs back at a fixed rate. Attack: the same, running backwards,
  // so the dip starts before the peak arrives. Both passes only ever lower the gain.
  const releaseStep = 1 / Math.max(1, (options.releaseSec ?? 0.12) * sampleRate);
  const attackStep = 1 / Math.max(1, (options.attackSec ?? 0.004) * sampleRate);
  for (let i = 1; i < length; i++) {
    const allowed = gain[i - 1] + releaseStep;
    if (gain[i] > allowed) gain[i] = allowed;
  }
  let lowest = gain[length - 1];
  for (let i = length - 2; i >= 0; i--) {
    const allowed = gain[i + 1] + attackStep;
    if (gain[i] > allowed) gain[i] = allowed;
    if (gain[i] < lowest) lowest = gain[i];
  }
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) data[i] *= gain[i];
  }
  return lowest;
}

/** Limits an AudioBuffer in place. */
export function limitAudioBuffer(buffer: AudioBuffer, options?: LimiterOptions): number {
  if (!buffer || typeof buffer.getChannelData !== 'function') return 1;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
  return limitPeaks(channels, buffer.sampleRate, options);
}
