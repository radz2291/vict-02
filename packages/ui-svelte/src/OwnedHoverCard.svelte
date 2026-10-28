<script lang="ts">
  import {getContext, setContext, untrack, type Snippet} from 'svelte';
  import type {HTMLAttributes} from 'svelte/elements';
  import {Portal} from 'bits-ui';
  import {UI_PORTAL_TARGET, type UiPortalTarget} from './document/extensions.js';
  import {CATALOG_PORTAL_LAYER} from './catalog/components/portal-layer.js';
  import {isOwnedPopupTarget, observeOwnedPopupSource, positionOwnedPopup, resolveOwnedPopupOwner} from './owned-popup.js';
  import {createOwnedHoverCardBehavior} from './owned-tooltip.js';

  export type TriggerAttributes = HTMLAttributes<HTMLElement> & {
    'data-hover-card-trigger': string;
    'data-owned-hover-card-trigger': string;
    'data-state': 'closed' | 'open';
  };
  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'|'id'|'role'> & {
    id?: string;
    open?: boolean;
    disabled?: boolean;
    delay?: number;
    owner?: HTMLElement;
    ownerId?: string;
    portalTarget?: HTMLElement;
    scopeClass?: string;
    side?: 'top'|'bottom'|'left'|'right';
    sideOffset?: number;
    arrow?: boolean;
    onOpenChange?: (open:boolean)=>void;
    trigger: Snippet<[TriggerAttributes]>;
    children?: Snippet;
  };
  let {id, open=$bindable(false), disabled=false, delay=10, owner, ownerId,
    portalTarget, scopeClass='', side='bottom', sideOffset=4, arrow=false, onOpenChange,
    trigger, children, class:contentClass='', style:contentStyle, ...attributes}: Props=$props();
  const uid=$props.id();
  const contentId=$derived(id ?? `${uid}-hover-card`);
  const hostTarget=getContext<UiPortalTarget|undefined>(UI_PORTAL_TARGET);
  const layer=(getContext<number|undefined>(CATALOG_PORTAL_LAYER)??0)+1;
  setContext(CATALOG_PORTAL_LAYER,layer);
  let anchor=$state<HTMLSpanElement>();
  let triggerElement=$state<HTMLElement>();
  let actualOwner=$state<HTMLElement>();
  let sourceAvailable=$state(false);
  let panel=$state<HTMLDivElement>();
  let behavior=$state.raw<ReturnType<typeof createOwnedHoverCardBehavior>>();
  const visible=$derived(open&&!disabled&&sourceAvailable&&!!triggerElement&&!!actualOwner);
  const destination=$derived.by(()=>{
    const target=portalTarget??hostTarget?.();
    return actualOwner&&target&&isOwnedPopupTarget(actualOwner,target)?target:actualOwner;
  });
  const triggerAttributes=$derived<TriggerAttributes>({'data-hover-card-trigger':'','data-owned-hover-card-trigger':uid,'data-state':visible?'open':'closed','aria-controls':visible?contentId:undefined,'aria-expanded':visible});
  function change(next:boolean){if(open!==next){open=next;onOpenChange?.(next);}}
  $effect(()=>{
    if(!anchor)return;
    const element=anchor;
    const reconcile=()=>{
      const candidates=[...element.querySelectorAll<HTMLElement>('[data-owned-hover-card-trigger]')].filter(item=>item.getAttribute('data-owned-hover-card-trigger')===uid);
      triggerElement=candidates.length===1?candidates[0]:undefined;
    };
    const observer=new element.ownerDocument.defaultView!.MutationObserver(reconcile);
    observer.observe(element,{childList:true,subtree:true,attributes:true,attributeFilter:['data-owned-hover-card-trigger']});
    reconcile();
    return()=>observer.disconnect();
  });
  $effect(()=>{
    const source=triggerElement,descriptionId=contentId;
    const scope=source?(owner??resolveOwnedPopupOwner(source,ownerId)):undefined;
    actualOwner=scope;sourceAvailable=false;
    if(!source||!scope)return;
    const stopSource=untrack(()=>observeOwnedPopupSource(scope,source,()=>change(false),next=>sourceAvailable=next));
    const controller=untrack(()=>createOwnedHoverCardBehavior({owner:scope,trigger:source,id:descriptionId,getPanel:()=>panel,isOpen:()=>open,isDisabled:()=>disabled,delay:()=>delay,onOpenChange:change}));
    behavior=controller;
    return()=>{stopSource();controller.dispose();behavior=undefined;};
  });
  $effect(()=>{void open;void disabled;void panel;const controller=behavior;if(controller)untrack(()=>controller.sync());});
  $effect(()=>{
    void contentStyle;
    if(!visible||!actualOwner||!triggerElement||!panel)return;
    return positionOwnedPopup({owner:actualOwner,trigger:triggerElement,panel,side,align:'center',sideOffset});
  });
</script>

<span bind:this={anchor} style="display:contents">{@render trigger(triggerAttributes)}</span>
{#if visible&&destination}
  <Portal to={destination}>
    <div class={scopeClass} style={`display:contents;--vict-catalog-layer:${layer*100}`}>
      <div {...attributes} bind:this={panel} id={contentId} tabindex="-1" data-slot="hover-card-content" data-hover-card-content data-owned-hover-card-content data-open data-state="open" data-side={side}
        class={contentClass} style={contentStyle}>
        {@render children?.()}
        {#if arrow}<span data-owned-hover-card-arrow aria-hidden="true"></span>{/if}
      </div>
    </div>
  </Portal>
{/if}
<style>
  [data-owned-hover-card-arrow]{position:absolute;width:10px;height:10px;transform:rotate(45deg);background:inherit;border-radius:2px;pointer-events:none}
  [data-side=top]>[data-owned-hover-card-arrow]{bottom:-4px;left:calc(50% - 5px)}
  [data-side=bottom]>[data-owned-hover-card-arrow]{top:-4px;left:calc(50% - 5px)}
  [data-side=left]>[data-owned-hover-card-arrow]{right:-4px;top:calc(50% - 5px)}
  [data-side=right]>[data-owned-hover-card-arrow]{left:-4px;top:calc(50% - 5px)}
</style>
