<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {resolveOccurrence} from '@victframework/ui-editor';
 import {relationMeaning} from './structure-connections.js';
 import SourceDetails from './SourceDetails.svelte';
 import {projectStructure,structureId,parseStructureId,structureNodePresentation,type StructureContext,type StructureHandoff} from './structure.js';
 import {relationLabel} from './structure-connections.js';
 import {itemKey,type WorkspaceSelection,type WorkspaceItem} from './workspace-selection.js';
 import './disclosures.css';
 let {document,context={},selection,layerProvenance,blocked=false,page=$bindable('properties'),onClose,onSelect,onNavigate,onInspect,onRemove}: {
  document:UiDocument;context?:StructureContext;selection:WorkspaceSelection;layerProvenance?:{occurrence:string;detail:string};blocked?:boolean;page?:'properties'|'relationships'|'technical'|'none';
  onClose:()=>void;onSelect:(id:string)=>void;onNavigate:(request:StructureHandoff)=>void;onInspect:(item:WorkspaceItem)=>void;onRemove:(item:WorkspaceItem)=>void;
 }=$props();
 const graph=$derived(projectStructure(document,context));
 const items=$derived(selection.items);
 const single=$derived(items.length===1?items[0]:undefined);
 const nodes=$derived(items.filter(item=>item.kind==='node'));
 const connections=$derived(items.filter(item=>item.kind==='edge').flatMap(item=>{const edge=graph.edges.find(edge=>edge.id===item.id);return edge?[edge]:[];}));
 const related=$derived(graph.edges.filter(edge=>connections.some(selected=>selected.id===edge.id)||nodes.some(item=>item.id===edge.source||item.id===edge.target)));
 const title=$derived(single?.kind==='edge'?'Connection':[nodes.length?`${nodes.length} ${nodes.length===1?'node':'nodes'}`:'',connections.length?`${connections.length} ${connections.length===1?'connection':'connections'}`:''].filter(Boolean).join(' · '));
 const id=$props.id();
 let root=$state<HTMLElement>();
 $effect(()=>{const element=root;if(!element)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}};element.addEventListener('keydown',escape);return()=>element.removeEventListener('keydown',escape);});
 let relationshipLimit=$state(50);
 $effect(()=>{void selection;relationshipLimit=50;});
 const visibleRelationships=$derived(related.slice(0,relationshipLimit));
 function nodeName(key:string){const node=graph.nodes.find(node=>node.id===key);return node?structureNodePresentation(document,node.data).fullLabel??node.data.label:'Unavailable';}
 function itemType(item:WorkspaceItem){const node=item.kind==='node'?graph.nodes.find(node=>node.id===item.id):undefined;return item.kind==='edge'?'Connection':node?structureNodePresentation(document,node.data).kindLabel:'Unavailable';}
 function itemName(item:WorkspaceItem){if(item.kind==='edge'){const edge=graph.edges.find(edge=>edge.id===item.id);return edge?`${nodeName(edge.source)} → ${relationLabel(edge)} → ${nodeName(edge.target)}`:'Unavailable connection';}return nodeName(item.id);}
 function identity(item:WorkspaceItem){
  if(item.kind!=='node')return;
  if(!item.occurrence)return nodes.some(other=>other.id===item.id&&other!==item)?'Source definition':undefined;
  const report=resolveOccurrence(item.occurrence,document);
  return [...report.instancePath.map(step=>nodeName(structureId(document.id,'node',step.sourceNodeId))),...report.repeatKeys.map(key=>`Row ${key}`),...report.portalPath.map(step=>`Overlay ${step.overlayId}`)].join(' · ')||undefined;
 }
 function encode(value:unknown):string {if(value===undefined)return 'Not set';if(value===null)return 'null';if(Array.isArray(value))return '['+value.map(encode).join(', ')+']';if(typeof value==='object')return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>JSON.stringify(key)+': '+encode(value)).join(', ')+'}';return typeof value==='string'?value:String(value);}
 function stable(value:unknown):unknown{return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,stable(value)])):value;}
 const shared=$derived.by(()=>{
  const sources=nodes.map(item=>graph.nodes.find(node=>node.id===item.id));
  if(sources.length<2)return [];
  const rows:{name:string;value:string}[]=[];
  const add=(name:string,values:unknown[])=>{const serial=values.map(value=>JSON.stringify([typeof value,stable(value)]));rows.push({name,value:serial.every(value=>value===serial[0])?encode(values[0]):'Mixed'});};
  add('Type',sources.map(node=>node?structureNodePresentation(document,node.data).kindLabel:undefined));
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
 <SourceDetails {document} {context} embedded selectedId={single.id} selectedOccurrence={single.occurrence} {layerProvenance} {blocked} bind:page {onClose} {onSelect} {onNavigate}/>
{:else}
 <section class="workspace-selection-details studio-type-scope" data-studio-typography aria-label="Selection details" bind:this={root}>
  <header><span>{items.length?title:'No selection'}</span></header>
  {#if !items.length}<p class="empty">Select nodes, layers or connections. Ctrl-click adds to your selection.</p>
  {:else}
   <section class:expanded={page==='properties'}><button class="studio-section-header" type="button" aria-expanded={page==='properties'} aria-controls={id+'-overview'} onclick={()=>page=page==='properties'?'none':'properties'}>Overview</button><div id={id+'-overview'} hidden={page!=='properties'} class="body">
    {#if single?.kind==='edge' && connections[0]}{@const edge=connections[0]}<dl><div><dt>Relationship</dt><dd>{relationLabel(edge)}</dd></div><div><dt>From</dt><dd>{nodeName(edge.source)}</dd></div><div><dt>To</dt><dd>{nodeName(edge.target)}</dd></div><div><dt>Origin</dt><dd>{edge.data?.origin==='host'?'Host connection':'Document declaration'}</dd></div><div><dt>Meaning</dt><dd>{edge.data?.description??relationMeaning(edge)}</dd></div></dl><p class="quiet">Declared direction; this does not indicate a live execution.</p>{/if}
    {#if shared.length}<dl aria-label="Shared properties">{#each shared as fact}<div><dt>{fact.name}</dt><dd title={fact.value}>{fact.value}</dd></div>{/each}</dl><p class="quiet">Read-only comparison. Mixed means the selected items differ.</p>{/if}
    {#if !single}<ul class="selection-items" aria-label="Selected items">{#each items as item (itemKey(item))}<li><button class="inspect-item" type="button" disabled={blocked} title={identity(item)} onclick={()=>onInspect(item)}><small class="item-type">{itemType(item)}</small>{itemName(item)}{#if identity(item)}<small>{identity(item)}</small>{/if}</button><button class="remove-item" type="button" disabled={blocked} aria-label={`Remove ${itemType(item)} ${itemName(item)} from selection`} onclick={()=>onRemove(item)}>×</button></li>{/each}</ul>{/if}
   </div></section>
   <section class:expanded={page==='relationships'}><button class="studio-section-header" type="button" aria-expanded={page==='relationships'} aria-controls={id+'-relationships'} onclick={()=>page=page==='relationships'?'none':'relationships'}>Relationships</button><div id={id+'-relationships'} hidden={page!=='relationships'} class="body">
    {#if related.length}<p class="quiet">{related.length} declared relationships; related items are not automatically selected.</p>{#each visibleRelationships as edge (edge.id)}<div class="connection-card"><span>{relationLabel(edge)}</span><strong>{nodeName(edge.source)} → {nodeName(edge.target)}</strong><small>{edge.data?.description??relationMeaning(edge)}</small></div>{/each}{#if related.length>relationshipLimit}<button type="button" onclick={()=>relationshipLimit+=50}>Show 50 more</button>{/if}{:else}<p>Select a connection or inspect an individual node to see its relationship details.</p>{/if}
   </div></section>
   <section class:expanded={page==='technical'}><button class="studio-section-header" type="button" aria-expanded={page==='technical'} aria-controls={id+'-technical'} onclick={()=>page=page==='technical'?'none':'technical'}>Technical information</button><div id={id+'-technical'} hidden={page!=='technical'} class="body"><dl>{#each items as item (itemKey(item))}<div><dt>{itemName(item)}</dt><dd><code>{item.kind==='node'?item.occurrence??item.id:graph.edges.find(edge=>edge.id===item.id)?.data?.path}</code></dd></div>{/each}</dl></div></section>
  {/if}
 </section>
{/if}
<style>
 .workspace-selection-details{height:100%;min-height:0;overflow:auto;color:var(--vict-color-text);font:var(--studio-font-ui)}
 header{padding:12px;border-bottom:1px solid var(--vict-color-border);font-weight:400}.body{padding:12px}.empty{padding:12px;color:var(--vict-color-textMuted)}
 dl{margin:0}dl>div{display:grid;grid-template-columns:minmax(64px,1fr) minmax(0,2fr);gap:10px;padding:7px 0;border-bottom:1px solid var(--vict-color-border)}dt{color:var(--vict-color-textMuted)}dd{margin:0;overflow-wrap:anywhere;max-height:120px;overflow:auto}
 .quiet,small{color:var(--vict-color-textMuted);font:var(--studio-font-meta)}.selection-items{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}.selection-items li{display:flex;border:1px solid var(--vict-color-border);border-radius:5px}
 .inspect-item{flex:1;min-width:0;padding:8px;text-align:left;overflow-wrap:anywhere}.inspect-item small{display:block;overflow-wrap:anywhere;margin-top:3px}.remove-item{width:28px;flex:none}
 .inspect-item .item-type{margin:0 0 3px}
 button{background:transparent;border:0;color:inherit;font:inherit;cursor:pointer}button:hover{background:var(--vict-control-selected)}button:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}button:disabled{opacity:.5;cursor:default}
 .connection-card{display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid var(--vict-color-border);border-radius:5px;margin-bottom:6px}.connection-card span{color:var(--vict-color-textMuted)}strong{font-weight:400}code{font-size:11px;overflow-wrap:anywhere}
</style>
