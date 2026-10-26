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
  .details-header{display:flex;align-items:center;justify-content:space-between;flex:none;min-height:42px;padding:5px 8px;border-bottom:1px solid var(--vict-color-border);gap:8px}
  [role=tablist]{display:flex;gap:3px;min-width:0}button{font:inherit;cursor:pointer;border:0;border-radius:4px;background:transparent;color:var(--vict-color-textMuted);padding:6px 9px}
  [role=tab][aria-selected=true]{background:var(--vict-control-selected);color:var(--vict-color-text);font-weight:600}.close-document{font-size:18px;padding:2px 7px}
  .context-content{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;overflow:hidden}.context-content[hidden]{display:none}
  :focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:-1px}
</style>
