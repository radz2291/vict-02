<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    surfaceId?: string;
    componentId?: string;
    children: Snippet;
  }
  let { surfaceId, componentId, children }: Props = $props();
</script>

<div class="vict-component-slot" data-surface={surfaceId} data-component={componentId}>
  {@render children()}
</div>
