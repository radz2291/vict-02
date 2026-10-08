<script lang="ts" generics="T extends HTMLElement">
  import type { Snippet } from 'svelte';
  let { as, attributes, ref = $bindable(null), children }: {
    as: 'button' | 'div';
    attributes: Readonly<Record<string, unknown> & Record<symbol, unknown>>;
    ref?: T | null;
    children?: Snippet;
  } = $props();
  const domAttributes = $derived(as === 'button' ? { type: 'button', ...attributes } : attributes);
  // bits-ui supplies attachment symbols alongside string attributes; the DOM
  // spread owns both, while the declaration above keeps authors type-honest.
  const domSpread = $derived(domAttributes as Record<string, unknown>);
</script>

<!-- The catalog's child API supplies ALL handlers and attachment symbols.
     Forward its public ref to the same DOM node; focus, presence and option
     activation must never depend on a presentation wrapper's DOM identity. -->
<svelte:element
  this={as}
  {...domSpread}
  bind:this={() => ref, (node: Element | null) => { ref = node as T | null; }}
>
  {@render children?.()}
</svelte:element>
