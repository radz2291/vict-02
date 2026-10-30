<script lang="ts">
  import { getContext } from 'svelte';
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

  const ownedMenu = getContext<OwnedMenuContext | undefined>(OWNED_MENU_CONTEXT);
  const radioGroup=getContext<B4OwnedRadio|undefined>(B4_OWNED_RADIO);
  function activate() {
    if(props.disabled===true)return;
    radioGroup?.select(String(props.value??''));
    io?.emit('itemActivate',String(props.value??''));
    if(props.closeOnSelect===true)ownedMenu?.closeAll('activate');
  }
</script>

{#if ownedMenu?.owned}
  <div {...presentation?.target('root')} bind:this={ref} role="menuitemradio" tabindex="-1" data-dropdown-menu-radio-item data-text-value={String(props.label??'')} aria-disabled={props.disabled===true||undefined} data-disabled={props.disabled===true||undefined} aria-checked={radioGroup?.value()===String(props.value??'')} data-state={radioGroup?.value()===String(props.value??'')?'checked':'unchecked'} onclick={activate}>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label??'')}{/if}
  </div>
{:else}
<DropdownMenu.RadioItem {...presentation?.target('root')} bind:ref value={String(props.value ?? '')} disabled={props.disabled === true} textValue={String(props.label ?? '')} closeOnSelect={props.closeOnSelect === true} onSelect={() => io?.emit('itemActivate', String(props.value ?? ''))}>{#snippet child({ props: attributes })}
  <CatalogPart as="div" {attributes} bind:ref>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}
  </CatalogPart>
{/snippet}</DropdownMenu.RadioItem>
{/if}
