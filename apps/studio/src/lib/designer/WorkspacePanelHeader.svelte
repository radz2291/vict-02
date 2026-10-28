<script lang="ts">
  import type { Snippet } from 'svelte';
  import {Button} from '@victframework/ui-svelte/catalog/button';
  let { label, onClose, children }: {label:string;onClose:()=>void;children:Snippet}=$props();
</script>
<header class="workspace-panel-header">
  <div class="panel-heading-content">{@render children()}</div>
  <Button.Root class="vict-btn vict-btn--quiet panel-close" type="button" aria-label={`Hide ${label}`} title={`Hide ${label} (Escape)`} onclick={onClose}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
  </Button.Root>
</header>
<style>
  .workspace-panel-header{display:flex;align-items:center;box-sizing:border-box;flex:none;height:var(--studio-panel-header-height,40px);min-height:var(--studio-panel-header-height,40px);border-bottom:1px solid var(--vict-color-border);color:var(--vict-color-text);background:var(--vict-color-surface)}
  .panel-heading-content{display:flex;align-items:stretch;flex:1;min-width:0;height:100%}
  .workspace-panel-header :global(.panel-close){flex:none;width:var(--studio-icon-control-size,32px);height:var(--studio-icon-control-size,32px);margin:0 var(--studio-space-1)}
</style>
