import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

// Vitest resolves the workspace packages directly to their TypeScript sources
// (same alias map the repository root config uses) so the showcase tests
// exercise the real renderer source without a prior build.
const aliases = {
  '@victframework/application/renderer': resolveFromRoot(
    '../../packages/application/src/renderer.ts',
  ),
  '@victframework/application': resolveFromRoot('../../packages/application/src/index.ts'),
  '@victframework/sdk': resolveFromRoot('../../packages/sdk/src/index.ts'),
  '@victframework/runtime': resolveFromRoot('../../packages/runtime/src/index.ts'),
  '@victframework/ui': resolveFromRoot('../../packages/ui/src/index.ts'),
  '@victframework/ui-svelte': resolveFromRoot('../../packages/ui-svelte/src/index.ts'),
  '@victframework/renderer-svelte': resolveFromRoot('../../packages/renderer-svelte/src/index.ts'),
};

// DOM-level and browser tests: the sveltekit plugin compiles .svelte imports
// (including the linked @victframework renderer sources) and provides the
// $app/* modules; the `browser` resolve condition selects Svelte's client
// runtime so `mount` is available. Fully offline.
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    conditions: ['browser'],
    alias: aliases,
  },
  test: {
    environment: 'happy-dom',
    server: { deps: { inline: ['bits-ui', 'runed', '@internationalized/date'] } },
    include: ['test/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 480_000,
    // The browser scenario builds the app and drives a real Chromium; test
    // FILES run sequentially so two beforeAll hooks can never race on the
    // shared build/ and .svelte-kit/ output (same protection the reference
    // application carries since its fresh-clone build race was fixed).
    fileParallelism: false,
  },
});
