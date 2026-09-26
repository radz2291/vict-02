<script lang="ts">
  import { BitsConfig } from 'bits-ui';
  import type { Snippet } from 'svelte';
  let {
    children,
    locale = 'en-GB',
    class: className = '',
  }: {
    children: Snippet;
    locale?: string;
    class?: string;
  } = $props();
  let root = $state<HTMLDivElement>();
</script>

<!-- The portal target keeps product tokens and catalog styling with the controls.
     Put the scope outside clipped/transforming containers, just like an app root. -->
<div class={`vict-controls ${className}`} bind:this={root}>
  <BitsConfig defaultLocale={locale} defaultPortalTo={root}>
    {@render children()}
  </BitsConfig>
</div>
