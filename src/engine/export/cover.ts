import type { MooProject } from '../../types';
import { createCompositionFrameRenderer } from '../composition/compositionFrameRenderer';
import { drawReframed, frameSize, type ReframeOptions } from './reframe';

/**
 * One frame of the film as a PNG, rendered by the same stage as the video (thumbnail / cover).
 * With `reframe` it comes out in another frame shape, the way the video export would.
 */
export async function renderCoverPng(project: MooProject, timeSec: number, reframe?: ReframeOptions | null): Promise<Blob> {
  const width = project.width || 1080;
  const height = project.height || 1920;
  const renderer = await createCompositionFrameRenderer(project, width, height);
  if (!renderer) throw new Error('Panggung render tidak bisa dimuat.');
  try {
    const frame = document.createElement('canvas');
    frame.width = width;
    frame.height = height;
    const fps = project.fps || 30;
    await renderer.renderFrame(Math.round(timeSec * fps), timeSec, frame);

    let out = frame;
    if (reframe && reframe.aspect !== project.aspectRatio) {
      const size = frameSize(reframe.aspect, project.resolution || '1080p');
      out = document.createElement('canvas');
      out.width = size.width;
      out.height = size.height;
      drawReframed(frame, out, reframe.mode);
    }
    return await new Promise<Blob>((resolve, reject) =>
      out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal membuat PNG.'))), 'image/png')
    );
  } finally {
    renderer.cleanup();
  }
}
