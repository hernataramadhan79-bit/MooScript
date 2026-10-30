/**
 * B-roll footage shows through the shot it belongs to in the exported video, and a transparent
 * export keeps the empty frame see-through.
 */
import { describe, expect, it } from 'vitest';
import { ALL_FORMATS, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Output, WebMOutputFormat, canEncodeVideo } from 'mediabunny';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import { exportMooProjectToMP4 } from '../../src/engine/export/mp4Exporter';
import type { MooProject } from '../../src/types';

/** A 2 s clip of solid green, made with the same encoder the app uses. */
async function greenClip(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 284;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, 0, 160, 284);
  const target = new BufferTarget();
  const output = new Output({ target, format: new WebMOutputFormat() });
  const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: 500_000 });
  output.addVideoTrack(source);
  await output.start();
  for (let i = 0; i < 20; i++) await source.add(i / 10, 1 / 10);
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/webm' });
}

function project(broll: boolean): MooProject {
  return compileProceduralProject(
    syncComposition({
      ...INITIAL_PROJECT,
      resolution: '720p',
      width: 360,
      height: 640,
      fps: 10,
      scenes: [
        { id: 'a', narrationText: 'Satu', durationInSeconds: 1, wordTimestamps: [] },
        {
          id: 'b',
          narrationText: 'Dua',
          durationInSeconds: 1,
          wordTimestamps: [],
          broll: broll ? { assetId: 'clip', start: 0, fit: 'cover', dim: 0 } : undefined
        }
      ]
    }),
    'kinetic-impact',
    true
  );
}

async function pixelAt(blob: Blob, t: number, alpha = false): Promise<number[]> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const sink = new CanvasSink(track, { alpha });
  const frame = (await sink.getCanvas(t))!;
  const c = frame.canvas as HTMLCanvasElement;
  const data = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(4, 4, 1, 1).data;
  return Array.from(data);
}

describe('B-roll and transparent export', () => {
  it('shows the footage behind its own shot only', async () => {
    if (typeof VideoEncoder === 'undefined' || !(await canEncodeVideo('vp9'))) return;
    const clip = await greenClip();
    const result = await exportMooProjectToMP4(project(true), () => {}, undefined, {
      brollSources: { clip },
      format: 'webm',
      quality: 'compact'
    });
    const [r1, g1] = await pixelAt(result.blob, 0.5);
    const [r2, g2, b2] = await pixelAt(result.blob, 1.5);
    // Shot 1 keeps its dark background; shot 2's corner is the green footage.
    expect(g1).toBeLessThan(80);
    expect(r1).toBeLessThan(80);
    expect(g2).toBeGreaterThan(180);
    expect(r2).toBeLessThan(90);
    expect(b2).toBeLessThan(90);
  }, 90000);

  it('leaves the empty frame transparent', async () => {
    if (typeof VideoEncoder === 'undefined' || !(await canEncodeVideo('vp9', { width: 360, height: 640, alpha: 'keep' }))) {
      console.info('[skip] this Chromium cannot encode VP9 with alpha');
      return;
    }
    const result = await exportMooProjectToMP4(project(false), () => {}, undefined, { transparent: true, quality: 'compact' });
    expect(result.blob.type).toBe('video/webm');
    const [, , , a] = await pixelAt(result.blob, 0.5, true);
    expect(a).toBeLessThan(40);
  }, 90000);
});
