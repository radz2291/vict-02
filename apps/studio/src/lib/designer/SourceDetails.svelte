<script lang="ts">
  import { tick, onDestroy, onMount } from 'svelte';
  import type { UiDocument } from '@victframework/ui';
  import { projectStructure, structureFacts, structureNodePresentation, parseStructureId, type StructureHandoff } from './structure.js';
  let { document, selectedId, blocked = false, height = $bindable(240), expanded = $bindable(false), page = $bindable('properties'), availableHeight = 600, onClose, onSelect, onNavigate }: {
    document: UiDocument; selectedId?: string; blocked?: boolean; height?: number; expanded?: boolean; page?: 'properties' | 'relationships'; availableHeight?: number;
    onClose: () => void; onSelect: (id: string) => void; onNavigate: (request: StructureHandoff) => void;
  } = $props();
  const graph = $derived(projectStructure(document));
  const selected = $derived(graph.nodes.find(node => node.id === selectedId));
  const label = $derived(selected ? structureNodePresentation(document, selected.data).label : 'No selection');
  const facts = $derived(selected ? structureFacts(document, selected) : []);
  const relationships = $derived(graph.edges.filter(edge => edge.source === selectedId || edge.target === selectedId));
  let root: HTMLElement;
  onMount(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();event.stopPropagation();onClose();}};
    root.addEventListener('keydown',escape);
    return ()=>root.removeEventListener('keydown',escape);
  });
  const maxHeight = $derived(Math.max(120, Math.min(availableHeight * .6, availableHeight - 160)));
  const minHeight = $derived(Math.min(160,maxHeight));
  const effectiveHeight = $derived(Math.min(maxHeight, Math.max(minHeight, height)));
  let stopResize = () => {};
  onDestroy(() => stopResize());
  function resize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault(); stopResize();
    const initial = effectiveHeight, start = event.clientY;
    const update = (next: PointerEvent) => height = Math.max(minHeight, Math.min(maxHeight, initial + start - next.clientY));
    const stop = () => { window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    stopResize = stop;
    window.addEventListener('pointermove', update); window.addEventListener('pointerup', stop, { once: true }); window.addEventListener('pointercancel', stop, { once: true });
  }
  function resizeKey(event: KeyboardEvent) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    height = event.key === 'Home' ? minHeight : event.key === 'End' ? maxHeight : Math.max(minHeight, Math.min(maxHeight, effectiveHeight + (event.key === 'ArrowUp' ? 24 : -24)));
  }
  function navigate(destination: StructureHandoff['destination']) {
    if (!selected || blocked) return;
    onNavigate({ destination, sourceId: selected.data.sourceId, occurrence: selected.data.occurrence, key: parseStructureId(selected.id)?.[2] });
  }
  async function toggleExpanded() { expanded = !expanded; await tick(); root?.querySelector<HTMLButtonElement>('[data-expand-details]')?.focus({ preventScroll: true }); }
</script>
<section class="source-details" class:expanded aria-label="Source inspection details" style:height={`${effectiveHeight}px`} bind:this={root}>
  {#if !expanded}
  <!-- ARIA window splitter is deliberately focusable and responds to arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <div class="details-resizer" tabindex="0" role="separator" aria-orientation="horizontal" aria-label="Inspection details height" aria-valuemin={minHeight} aria-valuemax={Math.round(maxHeight)} aria-valuenow={Math.round(effectiveHeight)} onpointerdown={resize} onkeydown={resizeKey}><span></span></div>{/if}
  <header><strong title={label}>{label}</strong><button type="button" data-expand-details aria-label={expanded ? 'Restore inspection details' : 'Expand inspection details'} onclick={() => void toggleExpanded()}>{expanded ? '↙' : '↗'}</button><button type="button" aria-label="Close inspection details" onclick={onClose}>×</button></header>
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
  .source-details { box-sizing:border-box; display:flex; flex-direction:column; flex:none; min-height:0; min-width:0; border-top:1px solid var(--vict-color-border,#e1e6ee); background:var(--vict-color-surface,#fff); color:var(--vict-color-text,#26334b); font:inherit; font-size:12px; line-height:1.45; overflow:hidden; }
  .source-details.expanded { position:absolute; inset:0; height:auto !important; z-index:4; }
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
  .details-resizer { flex:none; display:flex; justify-content:center; align-items:center; height:8px; width:100%; border:0; border-radius:0; padding:0; cursor:ns-resize; touch-action:none; }
  .details-resizer span { width:36px; height:2px; background:var(--vict-color-border,#dce2eb); }
  :focus-visible { outline:2px solid var(--vict-color-focusRing,#5269bd); outline-offset:-2px; } :disabled { opacity:.5; cursor:default; }
</style>
