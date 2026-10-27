import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  root: path('.'),
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      '@victframework/ui': path('../ui/src/index.ts'),
      '@victframework/ui-svelte': path('../ui-svelte/src/index.ts'),
      '@victframework/ui-media-svelte': path('../ui-media-svelte/src/index.ts'),
    },
  },
  test: { include: ['test/**/*.test.ts'], environment: 'happy-dom' },
});
