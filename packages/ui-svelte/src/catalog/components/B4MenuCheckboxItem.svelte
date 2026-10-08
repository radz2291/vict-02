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
  let checked = $derived(props.checked === true);
  let indeterminate = $derived(props.indeterminate === true);
</script>

<DropdownMenu.CheckboxItem {...presentation?.target('root')} bind:ref bind:checked bind:indeterminate value={String(props.value ?? '')} disabled={props.disabled === true} textValue={String(props.label ?? '')} closeOnSelect={props.closeOnSelect === true} onCheckedChange={(next) => io?.emit('checkedChange', next)} onIndeterminateChange={(next) => io?.emit('indeterminateChange', next)}>{#snippet child({ props: attributes })}
  <CatalogPart as="div" {attributes} bind:ref>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}
  </CatalogPart>
{/snippet}</DropdownMenu.CheckboxItem>
