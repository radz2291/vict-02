<script lang="ts">
  import { Command } from 'bits-ui';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let ref = $state<HTMLDivElement | null>(null);
</script>

<Command.Group {...presentation?.target('root')} bind:ref value={String(props.value ?? '')}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>
    <Command.GroupHeading>{#if io?.slots?.heading}{@render io.slots.heading()}{:else}{String(props.label ?? '')}{/if}</Command.GroupHeading>
    <Command.GroupItems>{@render io?.slots?.items?.()}</Command.GroupItems>
  </CatalogPart>{/snippet}
</Command.Group>
