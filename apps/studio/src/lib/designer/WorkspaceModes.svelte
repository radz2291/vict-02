<script lang="ts">
  import WorkspaceToolIcon from './WorkspaceToolIcon.svelte';
  let {view='design',onChange,leftOpen=false,rightOpen=false,onToggleLeft,onToggleRight}:{view?:'design'|'interact'|'structure';onChange:(view:'design'|'interact'|'structure')=>void;leftOpen?:boolean;rightOpen?:boolean;onToggleLeft?:()=>void;onToggleRight?:()=>void}=$props();
</script>
<div class="workspace-mode-bar">
{#if onToggleLeft}<button type="button" class="workspace-icon-button drawer-toggle left-drawer-toggle" aria-label="Toggle Chat drawer" title={leftOpen?'Hide Chat':'Show Chat'} aria-controls="studio-chat-panel" aria-expanded={leftOpen} onclick={onToggleLeft}><WorkspaceToolIcon name="left-panel"/></button>{/if}
<div class="canvas-modes" role="group" aria-label="Workspace mode">
  {#each ['design','interact','structure'] as const as choice}
    <button type="button" aria-pressed={view===choice} onclick={()=>onChange(choice)}>{choice[0].toUpperCase()+choice.slice(1)}</button>
  {/each}
</div>
{#if onToggleRight}<button type="button" class="workspace-icon-button drawer-toggle right-drawer-toggle" aria-label="Toggle Document and Selection drawer" title={rightOpen?'Hide Document and Selection':'Show Document and Selection'} aria-controls="document-drawer" aria-expanded={rightOpen} onclick={onToggleRight}><WorkspaceToolIcon name="right-panel"/></button>{/if}
</div>
<style>
  .workspace-mode-bar{display:grid;grid-template-columns:minmax(28px,1fr) auto minmax(28px,1fr);align-items:center;gap:8px;width:100%;min-width:0}
  .canvas-modes{grid-column:2;grid-row:1}
  .drawer-toggle{grid-row:1}
  .left-drawer-toggle{grid-column:1;justify-self:start}
  .right-drawer-toggle{grid-column:3;justify-self:end}
  .drawer-toggle[aria-expanded=true]{background:var(--vict-control-selected);color:var(--vict-color-accent)}
  .canvas-modes{display:flex;gap:2px;padding:2px;background:var(--vict-control-selected);border-radius:6px}
  button{font:inherit;font-size:11px;padding:4px 7px;border:0;border-radius:4px;background:transparent;color:var(--vict-color-textMuted);cursor:pointer}
  button[aria-pressed=true]{background:var(--vict-color-surface);color:var(--vict-color-accent);box-shadow:0 1px 4px #25334f14}
  button:focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:1px}
</style>
