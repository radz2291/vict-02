<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/svelte';
  import { Button, type UiComponentPresentation } from '@victframework/ui-svelte';
  import { MediaIcon } from '@victframework/ui-media-svelte';
  import GraphFields from './GraphFields.svelte';
  import type { GraphNode, GraphNodeType, GraphPort, GraphValue } from './model.js';
  let { id, data, selected }: NodeProps = $props();
  const node = $derived(data.node as GraphNode),
    family = $derived(data.family as GraphNodeType),
    ports = $derived(data.ports as GraphPort[]);
  const presentation = $derived(data.presentation as UiComponentPresentation | undefined);
  const actionPresentation = (label: string) => ({ class: 'nodrag nopan', 'aria-label': label });
  const update = useUpdateNodeInternals();
  const icon = $derived(node.icon ?? family.icon ?? {pack:'lucide',name:'sliders-horizontal',revision:'1.27.0'});
  $effect(() => {
    void node.collapsed; void family; void ports;
    let alive = true;
    void tick().then(() => { if (alive) untrack(() => update(id)); });
    return () => { alive = false; };
  });
  const change = $derived(data.onField as (nodeId:string,fieldId:string,value:GraphValue)=>void);
  const collapse = $derived(data.onCollapse as (nodeId:string,collapsed:boolean)=>void);
  const trace = $derived(data.onTracePort as (nodeId:string,portId:string)=>void);
</script>

<article {...presentation?.target('node')} class={`vict-rich-graph-node ${presentation?.target('node').class ?? ''}`} class:selected data-graph-node={id} aria-label={node.label}>
  <header {...presentation?.target('node-header')} class={`vict-graph-drag-handle ${presentation?.target('node-header').class ?? ''}`}>
    <div class="node-heading"><MediaIcon nodeId={`${id}/header-icon`} occurrenceKey={`${id}/header-icon`} props={{...icon,size:20,decorative:true}}/><span><strong>{node.label}</strong><small>{family.label}</small></span></div>
    <Button variant="secondary" label={node.collapsed?'+':'-'} presentation={actionPresentation(`${node.collapsed?'Expand':'Collapse'} ${node.label}`)} expanded={!node.collapsed} disabled={data.readOnly===true} onclick={event=>{event.stopPropagation();collapse(id,!node.collapsed);}}/>
  </header>
  <div class="port-list">
    {#each ports as port (port.id)}
      <div {...presentation?.target('port')} class:output={port.direction==='output'} class={`port-row ${presentation?.target('port').class ?? ''}`} data-port={port.id}>
        <Handle id={port.id} type={port.direction==='input'?'target':'source'} position={port.direction==='input'?Position.Left:Position.Right} isConnectable={data.readOnly!==true} aria-label={`${port.direction} ${port.label}: ${port.type}`} />
        <Button variant="secondary" label={port.label} presentation={actionPresentation(`Trace ${node.label} ${port.label} connections`)} onclick={event=>{event.stopPropagation();trace(id,port.id);}}/><small>{port.type}</small>
      </div>
    {/each}
  </div>
  {#if !node.collapsed}<section {...presentation?.target('node-body')} class={`node-body ${presentation?.target('node-body').class ?? ''}`}><GraphFields {presentation} owner={id} fields={family.fields} values={node.values} readOnly={data.readOnly===true} onchange={(fieldId,value)=>change(id,fieldId,value)}/></section>{/if}
</article>

<style>
  .node-heading{display:flex;align-items:center;gap:var(--vict-space-2,8px);min-width:0}
  .vict-rich-graph-node{width:280px;box-sizing:border-box;background:var(--vict-flow-node,var(--vict-color-surface,#fff));color:var(--vict-flow-text,var(--vict-color-text,#203239));border:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5));border-radius:var(--vict-radius-base,10px);font:var(--vict-font-sizeBase,14px)/1.5 var(--vict-font-family,system-ui)}.selected{outline:2px solid var(--vict-flow-focus,var(--vict-color-focusRing,#167d72));outline-offset:2px}header{display:flex;align-items:center;justify-content:space-between;gap:var(--vict-space-2,8px);padding:var(--vict-space-3,12px);cursor:grab;border-bottom:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5))}header span{display:grid;gap:2px;min-width:0}strong{font-size:inherit;overflow-wrap:anywhere}small{font-size:12px;color:var(--vict-color-textMuted,#586c73)}.node-body{padding:var(--vict-space-3,12px)}.port-list{padding:var(--vict-space-1,4px) 0}.port-row{position:relative;display:flex;align-items:center;gap:var(--vict-space-2,8px);min-height:26px;padding:0 var(--vict-space-3,12px);font-size:12px}.port-row.output{justify-content:flex-end}.port-row :global(.svelte-flow__handle){width:10px;height:10px;top:50%;background:var(--vict-flow-focus,var(--vict-color-focusRing,#167d72))}
</style>
