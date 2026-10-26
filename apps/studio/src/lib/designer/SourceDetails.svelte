<script lang="ts">
  import './disclosures.css';
  import './studio-cards.css';
  import {groupStructureRelationships,connectionKinds} from './structure-connections.js';
  import { onMount } from 'svelte';
  import type { UiDocument } from '@victframework/ui';
  import { projectStructure, structureFacts, structureNodePresentation, parseStructureId, type StructureHandoff } from './structure.js';
  import { resolveOccurrence } from '@victframework/ui-editor';
  import { readableName } from './presentation.js';
  import { structureBehavior } from './structure-behavior.js';
  let { document, selectedId, selectedOccurrence, layerProvenance, blocked = false, containFocus = false, embedded=false, page = $bindable('properties'), onClose, onSelect, onNavigate }: {
    document: UiDocument; selectedId?: string; selectedOccurrence?:string; layerProvenance?:{occurrence:string;detail:string}; embedded?:boolean; blocked?: boolean; containFocus?: boolean; page?: 'properties' | 'relationships' | 'technical' | 'none';
    onClose: () => void; onSelect: (id: string) => void; onNavigate: (request: StructureHandoff) => void;
  } = $props();
  const graph = $derived(projectStructure(document));
  const selected = $derived(graph.nodes.find(node => node.id === selectedId));
  const label = $derived(selected ? structureNodePresentation(document, selected.data).label : 'No selection');
  const fullLabel = $derived(selected ? structureNodePresentation(document, selected.data).fullLabel : 'No selection');
  const facts = $derived(selected ? structureFacts(document, selected) : []);
  const relationships = $derived(groupStructureRelationships(graph,selectedId));
  const summary = $derived.by(() => {
    if (!selected) return [];
    const tuple = parseStructureId(selected.id);
    const node = selected.data.sourceId ? document.nodes[selected.data.sourceId] : undefined;
    const nativeType=node?.kind==='element' ? ({h1:'Heading',h2:'Heading',h3:'Heading',h4:'Heading',h5:'Heading',h6:'Heading',p:'Paragraph',input:node.attributes?.type==='checkbox'?'Checkbox':'Input',select:'Select',textarea:'Text area'} as Record<string,string>)[node.tag] ?? readableName(node.tag) : undefined;
    const result = [{name:'Type',value:nativeType ?? selected.data.kindLabel ?? readableName(selected.data.kind)}];
    if (node?.kind === 'element') result.push({name:'Children',value:String(node.children.length)});
    if (node?.kind === 'component') result.push({name:'Component',value:readableName(node.definitionId)});
    if (node?.kind === 'text') result.push({name:'Content',value:node.content.type === 'literal' ? String(node.content.value) : 'Connected to screen data'});
    if (node) result.push(...structureBehavior(document,node.id));
    const styleNames:Record<string,string>={display:'Layout','flex-direction':'Direction',gap:'Spacing',width:'Width',height:'Height',padding:'Padding','font-size':'Text size',color:'Text color','background-color':'Background'};
    for(const style of node?.localStyle??[])if(styleNames[style.property])result.push({name:styleNames[style.property]!,value:style.value.type==='text'?style.value.value:style.value.type==='token'?'Theme value':'Connected value'});
    if (tuple?.[1] === 'state' && document.localState[tuple[2]]) {const state=document.localState[tuple[2]]!;result.push({name:'Value type',value:readableName(state.type)},{name:'Starting value',value:Array.isArray(state.initial)?`${state.initial.length} items`:String(state.initial)});}
    const parent = graph.edges.find(edge=>edge.target===selectedId && edge.data?.kind==='containment');
    const parentNode = parent && graph.nodes.find(node=>node.id===parent.source);
    if(parentNode)result.push({name:'Inside',value:structureNodePresentation(document,parentNode.data).label});
    return result;
  });
  const accordionId=$props.id();
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
    onNavigate({ destination, sourceId: selected.data.sourceId, occurrence: selected.data.occurrence, key: parseStructureId(selected.id)?.[2] });
  }
