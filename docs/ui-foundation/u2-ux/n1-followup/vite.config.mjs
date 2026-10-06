import {svelte} from '@sveltejs/vite-plugin-svelte';
export default {root:import.meta.dirname,plugins:[svelte()],server:{host:'127.0.0.1',port:5200,strictPort:true,fs:{allow:['C:/Users/RZ1/Desktop/RZ/vict-02-u2-inspector-ux']}},resolve:{conditions:['browser']}};
