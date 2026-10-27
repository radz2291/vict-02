<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {relationMeaning,relationLabel} from './structure-connections.js';
 import SourceDetails from './SourceDetails.svelte';
 import {projectStructure,parseStructureId,structureNodePresentation,type StructureContext,type StructureHandoff} from './structure.js';
 import {itemKey,type WorkspaceSelection,type WorkspaceItem} from './workspace-selection.js';
 import './disclosures.css';
 import SelectionSections from './SelectionSections.svelte';
 import SelectionRelationships from './SelectionRelationships.svelte';
 import {relationshipCount,relationshipSubject,relationshipPhrase} from './selection-relationships.js';
 import {selectionIdentity,sourceOverview} from './selection-presentation.js';
 import {connectionGroup} from './structure-trace.js';
 import {SourceIdentity,type SelectionOperation} from '@victframework/ui-editor';
 let {document,context={},selection,layerProvenance,blocked=false,page=$bindable('properties'),onClose,onSelect,onNavigate,onInspect,onRemove,onSelectionIntent,renderedOccurrences}: {
  document:UiDocument;context?:StructureContext;selection:WorkspaceSelection;layerProvenance?:{occurrence:string;detail:string};blocked?:boolean;page?:'properties'|'relationships'|'technical'|'none';
  onSelectionIntent?:(items:readonly WorkspaceItem[],operation:SelectionOperation)=>void;renderedOccurrences?:readonly string[];
  onClose:()=>void;onSelect:(id:string)=>void;onNavigate:(request:StructureHandoff)=>void;onInspect:(item:WorkspaceItem)=>void;onRemove:(item:WorkspaceItem)=>void;
 }=$props();
 const graph=$derived(projectStructure(document,context));
 const items=$derived(selection.items);
 const single=$derived(items.length===1?items[0]:undefined);
 const nodes=$derived(items.filter(item=>item.kind==='node'));
 const connections=$derived(items.filter(item=>item.kind==='edge').flatMap(item=>{const edge=graph.edges.find(edge=>edge.id===item.id);return edge?[edge]:[];}));
 const title=$derived(single?.kind==='edge'?'Connection':[nodes.length?`${nodes.length} ${nodes.length===1?'node':'nodes'}`:'',connections.length?`${connections.length} ${connections.length===1?'connection':'connections'}`:''].filter(Boolean).join(' · '));
 let root=$state<HTMLElement>();
 $effect(()=>{const element=root;if(!element)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}};element.addEventListener('keydown',escape);return()=>element.removeEventListener('keydown',escape);});
 function nodeName(key:string){return selectionIdentity(document,graph,{kind:'node',id:key}).qualified;}
 function itemType(item:WorkspaceItem){return selectionIdentity(document,graph,item).type;}
 function itemName(item:WorkspaceItem){if(item.kind==='edge'){const edge=graph.edges.find(edge=>edge.id===item.id);if(!edge)return 'Unavailable connection';const subject=relationshipSubject(edge),target=subject===edge.source?edge.target:edge.source;return `${nodeName(subject)} · ${relationshipPhrase(edge,subject)} · ${nodeName(target)}`;}return selectionIdentity(document,graph,item).name;}
 function identity(item:WorkspaceItem){const identity=selectionIdentity(document,graph,item,renderedOccurrences);return [identity.scope,identity.textLocation,identity.availability].filter(Boolean).join(' · ');}
 function selectRelated(item:WorkspaceItem,operation:SelectionOperation){if(onSelectionIntent)onSelectionIntent(item.kind==='edge'?connectionGroup(graph.edges,item.id).map(edge=>({kind:'edge' as const,id:edge.id})):[item],operation);else if(item.kind==='node')onSelect(item.id);else onInspect(item);}
 function encode(value:unknown):string {if(value===undefined)return 'Not set';if(value===null)return 'null';if(Array.isArray(value))return '['+value.map(encode).join(', ')+']';if(typeof value==='object')return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>JSON.stringify(key)+': '+encode(value)).join(', ')+'}';return typeof value==='string'?value:String(value);}
 function stable(value:unknown):unknown{return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,stable(value)])):value;}
 const shared=$derived.by(()=>{
  const sources=nodes.map(item=>graph.nodes.find(node=>node.id===item.id));
  if(sources.length<2)return [];
  const rows:{name:string;value:string}[]=[];
  const add=(name:string,values:unknown[])=>{const serial=values.map(value=>JSON.stringify([typeof value,stable(value)]));rows.push({name,value:serial.every(value=>value===serial[0])?encode(values[0]):'Mixed'});};
  add('Type',sources.map(node=>node?structureNodePresentation(document,node.data).kindLabel:undefined));
  if(sources.some(node=>node?.data.scope))add('Scope',sources.map(node=>node?.data.scope));
  if(sources.every(node=>node?.data.kind!=='node'&&node?.data.kind!=='state')){const facts=sources.map(node=>node?sourceOverview(document,graph,node.id,context):[]);for(const name of new Set(facts.flatMap(rows=>rows.map(row=>row.name)).filter(name=>name!=='Type'&&name!=='Scope')))add(name,facts.map(rows=>rows.find(row=>row.name===name)?.value));}
  const authored=sources.map(node=>node?.data.sourceId?document.nodes[node.data.sourceId]:undefined);
  if(authored.every(node=>node?.kind==='element')){
   add('Element',authored.map(node=>node?.kind==='element'?node.tag:undefined));
   const names=new Set(authored.flatMap(node=>node?.kind==='element'?Object.keys(node.attributes??{}):[]));
   for(const name of [...names].sort())add(name,authored.map(node=>node?.kind==='element'?node.attributes?.[name]:undefined));
  }
  if(sources.every(node=>node?.data.kind==='state')){const states=sources.map(node=>document.localState[parseStructureId(node!.id)?.[2]??'']);add('Value type',states.map(state=>state?.type));add('Initial',states.map(state=>state?.initial));}
  if(authored.every(node=>node?.kind==='component'))add('Definition',authored.map(node=>node?.kind==='component'?node.definitionId:undefined));
  return rows;
 });
