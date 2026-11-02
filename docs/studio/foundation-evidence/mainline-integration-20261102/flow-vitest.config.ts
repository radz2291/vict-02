import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Integration evidence harness; public workspace exports, no source aliases.
export default defineConfig({
  root: process.cwd(),
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'happy-dom',
    include: ['packages/ui-flow-svelte/test/**/*.svelte.test.ts'],
    maxWorkers: 2,
    server: { deps: { inline: ['@xyflow/svelte', 'bits-ui', 'runed', '@internationalized/date', '@lucide/svelte', '@shadcn-svelte/primitives'] } },
  },
});
