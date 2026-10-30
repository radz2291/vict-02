import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte()],optimizeDeps:{exclude:['@victframework/ui-ai-svelte','@victframework/ui-flow-svelte']}});
