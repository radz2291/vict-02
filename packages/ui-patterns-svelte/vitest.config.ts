import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  root: path('.'),
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: [
      {find: '@victframework/ui-svelte/catalog/button', replacement: path('../ui-svelte/src/catalog/button.ts')},
      {find: '@victframework/ui-svelte/catalog/dialog', replacement: path('../ui-svelte/src/catalog/dialog.ts')},
      {find: /^@victframework\/ui$/, replacement: path('../ui/src/index.ts')},
      {find: /^@victframework\/ui-svelte$/, replacement: path('../ui-svelte/src/index.ts')},
      {find: /^@victframework\/ui-media-svelte$/, replacement: path('../ui-media-svelte/src/index.ts')},
    ],
  },
  test: {
    include: ['test/**/*.test.ts'], environment: 'happy-dom',
    server: {deps: {inline: ['bits-ui', 'runed', '@internationalized/date', '@lucide/svelte']}},
  },
});
