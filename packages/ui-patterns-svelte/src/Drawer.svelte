<script lang="ts">
  import {patternTarget} from './target.js';
  import { tick, untrack } from 'svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { lockViewport, trapFocus } from './focus.js';
  let { props, io, presentation }: UiSvelteComponentProps = $props();
  let panel = $state<HTMLElement>();
  let layer = $state<HTMLElement>();
  let trigger = $state<HTMLButtonElement>();
  const open = $derived(props.open === true);
  const title = $derived(String(props.title ?? 'Menu'));
  const triggerLabel = $derived(String(props.triggerLabel ?? 'Open menu').trim() || 'Open menu');
  const side = $derived(['left','right','top','bottom'].includes(String(props.side)) ? String(props.side) : 'left');
  const width = $derived(typeof props.size === 'number' ? Math.max(160, Math.min(1000, props.size)) : 320);
  const panelId = $props.id();
  const close = () => io?.emit('openChange', false);
  $effect(() => {
    if (!open) return;
    const original = untrack(() => panel?.ownerDocument.activeElement);
    let release = () => {};
    let cancelled = false;
    void tick().then(() => { if (!cancelled && panel) { release = lockViewport(panel); panel.focus(); } });
    return () => { cancelled = true; release(); if (original instanceof HTMLElement && original.isConnected) original.focus(); else trigger?.focus(); };
  });
  $effect(()=>{
    if(!open||!layer)return;const element=layer,viewport=element.closest<HTMLElement>('[data-ui-application-viewport]');if(!viewport)return;
    const align=()=>{const parent=element.offsetParent as HTMLElement|null;const box=viewport.getBoundingClientRect(),base=parent?.getBoundingClientRect()??new DOMRect();Object.assign(element.style,{inset:'auto',left:`${box.left-base.left+(parent?.scrollLeft??0)}px`,top:`${box.top-base.top+(parent?.scrollTop??0)}px`,width:`${viewport.clientWidth}px`,height:`${viewport.clientHeight}px`});};
    const resize=new ResizeObserver(align);resize.observe(viewport);align();return()=>resize.disconnect();
  });
  function keyboard(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && props.dismissible !== false) { event.preventDefault(); event.stopPropagation(); close(); }
    else if (panel) trapFocus(event, panel);
  }
</script>

<span {...patternTarget(presentation,'root','vict-drawer-root')}>
  {#if props.showTrigger !== false}
    <button {...presentation?.target('trigger')} bind:this={trigger} type="button" aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} onclick={() => io?.emit('openChange', !open)}>
      {#if io?.slots?.trigger}{@render io.slots.trigger()}{:else}{triggerLabel}{/if}
    </button>
  {/if}
  {#if open}
    <div {...patternTarget(presentation,'backdrop','vict-drawer-layer')} data-ui-pattern-overlay="drawer" bind:this={layer} onclick={(event) => { if (event.target === event.currentTarget && props.dismissible !== false) close(); }} role="presentation">
      <section {...patternTarget(presentation,'panel','vict-drawer-panel')} bind:this={panel} id={panelId} data-side={side} style:--drawer-size={`${width}px`} role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onkeydown={keyboard}>
        <header {...presentation?.target('header')}><h2>{title}</h2><button type="button" aria-label="Close drawer" onclick={close}>×</button></header>
        <div {...patternTarget(presentation,'body','vict-drawer-body')}>{@render io?.slots?.body?.()}</div>
        {#if io?.slots?.footer}<footer {...presentation?.target('footer')}>{@render io.slots.footer()}</footer>{/if}
      </section>
    </div>
  {/if}
</span>
<style>
  .vict-drawer-root{display:contents}.vict-drawer-layer{position:absolute;inset:0;z-index:30;background:rgb(0 0 0 / .4);display:flex;overflow:hidden;isolation:isolate}.vict-drawer-panel{position:absolute;display:flex;flex-direction:column;background:var(--vict-surface,var(--vict-color-surface,#fff));color:var(--vict-text,var(--vict-color-text,#172033));box-shadow:0 6px 30px rgb(0 0 0 / .18);max-width:100%;max-height:100%;outline:none;min-width:0}.vict-drawer-panel[data-side=left]{inset:0 auto 0 0;width:var(--drawer-size)}.vict-drawer-panel[data-side=right]{inset:0 0 0 auto;width:var(--drawer-size)}.vict-drawer-panel[data-side=top]{inset:0 0 auto;height:var(--drawer-size)}.vict-drawer-panel[data-side=bottom]{inset:auto 0 0;height:var(--drawer-size)}header{display:flex;align-items:center;gap:1rem;justify-content:space-between;padding:1rem;border-bottom:1px solid var(--vict-border,var(--vict-color-border,#d8dce5))}h2{font:inherit;font-weight:600;margin:0}button{font:inherit;min-width:44px;min-height:44px;color:inherit}header button{background:transparent;border:0;font-size:1.5rem}.vict-drawer-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:1rem}footer{padding:1rem;border-top:1px solid var(--vict-border,var(--vict-color-border,#d8dce5))}
</style>
