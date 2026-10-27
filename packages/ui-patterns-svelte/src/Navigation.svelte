<script lang="ts">
  import {patternTarget} from './target.js';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { MediaIcon } from '@victframework/ui-media-svelte';
  import { stringItems } from './state.js';
  let {props,io,presentation,occurrenceKey,nodeId}:UiSvelteComponentProps=$props();
  const items=$derived(stringItems(props.items));
  const values=$derived(stringItems(props.values));
  const icons=$derived(stringItems(props.icons));
  const iconPack=$derived(String(props.iconPack??'lucide'));
  const iconRevision=$derived(String(props.iconRevision??'1.27.0'));
  const menuLabel=$derived(String(props.menuLabel??'Menu').trim()||'Menu');
  const id=$props.id();
  let expanded=$state(false);
</script>
<nav {...patternTarget(presentation,'root','vict-navigation')} aria-label={String(props.label??'Main navigation')}>
  <button {...patternTarget(presentation,'trigger','vict-navigation-toggle')} type="button" aria-label={menuLabel} aria-expanded={expanded} aria-controls={id} onclick={()=>{expanded=!expanded;}}>
    {#if io?.slots?.triggerIcon}<span {...presentation?.target('triggerIcon')} aria-hidden="true">{@render io.slots.triggerIcon()}</span>{:else if props.menuIcon}<span {...presentation?.target('triggerIcon')} aria-hidden="true"><MediaIcon occurrenceKey={`${occurrenceKey}:menu-icon`} {nodeId} props={{pack:iconPack,revision:iconRevision,name:String(props.menuIcon),decorative:true,size:20}} /></span>{/if}
    <span>{menuLabel}</span>
  </button>
  <ul {...presentation?.target('items')} id={id} data-expanded={expanded}>
    {#each items as item,i}<li><button {...presentation?.target('item')} type="button" aria-current={String(props.selected??'')===(values[i]??item)?'page':undefined} onclick={()=>{io?.emit('activate',values[i]??item);expanded=false;}}>
      {#if icons[i]}<span {...presentation?.target('itemIcon')} aria-hidden="true"><MediaIcon occurrenceKey={`${occurrenceKey}:item-icon:${i}`} {nodeId} props={{pack:iconPack,revision:iconRevision,name:icons[i],decorative:true,size:20}} /></span>{/if}<span>{item}</span>
    </button></li>{/each}
  </ul>
</nav>
<style>.vict-navigation{container-type:inline-size;min-width:0}.vict-navigation-toggle{display:none}ul{display:flex;gap:.5rem;flex-wrap:wrap;list-style:none;padding:0;margin:0}li{margin:0}button{display:inline-flex;align-items:center;gap:.5rem;font:inherit;min-height:44px;min-width:44px;padding:.5rem .75rem;background:var(--vict-surface,var(--vict-color-surface,#fff));color:var(--vict-text,var(--vict-color-text,#172033));border:1px solid var(--vict-border,var(--vict-color-border,#d8dce5));border-radius:.25rem}button[aria-current=page]{font-weight:600;outline:2px solid currentColor;outline-offset:1px}@container(max-width:36rem){.vict-navigation-toggle{display:flex}ul{display:none;flex-direction:column}ul[data-expanded=true]{display:flex}li button{width:100%;text-align:start}}</style>
