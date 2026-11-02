import {fileURLToPath} from 'node:url';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {defineConfig} from 'vitest/config';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),plugins:[svelte()],resolve:{conditions:['browser']},test:{environment:'happy-dom',include:['*.test.ts'],maxWorkers:1,server:{deps:{inline:['bits-ui','runed','@internationalized/date']}}}});
