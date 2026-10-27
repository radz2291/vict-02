<script lang="ts">
  import './disclosures.css';
  import './studio-cards.css';
  import SelectionSections from './SelectionSections.svelte';
  import SelectionRelationships from './SelectionRelationships.svelte';
  import {relationshipCount} from './selection-relationships.js';
  import {selectionIdentity,sourceOverview} from './selection-presentation.js';
  import {connectionGroup} from './structure-trace.js';
  import type {WorkspaceItem} from './workspace-selection.js';
  import type {SelectionOperation} from '@victframework/ui-editor';
  import { onMount } from 'svelte';
  import type { UiDocument } from '@victframework/ui';
  import { projectStructure, structureFacts, structureNodePresentation, parseStructureId, type StructureHandoff, type StructureContext } from './structure.js';
  import { SourceIdentity,resolveOccurrence } from '@victframework/ui-editor';

  let { document, context={}, selectedId, selectedOccurrence, layerProvenance, blocked = false, containFocus = false, embedded=false, page = $bindable('properties'), onClose, onSelect, onNavigate, onSelectionIntent, renderedOccurrences }: {
    document: UiDocument; context?:StructureContext; selectedId?: string; selectedOccurrence?:string; layerProvenance?:{occurrence:string;detail:string}; embedded?:boolean; blocked?: boolean; containFocus?: boolean; page?: 'properties' | 'relationships' | 'technical' | 'none';
    renderedOccurrences?:readonly string[];onSelectionIntent?:(items:readonly WorkspaceItem[],operation:SelectionOperation)=>void;
    onClose: () => void; onSelect: (id: string) => void; onNavigate: (request: StructureHandoff) => void;
  } = $props();
  const graph = $derived(projectStructure(document,context));
  const selected = $derived(graph.nodes.find(node => node.id === selectedId));
  const label = $derived(selected ? structureNodePresentation(document, selected.data).label : 'No selection');
  const fullLabel = $derived(selected ? structureNodePresentation(document, selected.data).fullLabel : 'No selection');
  const facts = $derived(selected ? structureFacts(document, selected,context) : []);
  const item=$derived({kind:'node' as const,id:selectedId??'',...(selectedOccurrence?{occurrence:selectedOccurrence}:{})});
  const identity=$derived(selectionIdentity(document,graph,item,renderedOccurrences));
  const summary=$derived(selected?sourceOverview(document,graph,selected.id,context):[]);
  function selectRelated(item:WorkspaceItem,operation:SelectionOperation){if(onSelectionIntent)onSelectionIntent(item.kind==='edge'?connectionGroup(graph.edges,item.id).map(edge=>({kind:'edge' as const,id:edge.id})):[item],operation);else if(item.kind==='node')onSelect(item.id);}
  const provenance=$derived.by(()=>{
    if(!selected || !selectedOccurrence)return [];
    const occurrence=resolveOccurrence(selectedOccurrence,document);
    if(parseStructureId(selected.id)?.[1]!=='node' || selected.data.sourceId!==occurrence.sourceNodeId)return [];
    const result=[{path:'Source node',value:occurrence.sourceNodeId},{path:'Occurrence',value:selectedOccurrence}];
    if(occurrence.owningDefinitionId)result.push({path:'Owning definition',value:occurrence.owningDefinitionId});
    if(occurrence.instancePath.length)result.push({path:'Instance path',value:occurrence.instancePath.map(item=>item.sourceNodeId+' @ '+item.definitionId).join(' / ')});
    if(occurrence.repeatKeys.length)result.push({path:'Record keys',value:occurrence.repeatKeys.join(' / ')});
    if(occurrence.portalPath.length)result.push({path:'Portal ownership',value:occurrence.portalPath.map(item=>item.sourceNodeId+' → '+item.overlayId).join(' / ')});
    if(layerProvenance?.occurrence===selectedOccurrence)result.push({path:'Layer provenance',value:layerProvenance.detail});
    return result;
  });
  let root: HTMLElement;
  onMount(()=>{
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Tab' && containFocus){
        const closed=[...root.querySelectorAll('details:not([open])')];
        const controls=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),summary,a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(element=>!element.closest('[hidden],[inert]') && !closed.some(details=>details.contains(element) && details.querySelector(':scope > summary')!==element));
        const index=controls.indexOf(globalThis.document.activeElement as HTMLElement);
        if(controls.length && ((event.shiftKey && index<=0) || (!event.shiftKey && index===controls.length-1))){event.preventDefault();controls[event.shiftKey?controls.length-1:0]?.focus({preventScroll:true});}
      }
      if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();event.stopPropagation();onClose();}
    };
    root.addEventListener('keydown',escape);
    if(!embedded)root.querySelector<HTMLButtonElement>('[aria-label="Close inspection details"]')?.focus({preventScroll:true});
    return ()=>root.removeEventListener('keydown',escape);
  });
  function navigate(destination: StructureHandoff['destination']) {
    if (!selected || blocked) return;
    onNavigate({ destination, sourceId: selected.data.sourceId, occurrence: selectedOccurrence??selected.data.occurrence, key: parseStructureId(selected.id)?.[2] });
  }
