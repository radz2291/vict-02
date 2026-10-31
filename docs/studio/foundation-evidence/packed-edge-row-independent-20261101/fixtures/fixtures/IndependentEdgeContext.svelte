<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import { GRAPH_WORKSPACE, type GraphWorkspaceContext } from '@victframework/ui-flow-svelte';
  let { expose }: { expose: (context: GraphWorkspaceContext) => void } = $props();
  const context = getContext<GraphWorkspaceContext>(GRAPH_WORKSPACE);
  untrack(() => expose(context));
</script>
<span data-independent-context>Public workspace context</span>
