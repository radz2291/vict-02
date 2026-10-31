<script lang="ts">
  import {getContext,untrack} from 'svelte';
  import {Handle,Position} from '@xyflow/svelte';
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {GRAPH_BODY,type GraphBodyContext} from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  const body=getContext<GraphBodyContext|undefined>(GRAPH_BODY);
  const port=$derived(body?.ports.find(item=>item.id===props.id));
  function color(value:unknown):string|undefined {
    if(typeof value!=='string')return;
    if(/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value))return value;
    if(/^token:[a-z][a-z0-9-]*$/.test(value))return `var(--vict-color-${value.slice(6)},var(--vict-color-accent,#167d72))`;
  }
  const socketColor=$derived(color(props.color??'token:accent'));
  $effect(()=>{
    if(!body||!port)return;
    void port.direction;
    const cleanup=untrack(()=>body.registerPort(port.id,Symbol(port.id)));
    return()=>untrack(cleanup);
  });
</script>
{#if body&&port&&body.uniquePort(port.id)}
  <div {...presentation?.target('root')} class={`graph-port-row nodrag nopan nowheel ${presentation?.target('root').class??''}`} data-direction={port.direction} data-port={port.id} data-node-port={`${body.nodeId}/${port.id}`} style:--vict-port-row-color={socketColor??'var(--vict-color-accent,#167d72)'}>
    <Handle {...presentation?.target('handle')} id={port.id} type={port.direction==='input'?'target':'source'} position={port.direction==='input'?Position.Left:Position.Right} isConnectable={!body.readOnly} aria-label={`${port.direction} ${port.label}: ${port.type}`} title={`${port.direction} ${port.label} · ${port.type}`} class={`port-row-hit ${presentation?.target('handle').class??''}`}>
      <span {...presentation?.target('socket')} aria-hidden="true" class={`port-row-dot ${presentation?.target('socket').class??''}`}></span>
    </Handle>
    <span {...presentation?.target('label')} class={`port-row-label ${presentation?.target('label').class??''}`}>{port.label}</span>
    {#if props.showType!==false}<span {...presentation?.target('type')} class={`port-row-type ${presentation?.target('type').class??''}`}>{port.type}</span>{/if}
    {#if io?.slots?.content}{@render io.slots.content()}{/if}
    {#if !socketColor}<span role="alert">Port colour requires a hex value or semantic colour token.</span>{/if}
  </div>
{:else}<span role="alert">Graph port unavailable or duplicated: {typeof props.id==='string'?props.id:''}</span>{/if}
<style>
  .graph-port-row{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-width:0;min-height:32px;padding:4px 20px;color:inherit}
  .graph-port-row[data-direction=output]{justify-content:flex-end}
  .graph-port-row :global(.port-row-hit){display:grid;place-items:center;width:28px;height:28px;top:50%;border:0;background:transparent}
  .port-row-dot{box-sizing:border-box;width:10px;height:10px;flex:none;border:1px solid var(--vict-color-border,#dce5e5);border-radius:50%;background:var(--vict-port-row-color);pointer-events:none}
  .port-row-label{min-width:0;overflow-wrap:anywhere;font-size:12px}
  .port-row-type{flex:0 1 auto;min-width:0;max-width:45%;overflow-wrap:anywhere;border:1px solid var(--vict-color-border,#3b4b60);border-radius:4px;padding:1px 4px;font-size:10px;color:var(--vict-color-textMuted,inherit)}
  .graph-port-row :global(.port-row-hit.connectingto.valid),.graph-port-row :global(.port-row-hit.connectingfrom){outline:2px solid var(--vict-color-focusRing,#2dd4bf);outline-offset:1px}
</style>
