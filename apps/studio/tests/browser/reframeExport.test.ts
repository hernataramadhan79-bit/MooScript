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

  it('writes a long export to disk and hands back a playable file', async () => {
    if (typeof VideoEncoder === 'undefined' || !navigator.storage?.getDirectory) return;
    const inMemory = await exportMooProjectToMP4(project(), () => {}, undefined, { quality: 'compact', streamToDisk: false });
    const onDisk = await exportMooProjectToMP4(project(), () => {}, undefined, { quality: 'compact', streamToDisk: true });
    expect(onDisk.blob.type).toBe(inMemory.blob.type);
    // Same frames, so about the same size; only the index sits at the other end of the file.
    expect(onDisk.fileSizeBytes).toBeGreaterThan(inMemory.fileSizeBytes * 0.8);
    expect(onDisk.fileSizeBytes).toBeLessThan(inMemory.fileSizeBytes * 1.2);

    const video = document.createElement('video');
    video.muted = true;
    video.src = onDisk.objectUrl;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('the file written to disk does not play'));
    });
    expect(video.duration).toBeCloseTo(1, 1);
    expect([video.videoWidth, video.videoHeight]).toEqual([720, 1280]);
    URL.revokeObjectURL(inMemory.objectUrl);
    URL.revokeObjectURL(onDisk.objectUrl);
  }, 90000);
});
