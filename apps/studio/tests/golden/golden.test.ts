/**
 * Golden frames: every corpus case is rendered in a real stage iframe (now running MooTween) and
 * compared with its JSON snapshot, minus the divergences the case documents.
 *
 * The snapshots are the GSAP reference recorded before the migration; GSAP is no longer installed, so
 * `-u` records with MooTween. Only refresh a case on purpose, e.g.
 * `npm run test:golden -- -u -t transition-` after changing the transitions.
 */
import { describe, expect, inject, it } from 'vitest';
import { commands } from '@vitest/browser/context';
import { buildCorpus } from './corpus';
import { recordCase, serializeRecord, type GoldenCase, type GoldenRecord } from './harness';
import { compareRecords, formatMismatches, type Mismatch } from './compare';

const update = inject('goldenUpdate');
// GOLDEN_REPORT=1 writes every remaining mismatch to tests/golden/.report/<case>.txt.
const report = inject('goldenReport');
const corpus = buildCorpus();

function allowed(c: GoldenCase, record: GoldenRecord, m: Mismatch): boolean {
  const el = record.elements.find((e) => e.id === m.element);
  return (c.divergences || []).some((d) => {
    if (d.prop && d.prop !== m.prop) return false;
    if (d.from !== undefined && m.time < d.from) return false;
    if (d.to !== undefined && m.time > d.to) return false;
    if (!d.element) return true;
    return d.element === m.element || d.element === el?.layer || (el?.cls || '').split(/\s+/).includes(d.element);
  });
}

async function loadSnapshot(name: string): Promise<GoldenRecord> {
  const file = `snapshots/${name}.json`;
  try {
    return JSON.parse(await commands.readFile(file));
  } catch {
    throw new Error(`Missing golden snapshot ${file}. Record it with: npm run test:golden -- -u -t ${name}`);
  }
}

describe('golden frames', () => {
  for (const c of corpus) {
    it(c.name, async () => {
      const actual = await recordCase(c);

      if (update) {
        await commands.writeFile(`snapshots/${c.name}.json`, serializeRecord(actual));
        return;
      }

      const expected = await loadSnapshot(c.mooTweenReference || c.name);
      const result = compareRecords(expected, actual);
      if (result.crossPlatform) {
        console.info(`[golden] ${c.name}: recorded on ${expected.env.platform}, running on ${actual.env.platform}; layout-dependent values skipped`);
      }
      const mismatches = result.mismatches.filter((m) => !allowed(c, actual, m));
      if (report) {
        const lines = [...result.structural, ...formatMismatches(actual, mismatches, Infinity)];
        await commands.writeFile(`.report/${c.name}.txt`, lines.join('\n') + '\n');
      }
      expect(actual.logs.filter((l) => !l.startsWith('warn: [MooTween]'))).toEqual(expected.logs);
      expect(result.structural).toEqual([]);
      expect(formatMismatches(actual, mismatches)).toEqual([]);
    });
  }
});
