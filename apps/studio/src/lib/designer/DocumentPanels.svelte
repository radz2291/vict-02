<script lang="ts">
  import type { Snippet } from 'svelte';
  let { active=$bindable<'data'|'actions'|'source'|'none'>('data'), dataContent, actionsContent, sourceContent }: {
    active?:'data'|'actions'|'source'|'none';dataContent:Snippet;actionsContent:Snippet;sourceContent:Snippet;
  }=$props();
  const id=$props.id();
</script>
<div class="document-sections">
  <section aria-label="Document data"><button data-document-section="data" class="document-section-header" type="button" aria-expanded={active==='data'} aria-controls={`${id}-data`} onclick={()=>active=active==='data'?'none':'data'}>Data</button><div id={`${id}-data`} class="document-section-body" hidden={active!=='data'}>{@render dataContent()}</div></section>
  <section aria-label="Document actions"><button data-document-section="actions" class="document-section-header" type="button" aria-expanded={active==='actions'} aria-controls={`${id}-actions`} onclick={()=>active=active==='actions'?'none':'actions'}>Actions</button><div id={`${id}-actions`} class="document-section-body" hidden={active!=='actions'}>{@render actionsContent()}</div></section>
  <section aria-label="Document source"><button data-document-section="source" class="document-section-header" type="button" aria-expanded={active==='source'} aria-controls={`${id}-source`} onclick={()=>active=active==='source'?'none':'source'}>Source</button><div id={`${id}-source`} class="document-section-body source-body" hidden={active!=='source'}>{@render sourceContent()}</div></section>
</div>
<style>
  .document-sections{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
  .document-section-header{display:flex;align-items:center;width:100%;height:34px;padding:0 10px;text-align:left;background:var(--vict-color-surface);color:var(--vict-color-text);font:inherit;font-weight:600;border:0;border-bottom:1px solid var(--vict-color-border);cursor:pointer}
  .document-section-header:hover{background:var(--vict-control-selected)}
  .document-section-body{display:flex;flex-direction:column;padding:12px;min-height:0;overflow:hidden}.document-section-body[hidden]{display:none}
  .document-section-body :global(.section-heading h2){display:none}
  .source-body :global(.source-editor){flex:none;height:280px;min-height:160px;width:100%;resize:vertical}
  .document-section-body :global(.application-attachment){max-height:240px}
  :focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:-2px}
</style>
