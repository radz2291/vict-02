<script lang="ts">
  let {name}:{name:'left-panel'|'right-panel'|'fit-all'|'fit-selection'|'arrange'}=$props();
</script>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name==='left-panel' || name==='right-panel'}
    <rect x="3" y="4" width="18" height="16" rx="2"/><path d={name==='left-panel'?'M9 4v16':'M15 4v16'}/>
  {:else if name==='fit-all'}
    <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>
  {:else if name==='fit-selection'}
    <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 8v8m-4-4h8"/>
  {:else}
    <rect x="3" y="9" width="5" height="6" rx="1"/><rect x="16" y="3" width="5" height="6" rx="1"/><rect x="16" y="15" width="5" height="6" rx="1"/><path d="M8 12h4V6h4m-4 6v6h4"/>
  {/if}
</svg>
