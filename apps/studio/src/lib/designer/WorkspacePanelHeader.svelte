<script lang="ts">
  import type { Snippet } from 'svelte';
  let { label, onClose, children }: {label:string;onClose:()=>void;children:Snippet}=$props();
</script>
<header class="workspace-panel-header">
  <div class="panel-heading-content">{@render children()}</div>
  <button class="panel-close" type="button" aria-label={`Hide ${label}`} title={`Hide ${label} (Escape)`} onclick={onClose}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
  </button>
</header>
<style>
  .workspace-panel-header{display:flex;align-items:center;box-sizing:border-box;flex:none;height:40px;min-height:40px;border-bottom:1px solid var(--vict-color-border);color:var(--vict-color-text);background:var(--vict-color-surface)}
  .panel-heading-content{display:flex;align-items:stretch;flex:1;min-width:0;height:100%}
  .panel-close{display:grid;place-items:center;flex:none;width:32px;height:32px;margin:0 4px;padding:0;border:0;border-radius:4px;background:transparent;color:var(--vict-color-textMuted);cursor:pointer}
  .panel-close:hover{background:var(--vict-control-selected);color:var(--vict-color-text)}
  .panel-close:focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:-1px}
</style>
