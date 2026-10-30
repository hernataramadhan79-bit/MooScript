import { defineWorkspace } from 'vitest/config';
import { fontDataUri } from './fontDataUriPlugin';

const updateGolden = process.env.GOLDEN_UPDATE === '1' || process.argv.includes('-u') || process.argv.includes('--update');

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: { name: 'unit' }
  },
  {
    // Golden frames and MooTween need a real layout engine: computed transforms, SVG geometry, getBBox.
    plugins: [fontDataUri()],
    test: {
      name: 'browser',
      include: ['tests/golden/**/*.test.ts', 'tests/browser/**/*.test.ts'],
      testTimeout: 60000,
      provide: { goldenUpdate: updateGolden, goldenReport: process.env.GOLDEN_REPORT === '1' },
      browser: {
        enabled: true,
        provider: 'playwright',
        name: 'chromium',
        headless: true,
        screenshotFailures: false
      }
    }
  }
]);
