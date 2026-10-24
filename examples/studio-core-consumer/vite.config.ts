import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
const installation = JSON.parse(readFileSync(new URL('./installation.json', import.meta.url), 'utf8'));
// Public package exports only. No aliases, workspace links or Studio imports.
export default defineConfig({
  plugins: [svelte()],
  define: { __CONSUMER_SOURCE__: JSON.stringify(installation.sourceCandidate) },
  // elkjs/main targets Node and references an optional web-worker package.
  // The Flow package's optional layout API explicitly loads elk.bundled.js;
  // avoid eager crawling of its unused Node entry in this authored-Flow fixture.
  optimizeDeps: { exclude: ['elkjs', '@victframework/ui', '@victframework/ui-svelte', '@victframework/ui-editor', '@victframework/ui-ai-svelte', '@victframework/ui-flow-svelte', '@victframework/application', '@victframework/sdk', '@victframework/contracts'] },
});
