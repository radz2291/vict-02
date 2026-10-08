<script lang="ts">
  import { Portal } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import type { UiComponentPresentation } from '../../document/extensions.js';
  let { open, presentation, children }: {
    open: boolean;
    presentation?: UiComponentPresentation;
    children: Snippet;
  } = $props();
</script>

<!-- Portal uses a separately mounted Svelte root. Its lifetime belongs to
     the controlled layer, rather than to a retained closed snippet tree.
     Bits still owns dismissal, focus scopes, scroll locking and positioning.
     The ancestor keeps the frozen descendant CSS cascade for portaled parts. -->
{#if open}
  <Portal>
    <div class={presentation?.scopeClass} style="display: contents">
      {@render children()}
    </div>
  </Portal>
{/if}
