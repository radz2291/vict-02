import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    // The @victframework packages resolve through the QA worktree's root
    // node_modules (workspace links; the renderer/ui-svelte `svelte`
    // export condition serves their Svelte SOURCE for compilation).
    conditions: ['svelte', 'module', 'browser', 'development|production'],
  },
});
