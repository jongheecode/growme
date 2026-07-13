import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    fileParallelism: false, // all files share one real Postgres DB with a blanket TRUNCATE per test
  },
});
