import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import { buildCaptionScript } from '../src/engine/composition/captions';
import type { CaptionStyle, CaptionPosition } from '../src/types';

describe('Subtitle Customization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Store Actions for Subtitle Customization', () => {
    it('updates caption style across all available presets', () => {
      const styles: CaptionStyle[] = ['boxed', 'karaoke', 'bold-pop', 'minimal', 'outline'];
      for (const style of styles) {
        useMooStore.getState().updateThemeCaptionStyle(style);
        expect(useMooStore.getState().project.theme.captionStyle).toBe(style);
      }
    });

    it('updates caption position across top, center, and bottom', () => {
      const positions: CaptionPosition[] = ['bottom', 'center', 'top'];
      for (const pos of positions) {
        useMooStore.getState().updateThemeCaptionPosition(pos);
        expect(useMooStore.getState().project.theme.captionPosition).toBe(pos);
      }
    });

    it('updates and merges subtitle customization settings', () => {
      useMooStore.getState().updateSubtitleCustomization({
        fontScale: 1.25,
        activeColor: '#eab308',
        uppercase: true,
        maxWordsPerChunk: 3
      });

      let theme = useMooStore.getState().project.theme;
      expect(theme.subtitleCustomization?.fontScale).toBe(1.25);
      expect(theme.subtitleCustomization?.activeColor).toBe('#eab308');
      expect(theme.subtitleCustomization?.uppercase).toBe(true);
      expect(theme.subtitleCustomization?.maxWordsPerChunk).toBe(3);

      // Partial update preserves existing fields
      useMooStore.getState().updateSubtitleCustomization({
        bgOpacity: 0.8
      });

      theme = useMooStore.getState().project.theme;
      expect(theme.subtitleCustomization?.fontScale).toBe(1.25);
      expect(theme.subtitleCustomization?.bgOpacity).toBe(0.8);
    });
  });

  describe('buildCaptionScript engine output', () => {
    it('embeds customization parameters into caption script', () => {
      const script = buildCaptionScript(
        {
          show: true,
          style: 'outline',
          position: 'bottom',
          width: 1080,
          height: 1920,
          subtitleCustomization: {
            fontScale: 1.5,
            activeColor: '#06b6d4',
            textColor: '#ffffff',
            uppercase: true,
            maxWordsPerChunk: 3,
            yOffsetPercent: -5
          }
        },
        [
          {
            id: 'sc-1',
            duration: 3.0,
            text: 'Subtitel kustomisasi modern untuk video pendek.',
            wordTimestamps: [
              { word: 'Subtitel', start: 0, end: 0.5 },
              { word: 'kustomisasi', start: 0.5, end: 1.2 },
              { word: 'modern', start: 1.2, end: 1.8 }
            ]
          }
        ]
      );

      expect(script).toContain('CFG');
      expect(script).toContain('SCENES');
      expect(script).toContain('outline');
      expect(script).toContain('#06b6d4');
      expect(script).toContain('mooPickChunk');
    });

    it('returns empty string when show is false', () => {
      const script = buildCaptionScript(
        {
          show: false,
          style: 'boxed',
          position: 'bottom',
          width: 1080,
          height: 1920
        },
        []
      );
      expect(script).toBe('');
    });
  });
});
