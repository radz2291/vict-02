import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

// Vitest resolves workspace package names directly to their TypeScript sources so
// tests exercise source without requiring a prior build. Longest prefixes first.
const aliases = {
  '@victframework/kernel/testing': resolveFromRoot('packages/kernel/src/testing.ts'),
  '@victframework/kernel': resolveFromRoot('packages/kernel/src/index.ts'),
  '@victframework/contracts/zod': resolveFromRoot('packages/contracts/src/zod/index.ts'),
  '@victframework/contracts': resolveFromRoot('packages/contracts/src/index.ts'),
  '@victframework/runtime/testing': resolveFromRoot('packages/runtime/src/testing.ts'),
  '@victframework/runtime': resolveFromRoot('packages/runtime/src/index.ts'),
  '@victframework/store-sqlite': resolveFromRoot('packages/store-sqlite/src/index.ts'),
  '@victframework/appdata-sqlite': resolveFromRoot('packages/appdata-sqlite/src/index.ts'),
  '@victframework/renderer-svelte': resolveFromRoot('packages/renderer-svelte/src/index.ts'),
  '@victframework/scaffolder': resolveFromRoot('packages/scaffolder/src/index.ts'),
  '@victframework/application/testing': resolveFromRoot('packages/application/src/testing.ts'),
  '@victframework/application/renderer': resolveFromRoot('packages/application/src/renderer.ts'),
  '@victframework/application': resolveFromRoot('packages/application/src/index.ts'),
  '@victframework/sdk/zod': resolveFromRoot('packages/sdk/src/zod.ts'),
  '@victframework/sdk': resolveFromRoot('packages/sdk/src/index.ts'),
  '@victframework/mastra': resolveFromRoot('packages/mastra/src/index.ts'),
  '@victframework/control': resolveFromRoot('packages/control/src/index.ts'),
  '@victframework/server': resolveFromRoot('packages/server/src/index.ts'),
  '@victframework/cli': resolveFromRoot('packages/cli/src/index.ts'),
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
          // toolchain. The Mastra adapter runs in its own project with a
          // network guard (its suites must fail on any unexpected network
          // request) — never double-run without that guard.
          exclude: ['packages/renderer-svelte/**', 'packages/mastra/**'],
        },
        resolve: { alias: aliases },
      },
      {
        test: {
          name: 'mastra',
          include: ['packages/mastra/test/**/*.test.ts'],
          // No setup file in this repo guards the network by default, so the
          // adapter project installs its own offline guard (below) that fails
          // the first unexpected socket/fetch attempt.
          // setupFiles: ['./packages/mastra/test/offline-guard.mjs'],
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
