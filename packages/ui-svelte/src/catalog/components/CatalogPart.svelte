<script lang="ts" generics="T extends HTMLElement">
  import type { Snippet } from 'svelte';
  interface Props {
    as: 'button' | 'div';
    attributes: Readonly<Record<string | symbol, unknown>>;
    ref?: T | null;
    children?: Snippet;
  }
  let { as, attributes, ref = $bindable(null), children }: Props = $props();
  const domAttributes = $derived(as === 'button' ? { type: 'button', ...attributes } : attributes);
</script>

<!-- The catalog's child API supplies ALL handlers and attachment symbols.
     Forward its public ref to the same DOM node; focus, presence and option
     activation must never depend on a presentation wrapper's DOM identity. -->
<svelte:element
  this={as}
  {...domAttributes}
  bind:this={() => ref, (node: Element | null) => { ref = node as T | null; }}
>
  {@render children?.()}
</svelte:element>
