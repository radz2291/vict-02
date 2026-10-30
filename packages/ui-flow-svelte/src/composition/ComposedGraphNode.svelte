<script lang="ts">
  import { setContext, tick,onDestroy } from 'svelte';
  import { on } from 'svelte/events';
  import { useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  import { GRAPH_BODY, type GraphBodyContext, type GraphWorkspaceContext, type GraphWorkspaceNode } from './context.js';
  let {id,data,selected}:NodeProps=$props();
  const workspace=$derived(data.workspace as GraphWorkspaceContext);
  const node=$derived(data.node as GraphWorkspaceNode);
  const activeNode=$derived(workspace.graph.nodes.find(node=>node.id===id));
  let root=$state<HTMLElement>();
  let anchors=$state<Record<string, symbol[]>>({});
  const update=useUpdateNodeInternals();
  let mounted=true;
  onDestroy(()=>{mounted=false;});
  const remeasure=()=>{void tick().then(()=>{if(mounted)update(id);});};
  $effect(()=>{
    if(!root)return;
    // Bubble after authored controls and nested viewports, before this node's
    // outer XYFlow wrapper. Preserve their defaults and all non-arrow commands.
    return on(root,'keydown',event=>{
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))event.stopPropagation();
    });
  });
  setContext<GraphBodyContext>(GRAPH_BODY,{
    get nodeId(){return id;},
    get ports(){return workspace.ports(node);},
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
  {#if activeNode}{#if workspace.body}{@render workspace.body(workspace.frame(activeNode,String(data.projectionKey??'default')))}{:else}<p role="alert">This graph needs an authored node body.</p>{/if}{/if}
</div>
<style>
  .composed-graph-node{position:relative;color:var(--vict-color-text,inherit);min-width:0}
  .selected{outline:2px solid var(--vict-color-focusRing,#167d72);outline-offset:2px}
</style>
