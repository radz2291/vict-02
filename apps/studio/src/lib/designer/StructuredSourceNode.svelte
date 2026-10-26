<script lang="ts">
  import {getContext,tick,untrack} from 'svelte';
  import {Handle,Position,useUpdateNodeInternals,type NodeProps} from '@victframework/ui-flow-svelte';
  import StructureTypeIcon from './StructureTypeIcon.svelte';
  import type {StructurePort} from './structure-connections.js';
  import {structureTraceContext,type StructureTraceContext} from './structure-trace.js';
  let {id,data,selected}:NodeProps=$props();
  const traceContext=getContext<StructureTraceContext|undefined>(structureTraceContext);
  const trace=$derived(traceContext?.current());
  const traced=$derived(!!trace && (trace.source===id || trace.target===id));
  const issues=$derived((data.issues??[]) as string[]);
  const ports=$derived((data.ports ?? []) as StructurePort[]);
  const incoming=$derived(ports.filter(port=>port.side==='in'));
  const outgoing=$derived(ports.filter(port=>port.side==='out'));
  const horizontal=$derived(data.direction!=='DOWN');
  const toggleGroup=$derived(typeof data.onToggleGroup==='function'?data.onToggleGroup as ()=>void:undefined);
  const updateNodeInternals=useUpdateNodeInternals();
  const portSignature=$derived(ports.map(port=>port.id).join('|'));
  $effect(()=>{const nodeId=id;void horizontal;void portSignature;void data.moveSource;void data.moveTarget;let cancelled=false;void tick().then(()=>{if(!cancelled)untrack(()=>updateNodeInternals(nodeId));});return()=>{cancelled=true;};});
</script>
<div class="vict-source-node structured-source-node" class:selected class:traced class:trace-dim={!!trace && !traced} data-kind={String(data.kind)}>
  <header class="structured-node-header">
    <span class="structured-node-icon" data-family={String(data.kind)}><StructureTypeIcon kind={String(data.kind==='node' && data.kindLabel==='Text'?'text':data.kind)}/></span>
    <div class="structured-node-identity">{#if String(data.kindLabel ?? data.kind).toLowerCase()!==String(data.label).toLowerCase()}<span class="vict-source-kind">{data.kindLabel ?? data.kind}</span>{/if}<strong title={String(data.fullLabel ?? data.label)}>{data.label}</strong></div>
    {#if toggleGroup}<button type="button" class="node-group-toggle nodrag nopan" aria-label={`${data.collapsed?'Expand':'Collapse'} ${data.label}`} aria-expanded={!data.collapsed} onkeydown={event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();}} onclick={event=>{event.stopPropagation();toggleGroup();}}>{data.collapsed?'›':'⌄'}</button>{/if}
  </header>
  {#if data.summary || data.collapsedCount || data.support || issues.length}<div class="structured-node-facts"><span class="vict-source-summary" title={String(data.summary ?? '')}>{data.collapsedCount?`${data.collapsedCount} items inside`:data.summary}</span>{#if data.support || issues.length}<span class="vict-source-summary" title={issues.join('\n')}>{data.support ?? 'Warning'}</span>{/if}</div>{/if}
  {#if ports.length}
    <div class="node-connections">
      {#each [incoming,outgoing] as side,index}
        <div class="connection-side" class:outgoing={index===1} role="list" aria-label={index===0?'Incoming connections':'Outgoing connections'}>
          {#each side as port (port.id)}
            {@const highlighted=!!trace && (port.side==='out'?trace.source===id && trace.sourceHandle===port.id:trace.target===id && trace.targetHandle===port.id)}
            <div class="connection-row" class:highlighted role="listitem" data-port={port.id} title={`${port.side==='in'?'Incoming':'Outgoing'} ${port.label} · ${port.count} declared ${port.count===1?'reference':'references'}`} style:--connection-color={port.color}>
              <span class="connection-label">{port.label}</span>{#if port.count>1}<span class="connection-count">· {port.count}</span>{/if}
              <div class="node-socket">
                <Handle id={port.id} type={port.side==='out'?'source':'target'} position={port.side==='out'?Position.Right:Position.Left} isConnectable={false} isConnectableStart={false} isConnectableEnd={false} class="declared-connection-handle" aria-hidden="true" tabindex={-1}/>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
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
  .structured-node-facts{padding:0 8px 8px;display:flex;flex-direction:column;gap:3px}
  /* Fixed input-left/output-right rows stay readable in both layout directions.
     Graph orientation moves cards, never labels between sides or with zoom. */
  .node-connections{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;border-top:1px solid var(--vict-color-border,#dce2eb);padding:5px 0}
  .connection-side{display:grid;grid-auto-rows:24px;align-content:start;min-width:0}
  .connection-row{position:relative;display:flex;align-items:center;gap:3px;padding:0 5px 0 12px;min-width:0;color:var(--vict-color-textMuted,#65748d);font:var(--studio-font-meta,400 11px/16px system-ui,sans-serif)}
  .outgoing .connection-row{justify-content:flex-end;padding:0 12px 0 5px}
  .connection-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.connection-count{flex:none}
  .connection-row.highlighted{background:var(--vict-control-selected,#edf1ff);color:var(--vict-color-text,#26334b)}
  .node-socket{position:absolute;left:0;top:50%;width:0;height:0;pointer-events:none}
  .outgoing .node-socket{left:auto;right:0}
  .trace-dim{opacity:.3}.traced:not(.selected){border-color:#9aa9c2}
  :global(.declared-connection-handle){width:7px;height:7px;background:var(--connection-color);border:1px solid white;pointer-events:none}
  :global(.edit-handle){width:10px;height:10px;background:#4f46e5}:global(.edit-handle.valid){background:#15803d;outline:3px solid #bbf7d0}
</style>