</script>
<section data-studio-typography class="studio-type-scope source-details" aria-label="Source inspection details" bind:this={root}>
  <header>{#if !embedded}<span>Inspect</span>{/if}<div class="selection-identity-card"><SourceIdentity icon={identity.iconKey} name={label} title={fullLabel} kindLabel={selected&&identity.type.toLowerCase()!==label.toLowerCase()?identity.type:undefined} context={[identity.scope,identity.textLocation].filter(Boolean).join(' · ')||undefined} variant="card"/></div>{#if !embedded}<button type="button" aria-label="Close inspection details" onclick={onClose}>×</button>{/if}</header>
  {#if !selected}<p class="empty-selection">Select an item on the canvas, in Layers or in the graph.</p>
  {:else}<SelectionSections bind:page relationshipsCount={relationshipCount(graph,[item])}>
    {#snippet overview()}
      {#if identity.availability}<p class="selection-availability">{identity.availability}</p>{/if}
      {#if identity.textLocation}<p class="text-location-explanation">The canvas uses the containing element for the highlight. The text remains selected.</p>{/if}
      {#if selected.data.occurrence}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('inspector')}>{identity.type==='Text'?'Locate text on canvas ↗':'Edit on canvas ↗'}</button>{/if}
      {#if selected.data.kind === 'state'}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('data')}>Edit in Data ↗</button>{/if}
      {#if selected.data.kind === 'action'}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('actions')}>Open Actions ↗</button>{/if}
      <dl class="useful-facts">{#each summary as fact}<div><dt>{fact.name}</dt><dd>{fact.value}</dd></div>{/each}</dl>
    {/snippet}
    {#snippet relationships()}<SelectionRelationships {document} {graph} items={[item]} {blocked} onIntent={selectRelated}/>{/snippet}
    {#snippet technical()}<dl>{#each [...provenance,...facts] as fact}<div><dt>{fact.path}</dt><dd>{fact.value}</dd></div>{/each}</dl>{/snippet}
  </SelectionSections>{/if}
</section>
<style>
  .source-details { box-sizing:border-box; display:flex; flex-direction:column; flex:none; height:100%; min-height:0; min-width:0; border-left:1px solid var(--vict-color-border,#e1e6ee); background:var(--vict-color-surface,#fff); color:var(--vict-color-text,#26334b); font:var(--studio-font-ui,12px/1.45 system-ui,sans-serif); overflow:hidden; }
  header { display:flex; align-items:center; gap:6px; padding:12px;box-sizing:border-box;flex:none;border-bottom:1px solid var(--vict-color-border,#e1e6ee); }
  button:not(.studio-section-header) { font:inherit; color:inherit; cursor:pointer; border:1px solid var(--vict-color-border,#dce2eb); border-radius:5px; background:var(--vict-color-surface,#fff); padding:5px 8px; }
  header button { width:28px; height:28px; border:0; padding:0; }
  .empty-selection{padding:10px}.selection-availability{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}
  .text-location-explanation{margin:0 0 8px;font:var(--studio-font-meta);color:var(--vict-color-textMuted)}
  .details-handoff { margin-bottom:8px; }
  dt { font:11px/1.45 ui-monospace,monospace; overflow-wrap:anywhere; }
  dl { margin:0; } dl>div { display:grid; grid-template-columns:minmax(80px,1fr) minmax(0,1.25fr); gap:10px; padding:6px 0; border-top:1px solid var(--vict-color-border,#eef1f6); } dd { margin:0; overflow-wrap:anywhere; }
  .useful-facts dt{font:inherit;color:var(--vict-color-textMuted,#65748d)}
  :focus-visible { outline:2px solid var(--vict-color-focusRing,#5269bd); outline-offset:-2px; } :disabled { opacity:.5; cursor:default; }
</style>
