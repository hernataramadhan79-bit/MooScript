import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { USE_CASE_PILLARS } from '../../web/src/data/useCases';
import { findForeignApis, validateSceneCode } from '../src/engine/composition/validator';

// The website shows these snippets as copyable scene code, so they must use the real scene API.
const kitSource = fs.readFileSync(path.resolve(__dirname, '../src/engine/composition/runtime/mographKit.ts'), 'utf8');
const CTX_NAMES = new Set([
  ...Array.from(kitSource.matchAll(/\bctx\.(\w+)\s*=/g), (m) => m[1]),
  'dur',
  'stage',
  'rand',
  'at'
]);
const SHOT_METHODS = new Set(['go', 'arrive', 'travel', 'pin', 'mark', 'cue', 'nest']);

describe('website use-case code samples', () => {
  for (const pillar of USE_CASE_PILLARS) {
    it(`${pillar.slug} uses only MooScript's scene API`, () => {
      const code = pillar.codeSnippet;
      expect(findForeignApis(code)).toEqual([]);
      expect(validateSceneCode({ buildJs: code }).errors).toEqual([]);

      const ctxCalls = Array.from(code.matchAll(/\bctx\.(\w+)/g), (m) => m[1]);
      expect(ctxCalls.filter((name) => !CTX_NAMES.has(name))).toEqual([]);

      const shotCalls = Array.from(code.matchAll(/\bshot\.(\w+)/g), (m) => m[1]);
      expect(shotCalls.filter((name) => !SHOT_METHODS.has(name))).toEqual([]);
    });
  }
});
