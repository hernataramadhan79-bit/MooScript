import { describe, expect, it } from 'vitest';
import { commands } from '@vitest/browser/context';
import { compareRecords, effectiveMatrix, sameValue } from './compare';
import type { GoldenRecord } from './harness';

const load = async (name: string): Promise<GoldenRecord> => JSON.parse(await commands.readFile(`snapshots/${name}.json`));

describe('golden comparator', () => {
  it('accepts a record compared with itself', async () => {
    const rec = await load('api-transforms');
    expect(compareRecords(rec, structuredClone(rec)).mismatches).toEqual([]);
  });

  it('reports a transform that drifts beyond 1e-3', async () => {
    const rec = await load('api-transforms');
    const drifted = structuredClone(rec);
    const frame = drifted.forward[10];
    const [id] = Object.entries(frame).find(([, p]) => p.transform && p.transform.startsWith('matrix(')) || [];
    expect(id).toBeTruthy();
    frame[id!].transform = frame[id!].transform.replace(/matrix\(([-\d.e]+)/, (_m, a) => `matrix(${Number(a) + 0.01}`);
    const mismatches = compareRecords(rec, drifted).mismatches;
    expect(mismatches.some((m) => m.element === id && m.prop === 'transform')).toBe(true);
  });

  it('applies the documented tolerances', () => {
    expect(sameValue('opacity', '0.5', '0.5008')).toBe(true);
    expect(sameValue('opacity', '0.5', '0.502')).toBe(false);
    expect(sameValue('color', 'rgb(10, 20, 30)', 'rgb(10.4, 20, 30)')).toBe(true);
    expect(sameValue('color', 'rgb(10, 20, 30)', 'rgb(11, 20, 30)')).toBe(false);
    expect(sameValue('clipPath', 'inset(10.0004% 0% 0% 0%)', 'inset(10% 0% 0% 0%)')).toBe(true);
    expect(sameValue('clipPath', 'inset(10% 0% 0% 0%)', 'circle(10% at 50% 50%)')).toBe(false);
  });

  it('judges CSS translate/scale/rotate by the matrix they produce', () => {
    const folded = effectiveMatrix({ transform: 'matrix(1, 0, 0, 1, 40, -60)', transformOrigin: '100px 50px' })!;
    const split = effectiveMatrix({ translate: '40px -60px', transformOrigin: '100px 50px' })!;
    expect(Array.from(folded.toFloat64Array())).toEqual(Array.from(split.toFloat64Array()));
  });

  it('accepts the same geometry spelled differently', () => {
    const frame = (props: Record<string, string>) => [{ '0': { transformOrigin: '100px 50px', ...props } }];
    const record = (props: Record<string, string>): GoldenRecord => ({
      version: 1,
      case: 'geometry',
      env: { platform: 'test', browser: 'test' },
      duration: 1,
      times: [0],
      posters: [],
      logs: [],
      elements: [{ id: '0', tag: 'div' }],
      forward: frame(props),
      backward: frame(props)
    });
    const folded = record({ transform: 'matrix(1.18832, 0.16701, -0.16701, 1.18832, 40, -60)' });
    const split = record({ translate: '40px -60px', scale: '1.2', rotate: '8deg' });
    expect(compareRecords(folded, split).mismatches).toEqual([]);
    expect(compareRecords(folded, record({ translate: '40px -60px', scale: '1.2', rotate: '9deg' })).mismatches.length).toBeGreaterThan(0);
  });

  // Why api-overrides-export is checked against the live snapshot: under GSAP, overrides baked into the
  // document (MP4 export, standalone HTML) were folded into its transform and overwritten by absolute
  // tweens, while the editor pushed them later with !important. The GSAP reference keeps that bug; the
  // golden suite proves MooTween renders the export like the editor.
  it('GSAP reference: baked overrides on animated layers differed from the editor', async () => {
    const baked = await load('api-overrides-export');
    const live = await load('api-overrides-live');
    const diverging = new Set(compareRecords(baked, live).mismatches.map((m) => m.element));
    // title (y + rotation lost), box (flipX turned into skew), icon (scale override lost)
    expect([...diverging].sort()).toEqual(['0.0.0.0', '0.0.0.1', '0.0.0.2']);
  });
});
