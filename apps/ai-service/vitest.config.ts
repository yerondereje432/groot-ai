import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'evals/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        // Per spec §32: ≥ 80% on business logic.
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 70,
      },
    },
  },
});
