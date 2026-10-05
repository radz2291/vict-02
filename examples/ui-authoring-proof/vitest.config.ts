import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const resolveFromExample = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: '$lib', replacement: resolveFromExample('./src/lib') },
      {
        find: '$app/environment',
        replacement: resolveFromExample('./src/lib/app-environment-stub.ts'),
      },
    ],
  },
  plugins: [svelte()],
});
