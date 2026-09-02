import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relative) => fileURLToPath(new URL(relative, import.meta.url));

// DOM-level tests: the svelte plugin compiles .svelte imports; happy-dom
// provides the DOM; the `browser` resolve condition selects Svelte's client
// runtime so `mount` is available. No network, no external services.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: resolveFromRoot('src/lib'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
