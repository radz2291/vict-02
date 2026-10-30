import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'] },
  server: {
    host: '127.0.0.1',
    port: 5594,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../../..', import.meta.url))] },
  },
  optimizeDeps: {
    exclude: [
      '@victframework/ui-svelte',
      '@victframework/ui',
      '@victframework/application',
      '@victframework/contracts',
      '@victframework/ui-editor',
      '@victframework/ui-preview',
      '@victframework/sdk',
    ],
  },
});
