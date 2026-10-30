<script lang="ts">
  import { getContext, setContext } from 'svelte';
  import { OWNED_MENU_CONTEXT, type OwnedMenuContext } from '../../owned-menu.js';
  import {B4_OWNED_CHECKBOX,type B4OwnedCheckbox} from './B4MenuContext.js';
  import { DropdownMenu } from '../dropdown-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let ref = $state<HTMLDivElement | null>(null);
  let value = $derived(Array.isArray(props.values) ? [...props.values] as string[] : []);

  const ownedMenu = getContext<OwnedMenuContext | undefined>(OWNED_MENU_CONTEXT);
  if(ownedMenu?.owned)setContext<B4OwnedCheckbox>(B4_OWNED_CHECKBOX,{values:()=>value,toggle:(item,checked)=>{const selected=checked??!value.includes(item);if(selected===value.includes(item))return;value=selected?[...value,item]:value.filter(entry=>entry!==item);io?.emit('valuesChange',[...value]);}});
</script>

{#if ownedMenu?.owned}
  <div {...presentation?.target('root')} bind:this={ref} role="group" data-dropdown-menu-checkbox-group>{@render io?.slots?.items?.()}</div>
{:else}
<DropdownMenu.CheckboxGroup {...presentation?.target('root')} bind:ref bind:value onValueChange={(next) => io?.emit('valuesChange', [...next])}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{@render io?.slots?.items?.()}</CatalogPart>{/snippet}
</DropdownMenu.CheckboxGroup>
{/if}
