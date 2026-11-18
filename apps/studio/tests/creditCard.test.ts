import { describe, expect, it } from 'vitest';
import {
  CREDIT_SCENE_ID,
  CREDIT_SECONDS,
  creditCardEnabled,
  creditSeconds,
  shareCaption,
  withCreditCard
} from '../src/engine/brand/creditCard';
import { buildInstantStoryboard } from '../src/engine/ai/instantStoryboard';
import { compileProceduralProject } from '../src/engine/composition/proceduralCompiler';
import { buildCompositionDocument } from '../src/engine/composition/buildDocument';
import { syncComposition } from '../src/engine/composition/sync';
import { INITIAL_PROJECT } from '../src/store/slices/projectSlice';
import type { MooProject } from '../src/types';

const project = (patch: Partial<MooProject> = {}): MooProject =>
  compileProceduralProject(
    syncComposition({
      ...structuredClone(INITIAL_PROJECT),
      scenes: buildInstantStoryboard('sejarah kopi', 1)!.scenes,
      ...patch
    })
  );

describe('credit card', () => {
  it('is added last to the exported copy only', () => {
    const source = project();
    const scenes = source.scenes.length;
    const exported = withCreditCard(source);
    expect(exported.scenes.at(-1)?.id).toBe(CREDIT_SCENE_ID);
    expect(exported.composition?.scenes.at(-1)?.status).toBe('ok');
    expect(exported.scenes.at(-1)?.hideSubtitles).toBe(true);
    expect(creditSeconds(exported)).toBe(CREDIT_SECONDS);
    expect(source.scenes).toHaveLength(scenes);
    expect(creditSeconds(source)).toBe(0);
  });

  it('renders in the composition document', () => {
    const doc = buildCompositionDocument(withCreditCard(project()));
    expect(doc).toContain('moo-credit-name');
    expect(doc).toContain('mooscript.web.id');
  });

  it('can be turned off, and is off by default for branded projects', () => {
    const off = project({ exportSettings: { format: 'mp4', fps: 30, quality: 'standard', creditCard: false } });
    expect(withCreditCard(off).scenes).toHaveLength(off.scenes.length);
    expect(creditCardEnabled({ brand: {} as MooProject['brand'] })).toBe(false);
    expect(creditCardEnabled({ brand: {} as MooProject['brand'], exportSettings: { format: 'mp4', fps: 30, quality: 'standard', creditCard: true } })).toBe(true);
  });

  it('stays out of transparent exports and empty projects', () => {
    const source = project();
    expect(withCreditCard(source, { transparent: true })).toBe(source);
    const empty = structuredClone(INITIAL_PROJECT);
    expect(withCreditCard(empty)).toBe(empty);
  });

  it('writes a caption with the title and link', () => {
    expect(shareCaption(' Sejarah kopi ')).toBe('Sejarah kopi\n\nDibuat dengan MooScript: https://mooscript.web.id');
  });
});
