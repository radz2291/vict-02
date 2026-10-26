<script lang="ts">
  import {tick,untrack} from 'svelte';
  import {Handle,Position,useUpdateNodeInternals,type NodeProps} from '@victframework/ui-flow-svelte';
  import StructureTypeIcon from './StructureTypeIcon.svelte';
  import type {StructurePort} from './structure-connections.js';
  let {id,data,selected}:NodeProps=$props();
  const ports=$derived((data.ports ?? []) as StructurePort[]);
  const incoming=$derived(ports.filter(port=>port.side==='in'));
  const outgoing=$derived(ports.filter(port=>port.side==='out'));
  const horizontal=$derived(data.direction!=='DOWN');
  const toggleGroup=$derived(typeof data.onToggleGroup==='function'?data.onToggleGroup as ()=>void:undefined);
  const updateNodeInternals=useUpdateNodeInternals();
  const portSignature=$derived(ports.map(port=>port.id).join('|'));
  $effect(()=>{const nodeId=id;void horizontal;void portSignature;void data.moveSource;void data.moveTarget;let cancelled=false;void tick().then(()=>{if(!cancelled)untrack(()=>updateNodeInternals(nodeId));});return()=>{cancelled=true;};});
</script>
<div class="vict-source-node structured-source-node" class:selected class:vertical={!horizontal} data-kind={String(data.kind)}>
  <header class="structured-node-header">
    <span class="structured-node-icon" data-family={String(data.kind)}><StructureTypeIcon kind={String(data.kind==='node' && data.kindLabel==='Text'?'text':data.kind)}/></span>
    <div class="structured-node-identity">{#if String(data.kindLabel ?? data.kind).toLowerCase()!==String(data.label).toLowerCase()}<span class="vict-source-kind">{data.kindLabel ?? data.kind}</span>{/if}<strong title={String(data.fullLabel ?? data.label)}>{data.label}</strong></div>
    {#if toggleGroup}<button type="button" class="node-group-toggle nodrag nopan" aria-label={`${data.collapsed?'Expand':'Collapse'} ${data.label}`} aria-expanded={!data.collapsed} onkeydown={event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();}} onclick={event=>{event.stopPropagation();toggleGroup();}}>{data.collapsed?'›':'⌄'}</button>{/if}
  </header>
  {#if data.summary || data.collapsedCount}<div class="structured-node-facts"><span class="vict-source-summary" title={String(data.summary ?? '')}>{data.collapsedCount?`${data.collapsedCount} items inside`:data.summary}</span></div>{/if}
  {#each [incoming,outgoing] as side,index}
      {#each side as port,slot (port.id)}<div class="node-socket" style:left={horizontal?(index===0?'0%':'100%'):`${(slot+1)*100/(side.length+1)}%`} style:top={horizontal?`${(slot+1)*100/(side.length+1)}%`:(index===0?'0%':'100%')} style:--connection-color={port.color}>
        <Handle id={port.id} type={port.side==='out'?'source':'target'} position={horizontal?(port.side==='out'?Position.Right:Position.Left):(port.side==='out'?Position.Bottom:Position.Top)} isConnectable={false} isConnectableStart={false} isConnectableEnd={false} class="declared-connection-handle" aria-hidden="true" tabindex={-1}/>
      </div>{/each}
  {/each}
  {#if data.moveTarget}<Handle id="container" type="target" position={horizontal?Position.Left:Position.Top} isConnectable class="edit-handle" style={horizontal?'top:-8px':'left:-8px'} aria-label={`Move content inside ${data.label}`}/>{/if}
  {#if data.moveSource}<Handle id="content" type="source" position={horizontal?Position.Right:Position.Bottom} isConnectable class="edit-handle" style={horizontal?'top:-8px':'left:-8px'} aria-label={`Move ${data.label} to a container`}/>{/if}
</div>
<style>
  .structured-source-node{position:relative;box-sizing:border-box;width:224px;min-height:76px;display:flex;flex-direction:column}
  .structured-node-header{display:flex;align-items:flex-start;gap:8px;padding:8px;min-height:62px}
  .structured-node-icon{color:#64748b;padding-top:2px;flex:none}.structured-node-icon[data-family=state]{color:#0f766e}.structured-node-icon[data-family=action]{color:#7c3aed}.structured-node-icon[data-family=catalog],.structured-node-icon[data-family=definition]{color:#3566a4}.structured-node-icon[data-family=route]{color:#0369a1}
  .structured-node-identity{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
  strong{display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;min-height:20px;line-height:20px}
  .node-group-toggle{border:0;background:transparent;color:var(--vict-color-textMuted);font:18px/20px system-ui;cursor:pointer;padding:0;width:20px;height:20px;border-radius:3px;flex:none}
  .node-group-toggle:hover{background:var(--vict-control-selected)}.node-group-toggle:focus-visible{outline:2px solid var(--vict-color-focusRing)}
  .structured-node-facts{padding:0 8px 8px}
  .node-socket{position:absolute;width:0;height:0;pointer-events:none}
  :global(.declared-connection-handle){width:7px;height:7px;background:var(--connection-color);border:1px solid white;pointer-events:none}
  :global(.edit-handle){width:10px;height:10px;background:#4f46e5}:global(.edit-handle.valid){background:#15803d;outline:3px solid #bbf7d0}
</style>
