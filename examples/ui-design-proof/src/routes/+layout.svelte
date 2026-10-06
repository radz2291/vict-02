<script lang="ts">
  import '../design-host.css';
  let { children } = $props();
</script>

<div class="design-host">
  <header class="design-top">
    <span class="design-brand">Northwind Atelier — design proof</span>
    <nav class="design-nav" aria-label="Proof pages">
      <a href="/">Overview</a>
      <a href="/service">Finished page</a>
      <a href="/workbench">Workbench</a>
    </nav>
  </header>
  {@render children()}
</div>
