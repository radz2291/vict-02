<script lang="ts">
  import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
  import type { RoutedEdgeData } from './layout.js';
  let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }: EdgeProps = $props();
  // Moving a node invalidates its old route. Fall back until the next layout.
  const path = $derived.by(() => {
    const route = (data as RoutedEdgeData | undefined)?.route;
    if (route?.length && Math.abs(route[0]!.x - sourceX) < 3 && Math.abs(route[0]!.y - sourceY) < 3 && Math.abs(route.at(-1)!.x - targetX) < 3 && Math.abs(route.at(-1)!.y - targetY) < 3)
      return route.map((point, index) => `${index ? 'L' : 'M'} ${point.x},${point.y}`).join(' ');
    return getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })[0];
  });
</script>
<BaseEdge {id} {path} {markerEnd} {style} />
