/** A layer's box on the stage, in stage pixels. */
export interface LayerBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export interface Offset {
  dx: number;
  dy: number;
}

export function unionBox(boxes: LayerBox[]): LayerBox {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { id: 'selection', x: left, y: top, width: right - left, height: bottom - top };
}

/** Edges and centre of a box along one axis. */
function lines(b: LayerBox, axis: 'x' | 'y'): number[] {
  return axis === 'x' ? [b.x, b.x + b.width / 2, b.x + b.width] : [b.y, b.y + b.height / 2, b.y + b.height];
}

/**
 * Moves a box by (dx, dy), pulling its edges or centre onto the canvas edges and centre, or onto
 * another layer's edges and centre, when they come within `threshold`. Returns the snapped move
 * and the lines it snapped to, for drawing guides.
 */
export function snapMove(
  moving: LayerBox,
  others: LayerBox[],
  canvas: { width: number; height: number },
  dx: number,
  dy: number,
  threshold: number
): Offset & { guidesX: number[]; guidesY: number[] } {
  const snapAxis = (axis: 'x' | 'y', delta: number) => {
    const size = axis === 'x' ? canvas.width : canvas.height;
    const targets = [0, size / 2, size, ...others.flatMap((o) => lines(o, axis))];
    const own = lines(moving, axis).map((v) => v + delta);
    let best: { shift: number; at: number } | null = null;
    for (const t of targets) {
      for (const v of own) {
        const shift = t - v;
        if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, at: t };
      }
    }
    if (!best) return { delta, guides: [] as number[] };
    const snapped = delta + best.shift;
    // Every target the snapped box now touches gets a guide, not only the one that won.
    const after = lines(moving, axis).map((v) => v + snapped);
    const guides = Array.from(new Set(targets.filter((t) => after.some((v) => Math.abs(v - t) < 0.5))));
    return { delta: snapped, guides };
  };
  const x = snapAxis('x', dx);
  const y = snapAxis('y', dy);
  return { dx: x.delta, dy: y.delta, guidesX: x.guides, guidesY: y.guides };
}

/**
 * Moves that line boxes up. One box aligns to the canvas; several align to the box around them.
 */
export function alignOffsets(
  boxes: LayerBox[],
  mode: AlignMode,
  canvas: { width: number; height: number }
): Record<string, Offset> {
  if (boxes.length === 0) return {};
  const frame = boxes.length === 1 ? { id: 'canvas', x: 0, y: 0, width: canvas.width, height: canvas.height } : unionBox(boxes);
  const out: Record<string, Offset> = {};
  for (const b of boxes) {
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = frame.x - b.x;
    else if (mode === 'hcenter') dx = frame.x + frame.width / 2 - (b.x + b.width / 2);
    else if (mode === 'right') dx = frame.x + frame.width - (b.x + b.width);
    else if (mode === 'top') dy = frame.y - b.y;
    else if (mode === 'vcenter') dy = frame.y + frame.height / 2 - (b.y + b.height / 2);
    else dy = frame.y + frame.height - (b.y + b.height);
    out[b.id] = { dx: Math.round(dx), dy: Math.round(dy) };
  }
  return out;
}

/** Moves that give three or more boxes equal gaps between them along one axis; the outer two stay. */
export function distributeOffsets(boxes: LayerBox[], axis: 'x' | 'y'): Record<string, Offset> {
  if (boxes.length < 3) return {};
  const pos = (b: LayerBox) => (axis === 'x' ? b.x : b.y);
  const size = (b: LayerBox) => (axis === 'x' ? b.width : b.height);
  const sorted = [...boxes].sort((a, b) => pos(a) - pos(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = pos(last) + size(last) - pos(first);
  const gap = (span - sorted.reduce((sum, b) => sum + size(b), 0)) / (sorted.length - 1);
  const out: Record<string, Offset> = {};
  let cursor = pos(first);
  for (const b of sorted) {
    const d = Math.round(cursor - pos(b));
    out[b.id] = axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cursor += size(b) + gap;
  }
  return out;
}
