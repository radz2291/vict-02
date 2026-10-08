<script lang="ts">
  import { getContext } from 'svelte';
  import { COMBOBOX_SEARCH } from './B2ComboboxContext.js';
  import { Combobox } from '../combobox.js';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
  const search = getContext<(() => string) | undefined>(COMBOBOX_SEARCH);
  const matches = $derived(String(props.label ?? props.value ?? '').toLowerCase().includes((search?.() ?? '').toLowerCase()));
</script>
{#if matches}
<Combobox.Item value={String(props.value ?? '')} label={String(props.label ?? props.value ?? '')} disabled={props.disabled === true} {...presentation?.target('root')}>
  {@render io?.slots?.content?.()}{#if !io?.slots?.content}{String(props.label ?? props.value ?? '')}{/if}
</Combobox.Item>

{/if}
