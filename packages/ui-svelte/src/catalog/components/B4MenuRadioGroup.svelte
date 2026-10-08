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
  let value = $derived(String(props.value ?? ''));
</script>

<DropdownMenu.RadioGroup {...presentation?.target('root')} bind:ref bind:value onValueChange={(next) => io?.emit('valueChange', next)}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{@render io?.slots?.items?.()}</CatalogPart>{/snippet}
</DropdownMenu.RadioGroup>
