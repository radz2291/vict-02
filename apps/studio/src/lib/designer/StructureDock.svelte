<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  let { open = $bindable(false), expanded = $bindable(false), height = $bindable(300), availableHeight = 600, children }: {
    open?: boolean; expanded?: boolean; height?: number; availableHeight?: number; children: Snippet;
  } = $props();
  let root: HTMLElement;
  let toggle: HTMLButtonElement;
  onMount(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !open || !(event.target instanceof Element) || !event.target.closest('.dock-bar')) return;
      event.preventDefault(); event.stopPropagation();
      if (expanded) expanded = false;
      else { open = false; toggle?.focus({preventScroll:true}); }
    };
    root.addEventListener('keydown', escape);
    return () => root.removeEventListener('keydown', escape);
  });
  const maximum = $derived(Math.max(96, availableHeight - (expanded ? 0 : 160) - 34));
  const minimum = $derived(Math.min(180, maximum));
  const actual = $derived(expanded ? maximum : Math.max(minimum, Math.min(maximum, height)));
  function setHeight(value: number) { height = Math.round(Math.max(minimum, Math.min(maximum, value))); }
  async function toggleOpen() {
    open = !open;
    await tick();
    if (open) root?.querySelector<HTMLInputElement>('[aria-label="Search structure"]')?.focus({ preventScroll: true });
    else toggle?.focus({ preventScroll: true });
  }
  function resize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const start = event.clientY, initial = actual;
    target.setPointerCapture(event.pointerId);
    target.onpointermove = next => setHeight(initial + start - next.clientY);
    target.onpointerup = () => { target.onpointermove = null; target.onpointerup = null; target.releasePointerCapture(event.pointerId); };
    target.onlostpointercapture = () => { target.onpointermove = null; target.onpointerup = null; };
  }
  function resizeKey(event: KeyboardEvent) {
    if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();
    setHeight(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : actual + (event.key === 'ArrowUp' ? 24 : -24));
  }
</script>
<section class="structure-dock" aria-label="Structure panel" bind:this={root}>
  <div class="dock-panel" hidden={!open} style:height={`${actual}px`}>
    {#if !expanded}
      <!-- ARIA window splitter supports pointer capture and keyboard height adjustment. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
      <div class="dock-resizer" role="separator" tabindex="0" aria-label="Structure panel height" aria-orientation="horizontal" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={actual} onpointerdown={resize} onkeydown={resizeKey}><span></span></div>
    {/if}
    <div class="dock-content" id="structure-dock-content">{@render children()}</div>
  </div>
  <nav class="dock-bar" aria-label="Structure panel controls">
    <button type="button" class="structure-toggle" bind:this={toggle} aria-label="Structure" aria-expanded={open} aria-controls="structure-dock-content" onclick={() => void toggleOpen()}><span aria-hidden="true">{open ? '▾' : '▸'}</span>Structure</button>
    {#if open}<button type="button" title={expanded ? 'Restore Structure' : 'Expand Structure'} aria-label={expanded ? 'Restore Structure' : 'Expand Structure'} aria-pressed={expanded} onclick={() => expanded = !expanded}>{expanded ? '↙' : '↗'}</button>{/if}
  </nav>
</section>
<style>
  .structure-dock { flex:none; min-width:0; background:var(--vict-color-surface,#fff); border-top:1px solid var(--vict-color-border,#e1e6ee); }
  .dock-panel { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
  .dock-panel[hidden] { display:none; }
  .dock-content { flex:1; min-height:0; min-width:0; overflow:hidden; }
  .dock-bar { height:34px; display:flex; align-items:center; gap:4px; padding:0 8px; border-top:1px solid var(--vict-color-border,#e1e6ee); }
  button { font:inherit; font-size:11px; color:var(--vict-color-textMuted,#65748d); background:transparent; border:0; border-radius:4px; padding:5px 8px; cursor:pointer; }
  .structure-toggle { display:flex; align-items:center; gap:6px; margin-right:auto; }
  button:hover,button[aria-expanded=true] { color:var(--vict-color-text,#26334b); background:var(--vict-rhea-muted,#eef1f7); }
  .dock-resizer { height:7px; flex:none; display:flex; align-items:center; justify-content:center; touch-action:none; cursor:ns-resize; }
  .dock-resizer span { width:36px; height:2px; background:var(--vict-color-border,#e1e6ee); }
  :focus-visible { outline:2px solid var(--vict-color-focusRing,#5269bd); outline-offset:-2px; }
</style>
