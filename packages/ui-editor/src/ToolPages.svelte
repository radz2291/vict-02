<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  let { pages, active = $bindable(''), label = 'Tool settings', locked = false, revealSignal, children }: {
    pages: readonly { id: string; label: string }[]; active?: string; label?: string; locked?: boolean; revealSignal?: symbol; children: Snippet<[string]>;
  } = $props();
  const uid = $props.id();
  let collapsed = $state(false);
  $effect(() => { active; untrack(()=>collapsed=false); });
  $effect(() => { if(revealSignal) collapsed=false; });
  let row = $state<HTMLElement>();
  const current = $derived(pages.some(page => page.id === active) ? active : pages[0]?.id ?? '');
  async function choose(id: string, focus = false, toggle = false) {
    if (locked && id !== current) return;
    collapsed = toggle && id === current ? !collapsed : false;
    if(id !== current || !toggle) active = id; await tick();
    const button = row?.querySelector<HTMLElement>('[aria-selected=true]');
    if (focus) button?.focus();
    if (button && row) { const item = button.getBoundingClientRect(), bounds = row.getBoundingClientRect(); if (item.right > bounds.right) row.scrollLeft += item.right-bounds.right; else if(item.left < bounds.left) row.scrollLeft -= bounds.left-item.left; }
  }
  function navigate(event: KeyboardEvent) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();event.stopPropagation();
    const index = pages.findIndex(page => page.id === current);
    const next = pages[event.key === 'Home' ? 0 : event.key === 'End' ? pages.length-1 : (index+(event.key==='ArrowRight'?1:pages.length-1))%pages.length];
    if(next) void choose(next.id,true);
  }
</script>
<div class="tool-pages">
  <div class="page-tabs" role="tablist" aria-label={label} bind:this={row}>{#each pages as page, i (page.id)}<button type="button" role="tab" id={`${uid}-${i}`} aria-controls={`${uid}-panel`} aria-selected={current===page.id && !collapsed} aria-expanded={current===page.id && !collapsed} tabindex={current===page.id?0:-1} disabled={locked && current!==page.id} onclick={()=>choose(page.id,false,true)} onkeydown={navigate}>{page.label}</button>{/each}</div>
  <div class="page-content" hidden={collapsed} role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${pages.findIndex(page=>page.id===current)}`}>{@render children(current)}</div>
</div>
<style>
 .tool-pages {display:flex;flex-direction:column;min-height:0;height:auto;}.page-tabs {display:flex;gap:2px;flex-shrink:0;overflow-x:auto;scrollbar-width:thin;border-bottom:1px solid #e4e8f0;padding-bottom:4px;overscroll-behavior:contain;}.page-tabs button {font:11px/1.4 'Segoe UI',system-ui,sans-serif;border:0;border-radius:4px;background:transparent;color:#78869c;white-space:nowrap;padding:5px 7px;cursor:pointer;flex-shrink:0;}.page-tabs button[aria-selected=true] {background:#f0f3fa;color:#405abd;font-weight:600;}.page-content {flex:0 0 auto;min-height:0;overflow:auto;padding:6px 0;overscroll-behavior:contain;}:disabled {opacity:.4;cursor:default;}:focus-visible {outline:2px solid #5269bd;outline-offset:-1px;}
</style>
