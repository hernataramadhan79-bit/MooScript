import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRemixUrl, hasRemixHash, readRemixHash } from '../src/engine/share/remixLink';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import { useMooStore } from '../src/store/useMooStore';
import type { Scene } from '../src/types';

const scene = (narrationText: string, patch: Partial<Scene> = {}): Scene => ({
  id: narrationText,
  narrationText,
  durationInSeconds: 3,
  wordTimestamps: [],
  ...patch
});
const hashOf = (url: string) => url.slice(url.indexOf('#'));
const encode = (value: unknown) => `#remix=${btoa(JSON.stringify(value)).replace(/=+$/, '')}`;

describe('remix links', () => {
  it('round-trips the title and script, including non-ASCII text', () => {
    const url = buildRemixUrl({ title: 'Kopi ☕', scenes: [scene('Kopi lahir di Etiopia.'), scene('Café au lait é.')] }, 'https://x.test')!;
    expect(url.startsWith('https://x.test/#remix=')).toBe(true);
    expect(readRemixHash(hashOf(url))).toEqual({ title: 'Kopi ☕', lines: ['Kopi lahir di Etiopia.', 'Café au lait é.'] });
  });

  it('carries only the narration, never shot code or brand cards', () => {
    const url = buildRemixUrl({ title: 'A', scenes: [scene('Outro', { brandCard: 'outro' }), scene('Isi')] }, 'https://x.test')!;
    const decoded = readRemixHash(hashOf(url))!;
    expect(decoded.lines).toEqual(['Isi']);
    expect(Object.keys(decoded).sort()).toEqual(['lines', 'title']);
  });

  it('offers no link without a script or when it is too long', () => {
    expect(buildRemixUrl({ title: 'A', scenes: [scene('  ')] }, 'https://x.test')).toBeNull();
    expect(buildRemixUrl({ title: 'A', scenes: [scene('x'.repeat(301))] }, 'https://x.test')).toBeNull();
    expect(buildRemixUrl({ title: 'A', scenes: Array.from({ length: 31 }, (_, i) => scene(`b${i}`)) }, 'https://x.test')).toBeNull();
  });

  it('rejects broken or hostile links and caps what it accepts', () => {
    expect(readRemixHash('#other=1')).toBeNull();
    expect(readRemixHash('#remix=%%%')).toBeNull();
    expect(readRemixHash(encode({ l: 'text' }))).toBeNull();
    expect(readRemixHash(encode({ l: [1, null] }))).toBeNull();
    const read = readRemixHash(encode({ t: 5, l: ['ok', 7, 'y'.repeat(400), ...Array(40).fill('z')] }))!;
    expect(read.title).toBe('');
    expect(read.lines).toHaveLength(30);
    expect(read.lines[1]).toHaveLength(300);
    expect(hasRemixHash('#remix=abc')).toBe(true);
    expect(hasRemixHash('#x')).toBe(false);
  });
});

describe('opening a remix link', () => {
  const original = useMooStore.getState();
  afterEach(() => {
    useMooStore.setState({ generateBgmOnlyAudio: original.generateBgmOnlyAudio, play: original.play });
  });

  it('keeps a one-line script as written, with the shared title and no autoplay', async () => {
    const play = vi.fn();
    useMooStore.setState({
      project: { ...structuredClone(INITIAL_PROJECT), id: 'proj-remix' },
      isGeneratingScript: false,
      play,
      generateBgmOnlyAudio: vi.fn().mockResolvedValue(undefined)
    } as never);
    await useMooStore.getState().createInstantVideo('Kopi enak', { firstRun: true, asScript: true, title: 'Punya teman', autoplay: false });
    const { project } = useMooStore.getState();
    expect(project.title).toBe('Punya teman');
    expect(project.scenes.map((s) => s.narrationText)).toEqual(['Kopi enak']);
    expect(play).not.toHaveBeenCalled();
  });
});
