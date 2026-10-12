import { describe, it, expect } from 'vitest';
import { extractWaveformPeaks } from '../src/engine/audio/waveform';
import { useMooStore } from '../src/store/useMooStore';

describe('Audio Waveform Peak Extraction & Store', () => {
  it('safely handles non-audio blobs or environments without AudioContext', async () => {
    const dummyBlob = new Blob(['not real audio'], { type: 'text/plain' });
    const peaks = await extractWaveformPeaks(dummyBlob, 32);
    // In node/test environment, AudioContext is undefined, returns [] safely
    expect(Array.isArray(peaks)).toBe(true);
  });

  it('stores and updates waveform peaks in audioSlice', () => {
    const store = useMooStore.getState();
    expect(store.waveformPeaks).toBeNull();

    const mockPeaks = [0.1, 0.5, 0.9, 0.3, 0.7];
    store.setWaveformPeaks(mockPeaks);

    expect(useMooStore.getState().waveformPeaks).toEqual(mockPeaks);

    store.setWaveformPeaks(null);
    expect(useMooStore.getState().waveformPeaks).toBeNull();
  });
});
