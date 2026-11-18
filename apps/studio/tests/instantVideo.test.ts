import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildInstantStoryboard } from '../src/engine/ai/instantStoryboard';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import { useMooStore } from '../src/store/useMooStore';
import { compileProceduralScene } from '../src/engine/composition/proceduralCompiler';
import { setLocale } from '../src/i18n';
import type { MooProject, Scene } from '../src/types';

const narration = (input: string) => buildInstantStoryboard(input, 1)!.scenes.map((s) => s.narrationText);
const wordCount = (s: string) => s.trim().split(/\s+/).length;

describe('buildInstantStoryboard', () => {
  afterEach(() => setLocale('id'));

  it('returns nothing for empty input', () => {
    expect(buildInstantStoryboard('   \n ')).toBeNull();
    expect(buildInstantStoryboard('?!')).toBeNull();
  });

  it('turns a short topic into an outline that names it', () => {
    const board = buildInstantStoryboard('sejarah kopi.', 1)!;
    expect(board.isOutline).toBe(true);
    expect(board.title).toBe('Sejarah kopi');
    expect(board.scenes).toHaveLength(5);
    expect(board.scenes[0].narrationText).toContain('sejarah kopi?');
    expect(board.scenes.every((s) => s.durationInSeconds > 0 && s.wordTimestamps.length > 0)).toBe(true);
    expect(new Set(board.scenes.map((s) => s.id)).size).toBe(5);
  });

  it('writes the outline in the interface language', () => {
    setLocale('en');
    expect(narration('coffee history')[0]).toBe('What should you know about coffee history?');
  });

  it('keeps every word of a script, in order', () => {
    const script =
      'Kopi pertama kali ditemukan di Etiopia. Lalu menyebar ke Yaman, Turki, dan Eropa dalam beberapa abad yang panjang sekali dan penuh cerita menarik untuk disimak semua orang. Ya. Sekarang kopi diminum di seluruh dunia.';
    const board = buildInstantStoryboard(script, 1)!;
    expect(board.isOutline).toBe(false);
    expect(board.scenes.map((s) => s.narrationText).join(' ')).toBe(script);
    expect(board.scenes.every((s) => wordCount(s.narrationText!) <= 22)).toBe(true);
    expect(board.scenes.every((s) => wordCount(s.narrationText!) >= 3)).toBe(true);
  });

  it('breaks one long sentence into several shots', () => {
    const lines = narration('Menabung itu mudah kalau kamu mulai dari jumlah kecil, lalu menambahnya sedikit demi sedikit setiap bulan');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => wordCount(l) <= 9)).toBe(true);
  });

  it('never prints a whole narration as the small shot label', () => {
    const board = buildInstantStoryboard('Satu dua tiga empat. Lima enam tujuh delapan. Sembilan sepuluh sebelas dua belas.', 1)!;
    expect(board.scenes.map((s) => s.visualIntent)).toEqual(['Pembuka', 'Bagian 2', 'Penutup']);
  });
});

