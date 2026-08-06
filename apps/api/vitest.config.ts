import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@pp/api',
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
