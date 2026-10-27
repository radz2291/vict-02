<script lang="ts">
  import { tick, untrack } from 'svelte';
  import {
    Handle,
    Position,
    useUpdateNodeInternals,
    type NodeProps,
  } from '@xyflow/svelte';
  import GraphFields from './GraphFields.svelte';
  import { MediaIcon } from '@victframework/ui-media-svelte';
  import type {
    GraphNode,
    GraphNodeType,
    GraphPort,
    GraphValue,
  } from './model.js';
  let { id, data, selected }: NodeProps = $props();
  const node = $derived(data.node as GraphNode),
    family = $derived(data.family as GraphNodeType),
    ports = $derived(data.ports as GraphPort[]);
  const update = useUpdateNodeInternals();
  const icon=$derived(node.icon??family.icon??{pack:'lucide',name:'sliders-horizontal',revision:'1.27.0'});
  $effect(() => {
    void node.collapsed;
    void family;
    void ports;
    let alive = true;
    void tick().then(() => {
      if (alive) untrack(() => update(id));
    });
    return () => {
      alive = false;
    };
  });
  const change = $derived(
    data.onField as (nodeId: string, fieldId: string, value: GraphValue) => void,
  );
  const collapse = $derived(
    data.onCollapse as (nodeId: string, collapsed: boolean) => void,
  );
  const trace = $derived(
    data.onTracePort as (nodeId: string, portId: string) => void,
  );
</script>
<article class="vict-rich-graph-node" class:selected data-graph-node={id} aria-label={node.label}>
  <header class="vict-graph-drag-handle"><div class="node-heading"><MediaIcon nodeId={`${id}/header-icon`} occurrenceKey={`${id}/header-icon`} props={{...icon,size:20,decorative:true}}/><span><strong>{node.label}</strong><small>{family.label}</small></span></div><button type="button" class="nodrag nopan" aria-label={`${node.collapsed?'Expand':'Collapse'} ${node.label}`} aria-expanded={!node.collapsed} onclick={event=>{event.stopPropagation();collapse(id,!node.collapsed);}}>{node.collapsed?'+':'-'}</button></header>
  <div class="port-list">
    {#each ports as port (port.id)}
      <div class:output={port.direction==='output'} class="port-row" data-port={port.id}>
        <Handle id={port.id} type={port.direction==='input'?'target':'source'} position={port.direction==='input'?Position.Left:Position.Right} isConnectable={data.readOnly!==true} aria-label={`${port.direction} ${port.label}: ${port.type}`} />
        <button type="button" class="nodrag nopan port-label" aria-label={`Trace ${node.label} ${port.label} connections`} onclick={event=>{event.stopPropagation();trace(id,port.id);}}>{port.label}</button><small>{port.type}</small>
      </div>
    {/each}
  </div>
  {#if !node.collapsed}<section class="node-body"><GraphFields owner={id} fields={family.fields} values={node.values} readOnly={data.readOnly===true} onchange={(fieldId,value)=>change(id,fieldId,value)} /></section>{/if}
</article>
<style>
  .node-heading{display:flex;align-items:center;gap:8px;min-width:0}
  .vict-rich-graph-node{width:280px;box-sizing:border-box;background:var(--vict-flow-node,#fff);color:var(--vict-flow-text,#172033);border:1px solid var(--vict-flow-border,#cbd5e1);border-radius:8px;font:13px/1.4 system-ui}.selected{outline:2px solid var(--vict-flow-focus,#4f46e5);outline-offset:2px}header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:grab;border-bottom:1px solid var(--vict-flow-border,#cbd5e1)}header span{display:grid;gap:2px;min-width:0}strong{font-size:13px;overflow-wrap:anywhere}small{font-size:11px;opacity:.7}button{min-width:28px;min-height:28px;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer}.node-body{padding:12px}.port-list{padding:6px 0}.port-row{position:relative;display:flex;align-items:center;gap:8px;min-height:26px;padding:0 12px;font-size:11px}.port-row.output{justify-content:flex-end}.port-row :global(.svelte-flow__handle){width:10px;height:10px;top:50%;background:var(--vict-flow-focus,#4f46e5)}
</style>
