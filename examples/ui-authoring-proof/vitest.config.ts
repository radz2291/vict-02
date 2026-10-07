import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const resolveFromExample = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

/**
 * Two projects:
 * - the DOM project (happy-dom + svelte) for component/journey behavior;
 * - the server project (plain node) for the process-hosted product
 *   singleton, whose durable implementation loads the SQLite driver chain
 *   (Node builtins load natively there — never bundled).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['test/**/*.test.ts'],
          exclude: ['test/product-server.test.ts', 'test/durable-adapter.test.ts'],
        },
        resolve: {
          alias: [
            { find: '$lib', replacement: resolveFromExample('./src/lib') },
            {
              find: '$app/environment',
              replacement: resolveFromExample('./src/lib/app-environment-stub.ts'),
            },
          ],
          // Component mounting needs Svelte's CLIENT build in happy-dom tests.
          conditions: ['browser'],
        },
        plugins: [svelte()],
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['test/product-server.test.ts', 'test/durable-adapter.test.ts'],
        },
        resolve: {
          alias: [{ find: '$lib', replacement: resolveFromExample('./src/lib') }],
        },
      },
    ],
  },
});
