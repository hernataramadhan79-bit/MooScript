/**
 * Layer animations made in the editor (entrance, A→B move, exit) play on the stage on their own
 * CSS variables, on top of whatever the shot's code does with the same element.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildCompositionDocument, compileCompositionOverridesCss } from '../../src/engine/composition/buildDocument';
import { compileProceduralProject } from '../../src/engine/composition/proceduralCompiler';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import type { MooProject } from '../../src/types';

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

function projectWithMotion(): MooProject {
  const base = compileProceduralProject(
    syncComposition({
      ...INITIAL_PROJECT,
      scenes: [{ id: 'm', narrationText: 'Satu ide kecil bisa mengubah segalanya', durationInSeconds: 5, wordTimestamps: [] }]
    }),
    'kinetic-impact',
    true
  );
  const comp = base.composition!;
  return {
    ...base,
    composition: {
      ...comp,
      scenes: [
        {
          ...comp.scenes[0],
          layerMotions: {
            Headline: {
              enter: { preset: 'fade', at: 1, dur: 0.5, curve: 'linear' },
              move: { at: 2, dur: 1, curve: 'linear', to: { x: 100 } },
              exit: { preset: 'slide-up', at: 4, dur: 0.5, curve: 'linear' }
            }
          }
        }
      ]
    }
  };
}

describe('layer motion', () => {
  it('enters, moves A→B and exits on its own variables', async () => {
    const project = projectWithMotion();
    const win = await loadStage(project);
    const el = win.document.querySelector('[data-moo-layer="Headline"]') as HTMLElement;
    const v = (t: number, name: string) => {
      win.__MOO_SEEK__(t, false);
      return parseFloat(win.getComputedStyle(el).getPropertyValue(name));
    };

    expect(v(0.5, '--moo-mo')).toBe(0);
    expect(v(1.25, '--moo-mo')).toBeCloseTo(0.5, 2);
    expect(v(1.8, '--moo-mo')).toBe(1);
    expect(v(2.5, '--moo-mx')).toBeCloseTo(50, 1);
    expect(v(3.5, '--moo-mx')).toBe(100);
    // The exit starts from B and slides up while fading out.
    expect(v(4.25, '--moo-mx')).toBe(100);
    expect(v(4.6, '--moo-my')).toBeCloseTo(-140, 1);
    expect(v(4.6, '--moo-mo')).toBe(0);
    // Seeking back undoes it all.
    expect(v(0.2, '--moo-mx')).toBe(0);
  });

  it('turns the variables into translate / scale / rotate / opacity', () => {
    const css = compileCompositionOverridesCss(projectWithMotion().composition);
    expect(css).toContain('translate: calc(var(--moo-mx, 0) * 1px + 0px)');
    expect(css).toContain('filter: opacity(calc(var(--moo-mo, 1) * 1))');
  });
});
