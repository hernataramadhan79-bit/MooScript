/**
 * Animated GIF encoder: per-frame 256-colour palettes (median cut over a 15-bit histogram), LZW
 * compression and an endless loop. Frames are added one by one, so a long film never sits in
 * memory as raw pixels.
 */

interface Box {
  keys: number[];
  count: number;
}

const R = (k: number) => (k >> 10) & 31;
const G = (k: number) => (k >> 5) & 31;
const B = (k: number) => k & 31;

/** Up to 256 colours that represent the frame's 15-bit histogram (median cut). */
export function buildPalette(hist: Uint32Array, maxColors = 256): number[][] {
  const keys: number[] = [];
  for (let k = 0; k < hist.length; k++) if (hist[k] > 0) keys.push(k);
  if (keys.length === 0) return [[0, 0, 0]];
  const total = (ks: number[]) => ks.reduce((s, k) => s + hist[k], 0);
  const boxes: Box[] = [{ keys, count: total(keys) }];

  while (boxes.length < maxColors) {
    // Split the box with the most pixels that still has more than one colour.
    let pick = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].keys.length > 1 && (pick < 0 || boxes[i].count > boxes[pick].count)) pick = i;
    }
    if (pick < 0) break;
    const box = boxes[pick];
    const ranges = [R, G, B].map((ch) => {
      let lo = 31;
      let hi = 0;
      for (const k of box.keys) {
        const v = ch(k);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return hi - lo;
    });
    const ch = [R, G, B][ranges.indexOf(Math.max(...ranges))];
    const sorted = box.keys.slice().sort((a, b) => ch(a) - ch(b));
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += hist[sorted[i]];
      if (acc >= box.count / 2) {
        cut = i + 1;
        break;
      }
      cut = i + 1;
    }
    const left = sorted.slice(0, cut);
    const right = sorted.slice(cut);
    boxes.splice(pick, 1, { keys: left, count: total(left) }, { keys: right, count: total(right) });
  }

  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const k of box.keys) {
      const n = hist[k];
      r += R(k) * n;
      g += G(k) * n;
      b += B(k) * n;
    }
    const n = box.count || 1;
    // 5-bit channel back to 8 bits, centred in its bucket.
    return [Math.round((r / n) * 8.2258), Math.round((g / n) * 8.2258), Math.round((b / n) * 8.2258)];
  });
}

/** Palette index for every pixel of an RGBA buffer (nearest colour, cached per 15-bit colour). */
export function mapPixels(rgba: Uint8ClampedArray, palette: number[][]): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  const cache = new Int16Array(32768).fill(-1);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
    let idx = cache[key];
    if (idx < 0) {
      let best = 0;
      let bestD = Infinity;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      for (let c = 0; c < palette.length; c++) {
        const dr = r - palette[c][0];
        const dg = g - palette[c][1];
        const db = b - palette[c][2];
        const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      idx = best;
      cache[key] = idx;
    }
    out[p] = idx;
  }
  return out;
}

/** Variable-width LZW as GIF uses it, split into ≤255-byte sub-blocks. */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const bytes: number[] = [];
  let bitBuf = 0;
  let bitLen = 0;
  let codeSize = minCodeSize + 1;
  const emit = (code: number) => {
    bitBuf |= code << bitLen;
    bitLen += codeSize;
    while (bitLen >= 8) {
      bytes.push(bitBuf & 255);
      bitBuf >>>= 8;
      bitLen -= 8;
    }
  };
  let dict = new Map<number, number>();
  let next = end + 1;
  emit(clear);
  let prefix = indices.length ? indices[0] : 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      next = end + 1;
      codeSize = minCodeSize + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(end);
  if (bitLen > 0) bytes.push(bitBuf & 255);

  const blocks: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const chunk = bytes.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return blocks;
}

export class GifEncoder {
  private parts: Uint8Array[] = [];

  constructor(
    private width: number,
    private height: number
  ) {
    const head: number[] = [];
    const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
    head.push(...ascii('GIF89a'), width & 255, width >> 8, height & 255, height >> 8, 0x00, 0, 0);
    // Loop forever (NETSCAPE2.0 application extension).
    head.push(0x21, 0xff, 11, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0);
    this.parts.push(Uint8Array.from(head));
  }

  /** Adds one RGBA frame shown for `delayCs` hundredths of a second. */
  addFrame(rgba: Uint8ClampedArray, delayCs: number): void {
    const hist = new Uint32Array(32768);
    for (let i = 0; i < rgba.length; i += 4) {
      hist[((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3)]++;
    }
    const palette = buildPalette(hist);
    const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length))));
    const size = 1 << bits;
    const table: number[] = [];
    for (let i = 0; i < size; i++) {
      const c = palette[i] || [0, 0, 0];
      table.push(c[0], c[1], c[2]);
    }
    const indices = mapPixels(rgba, palette);
    const w = this.width;
    const h = this.height;
    const delay = Math.max(2, Math.round(delayCs));
    const frame: number[] = [
      // Graphic control: no transparency, replace the previous frame.
      0x21, 0xf9, 4, 0x04, delay & 255, delay >> 8, 0, 0,
      // Image descriptor with a local colour table of 2^bits entries.
      0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0x80 | (bits - 1),
      ...table,
      Math.max(2, bits)
    ];
    this.parts.push(Uint8Array.from(frame));
    this.parts.push(Uint8Array.from(lzwEncode(indices, Math.max(2, bits))));
  }

  finish(): Blob {
    this.parts.push(Uint8Array.from([0x3b]));
    return new Blob(this.parts as BlobPart[], { type: 'image/gif' });
  }
}
