<script lang="ts">
  /**
   * The ONE custom component of the showcase (cmp.island@1): a deliberately
   * simple code island proving the versioned component registry/slot. It
   * receives ONLY its declared primitive props — never the runtime, the
   * adapter, or the registry — and deliberately does not dominate or
   * compensate for anything the VICT components render.
   */
  let { label = 'island' }: { label?: string } = $props();
</script>

<span class="island-chip" data-testid="custom-island">
  <span class="island-dot" aria-hidden="true"></span>
  {label}
</span>

<style>
  .island-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--vict-color-surface, #fff);
    border: 1px solid var(--vict-color-info, #3556a5);
    color: var(--vict-color-info, #3556a5);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .island-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--vict-color-info, #3556a5);
  }
</style>