import { configDefaults, defineConfig } from 'vitest/config';
import { fontDataUri } from './fontDataUriPlugin';

export default defineConfig({
  plugins: [fontDataUri()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Browser-only suite, run by the "golden" project in vitest.workspace.ts.
    exclude: [...configDefaults.exclude, 'tests/golden/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**']
    }
  }
});
