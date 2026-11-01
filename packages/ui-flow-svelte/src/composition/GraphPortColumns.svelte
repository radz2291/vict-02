<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  let {io,presentation}:UiSvelteComponentProps=$props();
</script>
<div {...presentation?.target('root')} class={`graph-port-columns ${presentation?.target('root').class??''}`}>
  <div {...presentation?.target('inputs')} class={`graph-port-column ${presentation?.target('inputs').class??''}`}>
    {#if io?.slots?.inputs}{@render io.slots.inputs()}{/if}
  </div>
  <div {...presentation?.target('outputs')} class={`graph-port-column ${presentation?.target('outputs').class??''}`}>
    {#if io?.slots?.outputs}{@render io.slots.outputs()}{/if}
  </div>
</div>
<style>
  .graph-port-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:12px;min-width:0;width:100%;box-sizing:border-box}
  .graph-port-columns:has(>.graph-port-column:empty){grid-template-columns:minmax(0,1fr)}
  .graph-port-column:empty{display:none}
  .graph-port-column{display:flex;flex-direction:column;align-items:stretch;min-width:0}
</style>
