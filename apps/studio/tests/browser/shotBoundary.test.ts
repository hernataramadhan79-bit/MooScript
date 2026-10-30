/**
 * Shot starts must not stutter: with the Flow transition the incoming shot waits underneath at its
 * frame 0 and only its own moves set it in motion. A wrapper push during the overlap fought the
 * shot's camera, so each shot zoomed one way, stopped and restarted from where the push began.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildCompositionDocument } from '../../src/engine/composition/buildDocument';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import type { MooProject } from '../../src/types';

const FPS = 30;
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

const narrations = [
  'Angka penjualan naik 300 persen tahun ini',
  'Kode baru membuat aplikasi jauh lebih cepat',
  'Bandingkan cara lama dan cara baru'
];

function templateProject(): MooProject {
  const base: MooProject = {
    ...INITIAL_PROJECT,
    scenes: narrations.map((t, i) => ({ id: `s${i}`, narrationText: t, durationInSeconds: 3, wordTimestamps: [] }))
  };
  return compileProceduralProject(syncComposition(base), 'auto', true);
}

describe('shot boundaries (Flow transition)', () => {
  it('holds the incoming shot still until its own first frame plays', async () => {
    const win = await loadStage(templateProject());
    const wrappers = Array.from(win.document.querySelectorAll('.moo-scene-wrapper')) as HTMLElement[];
    const snapshot = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('*'))
        .concat(el)
        .map((n) => {
          const r = (n as Element).getBoundingClientRect();
          return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(2)).join(',');
        })
        .join('|');

    for (let shot = 1; shot < wrappers.length; shot++) {
      const start = shot * 3;
      const seen = new Set<string>();
      // Every frame from the overlap's start up to (not including) the shot's first frame.
      for (let f = Math.round((start - 0.4) * FPS); f < start * FPS; f++) {
        win.__MOO_SEEK__(f / FPS, false);
        if (win.getComputedStyle(wrappers[shot]).visibility !== 'visible') continue;
        seen.add(snapshot(wrappers[shot]));
      }
      win.__MOO_SEEK__(start, false);
      seen.add(snapshot(wrappers[shot]));
      expect(seen.size, `shot ${shot + 1} moved before it started`).toBe(1);
    }
  });
});
