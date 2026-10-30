/**
 * The stage reports where the shots' code hits (for automatic sound effects), and the mixer renders
 * voice, music and sound effects into one track with the voice edit applied.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildCompositionDocument } from '../../src/engine/composition/buildDocument';
import { syncComposition } from '../../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../../src/store/slices/projectSlice';
import { mixProjectAudio } from '../../src/engine/audio/bgmMixer';
import type { MooProject } from '../../src/types';

let frame: HTMLIFrameElement | null = null;
afterEach(() => {
  frame?.remove();
  frame = null;
});

function project(): MooProject {
  const base = syncComposition({
    ...INITIAL_PROJECT,
    scenes: [
      { id: 'one', narrationText: '', durationInSeconds: 2, wordTimestamps: [] },
      { id: 'two', narrationText: '', durationInSeconds: 2, wordTimestamps: [] }
    ]
  });
  const code = (js: string) => ({
    html: '<div class="moo-camera"><div class="a" data-moo-layer="a" style="width:100px;height:100px;background:red"></div></div>',
    css: '',
    buildJs: js,
    status: 'ok' as const
  });
  return {
    ...base,
    composition: {
      ...base.composition!,
      scenes: [
        { ...base.composition!.scenes[0], ...code("ctx.camera({ move: 'push' });") },
        { ...base.composition!.scenes[1], ...code("ctx.pop('.a', { at: 0.5 }); ctx.punch('.a', { at: 1.2 }); ctx.pop('.a', { at: 3 });") }
      ]
    }
  };
}

describe('stage accents', () => {
  it('reports the hits of ctx.pop / ctx.punch on the film clock', async () => {
    frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:0;top:0;width:1080px;height:1920px;border:0;opacity:0';
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    const accents = await new Promise<{ time: number; kind: string }[]>((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.source === win && e.data?.type === 'ready') {
          window.removeEventListener('message', onMessage);
          resolve(e.data.accents);
        }
      };
      window.addEventListener('message', onMessage);
      frame!.srcdoc = buildCompositionDocument(project());
    });
    // The pop at 3 s is clamped inside the 2 s shot by the kit and lands just before its end.
    expect(accents.slice(0, 2)).toEqual([
      { kind: 'pop', time: 2.5 },
      { kind: 'impact', time: 3.2 }
    ]);
    expect(accents.every((a) => a.time >= 2 && a.time < 4)).toBe(true);
  });
});

describe('project mix', () => {
  it('mixes a trimmed, faded voice with music and sound effects over the whole film', async () => {
    const sr = 22050;
    const ctx = new OfflineAudioContext(1, sr * 2, sr);
    const voice = ctx.createBuffer(1, sr * 2, sr);
    voice.getChannelData(0).fill(0.25);
    const blob = await mixProjectAudio({
      voice,
      voiceEdit: { trimStart: 0.5, fadeOut: 0.2 },
      bgmPreset: 'lofi',
      bgmLevel: 0.2,
      duckRatio: 0.15,
      wordTimestamps: [{ start: 0.6, end: 1.4 }],
      sfxCues: [{ id: 's', time: 2.5, kind: 'impact' }],
      sfxLevel: 1,
      filmDuration: 3
    });
    expect(blob).not.toBeNull();
    const decoded = await new AudioContext().decodeAudioData(await blob!.arrayBuffer());
    expect(decoded.duration).toBeCloseTo(3, 1);
    const data = decoded.getChannelData(0);
    const at = (t: number) => Math.abs(data[Math.round(t * decoded.sampleRate)]);
    // The voice is 1.5 s long after the trim, so 2.5 s only carries music and the impact.
    expect(Math.max(...Array.from(data.slice(Math.round(2.45 * decoded.sampleRate), Math.round(2.6 * decoded.sampleRate)), Math.abs))).toBeGreaterThan(0.2);
    expect(at(0.7)).toBeGreaterThan(0.15);

    expect(
      await mixProjectAudio({
        voice: null,
        bgmPreset: 'none',
        bgmLevel: 0,
        duckRatio: 0,
        wordTimestamps: [],
        sfxCues: [],
        sfxLevel: 1,
        filmDuration: 3
      })
    ).toBeNull();
  });
});
