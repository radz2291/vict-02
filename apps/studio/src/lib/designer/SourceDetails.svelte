<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiDocument } from '@victframework/ui';
  import { projectStructure, structureFacts, structureNodePresentation, parseStructureId, type StructureHandoff } from './structure.js';
  let { document, selectedId, blocked = false, containFocus = false, page = $bindable('properties'), onClose, onSelect, onNavigate }: {
    document: UiDocument; selectedId?: string; blocked?: boolean; containFocus?: boolean; page?: 'properties' | 'relationships';
    onClose: () => void; onSelect: (id: string) => void; onNavigate: (request: StructureHandoff) => void;
  } = $props();
  const graph = $derived(projectStructure(document));
  const selected = $derived(graph.nodes.find(node => node.id === selectedId));
  const label = $derived(selected ? structureNodePresentation(document, selected.data).label : 'No selection');
  const facts = $derived(selected ? structureFacts(document, selected) : []);
  const relationships = $derived(graph.edges.filter(edge => edge.source === selectedId || edge.target === selectedId));
  let root: HTMLElement;
  onMount(()=>{
    const escape=(event:KeyboardEvent)=>{
      if(event.key==='Tab' && containFocus){
        const controls=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')];
        const index=controls.indexOf(globalThis.document.activeElement as HTMLElement);
        if(controls.length && ((event.shiftKey && index<=0) || (!event.shiftKey && index===controls.length-1))){event.preventDefault();controls[event.shiftKey?controls.length-1:0]?.focus({preventScroll:true});}
      }
      if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();event.stopPropagation();onClose();}
    };
    root.addEventListener('keydown',escape);
    root.querySelector<HTMLButtonElement>('[aria-label="Close inspection details"]')?.focus({preventScroll:true});
    return ()=>root.removeEventListener('keydown',escape);
  });
  function navigate(destination: StructureHandoff['destination']) {
    if (!selected || blocked) return;
    onNavigate({ destination, sourceId: selected.data.sourceId, occurrence: selected.data.occurrence, key: parseStructureId(selected.id)?.[2] });
  }
</script>
<section class="source-details" aria-label="Source inspection details" bind:this={root}>
  <header><span>Inspect</span><strong title={label}>{label}</strong><button type="button" aria-label="Close inspection details" onclick={onClose}>×</button></header>
  <nav aria-label="Source inspection view"><button type="button" aria-pressed={page === 'properties'} onclick={() => page = 'properties'}>Properties</button><button type="button" aria-pressed={page === 'relationships'} onclick={() => page = 'relationships'}>Relationships</button></nav>
  <div class="details-body">
    {#if !selected}<p>Select an item in Layers or Structure.</p>
    {:else if page === 'properties'}
      <div class="details-identity"><span>{selected.data.kindLabel ?? selected.data.kind}</span><code>{selected.data.sourceId ?? parseStructureId(selected.id)?.[2]}</code></div>
      {#if selected.data.occurrence}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('inspector')}>Edit properties ↗</button>{/if}
      {#if selected.data.kind === 'state'}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('data')}>Edit in Data ↗</button>{/if}
      {#if selected.data.kind === 'action'}<button type="button" class="details-handoff" disabled={blocked} onclick={() => navigate('actions')}>Open Actions ↗</button>{/if}
      <dl>{#each facts as fact}<div><dt>{fact.path}</dt><dd>{fact.value}</dd></div>{/each}</dl>
    {:else}
      <div class="details-relationships">{#each relationships as edge (edge.id)}{@const other = graph.nodes.find(node => node.id === (edge.source === selectedId ? edge.target : edge.source))}<button type="button" disabled={blocked} onclick={() => { if (other) onSelect(other.id); }}><strong>{other ? structureNodePresentation(document, other.data).label : 'Source item'}</strong><span>{edge.label ?? edge.data?.kind}</span><code>{edge.data?.path}</code></button>{/each}</div>
      {#if !relationships.length}<p>No declared relationships.</p>{/if}
    {/if}
  </div>
</section>
<style>
  .source-details { box-sizing:border-box; display:flex; flex-direction:column; flex:none; height:100%; min-height:0; min-width:0; border-left:1px solid var(--vict-color-border,#e1e6ee); background:var(--vict-color-surface,#fff); color:var(--vict-color-text,#26334b); font:inherit; font-size:12px; line-height:1.45; overflow:hidden; }
  header { display:flex; align-items:center; gap:4px; padding:5px 8px; flex:none; }
  header strong { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; }
  button { font:inherit; color:inherit; cursor:pointer; border:1px solid var(--vict-color-border,#dce2eb); border-radius:5px; background:var(--vict-color-surface,#fff); padding:5px 8px; }
  header button { width:28px; height:28px; border:0; padding:0; }
  nav { display:flex; gap:4px; padding:0 8px 7px; flex:none; border-bottom:1px solid var(--vict-color-border,#e1e6ee); }
  nav button { border:0; background:transparent; }
  nav button[aria-pressed=true] { background:var(--vict-rhea-muted,#eef1f7); }
  .details-body { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; padding:10px; }
  .details-identity { display:flex; gap:8px; justify-content:space-between; color:var(--vict-color-textMuted,#65748d); margin-bottom:8px; overflow-wrap:anywhere; }
  .details-handoff { margin-bottom:8px; }
  code,dt { font:11px/1.45 ui-monospace,monospace; overflow-wrap:anywhere; }
  dl { margin:0; } dl>div { display:grid; grid-template-columns:minmax(80px,1fr) minmax(0,1.25fr); gap:10px; padding:6px 0; border-top:1px solid var(--vict-color-border,#eef1f6); } dd { margin:0; overflow-wrap:anywhere; }
  .details-relationships { display:grid; gap:6px; }.details-relationships button { display:flex; flex-direction:column; gap:3px; text-align:left; overflow-wrap:anywhere; }
  .details-relationships span,p { color:var(--vict-color-textMuted,#65748d); }
  :focus-visible { outline:2px solid var(--vict-color-focusRing,#5269bd); outline-offset:-2px; } :disabled { opacity:.5; cursor:default; }
</style>
