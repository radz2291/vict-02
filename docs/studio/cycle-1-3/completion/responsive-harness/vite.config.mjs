import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const root = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('../../../../../', import.meta.url));
export default defineConfig({
  root,
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  // Unlike Studio's production Rollup build, raw Vite dev imports do not turn
  // these UMD/CommonJS engines into ESM defaults unless explicitly prebundled.
  optimizeDeps: { noDiscovery: true, include: ['elkjs/lib/elk.bundled.js', '@dagrejs/dagre'] },
  server: { host: '127.0.0.5', port: 5599, strictPort: true, fs: { allow: [repository] } },
});
