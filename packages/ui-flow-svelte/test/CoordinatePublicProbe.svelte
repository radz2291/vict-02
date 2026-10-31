<script lang="ts">
 import {onMount} from 'svelte';
 import {useSvelteFlow} from '@xyflow/svelte';
 let {register}:{register:(api:ReturnType<typeof useSvelteFlow>)=>void}=$props();
 const api=useSvelteFlow();onMount(()=>register(api));
</script>
