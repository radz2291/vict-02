import {svelte} from '@sveltejs/vite-plugin-svelte';
export default {root:new URL('../',import.meta.url).pathname.replace(/^\/C:/,'C:'),plugins:[svelte()],server:{host:'127.0.0.1',port:5199,strictPort:true,fs:{allow:['C:/Users/RZ1/Desktop/RZ/vict-02-u2-ux-recheck']}},resolve:{conditions:['browser']}};
