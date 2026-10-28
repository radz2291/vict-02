import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),plugins:[svelte()],server:{host:'127.0.0.29',port:5629,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../../',import.meta.url))]}},optimizeDeps:{exclude:['@xyflow/svelte']}});
