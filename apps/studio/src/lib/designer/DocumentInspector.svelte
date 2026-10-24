<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { UiDocument } from '@victframework/ui';
  import { projectStructure, structureFacts, structureNodePresentation, parseStructureId, type StructureHandoff } from './structure.js';
  export type InspectorPage = 'Content' | 'Behavior' | 'Relationships';
  let { document, itemId, open = $bindable(false), expanded = $bindable(false), page = $bindable<InspectorPage>('Content'), revealSignal, blocked = false, editor, onSelectItem, onNavigate, onNotice }: {
    document: UiDocument; itemId?: string; open?: boolean; expanded?: boolean; page?: InspectorPage; revealSignal?: symbol; blocked?: boolean;
    editor: Snippet<['Content' | 'Style' | 'Behavior']>; onSelectItem: (id: string) => void;
    onNavigate: (request: StructureHandoff) => void; onNotice: (message: string) => void;
  } = $props();
  const uid = $props.id();
  let collapsed = $state(false);
  let height = $state(280);
  let dragging = $state(false);
  let startY = 0, startHeight = 0;
  let root = $state<HTMLElement>();
  let returnFocus: HTMLElement | undefined;
  const graph = $derived(projectStructure(document));
  const item = $derived(graph.nodes.find(node => node.id === itemId));
  const facts = $derived(item ? structureFacts(document, item) : []);
  const related = $derived(graph.edges.filter(edge => (edge.source === itemId || edge.target === itemId) && edge.data?.kind !== 'containment'));
  const editable = $derived(!!item?.data.occurrence);
  const pages = $derived<InspectorPage[]>(editable ? ['Content', 'Behavior', 'Relationships'] : ['Content', 'Relationships']);
  const effectivePage = $derived(pages.includes(page) ? page : 'Content');
  $effect(() => {
    if (!revealSignal) return;
    collapsed = false;
    returnFocus = globalThis.document.activeElement instanceof HTMLElement ? globalThis.document.activeElement : undefined;
    void tick().then(() => root?.querySelector<HTMLElement>('[role=tab][tabindex="0"]')?.focus({ preventScroll: true }));
  });
  function guarded(action: () => void) { if (blocked) onNotice('Apply or cancel your draft first.'); else action(); }
  function close() { guarded(() => { open = false; expanded = false; if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); }); }
  function escape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault(); event.stopPropagation();
    if (expanded) expanded = false; else close();
  }
  function resize(next: number) { height = Math.max(160, Math.min(520, Math.round(next))); }
  function resizeKey(event: KeyboardEvent) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    resize(event.key === 'Home' ? 160 : event.key === 'End' ? 520 : height + (event.key === 'ArrowUp' ? 16 : -16));
  }
  function tabs(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    guarded(() => {
      const index = pages.indexOf(effectivePage);
      page = pages[event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : pages.length - 1)) % pages.length]!;
      void tick().then(() => root?.querySelector<HTMLElement>('[role=tab][tabindex="0"]')?.focus());
    });
  }
  function navigate(destination: StructureHandoff['destination']) {
    if (item) onNavigate({ destination, occurrence: item.data.occurrence, sourceId: item.data.sourceId, key: parseStructureId(item.id)?.[2] });
  }
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="document-inspector" class:expanded class:collapsed hidden={!open} style:--inspector-height={`${height}px`} aria-label="Document Inspector" bind:this={root} onkeydown={escape}>
  {#if open}
    {#if !collapsed && !expanded}
      <!-- ARIA window splitter; upward movement increases the bottom pane. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
      <div class="height-resizer" role="separator" aria-orientation="horizontal" aria-label="Inspector height" aria-valuemin="160" aria-valuemax="520" aria-valuenow={height} tabindex="0" onkeydown={resizeKey}
        onpointerdown={event => { event.preventDefault(); event.currentTarget.focus(); startY = event.clientY; startHeight = height; dragging = true; event.currentTarget.setPointerCapture(event.pointerId); }}
        onpointermove={event => { if (dragging) resize(startHeight + startY - event.clientY); }}
        onpointerup={event => { dragging = false; event.currentTarget.releasePointerCapture(event.pointerId); }} onlostpointercapture={() => dragging = false}><span></span></div>
    {/if}
    <header><strong title={item ? structureNodePresentation(document, item.data).label : undefined}>{item ? structureNodePresentation(document, item.data).label : 'Inspector'}</strong>
      <button type="button" disabled={blocked} aria-label={collapsed ? 'Expand Inspector' : 'Collapse Inspector'} aria-expanded={!collapsed} onclick={() => { collapsed = !collapsed; if (collapsed) expanded = false; }}>{collapsed ? '⌃' : '⌄'}</button>
      <button type="button" aria-label={expanded ? 'Restore Inspector' : 'Maximize Inspector'} aria-pressed={expanded} onclick={() => { expanded = !expanded; collapsed = false; }}>{expanded ? '↙' : '↗'}</button>
      <button type="button" disabled={blocked} aria-label="Close Inspector" onclick={close}>×</button>
    </header>
    <div class="inspector-detail" hidden={collapsed}>
      <div role="tablist" aria-label="Inspector sections">
        {#each pages as section}<button type="button" role="tab" id={`${uid}-${section}`} aria-controls={`${uid}-body`} aria-selected={effectivePage === section} tabindex={effectivePage === section ? 0 : -1} disabled={blocked && effectivePage !== section} onclick={() => page = section} onkeydown={tabs}>{section === 'Content' ? (editable ? 'Format' : 'Properties') : section}</button>{/each}
      </div>
      <div class="inspector-content" role="tabpanel" id={`${uid}-body`} aria-labelledby={`${uid}-${effectivePage}`} tabindex="0">
        {#if !item}<p>Select an object in Layers, Structure or the canvas.</p>
        {:else if effectivePage === 'Relationships'}
          <div class="relations">{#each related as edge}{@const other = graph.nodes.find(node => node.id === (edge.source === itemId ? edge.target : edge.source))}<button type="button" disabled={blocked || !other} onclick={() => { if (other) onSelectItem(other.id); }}><strong>{other ? structureNodePresentation(document, other.data).label : 'Source item'}</strong><span>{edge.label}</span><code>{edge.data?.path}</code></button>{/each}</div>
          {#if !related.length}<p>No declared relationships.</p>{/if}
        {:else if editable}{@render editor(effectivePage)}
        {:else}
          <div class="source-identity"><span>{item.data.kindLabel ?? item.data.kind}</span><code>{parseStructureId(item.id)?.[2]}</code></div>
          {#if item.data.kind === 'state'}<button type="button" disabled={blocked} onclick={() => navigate('data')}>Edit in Data</button>{/if}
          {#if item.data.kind === 'action'}<button type="button" disabled={blocked} onclick={() => navigate('actions')}>Open Actions</button>{/if}
          <div class="facts">{#each facts as fact}<div><code>{fact.path}</code><span>{fact.value}</span></div>{/each}</div>
        {/if}
      </div>
    </div>
  {/if}
</section>
<style>
  .document-inspector { display: flex; flex-direction: column; flex: 0 0 auto; height: min(var(--inspector-height), 55%); max-height: calc(100% - 240px); min-height: 100px; min-width: 0; background: white; color: #34425a; border-top: 1px solid #dce2eb; font: 12px/1.45 'Segoe UI', system-ui, sans-serif; overflow: hidden; }
  .document-inspector[hidden], [hidden] { display: none; }
  .document-inspector.expanded { position: absolute; inset: 38px 0 0; height: auto; max-height: none; z-index: 5; }
  .document-inspector.collapsed { height: 36px; min-height: 36px; max-height: 36px; }
  header { display: flex; align-items: center; gap: 2px; padding: 3px 8px; flex-shrink: 0; }
  header strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  button { font: inherit; color: inherit; cursor: pointer; background: white; border: 1px solid #dce2eb; border-radius: 4px; padding: 5px 8px; }
  header button { border: 0; width: 28px; height: 28px; padding: 0; font-size: 17px; }
  button:hover { background: #edf1ff; } button:disabled { opacity: .4; cursor: default; }
  :focus-visible { outline: 2px solid #5269bd; outline-offset: -2px; }
  .height-resizer { display: grid; place-items: center; height: 6px; flex-shrink: 0; cursor: row-resize; touch-action: none; background: #f4f6f9; }
  .height-resizer:hover { background: #e5ebfb; } .height-resizer span { height: 2px; width: 30px; border-radius: 2px; background: #cbd4e4; }
  .inspector-detail { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  [role=tablist] { display: flex; gap: 2px; flex-shrink: 0; padding: 0 8px 5px; border-bottom: 1px solid #e8ebf1; }
  [role=tab] { flex: 1; border: 0; padding: 5px 3px; font-size: 11px; }
  [role=tab][aria-selected=true] { color: #405abd; background: #edf1ff; }
  .inspector-content { overflow: auto; min-height: 0; padding: 8px; overscroll-behavior: contain; }
  p { color: #65748d; margin: 4px 0; } code { font-size: 10px; overflow-wrap: anywhere; color: #65748d; }
  .relations { display: grid; gap: 6px; } .relations button { display: flex; flex-direction: column; text-align: left; gap: 3px; }
  .relations span { color: #65748d; } .source-identity { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
  .facts > div { display: grid; grid-template-columns: minmax(70px,1fr) 1fr; gap: 10px; padding: 7px 0; border-top: 1px solid #eef1f6; overflow-wrap: anywhere; }
</style>
