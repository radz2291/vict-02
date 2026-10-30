<script lang="ts">
  import {patternTarget} from './target.js';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import {Button} from '@victframework/ui-svelte/catalog/button';
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
  <Button.Root {...patternTarget(presentation,'trigger','vict-btn vict-btn--secondary vict-navigation-toggle')} type="button" aria-label={menuLabel} aria-expanded={expanded} aria-controls={id} onclick={()=>{expanded=!expanded;}}>
    {#if io?.slots?.triggerIcon}<span {...presentation?.target('triggerIcon')} aria-hidden="true">{@render io.slots.triggerIcon()}</span>{:else if props.menuIcon}<span {...presentation?.target('triggerIcon')} aria-hidden="true"><MediaIcon occurrenceKey={`${occurrenceKey}:menu-icon`} {nodeId} props={{pack:iconPack,revision:iconRevision,name:String(props.menuIcon),decorative:true,size:20}} /></span>{/if}
    <span>{menuLabel}</span>
  </Button.Root>
  <ul {...presentation?.target('items')} id={id} data-expanded={expanded}>
    {#each items as item,i}<li><Button.Root {...patternTarget(presentation,'item','vict-btn vict-btn--secondary vict-navigation-item')} type="button" aria-current={String(props.selected??'')===(values[i]??item)?'page':undefined} onclick={()=>{io?.emit('activate',values[i]??item);expanded=false;}}>
      {#if icons[i]}<span {...presentation?.target('itemIcon')} aria-hidden="true"><MediaIcon occurrenceKey={`${occurrenceKey}:item-icon:${i}`} {nodeId} props={{pack:iconPack,revision:iconRevision,name:icons[i],decorative:true,size:20}} /></span>{/if}<span>{item}</span>
    </Button.Root></li>{/each}
  </ul>
</nav>
<style>.vict-navigation{container-type:inline-size;min-width:0}.vict-navigation :global(.vict-navigation-toggle){display:none}ul{display:flex;gap:.5rem;flex-wrap:wrap;list-style:none;padding:0;margin:0}li{margin:0}.vict-navigation :global([data-button-root]){min-height:44px;min-width:44px}.vict-navigation :global([aria-current=page]){font-weight:600;outline:2px solid var(--vict-color-focusRing,currentColor);outline-offset:1px}@container(max-width:36rem){.vict-navigation :global(.vict-navigation-toggle){display:flex}ul{display:none;flex-direction:column}ul[data-expanded=true]{display:flex}li :global(button){width:100%;text-align:start}}</style>
