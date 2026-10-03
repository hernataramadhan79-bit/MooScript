import { describe, it, expect, beforeEach } from 'vitest';
import { buildSceneModule, escapeHtml } from '../src/engine/composition/sceneTemplates';
import { syncComposition, applySize } from '../src/engine/composition/sync';
import { validateSceneCode } from '../src/engine/composition/validator';
import { useMooStore } from '../src/store/useMooStore';
import type { LayoutType, MooProject, Scene } from '../src/types';

describe('Scene Templates and HTML Escaping (Phase 4a)', () => {
  const layouts: LayoutType[] = [
    'KINETIC_QUOTE',
    'METRIC_COUNTER',
    'TERMINAL_MOCKUP',
    'VS_COMPARISON',
    'LIST_STAGGER'
  ];

  const dummyTheme: MooProject['theme'] = {
    bg: '#09090b',
    textPrimary: '#f4f4f5',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center',
    showSubtitles: false
  };

  const dummySize = { width: 1080, height: 1920 };

  it('generates valid code passing validateSceneCode for all 5 layouts', () => {
    for (const layout of layouts) {
      const scene: Scene = {
        id: `sc-test-${layout.toLowerCase()}`,
        layout,
        narrationText: 'High performance motion design for fast compilation',
        text: 'High performance motion design for fast compilation',
        visualData: {
          title: `Layout ${layout}`,
          metricValue: '+450%',
          metricLabel: 'Speed Improvement',
          codeSnippet: 'const muxer = new Muxer();\nmuxer.addVideoChunk(chunk);',
          codeLanguage: 'typescript',
          leftSide: { label: 'Old Way', value: 'Server Rendering (Slow)' },
          rightSide: { label: 'New Way', value: 'Zero-Server WebCodecs' },
          bulletItems: ['Ultra-fast preview', 'Deterministic export', 'Zero server bill'],
          focusWords: ['performance', 'motion', 'fast']
        },
        focusWords: ['performance', 'motion', 'fast'],
        motionPreset: 'punch_zoom',
        camera: 'push_in',
        icon: 'zap',
        durationInSeconds: 3.5,
        wordTimestamps: []
      };

      const mod = buildSceneModule(scene, dummyTheme, dummySize);
      expect(mod.beatId).toBe(scene.id);
      expect(mod.status).toBe('ok');
      expect(mod.version).toBe(1);

      const validation = validateSceneCode(mod);
      expect(validation.valid, `Layout ${layout} validation failed: ${validation.errors.join(', ')}`).toBe(true);
      expect(validation.errors.length).toBe(0);
    }
  });

  it('escapes dangerous HTML characters (&, <, >, ", \') preventing XSS injection', () => {
    const dangerousText = 'Dangerous <script>alert(1)</script> & "quotes" \'test\' > 5 < 10';
    const escaped = escapeHtml(dangerousText);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;quotes&quot;');
    expect(escaped).toContain('&#39;test&#39;');

    const scene: Scene = {
      id: 'sc-xss',
      layout: 'KINETIC_QUOTE',
      narrationText: dangerousText,
      text: dangerousText,
      visualData: {
        title: '<script>alert(2)</script> & "Title"'
      },
      durationInSeconds: 3.0,
      wordTimestamps: []
    };

    const mod = buildSceneModule(scene, dummyTheme, dummySize);
    expect(mod.html).not.toContain('<script>');
    const validation = validateSceneCode(mod);
    expect(validation.valid).toBe(true);
  });
});

