<script lang="ts">
  import { getContext,untrack } from 'svelte';
  import { Handle, Position } from '@xyflow/svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { GRAPH_BODY, type GraphBodyContext } from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  const body=getContext<GraphBodyContext|undefined>(GRAPH_BODY);
  const port=$derived(body?.ports.find(item=>item.id===props.id));
  $effect(()=>{
    if(!body||!port)return;
    void port.direction;
    const cleanup=untrack(()=>body.registerPort(port.id,Symbol(port.id)));
    return()=>untrack(cleanup);
  });
</script>
{#if body&&port&&body.uniquePort(port.id)}
  <div {...presentation?.target('root')} class={`graph-port-anchor nodrag nopan nowheel ${presentation?.target('root').class??''}`} data-port={port.id} data-node-port={`${body.nodeId}/${port.id}`}>
    <Handle id={port.id} type={port.direction==='input'?'target':'source'} position={port.direction==='input'?Position.Left:Position.Right} isConnectable={!body.readOnly} aria-label={`${port.direction} ${port.label}: ${port.type}`}/>
    {#if io?.slots?.content}{@render io.slots!.content!()}{/if}
  </div>
{:else}<span role="alert">Graph port unavailable or duplicated: {String(props.id??'')}</span>{/if}
<style>
  .graph-port-anchor{position:relative;min-height:var(--vict-space-3,12px);min-width:var(--vict-space-3,12px)}
  .graph-port-anchor :global(.svelte-flow__handle){width:10px;height:10px;top:50%;background:var(--vict-color-accent,#167d72);border-color:var(--vict-color-border,#dce5e5)}
</style>
