<script lang="ts">
  import { Tooltip } from '../tooltip.js';
  import type { UiSvelteComponentProps } from '../../document/extensions.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import { getContext } from 'svelte';
  import { UI_PORTAL_TARGET, type UiPortalTarget } from '../../document/extensions.js';
  import { Button } from '../button.js';
  import OwnedTooltip from '../../OwnedTooltip.svelte';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let open = $derived(props.open === true && props.disabled !== true);
  const uid = $props.id();
  const contentId = `${uid}-tooltip`;
  let triggerRef = $state<HTMLButtonElement | null>(null);
  const side = $derived(props.side === 'top' || props.side === 'left' || props.side === 'right' ? props.side : 'bottom');
  const portalTarget = getContext<UiPortalTarget|undefined>(UI_PORTAL_TARGET);
  const owned = $derived(!!presentation || !!portalTarget);
</script>

{#if owned}
  <OwnedTooltip {...presentation?.target('root')} id={contentId} bind:open disabled={props.disabled===true}
    delay={typeof props.delay==='number'?Math.max(0,props.delay):700} {side} sideOffset={typeof props.sideOffset==='number'?props.sideOffset:8}
    ownerId={presentation?.target('root')['data-ui-owner']} portalTarget={portalTarget?.()} scopeClass={presentation?.scopeClass}
    onOpenChange={next=>io?.emit('openChange',next)}>
    {#snippet trigger(attributes)}
      <Button.Root {...attributes} {...presentation?.target('trigger')} disabled={props.disabled===true}>
        {#if io?.slotLabels?.trigger!==undefined}{io.slotLabels.trigger}{:else if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label==='string'?props.label:'Tooltip'}{/if}
      </Button.Root>
    {/snippet}
    {#if typeof props.title==='string'&&props.title}<strong>{props.title}</strong>{/if}
    {#if typeof props.description==='string'&&props.description}<p>{props.description}</p>{/if}
    {@render io?.slots?.content?.()}
  </OwnedTooltip>
{:else}
<Tooltip.Provider>
<Tooltip.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)} disabled={props.disabled === true} delayDuration={typeof props.delay === 'number' ? Math.max(0, props.delay) : 700}>
  <Tooltip.Trigger {...presentation?.target('trigger')} bind:ref={triggerRef} disabled={props.disabled === true} aria-describedby={open ? contentId : undefined}>
    {#if io?.slotLabels?.trigger !== undefined}{io.slotLabels.trigger}{:else if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{typeof props.label === 'string' ? props.label : 'Tooltip'}{/if}
  </Tooltip.Trigger>
  <CatalogPortal {open} {presentation}>

    <Tooltip.Content {...presentation?.target('root')} id={contentId} role="tooltip" customAnchor={triggerRef} side={side} sideOffset={typeof props.sideOffset === 'number' ? props.sideOffset : 8}>

      {#if typeof props.title === 'string' && props.title}<strong>{props.title}</strong>{/if}
      {#if typeof props.description === 'string' && props.description}<p>{props.description}</p>{/if}
      {@render io?.slots?.content?.()}

    </Tooltip.Content>
  </CatalogPortal>
</Tooltip.Root>
</Tooltip.Provider>
{/if}
