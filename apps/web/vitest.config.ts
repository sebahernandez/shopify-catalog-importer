import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.ts on purpose: tests must not load the dev-server and plugin setup.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
