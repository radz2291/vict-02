import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Multi-entry: the AUTHORING workbench (index.html) and the FINISHED
// application (app.html) build as separate bundles — the finished bundle
// imports no authoring machinery (bundle separation, handoff §6).
// The @victframework packages ship Svelte source consumed through their
// public exports; they must bypass Vite's esbuild dep optimizer (it cannot
// process the packages' .svelte.ts modules) and compile through the svelte
// plugin instead — same as any workspace-linked checkout.
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    exclude: [
      '@victframework/ui',
      '@victframework/ui-svelte',
      '@victframework/ui-editor',
      '@victframework/ui-preview',
      '@victframework/application',
      '@victframework/sdk',
    ],
  },
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