</script>
<section data-studio-typography class="studio-type-scope source-details" aria-label="Source inspection details" bind:this={root}>
  <header>{#if !embedded}<span>Inspect</span>{/if}<div class="selection-identity-card">{#if selected && (structureNodePresentation(document,selected.data).kindLabel ?? readableName(selected.data.kind)).toLowerCase()!==label.toLowerCase()}<span>{structureNodePresentation(document,selected.data).kindLabel ?? readableName(selected.data.kind)}</span>{/if}<strong title={fullLabel}>{label}</strong></div>{#if !embedded}<button type="button" aria-label="Close inspection details" onclick={onClose}>×</button>{/if}</header>
  <div class="selection-sections">
    {#if !selected}<p class="empty-selection">Select an item on the canvas, in Layers or in the graph.</p>
    {:else}
      <section class:expanded={page==='properties'} aria-label="Selection overview"><button class="studio-section-header" type="button" aria-expanded={page==='properties'} aria-controls={accordionId+'-overview'} onclick={()=>page=page==='properties'?'none':'properties'}>Overview</button><div id={accordionId+'-overview'} class="details-body" hidden={page!=='properties'}>
      {#if selected.data.occurrence}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('inspector')}>Edit on canvas ↗</button>{/if}
      {#if selected.data.kind === 'state'}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('data')}>Edit in Data ↗</button>{/if}
      {#if selected.data.kind === 'action'}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('actions')}>Open Actions ↗</button>{/if}
      <dl class="useful-facts">{#each summary as fact}<div><dt>{fact.name}</dt><dd>{fact.value}</dd></div>{/each}</dl>
      </div></section>
      <section class:expanded={page==='relationships'} aria-label="Selection relationships"><button class="studio-section-header" type="button" aria-expanded={page==='relationships'} aria-controls={accordionId+'-relationships'} onclick={()=>page=page==='relationships'?'none':'relationships'}>Relationships</button><div id={accordionId+'-relationships'} class="details-body" hidden={page!=='relationships'}>
      <div class="details-relationships">{#each relationships as group (group.targetId)}{@const other=graph.nodes.find(node=>node.id===group.targetId)}<button type="button" disabled={blocked} title={group.relations.flatMap(relation=>relation.paths).join('\n')} onclick={()=>{if(other)onSelect(other.id);}}><span class="relationship-label">{#each group.relations as relation}<span class="relationship-kind"><i aria-hidden="true" style:background={connectionKinds[relation.kind].color}></i>{relation.label}{relation.count>1?` (${relation.count})`:''}</span>{/each}</span><strong title={other?structureNodePresentation(document,other.data).fullLabel:undefined}>{other?structureNodePresentation(document,other.data).label:'Source item'}</strong>{#if group.count>1}<small>{group.count} source reference locations</small>{/if}</button>{/each}</div>
      {#if !relationships.length}<p>No declared relationships.</p>{/if}
      </div></section>
      <section class:expanded={page==='technical'} aria-label="Selection technical information"><button class="studio-section-header" type="button" aria-expanded={page==='technical'} aria-controls={accordionId+'-technical'} onclick={()=>page=page==='technical'?'none':'technical'}>Technical information</button><div id={accordionId+'-technical'} class="details-body" hidden={page!=='technical'}><dl>{#each [...provenance,...facts] as fact}<div><dt>{fact.path}</dt><dd>{fact.value}</dd></div>{/each}</dl></div></section>
    {/if}
  </div>
</section>
<style>
  .source-details { box-sizing:border-box; display:flex; flex-direction:column; flex:none; height:100%; min-height:0; min-width:0; border-left:1px solid var(--vict-color-border,#e1e6ee); background:var(--vict-color-surface,#fff); color:var(--vict-color-text,#26334b); font:var(--studio-font-ui,12px/1.45 system-ui,sans-serif); overflow:hidden; }
  header { display:flex; align-items:center; gap:6px; padding:12px;box-sizing:border-box;flex:none;border-bottom:1px solid var(--vict-color-border,#e1e6ee); }
  header strong { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; }
  button:not(.studio-section-header) { font:inherit; color:inherit; cursor:pointer; border:1px solid var(--vict-color-border,#dce2eb); border-radius:5px; background:var(--vict-color-surface,#fff); padding:5px 8px; }
  header button { width:28px; height:28px; border:0; padding:0; }
  .details-body { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; padding:10px; }
  .selection-sections{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}.selection-sections>section{display:flex;flex-direction:column;flex:none;min-height:0;overflow:hidden}.selection-sections>section.expanded{flex:1}.details-body[hidden]{display:none}.empty-selection{padding:10px;margin:0}.studio-section-header{flex:none}
  .details-handoff { margin-bottom:8px; }
  dt { font:11px/1.45 ui-monospace,monospace; overflow-wrap:anywhere; }
  dl { margin:0; } dl>div { display:grid; grid-template-columns:minmax(80px,1fr) minmax(0,1.25fr); gap:10px; padding:6px 0; border-top:1px solid var(--vict-color-border,#eef1f6); } dd { margin:0; overflow-wrap:anywhere; }
  .details-relationships { display:grid; gap:6px; }.details-relationships button { display:flex; flex-direction:column; gap:3px; text-align:left; overflow-wrap:anywhere; }
  .details-relationships span,p { color:var(--vict-color-textMuted,#65748d); }
  .relationship-label{display:flex;flex-wrap:wrap;gap:4px 10px}.relationship-kind{display:inline-flex;align-items:center;gap:4px}.relationship-kind i{width:5px;height:5px;border-radius:50%;flex:none}.details-relationships small{font:var(--studio-font-meta);color:var(--vict-color-textMuted)}
  .useful-facts dt{font:inherit;color:var(--vict-color-textMuted,#65748d)}
  :focus-visible { outline:2px solid var(--vict-color-focusRing,#5269bd); outline-offset:-2px; } :disabled { opacity:.5; cursor:default; }
</style>
