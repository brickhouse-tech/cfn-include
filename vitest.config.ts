import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'dist/**/*.js'],
    },
    // Increase timeout for file I/O and HTTP tests
    testTimeout: 20000,
    // Run tests sequentially to avoid port conflicts and race conditions
    sequence: {
      concurrent: false,
    },
    // Retry flaky tests (HTTP tests may be flaky due to server timing)
    retry: 1,
  },
});
