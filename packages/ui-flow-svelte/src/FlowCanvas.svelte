<script lang="ts">
  import { SvelteFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/svelte';
  import type { ComponentProps } from 'svelte';

  type Props = ComponentProps<typeof SvelteFlow> & {
    /** Optional convenience composition; use upstream parts directly for full control. */
    showControls?: boolean;
    showMiniMap?: boolean;
    showBackground?: boolean;
  };
  let {
    nodes = $bindable<Node[]>([]), edges = $bindable<Edge[]>([]),
    showControls = true, showMiniMap = true, showBackground = true,
    children, ...props
  }: Props = $props();
</script>

<SvelteFlow bind:nodes bind:edges {...props}>
  {#if showBackground}<Background />{/if}
  {#if showControls}<Controls />{/if}
  {#if showMiniMap}<MiniMap pannable zoomable />{/if}
  {@render children?.()}
</SvelteFlow>
