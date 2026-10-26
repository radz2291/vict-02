<script lang="ts">
  import type {Snippet} from 'svelte';
  let {context=$bindable<'document'|'selection'>('document'),onClose,documentContent,selectionContent}:{context?:'document'|'selection';onClose:()=>void;documentContent:Snippet;selectionContent:Snippet}=$props();
  const id=$props.id();
  function keys(event:KeyboardEvent){
    const next=event.key==='ArrowRight'||event.key==='End'?'selection':event.key==='ArrowLeft'||event.key==='Home'?'document':undefined;
    if(!next)return;event.preventDefault();context=next;
    (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(`[data-context="${next}"]`)?.focus();
  }
</script>
<header class="details-header">
  <div role="tablist" tabindex="-1" aria-label="Panel context" onkeydown={keys}>
    {#each ['document','selection'] as const as choice}
      <button type="button" role="tab" data-context={choice} id={`${id}-${choice}-tab`} aria-selected={context===choice} aria-controls={`${id}-${choice}`} tabindex={context===choice?0:-1} onclick={()=>context=choice}>{choice==='document'?'Document':'Selection'}</button>
    {/each}
  </div>
  <button class="close-document" type="button" aria-label="Close panel" title="Close panel (Escape)" onclick={onClose}>×</button>
</header>
<div class="context-content" role="tabpanel" id={`${id}-document`} aria-labelledby={`${id}-document-tab`} hidden={context!=='document'} inert={context!=='document'}>{@render documentContent()}</div>
<div class="context-content" role="tabpanel" id={`${id}-selection`} aria-labelledby={`${id}-selection-tab`} hidden={context!=='selection'} inert={context!=='selection'}>{@render selectionContent()}</div>
<style>
  .details-header{display:flex;flex:none;height:40px;min-height:40px;border-bottom:1px solid var(--vict-color-border)}
  [role=tablist]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));flex:1;min-width:0}
  button{font:inherit;cursor:pointer;border:0;border-radius:0;background:transparent;color:var(--vict-color-textMuted)}
  [role=tab]{position:relative;min-width:0;padding:0 12px;text-align:center;border-right:1px solid var(--vict-color-border);background:var(--vict-color-bg)}
  [role=tab][aria-selected=true]{background:var(--vict-color-surface);color:var(--vict-color-text);font-weight:600}
  [role=tab][aria-selected=true]::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--vict-color-accent)}
  [role=tab]:hover,.close-document:hover{color:var(--vict-color-text);background:var(--vict-control-selected)}
  .close-document{flex:none;width:32px;font-size:18px;padding:0;display:grid;place-items:center}
  .context-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:hidden}.context-content[hidden]{display:none}
  :focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:-1px}
</style>
