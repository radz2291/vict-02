<script lang="ts">
  import SourceNode from '../../../../../packages/ui-flow-svelte/src/SourceNode.svelte';
  let direction = $state('DOWN');
  let selected = $state(false);
</script>
<button type="button" onclick={() => direction = direction === 'DOWN' ? 'RIGHT' : 'DOWN'}>Change orientation</button>
<button type="button" onclick={() => selected = !selected}>Change selection</button>
<SourceNode id="orientation-node" data={{ label: 'Orientation fixture', kind: 'node', direction }} {selected}
  type="source" dragging={false} draggable={false} selectable={false} deletable={false} isConnectable={false} zIndex={0} positionAbsoluteX={0} positionAbsoluteY={0} />
