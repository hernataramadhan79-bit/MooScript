import { vi } from 'vitest';
import * as compRendererModule from '../../src/engine/composition/compositionFrameRenderer';

/**
 * The exporter draws every frame through the stage and into canvases it creates. Node has neither,
 * so tests get a `document` whose canvases are the OffscreenCanvas mock already installed by the
 * suite, and a stage that draws nothing. Returns the stage mock and a function that undoes both.
 */
export function installExportStage(renderFrame?: compRendererModule.FrameRenderer['renderFrame']) {
  const originalDocument = (globalThis as any).document;
  (globalThis as any).document = {
    ...(originalDocument || {}),
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`export tests only create canvases, not <${tag}>`);
      return new (globalThis as any).OffscreenCanvas(1, 1);
    }
  };
  const stage: compRendererModule.FrameRenderer = {
    renderFrame: vi.fn(renderFrame ?? (() => Promise.resolve())),
    cleanup: vi.fn()
  };
  const spy = vi.spyOn(compRendererModule, 'createCompositionFrameRenderer').mockResolvedValue(stage);
  return {
    stage,
    restore: () => {
      spy.mockRestore();
      (globalThis as any).document = originalDocument;
    }
  };
}
