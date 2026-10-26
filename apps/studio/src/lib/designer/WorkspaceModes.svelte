<script lang="ts">
  let {view='design',onChange}:{view?:'design'|'interact'|'structure';onChange:(view:'design'|'interact'|'structure')=>void}=$props();
</script>
<div class="canvas-modes" role="group" aria-label="Workspace mode">
  {#each ['design','interact','structure'] as const as choice}
    <button type="button" aria-pressed={view===choice} onclick={()=>onChange(choice)}>{choice[0].toUpperCase()+choice.slice(1)}</button>
  {/each}
</div>
<style>
  .canvas-modes{display:flex;gap:2px;padding:2px;background:var(--vict-control-selected);border-radius:6px}
  button{font:inherit;font-size:11px;padding:4px 7px;border:0;border-radius:4px;background:transparent;color:var(--vict-color-textMuted);cursor:pointer}
  button[aria-pressed=true]{background:var(--vict-color-surface);color:var(--vict-color-accent);box-shadow:0 1px 4px #25334f14}
  button:focus-visible{outline:2px solid var(--vict-color-accent);outline-offset:1px}
</style>