describe('large type on instant visuals', () => {
  const line = 'Pertama, pahami dulu dasar menabung untuk masa depan keluarga kecilmu';
  const scene = (patch: Partial<Scene> = {}): Scene => ({
    id: 'sc-1',
    narrationText: line,
    text: line,
    visualIntent: 'Bagian 2',
    durationInSeconds: 4,
    wordTimestamps: [],
    largeType: true,
    ...patch
  });

  afterEach(() => setLocale('id'));

  it('shows the whole line once, in phone-sized type', () => {
    const mod = compileProceduralScene(scene(), 1, 5, undefined, 'bento-list');
    expect(mod.html).toContain(line);
    expect(mod.html).not.toContain('-bento-item');
    expect(mod.css).toMatch(/-bento-title[^{]*\{\s*font-size: \d{2,3}px/);
    expect(mod.instantArchetype).toBe('bento-list');
  });

  it('labels shots with the scene label, not fixed Indonesian text', () => {
    setLocale('en');
    const { scenes } = buildInstantStoryboard('First line goes here. Second line goes here. Third line goes here.', 1)!;
    const mod = compileProceduralScene(scenes[1], 1, 3, undefined, 'bento-list');
    expect(mod.html).toContain('PART 2');
    expect(mod.html).not.toContain('POIN KUNCI');
  });

  it('leaves other instant visuals exactly as they were', () => {
    const plain = compileProceduralScene(scene({ largeType: undefined }), 1, 5, undefined, 'bento-list');
    expect(plain.html).toContain('POIN KUNCI • 02 / 05');
    expect(plain.html).toContain('-bento-item');
    expect(plain.css).not.toContain('text-wrap: balance');
    expect(plain.instantArchetype).toBeUndefined();
  });
});

describe('editing the text of an instant video', () => {
  const build = async () => {
    useMooStore.setState({
      project: { ...structuredClone(INITIAL_PROJECT), id: 'proj-edit' },
      isGeneratingScript: false,
      generateBgmOnlyAudio: vi.fn().mockResolvedValue(undefined)
    } as never);
    await useMooStore.getState().createInstantVideo('sejarah kopi');
    return useMooStore.getState().project;
  };
  const original = useMooStore.getState().generateBgmOnlyAudio;
  afterEach(() => useMooStore.setState({ generateBgmOnlyAudio: original }));

  it('updates the picture in the same layout and keeps layer tweaks', async () => {
    const before = await build();
    const id = before.scenes[1].id;
    const mod = before.composition!.scenes[1];
    useMooStore.setState({
      project: {
        ...before,
        composition: {
          ...before.composition!,
          scenes: before.composition!.scenes.map((m) => (m.id === id ? { ...m, overrides: { Headline: { x: 20 } } } : m))
        }
      }
    });

    useMooStore.getState().updateSceneText(id, 'Kopi lahir di Etiopia');
    const after = useMooStore.getState().project.composition!.scenes[1];
    expect(after.html).toContain('Kopi lahir di Etiopia');
    expect(after.instantArchetype).toBe(mod.instantArchetype);
    expect(after.overrides).toEqual({ Headline: { x: 20 } });
  });

  it('never overwrites a shot the user edited', async () => {
    const before = await build();
    const id = before.scenes[1].id;
    useMooStore.setState({
      project: {
        ...before,
        composition: {
          ...before.composition!,
          scenes: before.composition!.scenes.map((m) => (m.id === id ? { ...m, html: '<div>mine</div>', userEdited: true } : m))
        }
      }
    });
    useMooStore.getState().updateSceneText(id, 'Teks baru');
    expect(useMooStore.getState().project.composition!.scenes[1].html).toBe('<div>mine</div>');
  });
});

describe('createInstantVideo', () => {
  const start = (patch: Partial<MooProject> = {}) => {
    const project = { ...structuredClone(INITIAL_PROJECT), id: 'proj-instant', ...patch };
    useMooStore.setState({ project, isGeneratingScript: false, previousScenesSnapshot: null, isPlaying: false });
    return project;
  };
  let mix: ReturnType<typeof vi.fn>;
  let play: ReturnType<typeof vi.fn>;
  let createNewProject: ReturnType<typeof vi.fn>;
  const original = useMooStore.getState();

  beforeEach(() => {
    mix = vi.fn().mockResolvedValue(undefined);
    play = vi.fn();
    createNewProject = vi.fn().mockResolvedValue('new');
    useMooStore.setState({ generateBgmOnlyAudio: mix, play, createNewProject } as never);
  });

  afterEach(() => {
    useMooStore.setState({
      generateBgmOnlyAudio: original.generateBgmOnlyAudio,
      play: original.play,
      createNewProject: original.createNewProject
    });
  });

  it('builds finished visuals without any API key', async () => {
    start();
    expect(useMooStore.getState().settings.apiKeys.gemini || '').toBe('');
    expect(await useMooStore.getState().createInstantVideo('sejarah kopi', { firstRun: true })).toBe(true);

    const { project } = useMooStore.getState();
    expect(project.title).toBe('Sejarah kopi');
    expect(project.scenes).toHaveLength(5);
    expect(project.composition?.scenes).toHaveLength(5);
    expect(project.composition?.scenes.every((m) => m.status === 'ok' && m.html.trim().length > 0)).toBe(true);
    expect(project.bgm.preset).toBe('lofi');
    expect(mix).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
    expect(createNewProject).not.toHaveBeenCalled();
  });

  it('replaces scenes in the editor as one undoable step, leaving music and playback alone', async () => {
    const before = start();
    await useMooStore.getState().createInstantVideo('sejarah kopi');
    const state = useMooStore.getState();
    expect(state.previousScenesSnapshot).toEqual(before.scenes);
    expect(state.project.bgm.preset).toBe('none');
    expect(play).not.toHaveBeenCalled();
  });

  it('opens a new project on first run instead of overwriting existing scenes', async () => {
    start();
    await useMooStore.getState().createInstantVideo('sejarah kopi');
    await useMooStore.getState().createInstantVideo('tips tidur', { firstRun: true });
    expect(createNewProject).toHaveBeenCalledWith('Tips tidur');
  });

  it('does nothing for empty input or while the AI is writing', async () => {
    const before = start();
    expect(await useMooStore.getState().createInstantVideo('  ')).toBe(false);
    useMooStore.setState({ isGeneratingScript: true });
    expect(await useMooStore.getState().createInstantVideo('sejarah kopi')).toBe(false);
    expect(useMooStore.getState().project.scenes).toEqual(before.scenes);
  });
});
