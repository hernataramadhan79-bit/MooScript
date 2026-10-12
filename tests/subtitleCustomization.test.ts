import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import { buildCaptionScript } from '../src/engine/composition/captions';
import { CanvasRenderer } from '../src/engine/renderer/canvasRenderer';
import { createMockCanvas } from './mocks/mockCanvas';
import type { MooProject, Scene, CaptionStyle, CaptionPosition } from '../src/types';

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

  describe('CanvasRenderer subtitle overlay', () => {
    it('renders subtitle overlay with custom style, colors, and font scaling without throwing', () => {
      const renderer = new CanvasRenderer();
      const mock = createMockCanvas(1080, 1920);
      const ctx = mock.ctx;

      const mockProject: MooProject = {
        id: 'proj-sub-test',
        title: 'Subtitle Test Project',
        aspectRatio: '9:16',
        fps: 30,
        width: 1080,
        height: 1920,
        theme: {
          bg: '#131315',
          textPrimary: '#ffffff',
          textHighlight: '#84cc16',
          fontFamily: 'Jakarta',
          captionStyle: 'outline',
          captionPosition: 'bottom',
          showSubtitles: true,
          subtitleCustomization: {
            fontScale: 1.2,
            activeColor: '#eab308',
            textColor: '#f4f4f5',
            uppercase: true,
            bgOpacity: 0.75,
            maxWordsPerChunk: 3
          }
        },
        scenes: [],
        audioDuration: 3,
        bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
      };

      const mockScene: Scene = {
        id: 'scene-1',
        layout: 'KINETIC_QUOTE',
        narrationText: 'Teks naskah subtitle animasi.',
        text: 'Teks naskah subtitle animasi.',
        visualData: { title: 'Scene 1', focusWords: ['subtitle'] },
        focusWords: ['subtitle'],
        motionPreset: 'punch_zoom',
        durationInSeconds: 3.0,
        wordTimestamps: [
          { word: 'Teks', start: 0, end: 0.6 },
          { word: 'naskah', start: 0.6, end: 1.2 },
          { word: 'subtitle', start: 1.2, end: 2.0 },
          { word: 'animasi', start: 2.0, end: 2.8 }
        ]
      };

      // Test across different elapsed times and styles
      const styles: CaptionStyle[] = ['boxed', 'karaoke', 'bold-pop', 'minimal', 'outline'];
      for (const style of styles) {
        mockProject.theme.captionStyle = style;
        expect(() => {
          renderer.renderBottomSubtitleOverlay(ctx, 1080, 1920, mockScene, 1.5, mockProject);
        }).not.toThrow();
      }
    });
  });
});
