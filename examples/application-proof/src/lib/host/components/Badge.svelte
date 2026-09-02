<script lang="ts">
  // A genuine custom Svelte component, registered OUTSIDE the serializable
  // definition through the versioned component registry (id: cmp.badge@1).
  let { label }: { label: string } = $props();
</script>

<span class="vict-badge" data-testid="custom-badge">★ {label}</span>

<style>
  .vict-badge {
    border: 1px solid #6c63ff;
    border-radius: 999px;
    padding: 0.15rem 0.7rem;
    font-size: 0.85rem;
  }
</style>
