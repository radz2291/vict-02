<script lang="ts">
  import { Menubar } from '../menubar.js';
  import CatalogPortal from './CatalogPortal.svelte';
  import { catalogMenuOpenFocus, catalogFocusReturn } from './focus-return.js';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  import { getContext, setContext } from 'svelte';
  import { B4_MENUBAR_VALUE,B4_OWNED_MENUBAR,type B4MenubarValue,type B4OwnedMenubar } from './B4MenuContext.js';
  import OwnedMenuContent from '../../OwnedMenuContent.svelte';
  import {OWNED_MENU_CONTEXT,createOwnedMenuContext,ownedMenuTriggerKey,focusOwnedMenuItem,type OwnedMenuContext} from '../../owned-menu.js';
  import {resolveOwnedPopupOwner} from '../../owned-popup.js';
  import {UI_PORTAL_TARGET,type UiPortalTarget} from '../../document/extensions.js';
  const activeMenu = getContext<B4MenubarValue>(B4_MENUBAR_VALUE);
  const value = $derived(String(props.value ?? ''));
  const open = $derived(activeMenu?.() === value);
  let triggerRef = $state<HTMLButtonElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  const focusContent = catalogMenuOpenFocus(() => contentRef);
  const restoreTrigger = catalogFocusReturn(() => triggerRef);

  const menubar=getContext<B4OwnedMenubar|undefined>(B4_OWNED_MENUBAR);
  const parentMenu=getContext<OwnedMenuContext|undefined>(OWNED_MENU_CONTEXT);
  const portalTarget=getContext<UiPortalTarget|undefined>(UI_PORTAL_TARGET);
  const ownedMode=!!menubar;
  const popupId=$props.id(),triggerId=popupId+'-trigger';
  let edge=$state<'first'|'last'|'selected'|'none'>('first');
  const sourceOwner=$derived(triggerRef?resolveOwnedPopupOwner(triggerRef,typeof presentation?.target('root')['data-ui-owner']==='string'?String(presentation.target('root')['data-ui-owner']):undefined):undefined);
  function requestClose(){if(menubar?.value()===value)menubar.select('');}
  const menuContext=createOwnedMenuContext({trigger:()=>triggerRef??undefined,panel:()=>contentRef??undefined,owner:()=>sourceOwner,parent:parentMenu,requestClose});
  if(ownedMode)setContext(OWNED_MENU_CONTEXT,menuContext);
  function openKey(event:KeyboardEvent){if(props.disabled===true)return;ownedMenuTriggerKey(event,next=>{edge=next;if(open&&contentRef)focusOwnedMenuItem(contentRef,next,sourceOwner);else menubar?.select(value);});}
  function popupKey(event:KeyboardEvent){
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||!triggerRef)return;
    const target=event.target as HTMLElement;
    // A child submenu retains its own left/right navigation.
    if(target.closest('[role="menu"]')!==contentRef||target.getAttribute('aria-haspopup')==='menu')return;
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();edge='first';menubar?.navigate(triggerRef,event.key==='ArrowRight'?'next':'previous',true);}
  }
  let priorOpen=$state<boolean|undefined>();
  $effect(()=>{if(ownedMode){if(priorOpen!==undefined&&priorOpen!==open)io?.emit('openChange',open);priorOpen=open;}});
</script>

{#if ownedMode}
  <button {...presentation?.target('root')} id={triggerId} type="button" bind:this={triggerRef} disabled={props.disabled===true} data-menubar-trigger data-owned-menubar-trigger data-menu-value={value} aria-haspopup="menu" aria-expanded={open} aria-controls={open?popupId:undefined} role="menuitem" tabindex="-1" onclick={()=>{edge='first';menubar?.select(open?'':value);}} onkeydown={openKey}>
    {#if io?.slotLabels?.trigger!==undefined}{io.slotLabels.trigger}{:else if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label??'')}{/if}
  </button>
  <OwnedMenuContent {...presentation?.target('content')} id={popupId} {open} trigger={triggerRef} owner={sourceOwner} portalTarget={portalTarget?.()} scopeClass={presentation?.scopeClass} context={menuContext} initialFocus={edge} bind:ref={contentRef} data-menubar-content aria-labelledby={triggerId} onkeydown={popupKey} onRequestClose={requestClose}>{@render io?.slots?.items?.()}</OwnedMenuContent>
{:else}
<Menubar.Menu {value} onOpenChange={(next) => io?.emit('openChange', next)}>
  <Menubar.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slotLabels?.trigger !== undefined}{io.slotLabels.trigger}{:else if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </Menubar.Trigger>
  <CatalogPortal {open} {presentation}><Menubar.Content {...presentation?.target('content')} bind:ref={contentRef} strategy="fixed" sideOffset={6} collisionPadding={16} onOpenAutoFocus={focusContent} onCloseAutoFocus={restoreTrigger}>
  {@render io?.slots?.items?.()}
</Menubar.Content></CatalogPortal>
</Menubar.Menu>
{/if}
