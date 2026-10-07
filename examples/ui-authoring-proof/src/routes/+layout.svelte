<script lang="ts">
  import '@victframework/ui-svelte/styles.css';
  import { page } from '$app/state';
  let { children } = $props();
</script>

<!-- Explicit QA frame: same source/renderer in a narrow container at a wide viewport. -->
<div class="vict-app product-container" style:max-width={page.url.searchParams.get('frame') === '480' ? '480px' : undefined}>{@render children()}</div>
<style>
  :global(body) { margin: 0; }
  .product-container { container: inspection / inline-size; margin: 0 auto; }
</style>
