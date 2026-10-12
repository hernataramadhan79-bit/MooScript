import { defineConfig } from 'vitest/config';
import { fontDataUri } from './fontDataUriPlugin';

export default defineConfig({
  plugins: [fontDataUri()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/engine/**']
    }
  }
});
