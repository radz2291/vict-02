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

<DropdownMenu.RadioItem {...presentation?.target('root')} bind:ref value={String(props.value ?? '')} disabled={props.disabled === true} textValue={String(props.label ?? '')} closeOnSelect={props.closeOnSelect === true} onSelect={() => io?.emit('itemActivate', String(props.value ?? ''))}>{#snippet child({ props: attributes })}
  <CatalogPart as="div" {attributes} bind:ref>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}
  </CatalogPart>
{/snippet}</DropdownMenu.RadioItem>
