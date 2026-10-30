import type { AspectRatio } from '../../types';

/** 'crop' fills the new frame and cuts the edges; 'fit' shows the whole picture on a blurred copy of itself. */
export type ReframeMode = 'crop' | 'fit';

export interface ReframeOptions {
  aspect: AspectRatio;
  mode: ReframeMode;
}

/** Output size of an aspect ratio at a resolution tier (the same sizes the editor uses). */
export function frameSize(aspect: AspectRatio, tier: '1080p' | '720p' = '1080p'): { width: number; height: number } {
  const long = tier === '720p' ? 1280 : 1920;
  const short = tier === '720p' ? 720 : 1080;
  if (aspect === '16:9') return { width: long, height: short };
  if (aspect === '1:1') return { width: short, height: short };
  return { width: short, height: long };
}

/** Where the source picture lands in the target: centred, scaled to cover (crop) or to fit inside. */
export function placeFrame(
  src: { width: number; height: number },
  dst: { width: number; height: number },
  mode: ReframeMode
): { x: number; y: number; width: number; height: number } {
  const scale =
    mode === 'crop' ? Math.max(dst.width / src.width, dst.height / src.height) : Math.min(dst.width / src.width, dst.height / src.height);
  const width = src.width * scale;
  const height = src.height * scale;
  return { x: (dst.width - width) / 2, y: (dst.height - height) / 2, width, height };
}

/** Draws one rendered frame into a frame of another shape. */
export function drawReframed(
  src: CanvasImageSource & { width: number; height: number },
  dst: HTMLCanvasElement,
  mode: ReframeMode,
  transparent = false
): void {
  const ctx = dst.getContext('2d');
  if (!ctx) return;
  const target = { width: dst.width, height: dst.height };
  ctx.save();
  if (transparent) {
    // A transparent video keeps empty bands empty.
    ctx.clearRect(0, 0, target.width, target.height);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, target.width, target.height);
  }
  if (mode === 'fit' && !transparent) {
    // The empty bands show a darkened, blurred cover of the same frame instead of black bars.
    const cover = placeFrame(src, target, 'crop');
    ctx.filter = 'blur(36px) brightness(0.55)';
    ctx.drawImage(src, cover.x, cover.y, cover.width, cover.height);
    ctx.filter = 'none';
  }
  const at = placeFrame(src, target, mode);
  ctx.drawImage(src, at.x, at.y, at.width, at.height);
  ctx.restore();
}
