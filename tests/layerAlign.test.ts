import { describe, expect, it } from 'vitest';
import { alignOffsets, distributeOffsets, snapMove } from '../src/engine/composition/layerAlign';

const canvas = { width: 1080, height: 1920 };
const box = (id: string, x: number, y: number, width = 100, height = 100) => ({ id, x, y, width, height });

describe('snapMove', () => {
  it('snaps a centre onto the canvas centre and reports the guide', () => {
    const r = snapMove(box('a', 100, 100), [], canvas, 386, 0, 8);
    expect(r.dx).toBe(390); // centre 150 + 390 = 540
    expect(r.guidesX).toContain(540);
    expect(r.dy).toBe(0);
  });

  it('snaps an edge onto another layer edge', () => {
    const r = snapMove(box('a', 0, 0), [box('b', 300, 600)], canvas, 0, 495, 8);
    expect(r.dy).toBe(500); // bottom 100 + 500 = top of b
    expect(r.guidesY).toContain(600);
  });

  it('leaves a move alone outside the threshold', () => {
    const r = snapMove(box('a', 0, 0), [], canvas, 233, 777, 8);
    expect([r.dx, r.dy]).toEqual([233, 777]);
    expect(r.guidesX).toEqual([]);
  });
});

describe('align and distribute', () => {
  it('aligns one layer to the canvas and several to their bounds', () => {
    expect(alignOffsets([box('a', 10, 10)], 'hcenter', canvas)).toEqual({ a: { dx: 480, dy: 0 } });
    const many = alignOffsets([box('a', 10, 10), box('b', 300, 50, 50)], 'right', canvas);
    expect(many).toEqual({ a: { dx: 240, dy: 0 }, b: { dx: 0, dy: 0 } });
  });

  it('gives equal gaps and keeps the outer boxes in place', () => {
    const d = distributeOffsets([box('a', 0, 0), box('b', 150, 0), box('c', 600, 0)], 'x');
    expect(d.a.dx).toBe(0);
    expect(d.c.dx).toBe(0);
    expect(d.b.dx).toBe(150); // gap (700 - 300) / 2 = 200 → b at 300
  });
});
