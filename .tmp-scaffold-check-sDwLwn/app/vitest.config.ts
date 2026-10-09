import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte(), sveltekit()],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
