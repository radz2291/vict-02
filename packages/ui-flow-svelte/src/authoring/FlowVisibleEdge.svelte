<script lang="ts">
  import { getBezierPath, type EdgeProps } from '@xyflow/svelte';
  import type { FlowDeclaration } from './context.js';
  let { data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps = $props();
  const entry = $derived(data?.declaration as FlowDeclaration);
  const path = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }));
</script>
<g {...entry.target} class={`${entry.target.class} vict-authored-flow-edge`} class:selected>
  <path d={path[0]} fill="none" stroke={selected ? '#6366f1' : '#64748b'} stroke-width={selected ? 3 : 2} />
  <path d={path[0]} fill="none" stroke="transparent" stroke-width="18" class="interaction" />
  {#if entry.label}<text x={path[1]} y={path[2] - 7} text-anchor="middle" fill="currentColor" font-size="12">{entry.label}</text>{/if}
</g>
<style>.interaction { pointer-events: stroke; }</style>
