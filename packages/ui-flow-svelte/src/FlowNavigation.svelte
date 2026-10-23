<script lang="ts">
  import { untrack } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  let { request, ids = [] }: { request?: object; ids?: string[] } = $props();
  const { fitView } = useSvelteFlow();
  $effect(() => {
    if (!request) return;
    const targets = untrack(() => ids);
    // fitView reads and writes the Flow store. Only the explicit request is a
    // dependency; tracking store geometry here would continuously refit itself.
    untrack(() => { void fitView({ nodes: targets.length ? targets.map(id => ({ id })) : undefined, minZoom: .35, maxZoom: 1.1, duration: 200, padding: .2 }); });
  });
</script>
