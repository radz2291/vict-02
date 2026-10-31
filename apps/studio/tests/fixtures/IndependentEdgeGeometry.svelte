<script lang="ts">
  // Deliberate white-box geometry probe, distinct from public API consumer tests.
  import Edge from '../../../../packages/ui-flow-svelte/src/composition/ComposedGraphEdge.svelte';
  import { Position, type GraphEdgeAppearance } from '@victframework/ui-flow-svelte';
  let { appearance }: { appearance: Required<GraphEdgeAppearance> } = $props();
</script>
<svg xmlns="http://www.w3.org/2000/svg"><g data-independent-marker-owner>
  <Edge id="same-edge" source="a" target="b" sourceX={12} sourceY={20} targetX={300} targetY={180} sourcePosition={Position.Right} targetPosition={Position.Left} data={{appearance,readOnly:true}}/>
</g></svg>
