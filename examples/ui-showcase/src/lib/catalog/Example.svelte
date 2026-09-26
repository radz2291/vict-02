<script lang="ts">
  import type { Snippet } from 'svelte';
  let { family, title, children }: { family: string; title: string; children: Snippet } = $props();
</script>

<section
  class="vict-control-panel vict-control-stack"
  data-family={family}
  aria-labelledby={`example-${family}`}
>
  <h3 id={`example-${family}`}>{title}</h3>
  {@render children()}
</section>
