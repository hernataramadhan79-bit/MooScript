import type { GeneratedScene } from '../../types';

/** Stage sizes a shot can have been written for: both tiers of each frame shape. */
const STAGE_SIZES: Array<[number, number]> = [
  [1080, 1920],
  [720, 1280],
  [1920, 1080],
  [1280, 720],
  [1080, 1080],
  [720, 720]
];

/**
 * The stage size a shot's code was written for. A shot composes in absolute pixels, so when the
 * project's resolution changes afterwards (1080p to 720p for a quick export) the picture has to be
 * scaled to the new stage rather than left overflowing it.
 *
 * The size comes from the shot itself (`stageSize`, set when it is generated), or else from the
 * `viewBox` of its stage SVG, which the stage contract sets to the full frame. A shot that names
 * neither is taken to match the current stage, as before. Only the same frame shape is scaled: a
 * 9:16 shot on a 16:9 stage is a reframe, not a resolution change.
 */
export function sceneDesignSize(
  scene: Pick<GeneratedScene, 'html' | 'stageSize'>,
  stageWidth: number,
  stageHeight: number
): { width: number; height: number } | null {
  const sameShape = (w: number, h: number) => Math.abs(w / h - stageWidth / stageHeight) < 0.02;
  const differs = (w: number) => Math.abs(w - stageWidth) > 1;

  const own = scene.stageSize;
  if (own && own.width > 0 && own.height > 0) {
    return sameShape(own.width, own.height) && differs(own.width) ? { width: own.width, height: own.height } : null;
  }

  const viewBoxes = (scene.html || '').matchAll(/viewBox\s*=\s*["']\s*0[\s,]+0[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*["']/gi);
  for (const match of viewBoxes) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (!STAGE_SIZES.some(([sw, sh]) => sw === w && sh === h)) continue;
    return sameShape(w, h) && differs(w) ? { width: w, height: h } : null;
  }
  return null;
}
