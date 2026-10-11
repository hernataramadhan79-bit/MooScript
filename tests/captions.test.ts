import { describe, it, expect } from 'vitest';
import { CAPTION_CHUNK_SRC, CAPTION_FALLBACK_SRC, buildCaptionScript } from '../src/engine/composition/captions';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import type { MooProject } from '../src/types';

// Evaluate the exact source strings that ship inside the stage iframe.
const pick = new Function(`${CAPTION_CHUNK_SRC}; return mooPickChunk;`)() as (
  words: { word: string; start: number; end: number }[],
  t: number,
  max: number
) => { words: string[]; active: number } | null;
const even = new Function(`${CAPTION_FALLBACK_SRC}; return mooEvenWords;`)() as (
  text: string,
  dur: number
) => { word: string; start: number; end: number }[];

const words = [
  { word: 'a', start: 0, end: 1 },
  { word: 'b', start: 1, end: 2 },
  { word: 'c', start: 2, end: 3 },
  { word: 'd', start: 3, end: 4 },
  { word: 'e', start: 4, end: 5 },
  { word: 'f', start: 5, end: 6 }
];

describe('caption chunk picker', () => {
  it('groups words and marks the active one', () => {
    expect(pick(words, 0.5, 5)).toEqual({ words: ['a', 'b', 'c', 'd', 'e'], active: 0 });
    expect(pick(words, 2.2, 5)).toEqual({ words: ['a', 'b', 'c', 'd', 'e'], active: 2 });
  });

  it('moves to the next group when the active word crosses the boundary', () => {
    expect(pick(words, 5.5, 5)).toEqual({ words: ['f'], active: 0 });
  });

  it('holds the last word briefly in gaps, then hides', () => {
    const gappy = [
      { word: 'x', start: 0, end: 1 },
      { word: 'y', start: 3, end: 4 }
    ];
    expect(pick(gappy, 1.3, 5)?.active).toBe(0);
    expect(pick(gappy, 2.5, 5)).toBeNull();
  });

  it('returns null with no words', () => {
    expect(pick([], 1, 5)).toBeNull();
  });

  it('spreads fallback words evenly over the duration', () => {
    const out = even('satu dua tiga empat', 4);
    expect(out).toHaveLength(4);
    expect(out[2]).toEqual({ word: 'tiga', start: 2, end: 3 });
    expect(even('', 4)).toEqual([]);
  });
});

describe('caption script wiring', () => {
  it('emits nothing when subtitles are off', () => {
    expect(
      buildCaptionScript({ show: false, style: 'boxed', position: 'bottom', width: 1080, height: 1920 }, [])
    ).toBe('');
  });

  it('is valid JavaScript and escapes script-closing sequences in narration', () => {
    const script = buildCaptionScript(
      { show: true, style: 'karaoke', position: 'center', width: 1080, height: 1920 },
      [{ id: 's1', duration: 3, text: '</script><b>x</b>', wordTimestamps: [] }]
    );
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toContain('</script>');
  });

  it('is included in the document only when showSubtitles is on', () => {
    const base = {
      id: 'p',
      width: 1080,
      height: 1920,
      fps: 30,
      scenes: [{ id: 's1', narrationText: 'halo dunia', text: 'halo dunia', durationInSeconds: 3, wordTimestamps: [] }],
      composition: undefined,
      theme: { showSubtitles: false, captionStyle: 'boxed', captionPosition: 'bottom' }
    } as unknown as MooProject;
    expect(buildCompositionDocument(base)).not.toContain('__MOO_AFTER_SEEK__ = render');
    const on = { ...base, theme: { ...base.theme, showSubtitles: true } } as MooProject;
    expect(buildCompositionDocument(on)).toContain('__MOO_AFTER_SEEK__ = render');
  });
});
