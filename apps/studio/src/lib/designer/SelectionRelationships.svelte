<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import type {SelectionOperation} from '@victframework/ui-editor';
 import {selectionOperation} from '@victframework/ui-editor';
 import type {StructureGraph} from './structure.js';
 import type {WorkspaceItem} from './workspace-selection.js';
 import {selectionIdentity} from './selection-presentation.js';
 import {relationLabel,relationMeaning} from './structure-connections.js';
 let {document,graph,items,blocked=false,onIntent}:{document:UiDocument;graph:StructureGraph;items:readonly WorkspaceItem[];blocked?:boolean;onIntent:(item:WorkspaceItem,operation:SelectionOperation)=>void}=$props();
 const related=$derived(graph.edges.filter(edge=>items.some(item=>item.kind==='edge'?item.id===edge.id:item.id===edge.source||item.id===edge.target)));
 const groups=$derived.by(()=>{const groups=new Map<string,{edge:StructureGraph['edges'][number];paths:string[]}>();for(const edge of related){const key=JSON.stringify([edge.source,edge.target,edge.data?.role,edge.data?.description,edge.data?.origin,edge.data?.owner]);const existing=groups.get(key);if(existing)existing.paths.push(edge.data?.path??'');else groups.set(key,{edge,paths:[edge.data?.path??'']});}return [...groups.values()];});
 let limit=$state(50);$effect(()=>{void items;limit=50;});
 function select(item:WorkspaceItem,event:{ctrlKey:boolean;metaKey:boolean}){onIntent(item,selectionOperation(event));}
 function keyboard(event:KeyboardEvent,item:WorkspaceItem){if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)select(item,event);}}
 function nodeItem(id:string):WorkspaceItem{const source=graph.nodes.find(node=>node.id===id);return {kind:'node',id,...(source?.data.occurrence?{occurrence:source.data.occurrence}:{})};}
</script>
<div class="details-relationships">
 {#if related.length}<p>{related.length} declared relationships; related items are not automatically selected.</p>{/if}
 {#each groups.slice(0,limit) as group (group.edge.id)}{@const edge=group.edge}{@const from=nodeItem(edge.source)}{@const to=nodeItem(edge.target)}{@const origin=edge.data?.origin==='host'?'Host connection':'Document declaration'}
  <div class="connection-card">
   <button class="connection-role" type="button" disabled={blocked} title={[origin,edge.data?.description??relationMeaning(edge),...group.paths].join('\n')} aria-label={`Inspect ${relationLabel(edge)} connection from ${selectionIdentity(document,graph,from).qualified} to ${selectionIdentity(document,graph,to).qualified}`} onclick={event=>select({kind:'edge',id:edge.id},event)} onkeydown={event=>keyboard(event,{kind:'edge',id:edge.id})}>{relationLabel(edge)}{group.paths.length>1?` (${group.paths.length})`:''}<small>{origin}</small></button>
   <div class="endpoints">{#each [from,to] as item,index}{@const identity=selectionIdentity(document,graph,item)}{#if index}<span aria-hidden="true">→</span>{/if}<button class="endpoint" type="button" disabled={blocked} title={identity.qualified} onclick={event=>select(item,event)} onkeydown={event=>keyboard(event,item)}><small>{identity.type}{identity.scope?` · ${identity.scope}`:''}</small><span>{identity.name}</span></button>{/each}</div>
  </div>
 {/each}
 {#if groups.length>limit}<button type="button" onclick={()=>limit+=50}>Show 50 more</button>{/if}
 {#if !related.length}<p>No declared relationships.</p>{/if}
</div>
<style>
 .details-relationships{display:grid;gap:6px}.connection-card{border:1px solid var(--vict-color-border);border-radius:5px;min-width:0;overflow:hidden}button{font:inherit;color:inherit;background:transparent;border:0;text-align:left;cursor:pointer;overflow-wrap:anywhere}button:hover{background:var(--vict-control-selected)}button:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}button:disabled{opacity:.5;cursor:default}.connection-role{display:flex;justify-content:space-between;align-items:baseline;gap:8px;width:100%;padding:8px}.endpoints{display:flex;align-items:center;padding:0 4px 4px;gap:4px}.endpoint{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;padding:4px}.endpoint small{display:block}small,p,.endpoints>span{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}p{margin:0 0 4px}
</style>
