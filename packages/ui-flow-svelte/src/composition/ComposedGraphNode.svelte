<script lang="ts">
  import { setContext, tick,onDestroy } from 'svelte';
  import { useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  import type { GraphNode } from '../editor/model.js';
  import { graphPorts } from '../editor/model.js';
  import { GRAPH_BODY, type GraphBodyContext, type GraphWorkspaceContext } from './context.js';
  let {id,data,selected}:NodeProps=$props();
  const workspace=$derived(data.workspace as GraphWorkspaceContext);
  const node=$derived(data.node as GraphNode);
  let root:HTMLElement;
  let anchors=$state<Record<string, symbol[]>>({});
  const update=useUpdateNodeInternals();
  let mounted=true;
  onDestroy(()=>{mounted=false;});
  const remeasure=()=>{void tick().then(()=>{if(mounted)update(id);});};
  setContext<GraphBodyContext>(GRAPH_BODY,{
    get nodeId(){return id;},
    get ports(){return graphPorts(workspace.graph,node);},
    get readOnly(){return workspace.readOnly;},
    registerPort(id,token){anchors={...anchors,[id]:[...(anchors[id]??[]),token]};remeasure();return()=>{anchors={...anchors,[id]:(anchors[id]??[]).filter(item=>item!==token)};remeasure();};},
    uniquePort(id){return anchors[id]?.length===1;},
  });
  $effect(()=>{
    void node;let alive=true;
    void tick().then(()=>{if(alive)update(id);});
    const Observer=root?.ownerDocument.defaultView?.ResizeObserver;
    const observer=Observer?new Observer(()=>{if(alive)update(id);}):undefined;
    if(root)observer?.observe(root);
    return()=>{alive=false;observer?.disconnect();};
  });
</script>
<div bind:this={root} class:selected class="composed-graph-node" data-graph-node={id}>
  {#if workspace.body}{@render workspace.body(workspace.frame(node,String(data.projectionKey??'default')))}{:else}<p role="alert">This graph needs an authored node body.</p>{/if}
</div>
<style>
  .composed-graph-node{position:relative;color:var(--vict-color-text,inherit);min-width:0}
  .selected{outline:2px solid var(--vict-color-focusRing,#167d72);outline-offset:2px}
</style>
