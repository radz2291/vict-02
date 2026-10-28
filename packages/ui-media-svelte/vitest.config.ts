import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: { '@victframework/ui': fileURLToPath(new URL('../ui/src/index.ts', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          disableIframePageLoading: true,
          disableCSSFileLoading: true,
          disableJavaScriptFileLoading: true,
        },
      },
    },
    include: ['packages/ui-media-svelte/test/**/*.test.ts'],
    server: { deps: { inline: ['bits-ui', 'runed', '@internationalized/date', '@lucide/svelte'] } },
  },
});
