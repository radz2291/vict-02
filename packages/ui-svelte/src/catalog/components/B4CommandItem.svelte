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

<Command.Item {...presentation?.target('root')} bind:ref value={String(props.value ?? '')} disabled={props.disabled === true} keywords={Array.isArray(props.keywords) ? props.keywords as string[] : []} onSelect={() => io?.emit('itemActivate', String(props.value ?? ''))}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}</CatalogPart>{/snippet}
</Command.Item>
