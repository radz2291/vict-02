<script lang="ts">
  import type {Snippet} from 'svelte';
  import {PanelResizer} from '@victframework/ui-editor';
  let {open=false,width=$bindable(300),graphContent,inspectionContent}:{open?:boolean;width?:number;graphContent:Snippet<[boolean]>;inspectionContent:Snippet}=$props();
  let available=$state(0);
  const narrow=$derived(available<600);
  const maximum=$derived(Math.max(240,Math.min(420,available-286)));
  const actual=$derived(Math.max(240,Math.min(maximum,width)));
</script>
<div class="structure-inspection-layout" class:inspect-open={open} class:narrow-inspect={open && narrow} bind:clientWidth={available} style:--inspection-width={`${actual}px`}>
  <div class="structure-graph" hidden={open && narrow} inert={open && narrow}>{@render graphContent(!open || !narrow)}</div>
  {#if open}
    {#if !narrow}<div class="structure-inspection-resizer"><PanelResizer label="Structure inspection width" value={actual} min={240} max={maximum} reverse onChange={(value:number)=>width=value} /></div>{/if}
    <aside class="structure-inspection-pane" aria-label="Structure inspection">{@render inspectionContent()}</aside>
  {/if}
</div>
<style>
  .structure-inspection-layout{display:grid;grid-template-columns:minmax(0,1fr);height:100%;min-height:0;min-width:0;overflow:hidden}
  .structure-inspection-layout.inspect-open{grid-template-columns:minmax(0,1fr) 6px var(--inspection-width)}
  .structure-inspection-layout.narrow-inspect{grid-template-columns:minmax(0,1fr)}
  .structure-graph{display:flex;min-height:0;min-width:0;overflow:hidden}.structure-graph[hidden]{display:none}
  .structure-graph :global(.structure-view){flex:1;min-width:0}
  .structure-inspection-resizer{display:flex;min-height:0}.structure-inspection-resizer :global(.resizer){flex:1}
  .structure-inspection-pane{min-height:0;min-width:0;overflow:hidden}
</style>
