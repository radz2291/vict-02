import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,plugins:[svelte()],resolve:{conditions:['browser'],alias:[{find:/^@victframework\/ui$/,replacement:fileURLToPath(new URL('../../../ui/src/index.ts',import.meta.url))}]},server:{host:'127.0.0.27',port:5627,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../../',import.meta.url))]}}});