describe('Pure syncComposition (Phase 4b)', () => {
  const baseProject: MooProject = {
    id: 'proj-sync-test',
    title: 'Sync Test',
    aspectRatio: '9:16',
    fps: 30,
    width: 1080,
    height: 1920,
    theme: {
      bg: '#09090b',
      textPrimary: '#ffffff',
      textHighlight: '#84cc16',
      fontFamily: 'Jakarta',
      captionStyle: 'boxed',
      captionPosition: 'center'
    },
    scenes: [
      {
        id: 'sc-1',
        layout: 'KINETIC_QUOTE',
        narrationText: 'First Scene Text',
        text: 'First Scene Text',
        durationInSeconds: 3.0,
        wordTimestamps: []
      },
      {
        id: 'sc-2',
        layout: 'METRIC_COUNTER',
        narrationText: 'Second Scene Text',
        text: 'Second Scene Text',
        visualData: { metricValue: '99%', metricLabel: 'Efficiency' },
        durationInSeconds: 3.0,
        wordTimestamps: []
      }
    ],
    audioDuration: 6.0,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
  };

  it('adding a scene produces an extra module', () => {
    const synced1 = syncComposition(baseProject);
    expect(synced1.composition?.scenes.length).toBe(2);

    const projectWithExtraScene: MooProject = {
      ...synced1,
      scenes: [
        ...synced1.scenes,
        {
          id: 'sc-3',
          layout: 'TERMINAL_MOCKUP',
          narrationText: 'Third Scene Text',
          text: 'Third Scene Text',
          durationInSeconds: 3.0,
          wordTimestamps: []
        }
      ]
    };

    const synced2 = syncComposition(projectWithExtraScene);
    expect(synced2.composition?.scenes.length).toBe(3);
    expect(synced2.composition?.scenes[2].beatId).toBe('sc-3');
  });

  it('reordering project.scenes reorders composition.scenes to match', () => {
    const synced = syncComposition(baseProject);
    expect(synced.composition?.scenes.map((s) => s.beatId)).toEqual(['sc-1', 'sc-2']);

    const reversed: MooProject = {
      ...synced,
      scenes: [synced.scenes[1], synced.scenes[0]]
    };

    const reorderedSync = syncComposition(reversed);
    expect(reorderedSync.composition?.scenes.map((s) => s.beatId)).toEqual(['sc-2', 'sc-1']);
  });

  it('removing a scene drops its module', () => {
    const synced = syncComposition(baseProject);
    expect(synced.composition?.scenes.length).toBe(2);

    const removed: MooProject = {
      ...synced,
      scenes: [synced.scenes[0]]
    };

    const syncedRemoved = syncComposition(removed);
    expect(syncedRemoved.composition?.scenes.length).toBe(1);
    expect(syncedRemoved.composition?.scenes[0].beatId).toBe('sc-1');
  });

  it('module with userEdited: true is never overwritten when theme or text changes', () => {
    const synced = syncComposition(baseProject);
    // Mark scene 1 as user-edited with custom html/css
    const customHtml = '<div class="custom-handcrafted-module">HANDCRAFTED</div>';
    const compScenes = synced.composition!.scenes.map((s) =>
      s.beatId === 'sc-1' ? { ...s, html: customHtml, userEdited: true } : s
    );

    const projectWithCustom: MooProject = {
      ...synced,
      composition: { ...synced.composition!, scenes: compScenes },
      theme: { ...synced.theme, bg: '#ff0000', textHighlight: '#00ffff' },
      scenes: [
        { ...synced.scenes[0], text: 'Completely different text' },
        synced.scenes[1]
      ]
    };

    const reSynced = syncComposition(projectWithCustom);
    const mod1 = reSynced.composition?.scenes.find((s) => s.beatId === 'sc-1');
    expect(mod1?.userEdited).toBe(true);
    expect(mod1?.html).toBe(customHtml);
  });

  it('text change on unedited module DOES update the module HTML', () => {
    const synced1 = syncComposition(baseProject);
    const modBefore = synced1.composition?.scenes.find((s) => s.beatId === 'sc-1');
    expect(modBefore?.html).toContain('First');

    const updatedProject: MooProject = {
      ...synced1,
      scenes: [
        { ...synced1.scenes[0], narrationText: 'Brand New Headline', text: 'Brand New Headline' },
        synced1.scenes[1]
      ]
    };

    const synced2 = syncComposition(updatedProject);
    const modAfter = synced2.composition?.scenes.find((s) => s.beatId === 'sc-1');
    expect(modAfter?.html).toContain('Brand');
    expect(modAfter?.html).toContain('Headline');
    expect(modAfter?.html).not.toContain('First');
  });
});

