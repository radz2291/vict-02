import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Multi-entry: the AUTHORING workbench (index.html) and the FINISHED
// application (app.html) build as separate bundles — the finished bundle
// imports no authoring machinery (bundle separation, handoff §6).
export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        authoring: new URL('./index.html', import.meta.url).pathname,
        app: new URL('./app.html', import.meta.url).pathname,
      },
    },
  },
  test: {
    environment: 'happy-dom',
  },
});
