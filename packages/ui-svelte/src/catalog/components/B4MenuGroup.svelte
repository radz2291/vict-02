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
</script>

<DropdownMenu.Group {...presentation?.target('root')} bind:ref>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>
    <DropdownMenu.GroupHeading>{#if io?.slots?.heading}{@render io.slots.heading()}{:else}{String(props.label ?? '')}{/if}</DropdownMenu.GroupHeading>
    {@render io?.slots?.items?.()}
  </CatalogPart>{/snippet}
</DropdownMenu.Group>