describe('applySize (Phase 4d)', () => {
  const dummyProject: MooProject = {
    id: 'proj-size-test',
    title: 'Size Test',
    aspectRatio: '9:16',
    fps: 30,
    width: 1080,
    height: 1920,
    theme: {
      bg: '#000000',
      textPrimary: '#ffffff',
      textHighlight: '#84cc16',
      fontFamily: 'Jakarta',
      captionStyle: 'boxed',
      captionPosition: 'center'
    },
    scenes: [],
    audioDuration: 0,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
  };

  it('computes correct dimensions across aspect ratios and resolution tiers', () => {
    // 9:16
    const res916_1080 = applySize(dummyProject, '9:16', '1080p');
    expect(res916_1080.width).toBe(1080);
    expect(res916_1080.height).toBe(1920);

    const res916_720 = applySize(dummyProject, '9:16', '720p');
    expect(res916_720.width).toBe(720);
    expect(res916_720.height).toBe(1280);

    // 16:9
    const res169_1080 = applySize(dummyProject, '16:9', '1080p');
    expect(res169_1080.width).toBe(1920);
    expect(res169_1080.height).toBe(1080);

    const res169_720 = applySize(dummyProject, '16:9', '720p');
    expect(res169_720.width).toBe(1280);
    expect(res169_720.height).toBe(720);

    // 1:1
    const res11_1080 = applySize(dummyProject, '1:1', '1080p');
    expect(res11_1080.width).toBe(1080);
    expect(res11_1080.height).toBe(1080);

    const res11_720 = applySize(dummyProject, '1:1', '720p');
    expect(res11_720.width).toBe(720);
    expect(res11_720.height).toBe(720);
  });
});

describe('Audio Preservation Rules in Store Actions (Phase 4e)', () => {
  const initialTestProject: MooProject = {
    id: 'proj-audio-test',
    title: 'Audio Preservation Test',
    aspectRatio: '9:16',
    fps: 30,
    width: 1080,
    height: 1920,
    theme: {
      bg: '#09090b',
      textPrimary: '#ffffff',
      textHighlight: '#84cc16',
      fontFamily: 'Jakarta',
      captionStyle: 'boxed',
      captionPosition: 'center'
    },
    scenes: [
      {
        id: 'sc-audio-1',
        layout: 'KINETIC_QUOTE',
        narrationText: 'Original text for scene one',
        text: 'Original text for scene one',
        durationInSeconds: 4.0,
        wordTimestamps: [
          { word: 'Original', start: 0, end: 1.0 },
          { word: 'text', start: 1.0, end: 2.0 },
          { word: 'for', start: 2.0, end: 2.5 },
          { word: 'scene', start: 2.5, end: 3.2 },
          { word: 'one', start: 3.2, end: 4.0 }
        ]
      }
    ],
    audioDuration: 4.0,
    bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
  };

  beforeEach(() => {
    useMooStore.setState({
      project: JSON.parse(JSON.stringify(initialTestProject)),
      audioStale: false
    });
  });

  it('updateSceneText with audioBlob present keeps duration and wordTimestamps, sets audioStale: true', () => {
    // Add mock audio blob
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
    useMooStore.setState({
      project: {
        ...useMooStore.getState().project,
        audioBlob: mockBlob
      }
    });

    // Update text
    useMooStore.getState().updateSceneText('sc-audio-1', 'A completely different longer narration text here');

    const scene = useMooStore.getState().project.scenes[0];
    expect(scene.narrationText).toBe('A completely different longer narration text here');
    expect(scene.text).toBe('A completely different longer narration text here');
    // Duration and word timestamps MUST be preserved
    expect(scene.durationInSeconds).toBe(4.0);
    expect(scene.wordTimestamps?.length).toBe(5);
    expect(scene.wordTimestamps?.[0].word).toBe('Original');
    expect(useMooStore.getState().audioStale).toBe(true);
  });

  it('updateSceneText without audioBlob recalculates durationInSeconds and wordTimestamps', () => {
    useMooStore.setState({
      project: {
        ...useMooStore.getState().project,
        audioBlob: undefined
      }
    });

    useMooStore.getState().updateSceneText('sc-audio-1', 'Short');

    const scene = useMooStore.getState().project.scenes[0];
    expect(scene.narrationText).toBe('Short');
    // Fallback duration for a single short word should be around 2.5s (min 2.5s)
    expect(scene.durationInSeconds).toBeLessThan(4.0);
    expect(scene.wordTimestamps?.length).toBe(1);
    expect(scene.wordTimestamps?.[0].word).toBe('Short');
  });

  it('setSceneDuration with audioBlob present does not change duration and marks audioStale: true', () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
    useMooStore.setState({
      project: {
        ...useMooStore.getState().project,
        audioBlob: mockBlob
      }
    });

    useMooStore.getState().setSceneDuration('sc-audio-1', 10.0);

    const scene = useMooStore.getState().project.scenes[0];
    expect(scene.durationInSeconds).toBe(4.0);
    expect(useMooStore.getState().project.audioDuration).toBe(4.0);
    expect(useMooStore.getState().audioStale).toBe(true);
  });
});
