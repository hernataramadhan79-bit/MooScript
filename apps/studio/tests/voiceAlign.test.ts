import { describe, it, expect } from 'vitest';
import { alignScenesToTranscript, transcribeWords, WHISPER_MAX_BYTES } from '../src/engine/ai/voiceAlign';
import type { WordTimestamp } from '../src/types';

/** One transcript word every 0.5s: "w0" at 0.0, "w1" at 0.5, ... */
function transcriptOf(count: number): WordTimestamp[] {
  return Array.from({ length: count }, (_, i) => ({ word: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
}

describe('alignScenesToTranscript', () => {
  it('starts scenes where their first word is spoken and sums to the total duration', () => {
    // 6 script words over a 3s recording; scenes of 2 + 4 words.
    const aligned = alignScenesToTranscript(['satu dua', 'tiga empat lima enam'], transcriptOf(6), 3);
    expect(aligned).not.toBeNull();
    expect(aligned![0].durationInSeconds).toBe(1);
    expect(aligned![1].durationInSeconds).toBe(2);
    expect(aligned![0].durationInSeconds + aligned![1].durationInSeconds).toBe(3);
  });

  it('gives word timestamps relative to each scene start', () => {
    const aligned = alignScenesToTranscript(['satu dua', 'tiga empat lima enam'], transcriptOf(6), 3)!;
    expect(aligned[0].wordTimestamps.map((w) => w.word)).toEqual(['satu', 'dua']);
    expect(aligned[0].wordTimestamps[0].start).toBe(0);
    // Scene 2 starts at 1.0s absolute, so its first word is at 0 relative.
    expect(aligned[1].wordTimestamps[0].start).toBe(0);
    expect(aligned[1].wordTimestamps[1].start).toBe(0.5);
  });

  it('maps proportionally when the transcript has a different word count than the script', () => {
    // 4 script words against 8 transcript words: script word 2 lands on transcript word 4 (2.0s).
    const aligned = alignScenesToTranscript(['a b', 'c d'], transcriptOf(8), 4)!;
    expect(aligned[0].durationInSeconds).toBe(2);
    expect(aligned[1].durationInSeconds).toBe(2);
  });

  it('keeps the first scene at 0 even if speech starts late and enforces a 0.5s minimum', () => {
    const late: WordTimestamp[] = [
      { word: 'a', start: 2, end: 2.2 },
      { word: 'b', start: 2.1, end: 2.3 }
    ];
    const aligned = alignScenesToTranscript(['a', 'b'], late, 3)!;
    expect(aligned[0].durationInSeconds).toBe(2.1);
    expect(aligned[1].durationInSeconds).toBe(0.9);
  });

  it('returns null when there is nothing to align', () => {
    expect(alignScenesToTranscript(['a b'], [], 3)).toBeNull();
    expect(alignScenesToTranscript(['', ' '], transcriptOf(2), 3)).toBeNull();
    expect(alignScenesToTranscript(['a'], transcriptOf(1), 0)).toBeNull();
  });
});

describe('transcribeWords', () => {
  it('skips files over the Whisper upload limit without calling the network', async () => {
    const big = { size: WHISPER_MAX_BYTES + 1 } as unknown as Blob;
    expect(await transcribeWords({ apiKey: 'sk-test', audio: big })).toEqual([]);
  });
});
