import { describe, expect, it } from 'vitest';
import { buildPalette, GifEncoder, mapPixels } from '../src/engine/export/gifEncoder';

function solid(w: number, h: number, rgb: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return data;
}

describe('GIF encoder', () => {
  it('keeps flat colours exact enough and maps pixels to the nearest one', () => {
    const hist = new Uint32Array(32768);
    hist[(31 << 10) | (0 << 5) | 0] = 100; // red
    hist[(0 << 10) | (0 << 5) | 31] = 50; // blue
    const palette = buildPalette(hist);
    expect(palette).toHaveLength(2);
    const idx = mapPixels(Uint8ClampedArray.from([250, 5, 5, 255, 3, 3, 250, 255]), palette);
    expect(palette[idx[0]][0]).toBeGreaterThan(240);
    expect(palette[idx[1]][2]).toBeGreaterThan(240);
  });

  it('writes a looping GIF89a with one image per frame', async () => {
    const enc = new GifEncoder(8, 4);
    enc.addFrame(solid(8, 4, [255, 0, 0]), 10);
    enc.addFrame(solid(8, 4, [0, 0, 255]), 10);
    const bytes = new Uint8Array(await enc.finish().arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    expect(bytes[6]).toBe(8);
    expect(bytes[8]).toBe(4);
    expect(String.fromCharCode(...bytes.slice(16, 27))).toBe('NETSCAPE2.0');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    expect(bytes.filter((b, i) => b === 0x2c && bytes[i - 1] === 0x00).length).toBeGreaterThanOrEqual(2);
  });
});
