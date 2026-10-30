import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SHOWCASE_PRESETS, getOfficialMooScriptPrompt } from '@mooscript/presets';
import { findForeignApis, validateGeneratedScene } from '../src/engine/composition/validator';
import { db } from '../src/db/mooDb';
import { useMooStore } from '../src/store/useMooStore';
import { resetDeepLinkGuard } from '../src/store/slices/settingsSlice';

describe('@mooscript/presets MooTween integrity', () => {
  it('validates every showcase preset shot as 100% pure MooTween with zero foreign/GSAP APIs', () => {
    expect(SHOWCASE_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of SHOWCASE_PRESETS) {
      expect(preset.shots.length).toBeGreaterThan(0);
      for (const shot of preset.shots) {
        expect(findForeignApis(shot.buildJs)).toEqual([]);
        const check = validateGeneratedScene({
          html: shot.html,
          css: shot.css,
          buildJs: shot.buildJs
        });
        expect(check.valid).toBe(true);
      }
    }
  });

  it('produces an official AI system prompt teaching MooTween and banning GSAP', () => {
    const promptEn = getOfficialMooScriptPrompt('en');
    const promptId = getOfficialMooScriptPrompt('id');
    expect(promptEn).toContain('function(shot, root, ctx, MooTween)');
    expect(promptEn).toContain('NEVER use GSAP syntax');
    expect(promptId).toContain('MooTween');
  });
});

describe('Deep-linking ?template=[slug] into Studio', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(async () => {
    resetDeepLinkGuard();
    await db.projects.clear();
    await useMooStore.getState().refreshProjectsList();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    resetDeepLinkGuard();
  });

  it('loads pre-compiled showcase scenes directly with status ok when createProjectFromTemplate is called', async () => {
    const id = await useMooStore.getState().createProjectFromTemplate('kinetic-typography');
    expect(id).not.toBe('');
    const { project } = useMooStore.getState();
    expect(project.aspectRatio).toBe('9:16');
    expect(project.composition?.scenes.length).toBe(2);
    expect(project.composition?.scenes.every((s) => s.status === 'ok' && s.buildJs.includes('ctx.camera'))).toBe(true);
  });

  it('auto-loads ?template=data-chart-animation during initStore and strips the query param cleanly', async () => {
    let replacedUrl = '';
    (globalThis as any).window = {
      ...(originalWindow || {}),
      location: {
        pathname: '/',
        search: '?template=data-chart-animation&utm=hero',
        hash: ''
      },
      history: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          replacedUrl = url;
          (globalThis as any).window.location.search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
        }
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    await useMooStore.getState().initStore();

    const { project, projectsList } = useMooStore.getState();
    expect(project.aspectRatio).toBe('16:9');
    expect(project.width).toBe(1920);
    expect(project.height).toBe(1080);
    expect(project.composition?.scenes[0]?.buildJs).toContain('ctx.count');
    expect(replacedUrl).toBe('/?utm=hero');

    const countAfterFirstInit = projectsList.length;
    await useMooStore.getState().initStore();
    expect(useMooStore.getState().projectsList.length).toBe(countAfterFirstInit);
  });
});
