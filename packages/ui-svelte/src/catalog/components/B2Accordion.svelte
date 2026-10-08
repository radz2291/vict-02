<script lang="ts">
  import { Accordion } from 'bits-ui';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: { props: Readonly<Record<string, unknown>>; io?: UiSvelteComponentIO; presentation?: UiComponentPresentation } = $props();
  let single = $derived(typeof props.value === 'string' ? props.value : '');
  let multiple = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);
</script>
{#if props.values !== undefined}
  <Accordion.Root type="multiple" bind:value={multiple} disabled={props.disabled === true} {...presentation?.target('root')} onValueChange={next => io?.emit('valuesChange', [...next])}>
    {@render io?.slots?.items?.()}
  </Accordion.Root>
{:else}
  <Accordion.Root type="single" bind:value={single} disabled={props.disabled === true} {...presentation?.target('root')} onValueChange={next => io?.emit('valueChange', next)}>
    {@render io?.slots?.items?.()}
  </Accordion.Root>
{/if}
