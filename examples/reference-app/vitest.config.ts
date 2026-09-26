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
    // These suites drive REAL processes: http.test unconditionally runs
    // `vite build` then spawns the built server; browser.test conditionally
    // builds and drives a real Chromium. Run test FILES sequentially so two
    // beforeAll hooks can never race on the shared build/ and .svelte-kit/
    // output (a concurrent first build once truncated build/index.js mid-run,
    // making the spawned server exit 0 as an empty module on fresh clones).
    fileParallelism: false,
  },
});
