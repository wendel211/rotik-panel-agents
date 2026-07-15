import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://rotik:rotik_dev_only@localhost:5432/rotik_test';
process.env.JWT_SECRET = 'rotik-test-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'fatal';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./test/globalSetup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/config/env.ts', 'src/shared/logger.ts', 'src/types/**'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
});
