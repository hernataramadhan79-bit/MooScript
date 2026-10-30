import type { MooProject } from '../../types';
import { buildCompositionDocument, type BuildDocumentOptions } from './buildDocument';

export interface FrameDrawOptions {
  /** Leave uncovered pixels transparent instead of filling them (alpha output). */
  transparent?: boolean;
  /** Draws under the stage frame (B-roll footage); runs after the clear, before the frame. */
  underlay?: (ctx: CanvasRenderingContext2D) => void;
}

export interface FrameRenderer {
  renderFrame: (frame: number, timeSec: number, targetCanvas: HTMLCanvasElement, draw?: FrameDrawOptions) => Promise<void>;
  cleanup: () => void;
}

/** Clears the target (or fills it), draws the underlay, then the stage frame on top. */
function paintFrame(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, draw?: FrameDrawOptions): void {
  if (draw?.transparent) {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);
  }
  draw?.underlay?.(ctx);
  ctx.drawImage(source, 0, 0, width, height);
}

export async function createCompositionFrameRenderer(
  project: MooProject,
  width: number,
  height: number,
  documentOptions?: BuildDocumentOptions
): Promise<FrameRenderer | null> {
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  // Only proceed if composition has scenes
  if (!project.composition || !project.composition.scenes || project.composition.scenes.length === 0) {
    return null;
  }

  return new Promise((resolve) => {
    let isResolved = false;
    let iframe: HTMLIFrameElement | null = null;
    let pendingCallback: ((payload: { dataUrl?: string; bitmap?: ImageBitmap }) => void) | null = null;
    let pendingErrorCallback: ((err: string) => void) | null = null;
    let pendingFrameId: number | null = null;

    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(null);
      }
    }, 15000);

    const handleMessage = (e: MessageEvent) => {
      if (!iframe || e.source !== iframe.contentWindow) return;
      const data = e.data;
      if (!data || !data.type) return;

      if (data.type === 'ready' && !isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
        resolve({
          renderFrame: async (frame: number, timeSec: number, targetCanvas: HTMLCanvasElement, draw?: FrameDrawOptions): Promise<void> => {
            const targetIframe = iframe;
            if (!targetIframe) throw new Error(`Iframe unavailable for frame ${frame}`);
            const contentWindow = targetIframe.contentWindow;
            if (!contentWindow) throw new Error(`contentWindow unavailable for frame ${frame}`);

            return new Promise((res, rej) => {
              const frameTimeout = setTimeout(() => {
                pendingCallback = null;
                pendingErrorCallback = null;
                pendingFrameId = null;
                rej(new Error(`Frame capture timed out for frame ${frame}`));
              }, 3000);

              pendingFrameId = frame;
              pendingCallback = (payload: { dataUrl?: string; bitmap?: ImageBitmap }) => {
                clearTimeout(frameTimeout);
                if (payload.bitmap) {
                  try {
                    const ctx = targetCanvas.getContext('2d');
                    if (ctx) paintFrame(ctx, payload.bitmap, width, height, draw);
                    payload.bitmap.close?.();
                    res();
                  } catch (err) {
                    payload.bitmap.close?.();
                    rej(new Error(`Bitmap render error for frame ${frame}: ${String(err)}`));
                  }
                  return;
                }

                const dataUrl = payload.dataUrl || '';
                const img = new Image();
                img.onload = () => {
                  try {
                    const ctx = targetCanvas.getContext('2d');
                    if (ctx) paintFrame(ctx, img, width, height, draw);
                    res();
                  } finally {
                    img.onload = null;
                    img.onerror = null;
                    img.src = '';
                  }
                };
                img.onerror = (err) => {
                  img.onload = null;
                  img.onerror = null;
                  img.src = '';
                  rej(new Error(`Image render error for frame ${frame}: ${String(err)}`));
                };
                try {
                  img.src = dataUrl;
                } catch (err) {
                  img.onload = null;
                  img.onerror = null;
                  img.src = '';
                  rej(new Error(`Image render error for frame ${frame}: ${String(err)}`));
                }
              };

              pendingErrorCallback = (errMsg: string) => {
                clearTimeout(frameTimeout);
                rej(new Error(`Frame capture error for frame ${frame}: ${errMsg}`));
              };

              contentWindow.postMessage(
                {
                  type: 'capture_frame',
                  time: timeSec,
                  id: frame,
                  width,
                  height,
                  // An underlay needs the stage's empty pixels to stay see-through.
                  transparent: Boolean(draw?.transparent || draw?.underlay)
                },
                '*'
              );
            });
          },
          cleanup
        });
      } else if (data.type === 'frame') {
        if (data.id === pendingFrameId && pendingCallback) {
          const cb = pendingCallback;
          pendingCallback = null;
          pendingErrorCallback = null;
          pendingFrameId = null;
          cb({ dataUrl: data.dataUrl, bitmap: data.bitmap });
        }
      } else if (data.type === 'frame_error') {
        if (data.id === pendingFrameId && pendingErrorCallback) {
          const ecb = pendingErrorCallback;
          pendingCallback = null;
          pendingErrorCallback = null;
          pendingFrameId = null;
          ecb(data.message || 'Frame capture error');
        }
      }
    };

    function cleanup() {
      window.removeEventListener('message', handleMessage);
      pendingCallback = null;
      pendingErrorCallback = null;
      pendingFrameId = null;
      if (iframe) {
        try {
          iframe.contentWindow?.postMessage({ type: 'teardown' }, '*');
        } catch {
          // ignore
        }
      }
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
        iframe = null;
      }
    }

    try {
      window.addEventListener('message', handleMessage);

      iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      // Opaque-origin sandbox: postMessage + foreignObject rasterization work fine
      // without allow-same-origin, and scene JS can never reach host IndexedDB.
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.srcdoc = buildCompositionDocument(project, documentOptions);

      document.body.appendChild(iframe);
    } catch {
      cleanup();
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}
