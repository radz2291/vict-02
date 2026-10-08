<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let ref = $state<HTMLDivElement | null>(null);
</script>

<DropdownMenu.Separator {...presentation?.target('root')} bind:ref>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref />{/snippet}
</DropdownMenu.Separator>
