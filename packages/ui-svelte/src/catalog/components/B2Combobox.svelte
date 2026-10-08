<script lang="ts">
  import { setContext } from 'svelte';
  import { COMBOBOX_SEARCH } from './B2ComboboxContext.js';
  import { Combobox } from '../combobox.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
  let single = $derived(typeof props.value === 'string' ? props.value : '');
  let multiple = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);
  let open = $state(false);
  let search = $derived(typeof props.search === 'string' ? props.search : '');
  setContext(COMBOBOX_SEARCH, () => search);
  const options = $derived(Array.isArray(props.options) ? props.options.map(option => ({ value: String(option?.value ?? ''), label: String(option?.label ?? option?.value ?? ''), disabled: option?.disabled === true })) : []);
  const disabled = $derived(props.disabled === true);
</script>
<span style="display: contents">
{#if props.values !== undefined}
  <Combobox.Root type="multiple" bind:value={multiple} inputValue={search} {disabled} bind:open
    onValueChange={next => io?.emit('valuesChange', [...next])}>
    <Combobox.Input {...presentation?.target('root')} aria-label={String(props.label ?? 'Search options')} placeholder={String(props.label ?? 'Search options')} oninput={event => { search = event.currentTarget.value; io?.emit('searchChange', search); }} />
      <Combobox.Trigger aria-label="Show options">⌄</Combobox.Trigger>
      <CatalogPortal {open} {presentation}>
        <Combobox.Content {...presentation?.target('content')} sideOffset={6} align="start">
          {@render io?.slots?.items?.()}
          {#each options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())) as option (option.value)}
            <Combobox.Item value={option.value} label={option.label} disabled={option.disabled}>{option.label}</Combobox.Item>
          {/each}
        </Combobox.Content>
      </CatalogPortal>
  </Combobox.Root>
{:else}
  <Combobox.Root type="single" bind:value={single} inputValue={search} {disabled} bind:open
    onValueChange={next => io?.emit('valueChange', next)}>
    <Combobox.Input {...presentation?.target('root')} aria-label={String(props.label ?? 'Search options')} placeholder={String(props.label ?? 'Search options')} oninput={event => { search = event.currentTarget.value; io?.emit('searchChange', search); }} />
      <Combobox.Trigger aria-label="Show options">⌄</Combobox.Trigger>
      <CatalogPortal {open} {presentation}>
        <Combobox.Content {...presentation?.target('content')} sideOffset={6} align="start">
          {@render io?.slots?.items?.()}
          {#each options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())) as option (option.value)}
            <Combobox.Item value={option.value} label={option.label} disabled={option.disabled}>{option.label}</Combobox.Item>
          {/each}
        </Combobox.Content>
      </CatalogPortal>
  </Combobox.Root>
{/if}
</span>
