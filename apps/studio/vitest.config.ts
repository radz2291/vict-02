import { defineConfig } from 'vitest/config';

/**
 * Studio's own test project (server boundary, adapter mapping, UI rendering
 * tests). It consumes workspace packages through their installed dist — the
 * real delivery path — not through root source aliases.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
