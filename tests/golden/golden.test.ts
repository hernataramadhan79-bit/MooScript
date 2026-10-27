/**
 * Golden frames: every corpus case is rendered in a real stage iframe and compared with the JSON
 * snapshot recorded from GSAP. Record or refresh snapshots with `npm run test:golden -- -u`.
 */
import { describe, expect, inject, it } from 'vitest';
import { commands } from '@vitest/browser/context';
import { buildCorpus } from './corpus';
import { recordCase, serializeRecord, type GoldenRecord } from './harness';
import { compareRecords, formatMismatches } from './compare';

const update = inject('goldenUpdate');

describe('golden frames', () => {
  for (const c of buildCorpus()) {
    it(c.name, async () => {
      const actual = await recordCase(c);
      const file = `snapshots/${c.name}.json`;

      if (update) {
        await commands.writeFile(file, serializeRecord(actual));
        return;
      }

      let expected: GoldenRecord;
      try {
        expected = JSON.parse(await commands.readFile(file));
      } catch {
        throw new Error(`Missing golden snapshot ${file}. Record it with: npm run test:golden -- -u`);
      }

      const result = compareRecords(expected, actual);
      if (result.crossPlatform) {
        console.info(`[golden] ${c.name}: recorded on ${expected.env.platform}, running on ${actual.env.platform}; layout-dependent values skipped`);
      }
      expect(actual.logs).toEqual(expected.logs);
      expect(result.structural).toEqual([]);
      expect(formatMismatches(actual, result.mismatches)).toEqual([]);
    });
  }
});
