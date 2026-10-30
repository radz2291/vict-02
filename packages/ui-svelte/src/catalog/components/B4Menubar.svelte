<script lang="ts">
  import { Menubar } from '../menubar.js';
  import CatalogPart from './CatalogPart.svelte';
  import type { UiSvelteComponentIO, UiComponentPresentation } from '../../document/extensions.js';
  let { props, io, presentation }: {
    props: Readonly<Record<string, unknown>>;
    io?: UiSvelteComponentIO;
    presentation?: UiComponentPresentation;
  } = $props();
  import { getContext, setContext, untrack } from 'svelte';
  import { B4_MENUBAR_VALUE, B4_OWNED_MENUBAR, type B4MenubarValue, type B4OwnedMenubar } from './B4MenuContext.js';
  import {UI_PORTAL_TARGET,type UiPortalTarget} from '../../document/extensions.js';
  import {OWNED_MENU_CONTEXT,type OwnedMenuContext} from '../../owned-menu.js';
  import {isOwnedElementRendered} from '../../owned-popup.js';
  let value = $derived(String(props.value ?? ''));
  let ref = $state<HTMLDivElement | null>(null);
  setContext<B4MenubarValue>(B4_MENUBAR_VALUE, () => value);

  const portalTarget=getContext<UiPortalTarget|undefined>(UI_PORTAL_TARGET);
  const parentMenu=getContext<OwnedMenuContext|undefined>(OWNED_MENU_CONTEXT);
  // Rendering mode is a construction contract: never mount global Content while resolving an authored owner.
  const ownedMode=untrack(()=>!!presentation||!!portalTarget||!!parentMenu?.owned);
  const allTriggers=()=>ref?Array.from(ref.querySelectorAll<HTMLButtonElement>('[data-owned-menubar-trigger]')).filter(item=>item.closest('[role="menubar"]')===ref):[];
  const triggers=()=>allTriggers().filter(item=>isOwnedElementRendered(item));
  function setValue(next:string){if(value===next)return;value=next;io?.emit('valueChange',next);}
  function navigate(trigger:HTMLElement,direction:'next'|'previous'|'first'|'last',activate:boolean){
    const items=triggers(),index=items.indexOf(trigger as HTMLButtonElement);if(!items.length)return;
    let next=direction==='first'?0:direction==='last'?items.length-1:index+(direction==='next'?1:-1);
    if(props.loop!==false)next=(next+items.length)%items.length;else next=Math.max(0,Math.min(items.length-1,next));
    const item=items[next]!;for(const candidate of allTriggers())candidate.tabIndex=candidate===item?0:-1;
    item.focus({preventScroll:true});if(activate)setValue(item.dataset.menuValue??'');
  }
  if(ownedMode)setContext<B4OwnedMenubar>(B4_OWNED_MENUBAR,{value:()=>value,select:setValue,navigate});
  function barKey(event:KeyboardEvent){
    if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
    const target=event.target as HTMLElement;if(!triggers().includes(target as HTMLButtonElement))return;
    const direction=event.key==='ArrowRight'?'next':event.key==='ArrowLeft'?'previous':event.key==='Home'?'first':event.key==='End'?'last':undefined;
    if(direction){event.preventDefault();navigate(target,direction,value!=='');}
  }
  $effect(()=>{
    if(!ownedMode||!ref)return;const element=ref,current=value;
    return untrack(()=>{
      const view=element.ownerDocument.defaultView,Observer=view?.MutationObserver;
      const attributes=['hidden','inert','aria-hidden','disabled','aria-disabled','class','style','data-menu-value'];
      let ancestors:Element[]=[],watching=false;
      const observer=Observer?new Observer(reconcile):undefined;
      function reconcile(){
        const next:Element[]=[];for(let parent=element.parentElement;parent;parent=parent.parentElement)next.push(parent);
        if(observer&&(!watching||next.length!==ancestors.length||next.some((parent,index)=>parent!==ancestors[index]))){
          observer.disconnect();ancestors=next;watching=true;
          observer.observe(element,{childList:true,subtree:true,attributes:true,attributeFilter:attributes});
          for(const parent of ancestors)observer.observe(parent,{childList:true,attributes:true,attributeFilter:attributes});
        }
        const items=triggers(),active=element.ownerDocument.activeElement;
        const selected=items.find(item=>item.dataset.menuValue===current)??items.find(item=>item===active)??items.find(item=>item.tabIndex===0)??items[0];
        for(const item of allTriggers())item.tabIndex=item===selected?0:-1;
      }
      // Media/container CSS can change visibility without changing an item's attributes.
      const Resize=view?.ResizeObserver,resize=Resize?new Resize(reconcile):undefined;
      resize?.observe(element);view?.addEventListener('resize',reconcile);
      reconcile();
      return()=>{observer?.disconnect();resize?.disconnect();view?.removeEventListener('resize',reconcile);};
    });
  });
</script>

{#if ownedMode}
  <div {...presentation?.target('root')} bind:this={ref} role="menubar" aria-orientation="horizontal" data-menubar-root onkeydown={barKey}>{@render io?.slots?.menus?.()}</div>
{:else}
<Menubar.Root {...presentation?.target('root')} bind:ref bind:value loop={props.loop !== false} onValueChange={(next) => io?.emit('valueChange', next)}>
  {#snippet child({ props: attributes })}<CatalogPart as="div" {attributes} bind:ref>{@render io?.slots?.menus?.()}</CatalogPart>{/snippet}
</Menubar.Root>
{/if}
