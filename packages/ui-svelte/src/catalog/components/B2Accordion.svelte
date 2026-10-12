<script lang="ts">
  import { Accordion } from '../accordion.js';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
  let single = $derived(typeof props.value === 'string' ? props.value : '');
  let multiple = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);
  // Exposed `label` carries its intended effect: the group's accessible name.
  // Empty/unset leaves the attribute off (no empty-label noise for AT).
  let groupLabel = $derived(typeof props.label === 'string' && props.label !== '' ? props.label : undefined);
</script>
{#if props.values !== undefined}
  <Accordion.Root type="multiple" bind:value={multiple} disabled={props.disabled === true} aria-label={groupLabel} {...presentation?.target('root')} onValueChange={next => io?.emit('valuesChange', [...next])}>
    {@render io?.slots?.items?.()}
  </Accordion.Root>
{:else}
  <Accordion.Root type="single" bind:value={single} disabled={props.disabled === true} aria-label={groupLabel} {...presentation?.target('root')} onValueChange={next => io?.emit('valueChange', next)}>
    {@render io?.slots?.items?.()}
  </Accordion.Root>
{/if}
