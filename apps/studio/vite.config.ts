import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: [
      '@victframework/ui',
      '@victframework/ui-svelte',
      '@victframework/ui-editor',
      '@victframework/ui-preview',
      '@victframework/application',
      '@victframework/sdk',
      '@victframework/contracts',
    ],
  },
});
