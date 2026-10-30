/**
 * Cover images and reframed videos come out in the requested frame shape, rendered by the stage.
 */
import { describe, expect, it } from 'vitest';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import { renderCoverPng } from '../../src/engine/export/cover';
import { exportMooProjectToMP4 } from '../../src/engine/export/mp4Exporter';
import type { MooProject } from '../../src/types';

function project(): MooProject {
  return compileProceduralProject(
    syncComposition({
      ...INITIAL_PROJECT,
      resolution: '720p',
      width: 720,
      height: 1280,
      fps: 12,
      scenes: [{ id: 'a', narrationText: 'Satu ide kecil bisa mengubah segalanya', durationInSeconds: 1, wordTimestamps: [] }]
    }),
    'auto',
    true
  );
}

describe('reframed output', () => {
  it('renders a cover PNG in another frame shape', async () => {
    const blob = await renderCoverPng(project(), 0.5, { aspect: '16:9', mode: 'fit' });
    expect(blob.type).toBe('image/png');
    const img = await createImageBitmap(blob);
    expect([img.width, img.height]).toEqual([1280, 720]);
  });

  it('exports a 1:1 video from a 9:16 project', async () => {
    if (typeof VideoEncoder === 'undefined') return;
    const result = await exportMooProjectToMP4(project(), () => {}, undefined, {
      reframe: { aspect: '1:1', mode: 'crop' },
      quality: 'compact'
    });
    expect(result.aspectRatio).toBe('1:1');
    expect([result.width, result.height]).toEqual([720, 720]);
    expect(result.fileSizeBytes).toBeGreaterThan(1000);
    URL.revokeObjectURL(result.objectUrl);
  }, 60000);
});
