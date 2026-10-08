<script lang="ts">
  import { LinkPreview } from '../link-preview.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import CatalogPortal from './CatalogPortal.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let open = $derived(props.open === true);
  const side = $derived(props.side === 'top' || props.side === 'left' || props.side === 'right' ? props.side : 'bottom');
</script>

<LinkPreview.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)} disabled={props.disabled === true} openDelay={typeof props.openDelay === 'number' ? Math.max(0, props.openDelay) : 700} closeDelay={typeof props.closeDelay === 'number' ? Math.max(0, props.closeDelay) : 300}>
  <LinkPreview.Trigger {...presentation?.target('trigger')} href={typeof props.href === 'string' ? props.href : '#'}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label === 'string' ? props.label : 'LinkPreview'}{/if}
  </LinkPreview.Trigger>
  <CatalogPortal {open} {presentation}>

    <LinkPreview.Content {...presentation?.target('root')} side={side} sideOffset={typeof props.sideOffset === 'number' ? props.sideOffset : 8}>

      {#if typeof props.title === 'string' && props.title}<strong>{props.title}</strong>{/if}
      {#if typeof props.description === 'string' && props.description}<p>{props.description}</p>{/if}
      {@render io?.slots?.content?.()}

    </LinkPreview.Content>
  </CatalogPortal>
</LinkPreview.Root>
