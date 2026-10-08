<script lang="ts">
  import { DropdownMenu } from '../dropdown-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let ref = $state<HTMLDivElement | null>(null);
  let value = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);
</script>

<DropdownMenu.CheckboxGroup {...presentation?.target('root')} bind:ref bind:value onValueChange={(next) => io?.emit('valuesChange', [...next])}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{@render io?.slots?.items?.()}</CatalogPart>{/snippet}
</DropdownMenu.CheckboxGroup>
