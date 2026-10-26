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
    <div class="structured-node-identity"><span class="vict-source-kind">{data.kindLabel ?? data.kind}</span><strong title={String(data.label)}>{data.label}</strong></div>
    {#if toggleGroup}<button type="button" class="node-group-toggle nodrag nopan" aria-label={`${data.collapsed?'Expand':'Collapse'} ${data.label}`} aria-expanded={!data.collapsed} onkeydown={event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();}} onclick={event=>{event.stopPropagation();toggleGroup();}}>{data.collapsed?'›':'⌄'}</button>{/if}
  </header>
  {#if data.summary || data.collapsedCount}<div class="structured-node-facts"><span class="vict-source-summary">{data.collapsedCount?`${data.collapsedCount} items inside`:data.summary}</span></div>{/if}
  {#if ports.length}<div class="structured-node-ports">
    {#each [incoming,outgoing] as side,index}{#if side.length}<div class="node-port-list" class:outgoing={index===1}>
      {#each side as port (port.id)}<div class="node-port" style:--connection-color={port.color} title={`${port.label}: ${port.count} declared connection${port.count===1?'':'s'}`}>
        <Handle id={port.id} type={port.side==='out'?'source':'target'} position={horizontal?(port.side==='out'?Position.Right:Position.Left):(port.side==='out'?Position.Bottom:Position.Top)} isConnectable={false} class="declared-connection-handle" aria-label={`${port.label}: ${port.count} declared connections`}/>
        <span class="node-port-label">{port.label}</span>{#if port.count>1}<span class="node-port-count">{port.count}</span>{/if}
      </div>{/each}
    </div>{/if}{/each}
  </div>{/if}
  {#if data.moveTarget}<Handle id="container" type="target" position={horizontal?Position.Left:Position.Top} isConnectable class="edit-handle" aria-label={`Move content inside ${data.label}`}/>{/if}
  {#if data.moveSource}<Handle id="content" type="source" position={horizontal?Position.Right:Position.Bottom} isConnectable class="edit-handle" aria-label={`Move ${data.label} to a container`}/>{/if}
</div>
<style>
  .structured-source-node{box-sizing:border-box;width:224px;min-height:76px;display:flex;flex-direction:column}
  .structured-node-header{display:flex;align-items:flex-start;gap:8px;padding:8px;min-height:62px}
  .structured-node-icon{color:#64748b;padding-top:2px;flex:none}.structured-node-icon[data-family=state]{color:#0f766e}.structured-node-icon[data-family=action]{color:#7c3aed}.structured-node-icon[data-family=catalog],.structured-node-icon[data-family=definition]{color:#3566a4}.structured-node-icon[data-family=route]{color:#0369a1}
  .structured-node-identity{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
  strong{display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;min-height:20px;line-height:20px}
  .node-group-toggle{border:0;background:transparent;color:var(--vict-color-textMuted);font:18px/20px system-ui;cursor:pointer;padding:0;width:20px;height:20px;border-radius:3px;flex:none}
  .node-group-toggle:hover{background:var(--vict-control-selected)}.node-group-toggle:focus-visible{outline:2px solid var(--vict-color-focusRing)}
  .structured-node-facts{padding:0 8px 8px}
  .structured-node-ports{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;border-top:1px solid var(--vict-color-border);padding:4px 0}
  .node-port-list{min-width:0;grid-column:1;grid-row:1}.node-port-list.outgoing{grid-column:2}.node-port{position:relative;display:flex;align-items:center;gap:4px;min-height:24px;padding:2px 8px;font:var(--studio-font-meta);color:var(--vict-color-textMuted)}
  .outgoing .node-port{justify-content:flex-end}.node-port-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.node-port-count{font-variant-numeric:tabular-nums;flex:none}
  .vertical .structured-node-header{order:1}.vertical .structured-node-facts{order:2}.vertical .structured-node-ports{display:contents}.vertical .node-port-list{display:flex;justify-content:space-around;min-height:24px;order:0;border-bottom:1px solid var(--vict-color-border)}.vertical .node-port-list.outgoing{order:3;border-bottom:0;border-top:1px solid var(--vict-color-border)}.vertical .node-port{min-width:0;flex:1;justify-content:center}
  :global(.declared-connection-handle){width:7px;height:7px;background:var(--connection-color);border:1px solid white;pointer-events:none}
  :global(.edit-handle){width:10px;height:10px;background:#4f46e5}:global(.edit-handle.valid){background:#15803d;outline:3px solid #bbf7d0}
</style>
