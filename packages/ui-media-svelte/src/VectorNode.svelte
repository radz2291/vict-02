<script lang="ts">
  import type {VectorNode as Node} from './vectors.js';
  import VectorNode from './VectorNode.svelte';
  let {node}:{node:Node}=$props();
</script>
<svelte:element this={node.tag} {...node.attributes} xmlns="http://www.w3.org/2000/svg">
  {#each node.children??[] as child}<VectorNode node={child}/>{/each}
</svelte:element>
