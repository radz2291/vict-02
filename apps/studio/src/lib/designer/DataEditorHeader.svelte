<script lang="ts">
  let {name,type,dirty,onBack,onApply}:{name:string;type:string;dirty:boolean;onBack:()=>void;onApply:()=>void}=$props();
</script>
<div class="data-editor-toolbar" aria-label="Data editing controls"><button type="button" disabled={dirty} onclick={onBack}>Back</button><button type="button" disabled={!dirty} onclick={onApply}>Apply</button></div>
<div class="data-editor-heading"><h2>{name}</h2><span>{type}</span></div>
<style>
.data-editor-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.data-editor-heading{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:14px}h2{font:inherit;font-weight:600;margin:0}span{font-size:11px;color:var(--vict-color-textMuted,#65748d)}button{font:inherit;color:inherit;background:var(--vict-color-surface,#fff);border:1px solid var(--vict-color-border,#dce2eb);border-radius:4px;padding:6px 10px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible{outline:2px solid var(--vict-color-focusRing,#5269bd);outline-offset:2px}
</style>
