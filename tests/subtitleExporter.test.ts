/**
 * tests/subtitleExporter.test.ts
 * Unit tests for Subtitle Exporter engine (SRT & WebVTT)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatSrtTimecode,
  formatVttTimecode,
  generateSubtitleCues,
  generateSrt,
  generateVtt,
  downloadSubtitleFile
} from '../src/engine/export/subtitleExporter';
import type { MooProject } from '../src/types';

const SAMPLE_PROJECT: MooProject = {
  id: 'test-project',
  title: 'My Viral Video',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#121214',
    textPrimary: '#ffffff',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center'
  },
  scenes: [
    {
      id: 'sc-1',
      text: 'Zero server rendering directly inside browser.',
      focusWords: ['zero', 'browser'],
      motionPreset: 'punch_zoom',
      durationInSeconds: 3.0,
      wordTimestamps: [
        { word: 'Zero', start: 0.0, end: 0.4 },
        { word: 'server', start: 0.4, end: 0.9 },
        { word: 'rendering', start: 0.9, end: 1.5 },
        { word: 'directly', start: 1.5, end: 2.0 },
        { word: 'inside', start: 2.0, end: 2.4 },
        { word: 'browser.', start: 2.4, end: 3.0 }
      ]
    },
    {
      id: 'sc-2',
      text: 'Hardware acceleration with WebCodecs.',
      focusWords: ['hardware', 'webcodecs'],
      motionPreset: 'slide_split',
      durationInSeconds: 2.5,
      wordTimestamps: [
        { word: 'Hardware', start: 0.0, end: 0.6 },
        { word: 'acceleration', start: 0.6, end: 1.4 },
        { word: 'with', start: 1.4, end: 1.7 },
        { word: 'WebCodecs.', start: 1.7, end: 2.5 }
      ]
    }
  ],
  audioDuration: 5.5,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
};

describe('Subtitle Timecode Formatting', () => {
  it('formats SRT timecodes with comma separators and zero padding', () => {
    expect(formatSrtTimecode(0)).toBe('00:00:00,000');
    expect(formatSrtTimecode(1.5)).toBe('00:00:01,500');
    expect(formatSrtTimecode(65.42)).toBe('00:01:05,420');
    expect(formatSrtTimecode(3661.055)).toBe('01:01:01,055');
  });

  it('clamps negative or invalid numbers to 00:00:00,000 for SRT', () => {
    expect(formatSrtTimecode(-5)).toBe('00:00:00,000');
    expect(formatSrtTimecode(NaN)).toBe('00:00:00,000');
  });

  it('formats WebVTT timecodes with period separators', () => {
    expect(formatVttTimecode(0)).toBe('00:00:00.000');
    expect(formatVttTimecode(1.5)).toBe('00:00:01.500');
    expect(formatVttTimecode(65.42)).toBe('00:01:05.420');
    expect(formatVttTimecode(3661.055)).toBe('01:01:01.055');
  });
});

describe('generateSubtitleCues', () => {
  it('returns empty array when project has no scenes', () => {
    const emptyProj: MooProject = { ...SAMPLE_PROJECT, scenes: [] };
    const cues = generateSubtitleCues(emptyProj);
    expect(cues).toEqual([]);
  });

  it('generates 1 cue per scene in scene mode', () => {
    const cues = generateSubtitleCues(SAMPLE_PROJECT, { mode: 'scene' });
    expect(cues.length).toBe(2);

    expect(cues[0].index).toBe(1);
    expect(cues[0].startTime).toBe(0);
    expect(cues[0].endTime).toBe(3.0);
    expect(cues[0].text).toBe('Zero server rendering directly inside browser.');

    // Scene 2 starts at offset 3.0
    expect(cues[1].index).toBe(2);
    expect(cues[1].startTime).toBe(3.0);
    expect(cues[1].endTime).toBe(5.5);
    expect(cues[1].text).toBe('Hardware acceleration with WebCodecs.');
  });

  it('generates 1 cue per word in word mode with cumulative timeline offsets', () => {
    const cues = generateSubtitleCues(SAMPLE_PROJECT, { mode: 'word' });
    // Total words = 6 in scene 1 + 4 in scene 2 = 10 cues
    expect(cues.length).toBe(10);
    expect(cues[0].text).toBe('Zero');
    expect(cues[0].startTime).toBe(0.0);
    expect(cues[0].endTime).toBe(0.4);

    // First word of scene 2 starts at sceneOffset 3.0 + 0.0 = 3.0
    expect(cues[6].text).toBe('Hardware');
    expect(cues[6].startTime).toBe(3.0);
    expect(cues[6].endTime).toBe(3.6);
  });

  it('chunks words into readable phrases in phrase mode (default)', () => {
    const cues = generateSubtitleCues(SAMPLE_PROJECT, { mode: 'phrase', maxWordsPerCue: 4 });
    expect(cues.length).toBeGreaterThan(1);
    // Each cue should have <= 4 words
    for (const cue of cues) {
      const wordCount = cue.text.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(4);
    }
    // Indices must be sequential starting at 1
    cues.forEach((c, idx) => expect(c.index).toBe(idx + 1));
  });

  it('falls back to scene duration when scene lacks wordTimestamps', () => {
    const projWithoutWords: MooProject = {
      ...SAMPLE_PROJECT,
      scenes: [
        {
          id: 'sc-fallback',
          text: 'Fallback scene without word alignment',
          focusWords: [],
          motionPreset: 'punch_zoom',
          durationInSeconds: 4.0,
          wordTimestamps: []
        }
      ]
    };

    const cues = generateSubtitleCues(projWithoutWords, { mode: 'phrase' });
    expect(cues.length).toBe(1);
    expect(cues[0].startTime).toBe(0);
    expect(cues[0].endTime).toBe(4.0);
    expect(cues[0].text).toBe('Fallback scene without word alignment');
  });
});

describe('generateSrt', () => {
  it('returns empty string for empty project', () => {
    const emptyProj: MooProject = { ...SAMPLE_PROJECT, scenes: [] };
    expect(generateSrt(emptyProj)).toBe('');
  });

  it('generates standard SRT format with sequential numbering and comma timecodes', () => {
    const srt = generateSrt(SAMPLE_PROJECT, { mode: 'scene' });

    expect(srt).toContain('1\n00:00:00,000 --> 00:00:03,000\nZero server rendering directly inside browser.');
    expect(srt).toContain('2\n00:00:03,000 --> 00:00:05,500\nHardware acceleration with WebCodecs.');
    expect(srt.endsWith('\n')).toBe(true);
  });
});

describe('generateVtt', () => {
  it('returns WEBVTT header for empty project', () => {
    const emptyProj: MooProject = { ...SAMPLE_PROJECT, scenes: [] };
    expect(generateVtt(emptyProj)).toBe('WEBVTT\n');
  });

  it('generates standard WebVTT format starting with WEBVTT header and period timecodes', () => {
    const vtt = generateVtt(SAMPLE_PROJECT, { mode: 'scene' });

    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('1\n00:00:00.000 --> 00:00:03.000\nZero server rendering directly inside browser.');
    expect(vtt).toContain('2\n00:00:03.000 --> 00:00:05.500\nHardware acceleration with WebCodecs.');
  });
});

describe('downloadSubtitleFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates Blob and triggers download without throwing', () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
    const mockRevokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    const clickSpy = vi.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: clickSpy
    };

    const mockDoc = {
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === 'a') return mockAnchor;
        return {};
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      }
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {};

    try {
      // Test SRT download
      downloadSubtitleFile(SAMPLE_PROJECT, 'srt', { mode: 'scene' });
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(mockAnchor.download).toBe('my_viral_video.srt');
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-url');

      // Test VTT download
      downloadSubtitleFile(SAMPLE_PROJECT, 'vtt', { mode: 'scene' });
      expect(mockAnchor.download).toBe('my_viral_video.vtt');
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(2);
    } finally {
      delete (globalThis as any).document;
      delete (globalThis as any).window;
    }
  });

  it('no-ops safely when document is undefined (SSR/Node environment)', () => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
    expect(() => downloadSubtitleFile(SAMPLE_PROJECT, 'srt')).not.toThrow();
  });
});
