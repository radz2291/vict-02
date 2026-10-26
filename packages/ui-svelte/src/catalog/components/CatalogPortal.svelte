<script lang="ts">
  import { Portal } from 'bits-ui';
  import { getContext, setContext } from 'svelte';
  import { CATALOG_PORTAL_LAYER } from './portal-layer.js';
  import type { Snippet } from 'svelte';
  import type { UiComponentPresentation } from '../../document/extensions.js';
  let { open, presentation, children }: {
    open: boolean;
    presentation?: UiComponentPresentation;
    children: Snippet;
  } = $props();
  const layer = (getContext<number | undefined>(CATALOG_PORTAL_LAYER) ?? 0) + 1;
  setContext(CATALOG_PORTAL_LAYER, layer);
  let ownerVisible=$state(false);
  $effect(()=>{
    if(!open){ownerVisible=false;return;}
    const owner=presentation?.target('root')['data-ui-owner'];
    // Standalone catalog controls retain their ordinary portal lifetime.
    if(typeof owner!=='string' || !owner){ownerVisible=true;return;}
    let ancestors:Element[]=[];
    const visibility=new MutationObserver(reconcile);
    function reconcile(){
      const roots=[...document.querySelectorAll<HTMLElement>('[data-ui-owner-root]')].filter(root=>root.dataset.uiOwnerRoot===owner);
      const root=roots.length===1?roots[0]:undefined;
      const next:Element[]=[];
      for(let element:Element|null=root ?? null;element;element=element.parentElement)next.push(element);
      if(next.length!==ancestors.length || next.some((element,index)=>element!==ancestors[index])){
        visibility.disconnect();ancestors=next;
        for(const element of ancestors)visibility.observe(element,{attributes:true,attributeFilter:['hidden','inert','class','style']});
      }
      // Modal libraries may mark the source aria-hidden or disable pointer events.
      // Those do not hide its logical owner and must never close their own portal.
      ownerVisible=!!root?.isConnected && ancestors.every(element=>{
        const style=getComputedStyle(element);
        return !element.hasAttribute('hidden') && !element.hasAttribute('inert') && style.display!=='none' && style.visibility!=='hidden';
      });
    }
    const membership=new MutationObserver(reconcile);
    membership.observe(document.body,{childList:true,subtree:true});
    globalThis.addEventListener('resize',reconcile);
    reconcile();
    return ()=>{visibility.disconnect();membership.disconnect();globalThis.removeEventListener('resize',reconcile);};
  });
</script>

<!-- Portal uses a separately mounted Svelte root. Its lifetime belongs to
     the controlled layer, rather than to a retained closed snippet tree.
     Bits still owns dismissal, focus scopes, scroll locking and positioning.
     The ancestor keeps the frozen descendant CSS cascade for portaled parts. -->
{#if open && ownerVisible}
  <Portal>
    <div class={presentation?.scopeClass} style={`display: contents; --vict-catalog-layer: ${layer * 100}`}>
      {@render children()}
    </div>
  </Portal>
{/if}
