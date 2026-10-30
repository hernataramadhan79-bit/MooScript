import { describe, it, expect, beforeEach } from 'vitest';
import { useMooStore } from '../src/store/useMooStore';
import type { CaptionStyle, CaptionPosition } from '../src/types';

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
        composition: {
          id: 'comp-test',
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 3.5,
          scenes: [
            {
              id: 'scene-test-1',
              beatId: 'scene-test-1',
              duration: 3.5,
              html: '<div data-moo-layer="title">Test</div>',
              css: '',
              buildJs: '',
              status: 'ok',
              version: 1,
              userEdited: false
            }
          ],
          createdAt: Date.now()
        },
        scenes: [
          {
            id: 'scene-test-1',
            text: 'Hello world typography punch',
            narrationText: 'Hello world typography punch',
            visualIntent: 'Initial visual intent for punch typography',
            visualConcept: 'Initial visual concept',
            focusWords: ['punch'],
            motionPreset: 'punch_zoom',
            durationInSeconds: 3.5,
            wordTimestamps: []
          }
        ]
      }
    });
  });

  it('updates scene visualIntent and visualConcept', () => {
    const newIntent = 'Display airplane airflow vectors flowing over wing curvature';
    useMooStore.getState().updateSceneVisualIntent('scene-test-1', newIntent);

    const scene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(scene?.visualIntent).toBe(newIntent);

    const newConcept = 'Curved streamlines with color gradient from blue to orange';
    useMooStore.getState().updateSceneVisualConcept('scene-test-1', newConcept);
    const updatedScene = useMooStore.getState().project.scenes.find((s) => s.id === 'scene-test-1');
    expect(updatedScene?.visualConcept).toBe(newConcept);
  });

  it('updates scene layer overrides and palette', () => {
    useMooStore.getState().updateLayerOverride('scene-test-1', 'title', {
      x: 10,
      scale: 1.2,
      opacity: 0.8
    });
    const comp = useMooStore.getState().project.composition;
    const sceneMod = comp?.scenes.find((s) => s.id === 'scene-test-1' || s.beatId === 'scene-test-1');
    expect(sceneMod?.overrides?.['title']?.x).toBe(10);
    expect(sceneMod?.overrides?.['title']?.scale).toBe(1.2);
    expect(sceneMod?.overrides?.['title']?.opacity).toBe(0.8);

    useMooStore.getState().updateScenePalette('scene-test-1', {
      accent: '#84cc16'
    });
    const updatedSceneMod = useMooStore.getState().project.composition?.scenes.find((s) => s.id === 'scene-test-1' || s.beatId === 'scene-test-1');
    expect(updatedSceneMod?.palette?.accent).toBe('#84cc16');
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
