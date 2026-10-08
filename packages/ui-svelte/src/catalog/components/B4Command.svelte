<script lang="ts">
  import { Command } from '../command.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let value = $derived(String(props.value ?? ''));
  let search = $derived(String(props.search ?? ''));
  let ref = $state<HTMLDivElement | null>(null);
</script>

<Command.Root {...presentation?.target('root')} bind:ref bind:value label={String(props.label ?? '')} loop={props.loop !== false} onValueChange={(next) => io?.emit('valueChange', next)}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>
    <Command.Input bind:value={search} aria-label={String(props.label ?? 'Search commands')} placeholder={String(props.placeholder ?? '')} oninput={(event) => { search = event.currentTarget.value; io?.emit('searchChange', search); }} />
    <Command.List><Command.Viewport>{@render io?.slots?.items?.()}</Command.Viewport><Command.Empty>{#if io?.slots?.empty}{@render io.slots.empty()}{:else}No matching commands{/if}</Command.Empty></Command.List>
  </CatalogPart>{/snippet}
</Command.Root>
