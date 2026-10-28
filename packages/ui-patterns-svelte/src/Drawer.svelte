<script lang="ts">
  import {patternTarget} from './target.js';
  import {Dialog} from '@victframework/ui-svelte/catalog/dialog';
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {lockViewport,restoreFocus} from './focus.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  let panel=$state<HTMLElement|null>(null);
  let layer=$state<HTMLElement>();
  let trigger=$state<HTMLButtonElement|null>(null);
  let previousFocus:Element|null=null;
  let open=$derived(props.open===true);
  const title=$derived(String(props.title??'Menu').trim()||'Menu');
  const triggerLabel=$derived(String(props.triggerLabel??'Open menu').trim()||'Open menu');
  const side=$derived(['left','right','top','bottom'].includes(String(props.side))?String(props.side):'left');
  const size=$derived(typeof props.size==='number'&&Number.isFinite(props.size)?Math.max(160,Math.min(1000,props.size)):320);
  const panelId=$props.id();
  $effect(()=>{if(open&&panel)return lockViewport(panel);});
  $effect(()=>{
    if(!open||!layer)return;
    const element=layer,viewport=element.closest<HTMLElement>('[data-ui-application-viewport]');
    if(!viewport)return;
    const align=()=>{
      const parent=element.offsetParent as HTMLElement|null;
      const box=viewport.getBoundingClientRect(),base=parent?.getBoundingClientRect();
      Object.assign(element.style,{inset:'auto',left:`${box.left-(base?.left??0)+(parent?.scrollLeft??0)}px`,top:`${box.top-(base?.top??0)+(parent?.scrollTop??0)}px`,width:`${viewport.clientWidth}px`,height:`${viewport.clientHeight}px`});
    };
    const resize=new ResizeObserver(align);resize.observe(viewport);align();return()=>resize.disconnect();
  });
  function focusOpen(event:Event){
    event.preventDefault();previousFocus=panel?.ownerDocument.activeElement??null;
    panel?.focus({preventScroll:true});
  }
  function focusClose(event:Event){event.preventDefault();restoreFocus(previousFocus,trigger);}
  function outside(event:PointerEvent){
    // Dismiss only inside this application; another application's input is not a close action.
    if(props.dismissible===false||!layer?.contains(event.target as Node))event.preventDefault();
  }
  const panelStyle=$derived(`position:absolute;transform:none;padding:0;margin:0;max-width:100%;max-height:100%;min-width:0;${side==='left'?`inset:0 auto 0 0;width:${size}px;height:100%;`:side==='right'?`inset:0 0 0 auto;width:${size}px;height:100%;`:side==='top'?`inset:0 0 auto 0;width:100%;height:${size}px;`:`inset:auto 0 0 0;width:100%;height:${size}px;`}`);
</script>

<span {...patternTarget(presentation,'root','vict-drawer-root')}>
  <Dialog.Root bind:open onOpenChange={next=>io?.emit('openChange',next)}>
    {#if props.showTrigger!==false}
      <Dialog.Trigger {...patternTarget(presentation,'trigger','vict-btn vict-btn--secondary')} bind:ref={trigger} aria-label={triggerLabel} aria-controls={panelId}>
        {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{triggerLabel}{/if}
      </Dialog.Trigger>
    {/if}
    {#if open}
      <div class="vict-drawer-layer" data-ui-pattern-overlay="drawer" bind:this={layer} role="presentation" onclick={event=>{if(event.target===event.currentTarget&&props.dismissible!==false)io?.emit('openChange',false);}}>
        <Dialog.Overlay {...patternTarget(presentation,'backdrop','vict-drawer-backdrop')} onclick={()=>{if(props.dismissible!==false)io?.emit('openChange',false);}}/>
        <Dialog.Content {...patternTarget(presentation,'panel','vict-drawer-panel')} bind:ref={panel} id={panelId} data-side={side} style={panelStyle} aria-label={title} preventScroll={false} onOpenAutoFocus={focusOpen} onCloseAutoFocus={focusClose} onEscapeKeydown={event=>{if(props.dismissible===false)event.preventDefault();}} onInteractOutside={outside}>
          <header {...presentation?.target('header')}><Dialog.Title>{title}</Dialog.Title><Dialog.Close class="vict-btn vict-btn--secondary" aria-label="Close drawer">×</Dialog.Close></header>
          <div {...patternTarget(presentation,'body','vict-drawer-body')}>{@render io?.slots?.body?.()}</div>
          {#if io?.slots?.footer}<footer {...presentation?.target('footer')}>{@render io.slots.footer()}</footer>{/if}
        </Dialog.Content>
      </div>
    {/if}
  </Dialog.Root>
</span>
<style>
  .vict-drawer-root{display:contents}.vict-drawer-layer{position:absolute;inset:0;z-index:30;display:flex;overflow:hidden;isolation:isolate}
  .vict-drawer-layer :global(.vict-drawer-backdrop){position:absolute;inset:0}
  .vict-drawer-layer :global(.vict-drawer-panel){display:flex;flex-direction:column;outline:none}
  header{display:flex;align-items:center;gap:1rem;justify-content:space-between;padding:1rem;border-bottom:1px solid var(--vict-color-border)}
  header :global([data-dialog-title]){font:inherit;font-weight:600;margin:0}
  .vict-drawer-root :global([data-dialog-trigger]),header :global([data-dialog-close]){min-width:44px;min-height:44px}
  .vict-drawer-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:1rem}
  footer{padding:1rem;border-top:1px solid var(--vict-color-border)}
</style>
