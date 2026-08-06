import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@pp/contracts',
    environment: 'node',
    passWithNoTests: true,
  },
});
