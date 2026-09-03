import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

// DOM-level and HTTP/browser tests: the sveltekit plugin compiles .svelte
// imports (including the linked @vict renderer sources) and provides
// $app/* modules; the `browser` resolve condition selects Svelte's client
// runtime so `mount` is available. Fully offline.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: resolveFromRoot('src/lib'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