</script>
{#if single?.kind==='node'}
 <SourceDetails {onSelectionIntent} {renderedOccurrences} {document} {context} embedded selectedId={single.id} selectedOccurrence={single.occurrence} {layerProvenance} {blocked} bind:page {onClose} {onSelect} {onNavigate}/>
{:else}
 <section class="workspace-selection-details studio-type-scope" data-studio-typography aria-label="Selection details" bind:this={root}>
  <header><span>{items.length?title:'No selection'}</span></header>
  {#if !items.length}<p class="empty">Select nodes, layers or connections. Ctrl-click adds to your selection.</p>
  {:else}
   <SelectionSections bind:page relationshipsCount={relationshipCount(graph,items)}>
    {#snippet overview()}
    {#if single?.kind==='edge' && connections[0]}<SelectionRelationships {document} {graph} {items} {blocked} onIntent={selectRelated}/><p class="quiet">Declared relationship.</p>{/if}
    {#if shared.length}<dl aria-label="Shared properties">{#each shared as fact}<div><dt>{fact.name}</dt><dd title={fact.value}>{fact.value}</dd></div>{/each}</dl><p class="quiet">Read-only comparison. Mixed means the selected items differ.</p>{/if}
    {#if !single}<ul class="selection-items" aria-label="Selected items">{#each items as item (itemKey(item))}<li><button class="inspect-item" type="button" disabled={blocked} title={identity(item)} onclick={()=>onInspect(item)}><SourceIdentity icon={item.kind==='edge'?'reference':selectionIdentity(document,graph,item).iconKey} name={itemName(item)} kindLabel={itemType(item)} context={identity(item)||undefined} variant="card"/></button><button class="remove-item" type="button" disabled={blocked} aria-label={`Remove ${itemType(item)} ${itemName(item)} from selection`} onclick={()=>onRemove(item)}>×</button></li>{/each}</ul>{/if}
    {/snippet}
    {#snippet relationships()}<SelectionRelationships {document} {graph} {items} {blocked} onIntent={selectRelated}/>{/snippet}
    {#snippet technical()}<dl>{#each items as item (itemKey(item))}<div><dt>{itemName(item)}</dt><dd><code>{item.kind==='node'?item.occurrence??item.id:graph.edges.find(edge=>edge.id===item.id)?.data?.path}</code>{#if item.kind==='edge'}{@const edge=connections.find(edge=>edge.id===item.id)}{#if edge}<p>Relationship: {relationLabel(edge)}</p><p>{edge.data?.origin==='host'?'Host connection':'Document declaration'}</p><p>{edge.data?.description??relationMeaning(edge)}</p>{/if}{/if}</dd></div>{/each}</dl>{/snippet}
   </SelectionSections>
  {/if}
 </section>
{/if}
<style>
 .workspace-selection-details{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;color:var(--vict-color-text);font:var(--studio-font-ui)}
 header{flex:none;padding:12px;border-bottom:1px solid var(--vict-color-border);font-weight:400}.empty{padding:12px;color:var(--vict-color-textMuted)}
 dl{margin:0}dl>div{display:grid;grid-template-columns:minmax(64px,1fr) minmax(0,2fr);gap:10px;padding:7px 0;border-bottom:1px solid var(--vict-color-border)}dt{color:var(--vict-color-textMuted)}dd{margin:0;overflow-wrap:anywhere;max-height:120px;overflow:auto}
 .quiet{color:var(--vict-color-textMuted);font:var(--studio-font-meta)}.selection-items{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}.selection-items li{display:flex;border:1px solid var(--vict-color-border);border-radius:5px}
 .inspect-item{flex:1;min-width:0;padding:8px;text-align:left;overflow-wrap:anywhere}.remove-item{width:28px;flex:none}
 button{background:transparent;border:0;color:inherit;font:inherit;cursor:pointer}button:hover{background:var(--vict-control-selected)}button:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}button:disabled{opacity:.5;cursor:default}
</style>
