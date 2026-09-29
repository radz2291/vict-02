import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/**
 * Studio's own test project (server boundary, adapter mapping, UI rendering
 * tests). It consumes workspace packages through their installed dist — the
 * real delivery path — not through root source aliases.
 */
export default defineConfig({
  // The sveltekit plugin is ADDITIVE (approved by the stage manager,
  // 2026-09-29): it only transforms when .svelte files enter a module
  // graph (UI render tests importing the component registry), so the
  // server track's node-environment tests are unaffected. DOM environments
  // are selected per file via the `@vitest-environment happy-dom` pragma.
  plugins: [sveltekit()],
  // 'browser' resolve condition (approved addendum #2): selects the Svelte
  // CLIENT runtime so `mount()` works in the happy-dom UI render tests
  // (same pattern as examples/reference-app/vitest.config.ts).
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
