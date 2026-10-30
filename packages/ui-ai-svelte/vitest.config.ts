import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root:fileURLToPath(new URL('.',import.meta.url)), plugins:[svelte()], resolve:{conditions:['browser'],alias:[{find:/^@victframework\/ui$/,replacement:fileURLToPath(new URL('../ui/src/index.ts',import.meta.url))}]}, test:{environment:'happy-dom',include:['test/**/*.test.ts'],exclude:['test/capture*.test.ts'],server:{deps:{inline:['bits-ui','runed','@internationalized/date','@xyflow/svelte','@lucide/svelte','@shadcn-svelte/primitives']}},testTimeout:30000} });
