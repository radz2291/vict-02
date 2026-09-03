import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

// Vitest resolves workspace package names directly to their TypeScript sources so
// tests exercise source without requiring a prior build. Longest prefixes first.
const aliases = {
  '@vict/kernel/testing': resolveFromRoot('packages/kernel/src/testing.ts'),
  '@vict/kernel': resolveFromRoot('packages/kernel/src/index.ts'),
  '@vict/contracts/zod': resolveFromRoot('packages/contracts/src/zod/index.ts'),
  '@vict/contracts': resolveFromRoot('packages/contracts/src/index.ts'),
  '@vict/runtime/testing': resolveFromRoot('packages/runtime/src/testing.ts'),
  '@vict/runtime': resolveFromRoot('packages/runtime/src/index.ts'),
  '@vict/store-sqlite': resolveFromRoot('packages/store-sqlite/src/index.ts'),
  '@vict/appdata-sqlite': resolveFromRoot('packages/appdata-sqlite/src/index.ts'),
  '@vict/renderer-svelte': resolveFromRoot('packages/renderer-svelte/src/index.ts'),
  '@vict/scaffolder': resolveFromRoot('packages/scaffolder/src/index.ts'),
  '@vict/application/testing': resolveFromRoot('packages/application/src/testing.ts'),
  '@vict/application/renderer': resolveFromRoot('packages/application/src/renderer.ts'),
  '@vict/application': resolveFromRoot('packages/application/src/index.ts'),
  '@vict/sdk/zod': resolveFromRoot('packages/sdk/src/zod.ts'),
  '@vict/sdk': resolveFromRoot('packages/sdk/src/index.ts'),
};

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/**/*.test.ts', 'packs/*/test/**/*.test.ts'],
          // The Svelte renderer package runs in its own DOM-level project
          // (svelte plugin + happy-dom) — never double-run without its
          // toolchain.
          exclude: ['packages/renderer-svelte/**'],
        },
        resolve: { alias: aliases },
      },
      {
        test: {
          name: 'renderer',
          include: ['packages/renderer-svelte/test/**/*.test.ts'],
          environment: 'happy-dom',
        },
        resolve: { alias: aliases, conditions: ['browser'] },
        plugins: [svelte()],
      },
      {
        test: {
          name: 'integration',
          include: ['examples/**/*.test.ts'],
          // The SvelteKit applications run their own DOM/browser-level
          // projects (svelte/sveltekit toolchain) — excluded here so they
          // are never double-run without their toolchains.
          exclude: ['examples/application-proof/**', 'examples/reference-app/**'],
        },
        resolve: { alias: aliases },
      },
    ],
  },
});
