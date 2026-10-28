<script lang="ts">
  import {getContext,setContext} from 'svelte';
  import OwnedMenuContent from '../../OwnedMenuContent.svelte';
  import {OWNED_MENU_CONTEXT,createOwnedMenuContext,ownedMenuTriggerKey,focusOwnedMenuItem,type OwnedMenuContext} from '../../owned-menu.js';
  import {resolveOwnedPopupOwner} from '../../owned-popup.js';
  import {UI_PORTAL_TARGET,type UiPortalTarget} from '../../document/extensions.js';

  import { onDestroy } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { DropdownMenu } from '../dropdown-menu.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  const authoredOpen = $derived(props.open === true);
  let open = $derived(authoredOpen);
  $effect(() => { if (!ownedMode && open !== authoredOpen) io?.emit('openChange', open); });
  // Closing the parent portal destroys its submenu. Keep the declared value
  // closed so reopening the parent starts from its own menu, not a stale layer.
  onDestroy(() => { if (open) io?.emit('openChange', false); });
  let triggerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  // Side-by-side menus cannot fit the shared minimum widths on a phone.
  // Let the public floating layer place the submenu vertically and shift it
  // within the viewport while retaining the library's submenu keyboard model.
  const narrow = new MediaQuery('(max-width: 600px)', false);

  const portalTarget=getContext<UiPortalTarget|undefined>(UI_PORTAL_TARGET);
  const parentMenu=getContext<OwnedMenuContext|undefined>(OWNED_MENU_CONTEXT);
  const ownedMode=!!parentMenu?.owned;
  const popupId=$props.id(),triggerId=popupId+'-trigger';
  let edge=$state<'first'|'last'|'selected'|'none'>('first');
  const sourceOwner=$derived(triggerRef?resolveOwnedPopupOwner(triggerRef,typeof presentation?.target('root')['data-ui-owner']==='string'?String(presentation.target('root')['data-ui-owner']):undefined):undefined);
  function setOpen(next:boolean){if(open===next)return;open=next;io?.emit('openChange',next);}
  function openFromKey(event:KeyboardEvent){
    if(props.disabled===true)return;
    ownedMenuTriggerKey(event,next=>{edge=next;if(open&&contentRef)focusOwnedMenuItem(contentRef,next,sourceOwner);else setOpen(true);});
  }
  const menuContext=createOwnedMenuContext({trigger:()=>triggerRef??undefined,panel:()=>contentRef??undefined,owner:()=>sourceOwner,parent:parentMenu,requestClose:()=>setOpen(false)});
  if(ownedMode)setContext(OWNED_MENU_CONTEXT,menuContext);
  function subKey(event:KeyboardEvent){if(props.disabled===true)return;if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();edge='first';if(open&&contentRef)focusOwnedMenuItem(contentRef,'first',sourceOwner);else setOpen(true);}}
  function hoverOpen(){if(props.disabled!==true){edge='none';if(!open)setOpen(true);}}
</script>

{#if ownedMode}
  <div {...presentation?.target('root')} id={triggerId} bind:this={triggerRef} role="menuitem" tabindex="-1" aria-disabled={props.disabled===true||undefined} data-disabled={props.disabled===true||undefined} data-dropdown-menu-sub-trigger data-text-value={String(props.label??'')} aria-haspopup="menu" aria-expanded={open} aria-controls={open?popupId:undefined} onclick={()=>{if(props.disabled!==true){edge='first';setOpen(true);}}} onkeydown={subKey} onpointerenter={hoverOpen}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label??'')}{/if}
  </div>
  <OwnedMenuContent {...presentation?.target('content')} id={popupId} {open} trigger={triggerRef} owner={sourceOwner} portalTarget={portalTarget?.()} scopeClass={presentation?.scopeClass} context={menuContext} initialFocus={edge} side={narrow.current?'bottom':'right'} bind:ref={contentRef} data-dropdown-menu-sub-content aria-labelledby={triggerId} onRequestClose={()=>setOpen(false)}>{@render io?.slots?.items?.()}</OwnedMenuContent>
{:else}
<DropdownMenu.Sub bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <DropdownMenu.SubTrigger {...presentation?.target('root')} disabled={props.disabled === true} textValue={String(props.label ?? '')} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </DropdownMenu.SubTrigger>
  <CatalogPortal {open} {presentation}><DropdownMenu.SubContent {...presentation?.target('content')} bind:ref={contentRef} strategy="fixed" side={narrow.current ? 'bottom' : 'right'} sideOffset={6} collisionPadding={16}>
  {@render io?.slots?.items?.()}
</DropdownMenu.SubContent></CatalogPortal>
</DropdownMenu.Sub>
{/if}
