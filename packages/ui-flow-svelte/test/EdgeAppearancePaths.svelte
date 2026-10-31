<script lang="ts">
 import ComposedGraphEdge from '../src/composition/ComposedGraphEdge.svelte';
 import {Position} from '@xyflow/svelte';
 import type {GraphEdgeAppearance} from '../src/editor/model-v3.js';
 let {appearance}:{appearance:Required<GraphEdgeAppearance>}=$props();
</script>
<svg xmlns="http://www.w3.org/2000/svg">
 {#each [1,2,3] as occurrence}
  <g data-test-occurrence={occurrence}>
   <ComposedGraphEdge id="same-edge-id" source="a" target="b" sourceX={10} sourceY={20} targetX={200} targetY={120} sourcePosition={Position.Right} targetPosition={Position.Left} data={{appearance}}/>
  </g>
 {/each}
</svg>
