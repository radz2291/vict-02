<script lang="ts">
  import {patternTarget} from './target.js';
  import {Dialog} from '@victframework/ui-svelte/catalog/dialog';
  import {OwnedDialogContent,type UiSvelteComponentProps} from '@victframework/ui-svelte';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  let panel=$state<HTMLDivElement|null>(null);
  let layer=$state<HTMLElement>();
  let trigger=$state<HTMLButtonElement|null>(null);
  let open=$derived(props.open===true);
  const title=$derived(String(props.title??'Menu').trim()||'Menu');
  const triggerLabel=$derived(String(props.triggerLabel??'Open menu').trim()||'Open menu');
  const side=$derived(['left','right','top','bottom'].includes(String(props.side))?String(props.side):'left');
  const size=$derived(typeof props.size==='number'&&Number.isFinite(props.size)?Math.max(160,Math.min(1000,props.size)):320);
  const panelId=$props.id();
  const titleId=`${panelId}-title`;
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
  const panelStyle=$derived(`position:absolute;transform:none;padding:0;margin:0;max-width:100%;max-height:100%;min-width:0;${side==='left'?`inset:0 auto 0 0;width:${size}px;height:100%;`:side==='right'?`inset:0 0 0 auto;width:${size}px;height:100%;`:side==='top'?`inset:0 0 auto 0;width:100%;height:${size}px;`:`inset:auto 0 0 0;width:100%;height:${size}px;`}`);
  // Keep renderer-owned dynamic binding variables alongside sheet geometry.
  const composedPanelStyle=$derived(`${presentation?.target('panel').style??''};${panelStyle}`);
</script>

<span {...patternTarget(presentation,'root','vict-drawer-root')}>
  <Dialog.Root bind:open onOpenChange={next=>io?.emit('openChange',next)}>
    {#if props.showTrigger!==false}
      <Dialog.Trigger {...patternTarget(presentation,'trigger','vict-btn vict-btn--secondary')} bind:ref={trigger} aria-label={triggerLabel}>
        {#snippet child({props:triggerAttributes})}
          <button {...triggerAttributes} aria-controls={open?panelId:undefined}>
            {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{triggerLabel}{/if}
          </button>
        {/snippet}
      </Dialog.Trigger>
    {/if}
    {#if open}
      <div class="vict-drawer-layer" data-ui-pattern-overlay="drawer" bind:this={layer}>
        <Dialog.Overlay {...patternTarget(presentation,'backdrop','vict-drawer-backdrop')}/>
        <OwnedDialogContent {...patternTarget(presentation,'panel','vict-drawer-panel')} bind:ref={panel} {trigger} id={panelId} data-side={side} style={composedPanelStyle} aria-label={title} aria-labelledby={titleId} dismissible={props.dismissible!==false} lockScroll onRequestClose={()=>io?.emit('openChange',false)}>
          <header {...presentation?.target('header')}><Dialog.Title id={titleId}>{title}</Dialog.Title><Dialog.Close class="vict-btn vict-btn--secondary" aria-label="Close drawer">×</Dialog.Close></header>
          <div {...patternTarget(presentation,'body','vict-drawer-body')}>{@render io?.slots?.body?.()}</div>
          {#if io?.slots?.footer}<footer {...presentation?.target('footer')}>{@render io.slots.footer()}</footer>{/if}
        </OwnedDialogContent>
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
