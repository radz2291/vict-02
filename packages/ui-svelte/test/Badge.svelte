<script lang="ts">
  /** A real custom Svelte component used as the registered code island in tests. */
  let { label = 'badge' }: { label?: string } = $props();
</script>

<span class="test-badge" data-testid="custom-badge">{label}</span>

<style>
  .test-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--vict-color-accent, #3b5bdb);
    color: var(--vict-color-accentContrast, #fff);
  }
</style>
