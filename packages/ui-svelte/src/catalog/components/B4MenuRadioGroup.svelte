<script lang="ts">
  import { getContext, setContext } from 'svelte';
  import { OWNED_MENU_CONTEXT, type OwnedMenuContext } from '../../owned-menu.js';
  import {B4_OWNED_RADIO,type B4OwnedRadio} from './B4MenuContext.js';
  import { DropdownMenu } from '../dropdown-menu.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  let ref = $state<HTMLDivElement | null>(null);
  let value = $derived(String(props.value ?? ''));

  const ownedMenu = getContext<OwnedMenuContext | undefined>(OWNED_MENU_CONTEXT);
  if(ownedMenu?.owned)setContext<B4OwnedRadio>(B4_OWNED_RADIO,{value:()=>value,select:next=>{if(value===next)return;value=next;io?.emit('valueChange',next);}});
</script>

{#if ownedMenu?.owned}
  <div {...presentation?.target('root')} bind:this={ref} role="group" data-dropdown-menu-radio-group>{@render io?.slots?.items?.()}</div>
{:else}
<DropdownMenu.RadioGroup {...presentation?.target('root')} bind:ref bind:value onValueChange={(next) => io?.emit('valueChange', next)}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{@render io?.slots?.items?.()}</CatalogPart>{/snippet}
</DropdownMenu.RadioGroup>
{/if}
