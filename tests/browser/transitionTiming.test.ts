/**
 * A transition's length and curve can be set per shot; without them the stage keeps its automatic
 * 0.2-0.4 s timing and each transition's own curve.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildCompositionDocument } from '../../src/engine/composition/buildDocument';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import type { MooProject, Scene } from '../../src/types';

let frame: HTMLIFrameElement | null = null;

afterEach(() => {
  frame?.remove();
  frame = null;
});

async function loadStage(project: MooProject): Promise<any> {
  frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1080px;height:1920px;border:0;opacity:0';
  document.body.appendChild(frame);
  const win = frame.contentWindow as any;
  await new Promise<void>((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === win && e.data?.type === 'ready') {
        window.removeEventListener('message', onMessage);
        resolve();
      }
    };
    window.addEventListener('message', onMessage);
    frame!.srcdoc = buildCompositionDocument(project);
  });
  return win;
}

function twoShots(first: Partial<Scene>): MooProject {
  const scenes: Scene[] = [
    { id: 't0', narrationText: 'Satu ide kecil', durationInSeconds: 3, wordTimestamps: [], transition: 'fade', ...first },
    { id: 't1', narrationText: 'Bisa mengubah segalanya', durationInSeconds: 3, wordTimestamps: [] }
  ];
  return compileProceduralProject(syncComposition({ ...INITIAL_PROJECT, scenes }), 'auto', true);
}

function outgoingOpacity(win: any, t: number): number {
  win.__MOO_SEEK__(t, false);
  const wrapper = win.document.querySelectorAll('.moo-scene-wrapper')[0] as HTMLElement;
  return parseFloat(win.getComputedStyle(wrapper).opacity);
}

describe('transition timing per shot', () => {
  it('keeps the automatic length when none is set', async () => {
    const win = await loadStage(twoShots({}));
    // Automatic fade on a 3 s shot is 0.4 s long, so it has not started at 2.5 s.
    expect(outgoingOpacity(win, 2.5)).toBe(1);
  });

  it('starts a longer fade earlier and follows the chosen curve', async () => {
    const win = await loadStage(twoShots({ transitionDuration: 1, transitionCurve: 'linear' }));
    // A 1 s linear fade starts at 2.0 s: a quarter of the way in, the outgoing shot is at 0.75.
    expect(outgoingOpacity(win, 1.9)).toBe(1);
    expect(outgoingOpacity(win, 2.25)).toBeCloseTo(0.75, 2);
    expect(outgoingOpacity(win, 2.5)).toBeCloseTo(0.5, 2);
  });
});
