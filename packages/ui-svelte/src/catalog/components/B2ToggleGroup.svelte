<script lang="ts">
  import { ToggleGroup } from '../toggle-group.js';
  
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
  let single = $derived(typeof props.value === 'string' ? props.value : '');
  let multiple = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);
  let open = $state(false);
  let search = $state('');
  const options = $derived(Array.isArray(props.options) ? props.options.map(option => ({ value: String(option?.value ?? ''), label: String(option?.label ?? option?.value ?? ''), disabled: option?.disabled === true })) : []);
  const disabled = $derived(props.disabled === true);
</script>
<div class="vict-field">
<span class="vict-control-label">{String(props.label ?? 'Options')}</span>
{#if props.values !== undefined}
  <ToggleGroup.Root type="multiple" bind:value={multiple} {disabled} {...presentation?.target('root')} aria-label={String(props.label ?? 'Choices')}
    onValueChange={next => io?.emit('valuesChange', [...next])}>
    {@render io?.slots?.items?.()}
      {#each options as option (option.value)}<ToggleGroup.Item value={option.value} disabled={option.disabled}>{option.label}</ToggleGroup.Item>{/each}
  </ToggleGroup.Root>
{:else}
  <ToggleGroup.Root type="single" bind:value={single} {disabled} {...presentation?.target('root')} aria-label={String(props.label ?? 'Choices')}
    onValueChange={next => io?.emit('valueChange', next)}>
    {@render io?.slots?.items?.()}
      {#each options as option (option.value)}<ToggleGroup.Item value={option.value} disabled={option.disabled}>{option.label}</ToggleGroup.Item>{/each}
  </ToggleGroup.Root>
{/if}
</div>
