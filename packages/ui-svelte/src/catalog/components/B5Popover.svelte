<script lang="ts">
  import { Popover } from '../popover.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogFocusReturn } from './focus-return.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let open = $derived(props.open === true);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);
  const side = $derived(props.side === 'top' || props.side === 'left' || props.side === 'right' ? props.side : 'bottom');
</script>

<Popover.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <Popover.Trigger {...presentation?.target('trigger')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label === 'string' ? props.label : 'Popover'}{/if}
  </Popover.Trigger>
  <CatalogPortal {open} {presentation}>

    <Popover.Content {...presentation?.target('root')} side={side} sideOffset={typeof props.sideOffset === 'number' ? props.sideOffset : 8} onCloseAutoFocus={restoreTrigger}>

      {#if typeof props.title === 'string' && props.title}<strong>{props.title}</strong>{/if}
      {#if typeof props.description === 'string' && props.description}<p>{props.description}</p>{/if}
      {@render io?.slots?.content?.()}
      <Popover.Close aria-label="Close">✕</Popover.Close>
    </Popover.Content>
  </CatalogPortal>
</Popover.Root>
