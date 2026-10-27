import { defineWorkspace } from 'vitest/config';
import { fontDataUri } from './fontDataUriPlugin';

const updateGolden = process.env.GOLDEN_UPDATE === '1' || process.argv.includes('-u') || process.argv.includes('--update');

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: { name: 'unit' }
  },
  {
    // Golden frames need a real layout engine: computed transforms, SVG geometry, getBBox.
    plugins: [fontDataUri()],
    test: {
      name: 'golden',
      include: ['tests/golden/**/*.test.ts'],
      testTimeout: 60000,
      provide: { goldenUpdate: updateGolden },
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
