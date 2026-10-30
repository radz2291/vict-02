<script lang="ts">
  import { getContext } from 'svelte';
  import { OWNED_MENU_CONTEXT, type OwnedMenuContext } from '../../owned-menu.js';
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
  function activate() {
    if(props.disabled===true)return;
    io?.emit('itemActivate',String(props.value??''));
    if(props.closeOnSelect!==false)ownedMenu?.closeAll('activate');
  }
</script>

{#if ownedMenu?.owned}
  <div {...presentation?.target('root')} bind:this={ref} role="menuitem" tabindex="-1" data-dropdown-menu-item data-text-value={String(props.label??'')} aria-disabled={props.disabled===true||undefined} data-disabled={props.disabled===true||undefined} onclick={activate}>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label??'')}{/if}
  </div>
{:else}
<DropdownMenu.Item {...presentation?.target('root')} bind:ref disabled={props.disabled === true} textValue={String(props.label ?? '')} closeOnSelect={props.closeOnSelect !== false} onSelect={() => io?.emit('itemActivate', String(props.value ?? ''))}>{#snippet child({ props: attributes })}
  <CatalogPart as="div" {attributes} bind:ref>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}
  </CatalogPart>
{/snippet}</DropdownMenu.Item>
{/if}
