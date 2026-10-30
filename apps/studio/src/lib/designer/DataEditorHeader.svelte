<script lang="ts">
  import {Button} from '@victframework/ui-svelte/catalog/button';
  let {name,type,dirty,onBack,onApply}:{name:string;type:string;dirty:boolean;onBack:()=>void;onApply:()=>void}=$props();
</script>
<div class="data-editor-toolbar" aria-label="Data editing controls"><Button.Root class="vict-btn vict-btn--quiet" type="button" disabled={dirty} onclick={onBack}>Back</Button.Root><Button.Root class="vict-btn vict-btn--secondary" type="button" disabled={!dirty} onclick={onApply}>Apply</Button.Root></div>
<div class="data-editor-heading"><h2>{name}</h2><span class="vict-control-help">{type}</span></div>
<style>
.data-editor-toolbar{display:flex;align-items:center;justify-content:space-between;gap:var(--studio-space-2);margin-bottom:var(--studio-space-4)}.data-editor-heading{display:flex;align-items:baseline;justify-content:space-between;gap:var(--studio-space-2);margin-bottom:var(--studio-space-3)}h2{font:inherit;font-weight:var(--studio-weight-content);margin:0}
</style>
