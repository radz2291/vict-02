import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      '@victframework/ui': fileURLToPath(new URL('../ui/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: [
      'packages/ui-flow-svelte/test/**/*.svelte.test.ts',
      'packages/ui-ai-svelte/test/**/*.svelte.test.ts',
    ],
    server: {
      deps: {
        inline: [
          '@xyflow/svelte',
          '@lucide/svelte',
          '@shadcn-svelte/primitives',
          'svelte-streamdown',
          'svelte-toolbelt',
          'bits-ui',
          'runed',
          '@internationalized/date',
        ],
      },
    },
  },
});
