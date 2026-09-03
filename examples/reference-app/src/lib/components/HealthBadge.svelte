<script lang="ts">
  /**
   * A custom Svelte component (code island) registered in the versioned
   * component registry as cmp.health@1. It receives ONLY its declared
   * props — never the runtime, the database, the registry, or secrets.
   */
  let { label = 'health' }: { label?: string } = $props();
</script>

<span class="health-badge" data-testid="custom-health">
  <span class="health-dot" aria-hidden="true"></span>
  {label}
</span>

<style>
  .health-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--vict-color-surface, #fff);
    border: 1px solid var(--vict-color-success, #1e7145);
    color: var(--vict-color-success, #1e7145);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .health-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--vict-color-success, #1e7145);
  }
</style>
