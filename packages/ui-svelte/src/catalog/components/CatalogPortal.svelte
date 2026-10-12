<script lang="ts">
  import { Portal } from 'bits-ui';
  import { getContext, setContext } from 'svelte';
  import { CATALOG_PORTAL_LAYER } from './portal-layer.js';
  import type { Snippet } from 'svelte';
  import type { UiComponentPresentation } from '../../document/extensions.js';
  let { open, presentation, children }: {
    open: boolean;
    presentation?: UiComponentPresentation;
    children: Snippet;
  } = $props();
  const layer = (getContext<number | undefined>(CATALOG_PORTAL_LAYER) ?? 0) + 1;
  setContext(CATALOG_PORTAL_LAYER, layer);
</script>

<!-- Portal uses a separately mounted Svelte root. Its lifetime belongs to
     the controlled layer, rather than to a retained closed snippet tree.
     Bits still owns dismissal, focus scopes, scroll locking and positioning.
     The ancestor keeps the frozen descendant CSS cascade for portaled parts. -->
{#if open}
  <Portal>
    <div class={presentation?.scopeClass} style={`display: contents; --vict-catalog-layer: ${layer * 100}`}>
      {@render children()}
    </div>
  </Portal>
{/if}
