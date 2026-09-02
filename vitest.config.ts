import { fileURLToPath } from 'node:url';
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
  '@vict/application/testing': resolveFromRoot('packages/application/src/testing.ts'),
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
        },
        resolve: { alias: aliases },
      },
      {
        test: {
          name: 'integration',
          include: ['examples/**/*.test.ts'],
          // The SvelteKit application proof runs its own DOM-level project
          // (examples/application-proof) with the svelte plugin — excluded
          // here so it is never double-run without its toolchain.
          exclude: ['examples/application-proof/**'],
        },
        resolve: { alias: aliases },
      },
    ],
  },
});
