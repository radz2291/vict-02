<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {selectionOperation,type SelectionOperation} from '@victframework/ui-editor';
 import {parseStructureId,type StructureGraph} from './structure.js';
 import type {WorkspaceItem} from './workspace-selection.js';
 import {selectionIdentity} from './selection-presentation.js';
 import {relationLabel,relationMeaning} from './structure-connections.js';
 import {relationshipGroups} from './selection-relationships.js';
 import StructureTypeIcon from './StructureTypeIcon.svelte';
 let {document,graph,items,blocked=false,onIntent}:{document:UiDocument;graph:StructureGraph;items:readonly WorkspaceItem[];blocked?:boolean;onIntent:(item:WorkspaceItem,operation:SelectionOperation)=>void}=$props();
 const groups=$derived(relationshipGroups(graph,items));
 const anchor=$derived(items.length===1&&items[0]?.kind==='node'?items[0].id:undefined);
 const identities=$derived(new Map(graph.nodes.map(node=>[node.id,selectionIdentity(document,graph,{kind:'node',id:node.id})])));
 const duplicateNames=$derived.by(()=>{const counts=new Map<string,number>();for(const identity of identities.values())counts.set(identity.name,(counts.get(identity.name)??0)+1);return counts;});
 let limit=$state(50);
 $effect(()=>{void items;limit=50;});
 const sections=$derived(anchor?[
  {label:'Incoming',direction:'in',groups:groups.slice(0,limit).filter(group=>group.edge.target===anchor&&group.edge.source!==anchor)},
  {label:'Outgoing',direction:'out',groups:groups.slice(0,limit).filter(group=>group.edge.source===anchor)},
 ]:[{label:'Connections',direction:'both',groups:groups.slice(0,limit)}]);
 function select(item:WorkspaceItem,event:{ctrlKey:boolean;metaKey:boolean}){onIntent(item,selectionOperation(event));}
 function keyboard(event:KeyboardEvent,item:WorkspaceItem){if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)select(item,event);}}
 function nodeItem(id:string):WorkspaceItem{const source=graph.nodes.find(node=>node.id===id);return {kind:'node',id,...(source?.data.occurrence?{occurrence:source.data.occurrence}:{})};}
 function qualifier(id:string){const identity=identities.get(id);if(!identity||(duplicateNames.get(identity.name)??0)<2)return '';return identity.scope||graph.nodes.find(node=>node.id===id)?.data.sourceId||parseStructureId(id)?.[2]||identity.type;}
 function iconKind(id:string){const data=graph.nodes.find(node=>node.id===id)?.data;return data?.kind==='node'&&identities.get(id)?.type==='Text'?'text':data?.kind??'node';}
</script>
{#snippet endpoint(id:string)}
 {@const item=nodeItem(id)}{@const identity=identities.get(id)}{@const scope=qualifier(id)}
 <button class="endpoint" type="button" disabled={blocked} title={identity?.qualified??id} aria-label={identity?.qualified??id} onclick={event=>select(item,event)} onkeydown={event=>keyboard(event,item)}>
  <span class="type-icon"><StructureTypeIcon kind={iconKind(id)}/></span><span class="endpoint-label"><span class="endpoint-name">{identity?.name??'Unavailable'}</span>{#if scope}<small>{scope}</small>{/if}</span>
 </button>
{/snippet}
<div class="details-relationships">
 {#each sections as section}{#if section.groups.length}
  <section class="relationship-group" aria-label={section.label}>
   {#if anchor}<h3>{section.label}</h3>{/if}
   {#each section.groups as group (group.edge.id)}
    {@const edge=group.edge}{@const from=identities.get(edge.source)}{@const to=identities.get(edge.target)}{@const host=edge.data?.origin==='host'}
    <div class="connection-row" class:detailed={!anchor}>
     <button class="connection-role" type="button" disabled={blocked} title={[host?'Host connection':'Document declaration',edge.data?.description??relationMeaning(edge),...group.paths].join('\n')} aria-label={`Inspect ${relationLabel(edge)} connection from ${from?.qualified??edge.source} to ${to?.qualified??edge.target}`} onclick={event=>select({kind:'edge',id:edge.id},event)} onkeydown={event=>keyboard(event,{kind:'edge',id:edge.id})}>{relationLabel(edge)}{#if group.paths.length>1}<small title="Declared references">{group.paths.length}</small>{/if}</button>
     {#if anchor}<span class="direction" aria-hidden="true">{section.direction==='in'?'←':'→'}</span>{@render endpoint(section.direction==='in'?edge.source:edge.target)}{/if}
     {#if host}<small class="origin" title="Declared host connection">Host</small>{/if}
     {#if !anchor}<div class="endpoints">{@render endpoint(edge.source)}<span class="direction" aria-hidden="true">→</span>{@render endpoint(edge.target)}</div>{/if}
    </div>
   {/each}
  </section>
 {/if}{/each}
 {#if groups.length>limit}<button type="button" class="more" onclick={()=>limit+=50}>Show 50 more</button>{/if}
 {#if !groups.length}<p>No declared relationships.</p>{/if}
</div>
<style>
 .details-relationships{display:flex;flex-direction:column;gap:16px;min-width:0}.relationship-group{min-width:0}h3{margin:0 0 4px;font:var(--studio-font-meta);font-weight:400;color:var(--vict-color-textMuted)}
 .connection-row{display:grid;grid-template-columns:minmax(58px,.45fr) 12px minmax(0,1fr) auto;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid var(--vict-color-border);min-width:0}.connection-row:last-child{border-bottom:0}.connection-row.detailed{grid-template-columns:minmax(0,1fr) auto}
 button{font:inherit;font-weight:400;color:inherit;background:transparent;border:0;text-align:left;cursor:pointer;min-width:0;min-height:28px;padding:4px;border-radius:3px}button:hover{background:var(--vict-control-selected)}button:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}button:disabled{opacity:.5;cursor:default}
 .connection-role{display:flex;align-items:baseline;gap:6px;overflow-wrap:anywhere}.endpoint{display:flex;align-items:center;gap:6px;min-width:0}.endpoint-label{display:flex;flex-direction:column;min-width:0;gap:2px}.endpoint-name,.endpoint-label small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.type-icon{display:block;flex:none;color:var(--vict-color-textMuted);width:12px}.type-icon :global(svg){width:12px;height:12px}.endpoints{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr);align-items:center;gap:4px}
 small,p,.direction{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}.origin{padding-right:4px}.more{align-self:flex-start}p{margin:0}
</style>
