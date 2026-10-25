<script lang="ts">
  import type { Snippet } from 'svelte';
  let { layersOpen = $bindable(true), inspectOpen = $bindable(true), split = $bindable(50), layers, inspect }: {
    layersOpen?: boolean; inspectOpen?: boolean; split?: number; layers: Snippet; inspect: Snippet;
  } = $props();
  const id = $props.id();
  let height = $state(0);
  const minimum = $derived(Math.min(40, Math.max(0, 96 / Math.max(1, height - 7) * 100)));
  const actual = $derived(Math.max(minimum, Math.min(100 - minimum, split)));
  function resize(value:number) { split=Math.round(Math.max(minimum,Math.min(100-minimum,value))); }
  function pointer(event:PointerEvent) {
    if(event.button!==0)return;
    event.preventDefault();const target=event.currentTarget as HTMLElement;
    const start=event.clientY,initial=actual;target.focus();target.setPointerCapture(event.pointerId);
    target.onpointermove=next=>resize(initial+(next.clientY-start)/Math.max(1,height-7)*100);
    const finish=()=>{target.onpointermove=null;target.onpointerup=null;target.onlostpointercapture=null;};
    target.onpointerup=()=>{finish();target.releasePointerCapture(event.pointerId);};target.onlostpointercapture=finish;
  }
  function keyboard(event:KeyboardEvent) {
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();resize(event.key==='Home'?minimum:event.key==='End'?100-minimum:actual+(event.key==='ArrowDown'?5:-5));
  }
</script>
<div class="layers-inspect-panels" bind:clientHeight={height}>
  <section class="stack-panel" class:collapsed={!layersOpen} style:flex={layersOpen ? inspectOpen ? `${actual} 1 0px` : '1 1 0px' : '0 0 auto'} aria-label="Layers panel">
    <button id="layers-panel-header" class="stack-header" type="button" aria-expanded={layersOpen} aria-controls={`${id}-layers`} onclick={()=>layersOpen=!layersOpen}>Layers</button>
    <div id={`${id}-layers`} class="stack-content" hidden={!layersOpen}>{@render layers()}</div>
  </section>
  {#if layersOpen && inspectOpen}
    <!-- ARIA window splitter supports pointer and keyboard height adjustment. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
    <div class="stack-resizer" role="separator" tabindex="0" aria-label="Layers and Inspect split" aria-orientation="horizontal" aria-valuemin={Math.round(minimum)} aria-valuemax={Math.round(100-minimum)} aria-valuenow={Math.round(actual)} onpointerdown={pointer} onkeydown={keyboard}></div>
  {/if}
  <section class="stack-panel" class:collapsed={!inspectOpen} style:flex={inspectOpen ? layersOpen ? `${100-actual} 1 0px` : '1 1 0px' : '0 0 auto'} aria-label="Inspect panel">
    <button id="inspect-panel-header" class="stack-header" type="button" aria-expanded={inspectOpen} aria-controls={`${id}-inspect`} onclick={()=>inspectOpen=!inspectOpen}>Inspect</button>
    <div id={`${id}-inspect`} class="stack-content" hidden={!inspectOpen}>{@render inspect()}</div>
  </section>
</div>
<style>
  .layers-inspect-panels{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;overflow:hidden}
  .stack-panel{display:flex;flex-direction:column;min-height:0;overflow:hidden}
  .stack-header{display:flex;align-items:center;text-align:left;flex:none;height:34px;padding:0 10px;border:0;border-bottom:1px solid var(--vict-color-border);background:var(--vict-color-surface);color:var(--vict-color-text);font:inherit;font-weight:600;cursor:pointer}
  .stack-header:hover{background:var(--vict-control-selected)}
  .stack-content{display:flex;flex:1;min-height:0;overflow:hidden}.stack-content[hidden]{display:none}
  .stack-resizer{height:7px;flex:none;cursor:ns-resize;touch-action:none;background:var(--vict-color-bg);border-block:1px solid var(--vict-color-border)}
  .stack-resizer:hover{background:var(--vict-control-selected)}
  :focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:-2px}
</style>
