<script lang="ts">
 import {setContext,untrack} from 'svelte';
 import {GRAPH_BODY,GRAPH_WORKSPACE,type GraphWorkspaceContext} from '../src/composition/context.js';
 import GraphViewport from '../src/composition/GraphViewport.svelte';
 import GraphSurface from '../src/editor/GraphSurface.svelte';
 let {workspace,nested,retained=false,change}:{workspace:GraphWorkspaceContext;nested:boolean;retained?:boolean;change:(value:string)=>void}=$props();
 setContext(GRAPH_WORKSPACE,untrack(()=>workspace));
 if(nested)setContext(GRAPH_BODY,{nodeId:'outer',ports:[],readOnly:false,registerPort:()=>()=>{},uniquePort:()=>false});
</script>
{#if retained}<GraphSurface graph={JSON.stringify(workspace.graph)} ongraphchange={change}/>{:else}<GraphViewport props={{label:'Connect policy'}} occurrenceKey="connect-policy"/>{/if}
