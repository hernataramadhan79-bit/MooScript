import type { MooProject } from '../../types';
import { buildCompositionDocument } from './buildDocument';

export interface FrameRenderer {
  renderFrame: (frame: number, timeSec: number, targetCanvas: HTMLCanvasElement) => Promise<void>;
  cleanup: () => void;
}

export async function createCompositionFrameRenderer(
  project: MooProject,
  width: number,
  height: number
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
    let pendingCallback: ((dataUrl: string) => void) | null = null;
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
          renderFrame: async (frame: number, timeSec: number, targetCanvas: HTMLCanvasElement): Promise<void> => {
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
              pendingCallback = (dataUrl: string) => {
                clearTimeout(frameTimeout);
                const img = new Image();
                img.onload = () => {
                  const ctx = targetCanvas.getContext('2d');
                  if (ctx) {
                    ctx.fillStyle = '#09090b';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                  }
                  res();
                };
                img.onerror = (err) => {
                  rej(new Error(`Image render error for frame ${frame}: ${String(err)}`));
                };
                img.src = dataUrl;
              };

              pendingErrorCallback = (errMsg: string) => {
                clearTimeout(frameTimeout);
                rej(new Error(`Frame capture error for frame ${frame}: ${errMsg}`));
              };

              contentWindow.postMessage(
                {
                  type: 'capture',
                  time: timeSec,
                  id: frame,
                  width,
                  height
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
          cb(data.dataUrl);
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
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.srcdoc = buildCompositionDocument(project);

      document.body.appendChild(iframe);
    } catch {
      cleanup();
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}
