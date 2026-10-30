<script lang="ts">
  import {getContext,setContext,untrack} from 'svelte';
  import OwnedMenuContent from '../../OwnedMenuContent.svelte';
  import {OWNED_MENU_CONTEXT,createOwnedMenuContext,ownedMenuTriggerKey,focusOwnedMenuItem,type OwnedMenuContext} from '../../owned-menu.js';
  import {resolveOwnedPopupOwner} from '../../owned-popup.js';
  import {UI_PORTAL_TARGET,type UiPortalTarget} from '../../document/extensions.js';

  import { ContextMenu } from '../context-menu.js';
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
  let triggerRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);

  const portalTarget=getContext<UiPortalTarget|undefined>(UI_PORTAL_TARGET);
  const parentMenu=getContext<OwnedMenuContext|undefined>(OWNED_MENU_CONTEXT);
  // Rendering mode is a construction contract: never mount global Content while resolving an authored owner.
  const ownedMode=untrack(()=>!!presentation||!!portalTarget||!!parentMenu?.owned);
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
  let point=$state<{x:number;y:number}|undefined>();
  function contextOpen(event:MouseEvent){if(props.disabled===true)return;event.preventDefault();point={x:event.clientX,y:event.clientY};edge='first';setOpen(true);}
  function contextKey(event:KeyboardEvent){if(props.disabled===true)return;if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();point=undefined;edge='first';setOpen(true);}else{point=undefined;openFromKey(event);}}
</script>

{#if ownedMode}
  <div {...presentation?.target('root')} id={triggerId} bind:this={triggerRef} role="button" tabindex={props.disabled===true?-1:0} aria-disabled={props.disabled===true||undefined} data-context-menu-trigger aria-haspopup="menu" aria-expanded={open} aria-controls={open?popupId:undefined} oncontextmenu={contextOpen} onkeydown={contextKey}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label??'')}{/if}
  </div>
  <OwnedMenuContent {...presentation?.target('content')} id={popupId} {open} {point} trigger={triggerRef} owner={sourceOwner} portalTarget={portalTarget?.()} scopeClass={presentation?.scopeClass} context={menuContext} initialFocus={edge} bind:ref={contentRef} data-context-menu-content aria-labelledby={triggerId} onRequestClose={()=>setOpen(false)}>{@render io?.slots?.items?.()}</OwnedMenuContent>
{:else}
<ContextMenu.Root bind:open onOpenChange={(next) => io?.emit('openChange', next)}>
  <ContextMenu.Trigger {...presentation?.target('root')} disabled={props.disabled === true} bind:ref={triggerRef}>
    {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{String(props.label ?? '')}{/if}
  </ContextMenu.Trigger>
  <CatalogPortal {open} {presentation}>
    <ContextMenu.Content {...presentation?.target('content')} bind:ref={contentRef} sideOffset={6} collisionPadding={16}>
  {@render io?.slots?.items?.()}
</ContextMenu.Content>
  </CatalogPortal>
</ContextMenu.Root>
{/if}
