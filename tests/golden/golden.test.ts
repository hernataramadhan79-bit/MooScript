/**
 * Golden frames: every corpus case is rendered in a real stage iframe and compared with the JSON
 * snapshot recorded from GSAP. MooTween runs the same corpus against the same snapshots, minus the
 * divergences each case documents. Record or refresh snapshots with `npm run test:golden -- -u`.
 */
import { describe, expect, inject, it } from 'vitest';
import { commands } from '@vitest/browser/context';
import { buildCorpus } from './corpus';
import { recordCase, serializeRecord, withMooTween, type GoldenCase, type GoldenRecord, type RecordOptions } from './harness';
import { compareRecords, formatMismatches, type Mismatch } from './compare';

const update = inject('goldenUpdate');
// GOLDEN_REPORT=1 writes every remaining mismatch to tests/golden/.report/<engine>/<case>.txt.
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
    throw new Error(`Missing golden snapshot ${file}. Record it with: npm run test:golden -- -u`);
  }
}

const ENGINES: Array<{ name: string; options: RecordOptions }> = [
  { name: 'gsap', options: {} },
  { name: 'mootween', options: { prepareDocument: withMooTween } }
];

for (const engine of ENGINES) {
  describe(`golden frames (${engine.name})`, () => {
    for (const c of corpus) {
      it(c.name, async () => {
        if (update && engine.name !== 'gsap') return;
        const actual = await recordCase(c, engine.options);

        if (update) {
          await commands.writeFile(`snapshots/${c.name}.json`, serializeRecord(actual));
          return;
        }

        const mooTween = engine.name === 'mootween';
        const expected = await loadSnapshot(mooTween && c.mooTweenReference ? c.mooTweenReference : c.name);
        const result = compareRecords(expected, actual);
        if (result.crossPlatform) {
          console.info(`[golden] ${c.name}: recorded on ${expected.env.platform}, running on ${actual.env.platform}; layout-dependent values skipped`);
        }
        const mismatches = mooTween ? result.mismatches.filter((m) => !allowed(c, actual, m)) : result.mismatches;
        if (report) {
          const lines = [...result.structural, ...formatMismatches(actual, mismatches, Infinity)];
          await commands.writeFile(`.report/${engine.name}/${c.name}.txt`, lines.join('\n') + '\n');
        }
        expect(actual.logs.filter((l) => !mooTween || !l.startsWith('warn: [MooTween]'))).toEqual(expected.logs);
        expect(result.structural).toEqual([]);
        expect(formatMismatches(actual, mismatches)).toEqual([]);
      });
    }
  });
}
