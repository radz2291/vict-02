<script lang="ts">
  import {getContext,setContext,untrack,type Snippet} from 'svelte';
  import {Portal} from 'bits-ui';
  import type {HTMLAttributes} from 'svelte/elements';
  import {resolveOwnedPopupOwner,isOwnedPopupTarget,ownedDocumentHasFocus,observeOwnedPopupSource,positionOwnedPopup} from './owned-popup.js';
  import {OWNED_MENU_CONTEXT,createOwnedMenuContext,createOwnedMenuBehavior,focusOwnedMenuItem,restoreOwnedMenuFocus,type OwnedMenuContext,type OwnedMenuCloseReason} from './owned-menu.js';
  type Props=Omit<HTMLAttributes<HTMLDivElement>,'children'|'role'> & {
    id:string;open?:boolean;trigger:HTMLElement|null|undefined;owner?:HTMLElement;
    portalTarget?:HTMLElement;scopeClass?:string;ref?:HTMLDivElement|null;surface?:'catalog'|'custom';
    initialFocus?:'first'|'last'|'selected'|'none';side?:'bottom'|'right';point?:{x:number;y:number};
    context?:OwnedMenuContext;onRequestClose:(reason:OwnedMenuCloseReason)=>void;children?:Snippet;
  };
  let {id,open=true,trigger,owner,portalTarget,scopeClass,ref=$bindable(null),surface='catalog',initialFocus='first',side='bottom',point,context,onRequestClose,children,style:authoredStyle,...attributes}:Props=$props();
  const inherited=getContext<OwnedMenuContext|undefined>(OWNED_MENU_CONTEXT);
  const scope=$derived(owner??(trigger?resolveOwnedPopupOwner(trigger,trigger.getAttribute('data-ui-owner')??undefined):undefined));
  const portal=$derived(scope&&(portalTarget?.ownerDocument===scope.ownerDocument&&scope.contains(portalTarget)?portalTarget:scope));
  let sourceVisible=$state(true);
  const menuContext=untrack(()=>context)??createOwnedMenuContext({trigger:()=>trigger??undefined,panel:()=>ref??undefined,owner:()=>scope,parent:inherited,requestClose:reason=>onRequestClose(reason)});
  setContext(OWNED_MENU_CONTEXT,menuContext);
  let wasOpen=false;
  $effect.pre(()=>{
    if(wasOpen&&!open&&ref&&trigger&&sourceVisible)restoreOwnedMenuFocus(scope,ref,trigger);
    wasOpen=open;
  });
  $effect(()=>{
    if(!open||!trigger||!scope)return;
    sourceVisible=true;
    return untrack(()=>observeOwnedPopupSource(scope,trigger!,()=>{sourceVisible=false;menuContext.close('source-hidden',false);},undefined,{excludeDisabled:true}));
  });
  $effect(()=>{
    if(!open||!sourceVisible||!ref||!trigger||!scope)return;
    const panel=ref,source=trigger,owned=scope;
    return untrack(()=>{
      const stop=createOwnedMenuBehavior({owner:owned,panel,context:menuContext});
      menuContext.parent?.activateChild(menuContext);
      const stopPosition=positionOwnedPopup({owner:owned,trigger:source,panel,side,sideOffset:6,collisionPadding:4,...(point?{point}: {})});
      const active=panel.ownerDocument.activeElement;
      if(initialFocus!=='none'&&ownedDocumentHasFocus(panel.ownerDocument)&&active&&isOwnedPopupTarget(owned,active))focusOwnedMenuItem(panel,initialFocus,owned);
      return()=>{stop();stopPosition();menuContext.parent?.releaseChild(menuContext);};
    });
  });
</script>
{#if open&&sourceVisible&&portal}
  <Portal to={portal}>
    <div class={scopeClass} style="display:contents">
      <div {...attributes} {id} bind:this={ref} role="menu" aria-orientation="vertical" tabindex="-1" data-dropdown-menu-content data-owned-menu-content data-owned-menu-surface={surface} data-open data-side={side} data-state="open" style={authoredStyle}>
        {@render children?.()}
      </div>
    </div>
  </Portal>
{/if}
<style>
  :where([data-owned-menu-content]){z-index:calc(100 + var(--vict-catalog-layer,0));overflow:auto;overscroll-behavior:contain;outline:none}
  :where([data-owned-menu-content][data-owned-menu-surface="catalog"]){min-width:10rem;border:1px solid var(--vict-color-border,#dbe0e8);border-radius:var(--vict-radius-md,.75rem);padding:.25rem;background:var(--vict-theme-surface,var(--vict-color-surface,#fff));color:var(--vict-color-text,#18202f);box-shadow:0 8px 24px #0002}
  :where([data-owned-menu-content]) :global(:where([role^="menuitem"])){cursor:default;outline:none;user-select:none}
  :where([data-owned-menu-content][data-owned-menu-surface="catalog"]) :global(:where([role^="menuitem"]:focus)){background:var(--vict-color-surfaceMuted,#eef1f7)}
</style>
