import { describe, expect, it } from 'vitest';
import { sceneDesignSize } from '../src/engine/composition/designSize';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import type { MooProject } from '../src/types';

const fullHd = '<div class="s"><svg viewBox="0 0 1080 1920"></svg><div style="left:60px;width:960px">TITLE</div></div>';

describe('shot design size', () => {
  it('leaves a shot alone on the stage it was written for', () => {
    expect(sceneDesignSize({ html: fullHd }, 1080, 1920)).toBeNull();
  });

  it('finds the size a shot was written for when the project is now smaller', () => {
    expect(sceneDesignSize({ html: fullHd }, 720, 1280)).toEqual({ width: 1080, height: 1920 });
  });

  it('prefers the size recorded when the shot was generated', () => {
    expect(sceneDesignSize({ html: '<div>no svg</div>', stageSize: { width: 1080, height: 1920 } }, 720, 1280)).toEqual({
      width: 1080,
      height: 1920
    });
  });

  it('does not treat another frame shape as a resolution change', () => {
    expect(sceneDesignSize({ html: fullHd }, 1280, 720)).toBeNull();
    expect(sceneDesignSize({ html: fullHd }, 720, 720)).toBeNull();
  });

  it('ignores an icon-sized viewBox and falls back to the current stage', () => {
    expect(sceneDesignSize({ html: '<svg viewBox="0 0 24 24"></svg>' }, 720, 1280)).toBeNull();
  });

  it('tells the stage to scale such a shot', () => {
    const project: MooProject = {
      ...INITIAL_PROJECT,
      resolution: '720p',
      width: 720,
      height: 1280,
      scenes: [{ id: 'a', narrationText: 'x', durationInSeconds: 2, wordTimestamps: [] }],
      composition: {
        ...INITIAL_PROJECT.composition!,
        width: 720,
        height: 1280,
        scenes: [{ id: 'a', beatId: 'a', duration: 2, html: fullHd, css: '', buildJs: 'ctx.camera({});', status: 'ok', version: 1, userEdited: false }]
      }
    };
    expect(buildCompositionDocument(project)).toContain('designSize: {"width":1080,"height":1920}');
    const full = { ...project, width: 1080, height: 1920, composition: { ...project.composition!, width: 1080, height: 1920 } };
    expect(buildCompositionDocument(full)).toContain('designSize: null');
  });
});
