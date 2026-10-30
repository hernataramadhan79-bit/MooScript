/**
 * Splitting a shot must be invisible: the second piece continues the same animation from the cut,
 * so every frame after the cut matches the unsplit shot.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCompositionDocument } from '../../src/engine/composition/buildDocument';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import { useMooStore } from '../../src/store/useMooStore';
import type { MooProject } from '../../src/types';

const frames: HTMLIFrameElement[] = [];

afterEach(() => {
  frames.splice(0).forEach((f) => f.remove());
});

async function loadStage(project: MooProject): Promise<any> {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1080px;height:1920px;border:0;opacity:0';
  document.body.appendChild(frame);
  frames.push(frame);
  const win = frame.contentWindow as any;
  await new Promise<void>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === win && e.data?.type === 'ready') {
        window.removeEventListener('message', onMessage);
        resolve();
      }
    };
    window.addEventListener('message', onMessage);
    frame.srcdoc = buildCompositionDocument(project);
  });
  return win;
}

/** Positions and opacity of every element in the wrapper that is visible at time t. */
function pictureAt(win: any, t: number): string {
  win.__MOO_SEEK__(t, false);
  const wrapper = Array.from(win.document.querySelectorAll('.moo-scene-wrapper')).find(
    (w: any) => win.getComputedStyle(w).visibility === 'visible'
  ) as HTMLElement;
  return Array.from(wrapper.querySelectorAll('*'))
    .map((n) => {
      const el = n as HTMLElement;
      const r = el.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height, parseFloat(win.getComputedStyle(el).opacity)].map((v) => v.toFixed(1)).join(',');
    })
    .join('|');
}

describe('split shot', () => {
  let original: MooProject;

  beforeEach(() => {
    original = compileProceduralProject(
      syncComposition({
        ...INITIAL_PROJECT,
        scenes: [
          { id: 'a', narrationText: 'Satu ide kecil bisa mengubah segalanya hari ini', durationInSeconds: 4, wordTimestamps: [], transition: 'cut' },
          { id: 'b', narrationText: 'Lalu semuanya berubah', durationInSeconds: 3, wordTimestamps: [] }
        ]
      }),
      'auto',
      true
    );
  });

  it('keeps every frame after the cut identical to the unsplit shot', async () => {
    useMooStore.getState().setProject(original);
    const newId = useMooStore.getState().splitSceneAt('a', 1.5);
    expect(newId).not.toBeNull();
    const split = useMooStore.getState().project;
    expect(split.scenes.map((s) => s.durationInSeconds)).toEqual([1.5, 2.5, 3]);

    const before = await loadStage(original);
    const after = await loadStage(split);
    // The shot really moves, so equal pictures mean the cut kept its timing.
    expect(pictureAt(before, 0.2)).not.toBe(pictureAt(before, 2.5));
    for (const t of [0.5, 1.4, 1.5, 1.6, 2.5, 3.9]) {
      expect(pictureAt(after, t), `frame at ${t}s`).toBe(pictureAt(before, t));
    }
  });
});
