<script lang="ts">
  import { Tooltip } from '../tooltip.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import CatalogPortal from './CatalogPortal.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let open = $derived(props.open === true);
  const side = $derived(props.side === 'top' || props.side === 'left' || props.side === 'right' ? props.side : 'bottom');
</script>

<Tooltip.Provider>
<Tooltip.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)} disabled={props.disabled === true} delayDuration={typeof props.delay === 'number' ? Math.max(0, props.delay) : 700}>
  <Tooltip.Trigger {...presentation?.target('trigger')} disabled={props.disabled === true}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label === 'string' ? props.label : 'Tooltip'}{/if}
  </Tooltip.Trigger>
  <CatalogPortal {open} {presentation}>

    <Tooltip.Content {...presentation?.target('root')} side={side} sideOffset={typeof props.sideOffset === 'number' ? props.sideOffset : 8}>

      {#if typeof props.title === 'string' && props.title}<strong>{props.title}</strong>{/if}
      {#if typeof props.description === 'string' && props.description}<p>{props.description}</p>{/if}
      {@render io?.slots?.content?.()}

    </Tooltip.Content>
  </CatalogPortal>
</Tooltip.Root>
</Tooltip.Provider>
