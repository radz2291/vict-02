<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { UiRenderInstruction } from '@victframework/ui';
  import Self from './SlotSnippets.svelte';
  interface Props {
    fills: Readonly<Record<string, readonly UiRenderInstruction[]>>;
    names: readonly string[];
    index?: number;
    slots?: Readonly<Record<string, Snippet>>;
    renderFill: Snippet<[readonly UiRenderInstruction[]]>;
    children: Snippet<[Readonly<Record<string, Snippet>>]>;
  }
  let { fills, names, index = 0, slots = {}, renderFill, children }: Props = $props();
</script>

{#if index < names.length}
  {@const name = names[index]!}
  {#snippet fill()}{@render renderFill(fills[name] ?? [])}{/snippet}
  <Self {fills} {names} index={index + 1} slots={{ ...slots, [name]: fill }} {renderFill} {children} />
{:else}
  {@render children(slots)}
{/if}
