import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./__tests__/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
  },
});
