/**
 * The GIF encoder's output decodes in the browser (so its LZW stream is valid), with the right
 * frames and colours, and a project exports to a looping GIF.
 */
import { describe, expect, it } from 'vitest';
import { GifEncoder } from '../../src/engine/export/gifEncoder';
import { exportGif } from '../../src/engine/export/gifExport';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';

declare const ImageDecoder: any;

/** A noisy gradient: many colours, long LZW runs and code-size growth past 9 bits. */
function gradient(w: number, h: number, shift: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = (x * 4 + shift) & 255;
      data[i + 1] = (y * 3) & 255;
      data[i + 2] = ((x ^ y) * 2) & 255;
      data[i + 3] = 255;
    }
  }
  return data;
}

async function decodeFrames(blob: Blob): Promise<{ count: number; pixel: (frame: number, x: number, y: number) => Promise<number[]> }> {
  const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: 'image/gif' });
  await decoder.tracks.ready;
  const count = decoder.tracks.selectedTrack.frameCount;
  return {
    count,
    pixel: async (frame, x, y) => {
      const { image } = await decoder.decode({ frameIndex: frame });
      const c = document.createElement('canvas');
      c.width = image.displayWidth;
      c.height = image.displayHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      image.close();
      return Array.from(ctx.getImageData(x, y, 1, 1).data);
    }
  };
}

describe('GIF output', () => {
  it('decodes to the frames and colours that went in', async () => {
    expect(typeof ImageDecoder).toBe('function');
    const enc = new GifEncoder(120, 90);
    enc.addFrame(gradient(120, 90, 0), 10);
    enc.addFrame(gradient(120, 90, 128), 10);
    const gif = await decodeFrames(enc.finish());
    expect(gif.count).toBe(2);
    const [r, g, b] = await gif.pixel(0, 50, 40);
    // Within one 5-bit step of the source colour.
    expect(Math.abs(r - 200)).toBeLessThan(14);
    expect(Math.abs(g - 120)).toBeLessThan(14);
    expect(Math.abs(b - ((50 ^ 40) * 2 & 255))).toBeLessThan(14);
  });

  it('exports a project as a GIF at most 480 px on its long side', async () => {
    const project = compileProceduralProject(
      syncComposition({
        ...INITIAL_PROJECT,
        width: 360,
        height: 640,
        scenes: [{ id: 'a', narrationText: 'Satu ide kecil', durationInSeconds: 1, wordTimestamps: [] }]
      }),
      'kinetic-impact',
      true
    );
    const result = await exportGif(project, () => {}, undefined, { fps: 6 });
    expect(result.blob.type).toBe('image/gif');
    expect([result.width, result.height]).toEqual([270, 480]);
    expect((await decodeFrames(result.blob)).count).toBe(6);
    URL.revokeObjectURL(result.objectUrl);
  }, 60000);
});
