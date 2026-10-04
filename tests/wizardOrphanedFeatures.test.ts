import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import type { LayoutType, CaptionStyle, CaptionPosition } from '../src/types';

describe('Wizard Reconnected Features & Actions (Phase 8)', () => {
  beforeEach(() => {
    useMooStore.setState({
      project: {
        ...useMooStore.getState().project,
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        theme: {
          ...useMooStore.getState().project.theme,
          showSubtitles: false,
          captionStyle: 'boxed',
          captionPosition: 'bottom'
        },
        scenes: [
          {
            id: 'scene-test-1',
            layout: 'KINETIC_QUOTE',
            text: 'Hello world typography punch',
            narrationText: 'Hello world typography punch',
            visualData: { title: 'Initial Title' },
            focusWords: ['punch'],
            motionPreset: 'punch_zoom',
            durationInSeconds: 3.5,
            wordTimestamps: []
          }
        ]
      }
    });
  });

  it('updates scene layout and re-syncs composition', () => {
    const newLayout: LayoutType = 'METRIC_COUNTER';
    useMooStore.getState().updateSceneLayout('scene-test-1', newLayout);

    const scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.layout).toBe(newLayout);
    // composition should also be synced
    expect(useMooStore.getState().project.composition?.scenes.length).toBe(1);
  });

  it('updates scene visualData fields (metric, terminal, comparison, list)', () => {
    // 1. Metric counter fields
    useMooStore.getState().updateSceneVisualData('scene-test-1', {
      title: 'Performance Benchmark',
      metricValue: '+400%',
      metricLabel: 'Throughput Growth'
    });
    let scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.visualData?.title).toBe('Performance Benchmark');
    expect(scene?.visualData?.metricValue).toBe('+400%');
    expect(scene?.visualData?.metricLabel).toBe('Throughput Growth');

    // 2. Terminal mockup fields
    useMooStore.getState().updateSceneVisualData('scene-test-1', {
      codeSnippet: 'npm run build',
      codeLanguage: 'bash'
    });
    scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.visualData?.codeSnippet).toBe('npm run build');
    expect(scene?.visualData?.codeLanguage).toBe('bash');

    // 3. Stagger list fields
    useMooStore.getState().updateSceneVisualData('scene-test-1', {
      bulletItems: ['Fast', 'Deterministic', 'Local']
    });
    scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.visualData?.bulletItems).toEqual(['Fast', 'Deterministic', 'Local']);
  });

  it('duplicates scene correctly with a fresh ID', () => {
    const initialCount = useMooStore.getState().project.scenes.length;
    useMooStore.getState().duplicateScene('scene-test-1');

    const scenes = useMooStore.getState().project.scenes;
    expect(scenes.length).toBe(initialCount + 1);
    expect(scenes[1].id).not.toBe('scene-test-1');
    expect(scenes[1].narrationText).toBe(scenes[0].narrationText);
  });

  it('toggles word focus in KINETIC_QUOTE', () => {
    // Word 'hello' is not in focusWords
    useMooStore.getState().toggleWordFocus('scene-test-1', 'hello');
    let scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.focusWords).toContain('hello');

    // Toggle again removes it
    useMooStore.getState().toggleWordFocus('scene-test-1', 'hello');
    scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.focusWords).not.toContain('hello');
  });

  it('updates resolution between 1080p and 720p', () => {
    useMooStore.getState().updateResolution('720p');
    let project = useMooStore.getState().project;
    expect(project.resolution).toBe('720p');
    expect(project.width).toBe(720);
    expect(project.height).toBe(1280);

    useMooStore.getState().updateResolution('1080p');
    project = useMooStore.getState().project;
    expect(project.resolution).toBe('1080p');
    expect(project.width).toBe(1080);
    expect(project.height).toBe(1920);
  });

  it('toggles global subtitles in theme', () => {
    expect(useMooStore.getState().project.theme.showSubtitles).toBe(false);
    useMooStore.getState().toggleGlobalSubtitles();
    expect(useMooStore.getState().project.theme.showSubtitles).toBe(true);
    useMooStore.getState().toggleGlobalSubtitles();
    expect(useMooStore.getState().project.theme.showSubtitles).toBe(false);
  });

  it('updates captionStyle and captionPosition in theme', () => {
    const style: CaptionStyle = 'karaoke';
    useMooStore.getState().updateThemeCaptionStyle(style);
    expect(useMooStore.getState().project.theme.captionStyle).toBe(style);

    const position: CaptionPosition = 'top';
    useMooStore.getState().updateThemeCaptionPosition(position);
    expect(useMooStore.getState().project.theme.captionPosition).toBe(position);
  });

  it('allows updating scene duration', () => {
    useMooStore.getState().setSceneDuration('scene-test-1', 5.5);
    const scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.durationInSeconds).toBe(5.5);
  });
});
