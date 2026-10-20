<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  let { page = $bindable('format'), name, format, insert, arrange, connect, focusSignal, locked = false }: {
    locked?: boolean;
    page?: 'format' | 'insert' | 'arrange' | 'connect'; name: string;
    format: Snippet; insert: Snippet; arrange: Snippet; connect?: Snippet; focusSignal?: symbol;
  } = $props();
  const pages: readonly ('format' | 'insert' | 'arrange' | 'connect')[] = $derived(connect ? ['format', 'insert', 'arrange', 'connect'] as const : ['format', 'insert', 'arrange'] as const);
  const uid = $props.id();
  let root = $state<HTMLElement>();
  function change(next: typeof page, focus = false) {
    if (locked) return;
    page = next;
    if (focus) void tick().then(() => root?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus());
  }
  function navigate(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = pages.indexOf(page);
    change(pages[event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : pages.length - 1)) % pages.length]!, true);
  }
  // A newly opened floating surface is positioned on the next layout frame.
  $effect(() => { if (focusSignal) untrack(() => { void tick().then(() => requestAnimationFrame(() => requestAnimationFrame(() => root?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus()))); }); });
</script>
<div class="palette" bind:this={root} aria-label={`Tools for ${name}`}>
  <div class="palette-header">
    <div role="tablist" aria-label="Tool pages">
      {#each pages as item}<button type="button" role="tab" id={`${uid}-${item}`} aria-controls={`${uid}-panel`} aria-label={`${item[0]!.toUpperCase()}${item.slice(1)} tools`} aria-selected={page === item} tabindex={page === item ? 0 : -1} disabled={locked && page !== item} onclick={() => change(item)} onkeydown={navigate}>{item[0]!.toUpperCase()}{item.slice(1)}</button>{/each}
    </div>
    <span title={name}>{name}</span>
  </div>
  <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${page}`} tabindex="0" class="palette-body" data-ui-tool-body>
    {#if page === 'format'}{@render format()}{:else if page === 'insert'}{@render insert()}{:else if page === 'arrange'}{@render arrange()}{:else}{@render connect?.()}{/if}
  </div>
</div>
<style>
  .palette {font:11px/1.4 'Segoe UI',system-ui,sans-serif; color:#34425a;}
  .palette-header {display:flex;align-items:center;gap:8px;padding:4px 30px 4px 7px;border-bottom:1px solid #e4e8f0;}
  [role=tablist] {display:flex;gap:2px;flex-shrink:0;}
  [role=tab] {width:58px;text-align:center;border:0;border-radius:4px;background:transparent;color:#78869c;padding:5px 8px;font:inherit;cursor:pointer;}
  [role=tab][aria-selected=true] {background:#edf1ff;color:#405abd;font-weight:600;}
  .palette-header > span {margin-left:auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#8a96a8;font-size:10px;}
  .palette-body {height:auto;max-height:min(244px,calc(100dvh - 220px));min-height:0;overflow:auto;padding:7px;box-sizing:border-box;overscroll-behavior:contain;}
  .palette-body > :global(*) {max-width:100%;} :disabled {opacity:.4;cursor:default;}
  :focus-visible {outline:2px solid #5269bd;outline-offset:-1px;}
</style>
