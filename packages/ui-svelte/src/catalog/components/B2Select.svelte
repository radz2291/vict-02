<script lang="ts">
  import { Select } from '../select.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
  let single = $derived(typeof props.value === 'string' ? props.value : '');
  let multiple = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);
  let open = $state(false);
  let search = $state('');
  const options = $derived(Array.isArray(props.options) ? props.options.map(option => ({ value: String(option?.value ?? ''), label: String(option?.label ?? option?.value ?? ''), disabled: option?.disabled === true })) : []);
  const disabled = $derived(props.disabled === true);
</script>
<span style="display: contents">
{#if props.values !== undefined}
  <Select.Root type="multiple" bind:value={multiple} {disabled} bind:open
    onValueChange={next => io?.emit('valuesChange', [...next])}>
    <Select.Trigger {...presentation?.target('root')}>{multiple.map(value => options.find(option => option.value === value)?.label ?? value).join(', ') || String(props.label ?? 'Choose an option')}</Select.Trigger>
      <CatalogPortal {open} {presentation}>
        <Select.Content {...presentation?.target('content')} sideOffset={6} align="start">
          {@render io?.slots?.items?.()}
          {#each options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())) as option (option.value)}
            <Select.Item value={option.value} label={option.label} disabled={option.disabled}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </CatalogPortal>
  </Select.Root>
{:else}
  <Select.Root type="single" bind:value={single} {disabled} bind:open
    onValueChange={next => io?.emit('valueChange', next)}>
    <Select.Trigger {...presentation?.target('root')}>{(options.find(option => option.value === single)?.label ?? single) || String(props.label ?? 'Choose an option')}</Select.Trigger>
      <CatalogPortal {open} {presentation}>
        <Select.Content {...presentation?.target('content')} sideOffset={6} align="start">
          {@render io?.slots?.items?.()}
          {#each options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())) as option (option.value)}
            <Select.Item value={option.value} label={option.label} disabled={option.disabled}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </CatalogPortal>
  </Select.Root>
{/if}
</span>
