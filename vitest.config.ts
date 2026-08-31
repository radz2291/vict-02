import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

// Vitest resolves workspace package names directly to their TypeScript sources so
// tests exercise source without requiring a prior build. Longest prefixes first.
const aliases = {
  '@vict/kernel/testing': resolveFromRoot('packages/kernel/src/testing.ts'),
  '@vict/kernel': resolveFromRoot('packages/kernel/src/index.ts'),
  '@vict/contracts': resolveFromRoot('packages/contracts/src/index.ts'),
  '@vict/runtime': resolveFromRoot('packages/runtime/src/index.ts'),
  '@vict/sdk': resolveFromRoot('packages/sdk/src/index.ts'),
};

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/**/*.test.ts'],
        },
        resolve: { alias: aliases },
      },
      {
        test: {
          name: 'integration',
          include: ['examples/**/*.test.ts'],
        },
        resolve: { alias: aliases },
      },
    ],
  },
});
