<script lang="ts">
  import { getContext } from 'svelte';
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
  let checked = $derived(props.checked === true);
  let indeterminate = $derived(props.indeterminate === true);

  const ownedMenu = getContext<OwnedMenuContext | undefined>(OWNED_MENU_CONTEXT);
  const checkboxGroup=getContext<B4OwnedCheckbox|undefined>(B4_OWNED_CHECKBOX);
  const ownedChecked=$derived(checkboxGroup?checkboxGroup.values().includes(String(props.value??'')):checked);
  function activate() {
    if(props.disabled===true)return;
    const next=indeterminate?true:!ownedChecked;
    const changed=next!==ownedChecked;
    if(checkboxGroup)checkboxGroup.toggle(String(props.value??''),next); else checked=next;
    if(indeterminate){indeterminate=false;io?.emit('indeterminateChange',false);}
    if(changed)io?.emit('checkedChange',next);
    if(props.closeOnSelect===true)ownedMenu?.closeAll('activate');
  }
</script>

{#if ownedMenu?.owned}
  <div {...presentation?.target('root')} bind:this={ref} role="menuitemcheckbox" tabindex="-1" data-dropdown-menu-checkbox-item data-text-value={String(props.label??'')} aria-disabled={props.disabled===true||undefined} data-disabled={props.disabled===true||undefined} aria-checked={indeterminate?'mixed':ownedChecked} data-state={indeterminate?'indeterminate':ownedChecked?'checked':'unchecked'} onclick={activate}>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label??'')}{/if}
  </div>
{:else}
<DropdownMenu.CheckboxItem {...presentation?.target('root')} bind:ref bind:checked bind:indeterminate value={String(props.value ?? '')} disabled={props.disabled === true} textValue={String(props.label ?? '')} closeOnSelect={props.closeOnSelect === true} onCheckedChange={(next) => io?.emit('checkedChange', next)} onIndeterminateChange={(next) => io?.emit('indeterminateChange', next)}>{#snippet child({ props: attributes })}
  <CatalogPart as="div" {attributes} bind:ref>
    {#if io?.slots?.content}{@render io.slots.content()}{:else}{String(props.label ?? '')}{/if}
  </CatalogPart>
{/snippet}</DropdownMenu.CheckboxItem>
{/if}
