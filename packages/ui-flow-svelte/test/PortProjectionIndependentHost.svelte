<script lang="ts">
 import {setContext,untrack} from 'svelte';
 import {GRAPH_WORKSPACE,type GraphWorkspaceContext} from '../src/composition/context.js';
 import GraphViewport from '../src/composition/GraphViewport.svelte';
 let {workspace}:{workspace:GraphWorkspaceContext}=$props();
 setContext(GRAPH_WORKSPACE,untrack(()=>workspace));
</script>
<GraphViewport props={{label:'Independent callback boundary'}} occurrenceKey="independent"/>
