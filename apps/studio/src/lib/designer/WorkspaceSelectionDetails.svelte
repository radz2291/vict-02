<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {relationMeaning,relationLabel} from './structure-connections.js';
 import SourceDetails from './SourceDetails.svelte';
 import {projectStructure,type StructureContext,type StructureHandoff} from './structure.js';
 import {itemKey,type WorkspaceSelection,type WorkspaceItem} from './workspace-selection.js';
 import './disclosures.css';
 import SelectionPanel from './SelectionPanel.svelte';
 import SelectionHeading from './SelectionHeading.svelte';
 import SelectionRelationships from './SelectionRelationships.svelte';
 import {relationshipCount} from './selection-relationships.js';
 import {selectionMember,selectionComparison,selectionOverview} from './selection-presentation.js';
 import {connectionGroup} from './structure-trace.js';
 import {type SelectionOperation} from '@victframework/ui-editor';
 let {document,context={},selection,layerProvenance,blocked=false,page=$bindable('properties'),onClose,onSelect,onNavigate,onInspect,onRemove,onSelectionIntent,renderedOccurrences}: {
  document:UiDocument;context?:StructureContext;selection:WorkspaceSelection;layerProvenance?:{occurrence:string;detail:string};blocked?:boolean;page?:'properties'|'relationships'|'technical'|'none';
  onSelectionIntent?:(items:readonly WorkspaceItem[],operation:SelectionOperation)=>void;renderedOccurrences?:readonly string[];
  onClose:()=>void;onSelect:(id:string)=>void;onNavigate:(request:StructureHandoff)=>void;onInspect:(item:WorkspaceItem)=>void;onRemove:(item:WorkspaceItem)=>void;
 }=$props();
 const graph=$derived(projectStructure(document,context));
 const items=$derived(selection.items);
 const single=$derived(items.length===1?items[0]:undefined);
 let root=$state<HTMLElement>();
 $effect(()=>{const element=root;if(!element)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}};element.addEventListener('keydown',escape);return()=>element.removeEventListener('keydown',escape);});
 function itemName(item:WorkspaceItem){return selectionMember(document,graph,item,renderedOccurrences).name;}
 function selectRelated(item:WorkspaceItem,operation:SelectionOperation){if(onSelectionIntent)onSelectionIntent(item.kind==='edge'?connectionGroup(graph.edges,item.id).map(edge=>({kind:'edge' as const,id:edge.id})):[item],operation);else if(item.kind==='node')onSelect(item.id);else onInspect(item);}
 const comparison=$derived(selectionComparison(document,graph,items,context));
 const shared=$derived(selectionOverview(document,graph,items,context));
</script>
{#if single?.kind==='node'}
 <SourceDetails {onSelectionIntent} {renderedOccurrences} {document} {context} embedded selectedId={single.id} selectedOccurrence={single.occurrence} {layerProvenance} {blocked} bind:page {onClose} {onSelect} {onNavigate}/>
{:else}
 <section class="workspace-selection-details studio-type-scope" data-studio-typography aria-label="Selection details" bind:this={root}>
  {#if !items.length}<p class="empty">Select nodes, layers or connections. Ctrl-click adds to your selection.</p>
  {:else}
   <SelectionPanel bind:page hasOverview={shared.length>0} relationshipsCount={relationshipCount(graph,items)}>
    {#snippet identity()}<SelectionHeading {document} {graph} {items} {blocked} {renderedOccurrences} {onInspect} {onRemove}/>{/snippet}
    {#snippet overview()}
    <dl aria-label="Shared properties">{#each shared as fact}<div><dt>{fact.name}</dt><dd title={fact.value}>{fact.value}</dd></div>{/each}</dl>
    {/snippet}
    {#snippet relationships()}<SelectionRelationships {document} {graph} {items} {blocked} onIntent={selectRelated}/>{/snippet}
    {#snippet technical()}{#if comparison.length}<dl aria-label="Property comparison">{#each comparison as fact}<div><dt>{fact.name}</dt><dd>{fact.value}</dd></div>{/each}</dl>{/if}<dl>{#each items as item (itemKey(item))}<div><dt>{itemName(item)}</dt><dd><code>{item.kind==='node'?item.occurrence??item.id:graph.edges.find(edge=>edge.id===item.id)?.data?.path}</code>{#if item.kind==='edge'}{@const edge=graph.edges.find(edge=>edge.id===item.id)}{#if edge}<p>Relationship: {relationLabel(edge)}</p><p>{edge.data?.origin==='host'?'Host connection':'Document declaration'}</p><p>{edge.data?.description??relationMeaning(edge)}</p>{/if}{/if}</dd></div>{/each}</dl>{/snippet}
   </SelectionPanel>
  {/if}
 </section>
{/if}
<style>
 .workspace-selection-details{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;color:var(--vict-color-text);font:var(--studio-font-ui)}
 .empty{padding:12px;color:var(--vict-color-textMuted)}
 dl{margin:0}dl>div{display:grid;grid-template-columns:minmax(64px,1fr) minmax(0,2fr);gap:10px;padding:7px 0;border-bottom:1px solid var(--vict-color-border)}dt{color:var(--vict-color-textMuted)}dd{margin:0;overflow-wrap:anywhere;max-height:120px;overflow:auto}
</style>
