<script lang="ts">
  import {patternTarget} from './target.js';
  import { untrack } from 'svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import {Button} from '@victframework/ui-svelte/catalog/button';
  import { campaignKey,campaignSeen,dismissCampaign,resetCampaign,type VisitStore } from './state.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  let visible=$state(false);
  let memory=$state<'ready'|'unavailable'|'invalid'>('unavailable');
  let store:VisitStore|undefined;
  let key='';
  let resetError=$state('');
  const applicationId=$derived(String(props.applicationId??''));
  const campaignId=$derived(String(props.campaignId??''));
  const resetKey=$derived(String(props.resetKey??''));
  const scope=$derived(props.scope==='session'?'session':'browser');
  const dismissed=$derived(props.dismissed===true);
  $effect(()=>{
    resetError='';
    let nextVisible=false;
    let nextMemory:'ready'|'unavailable'|'invalid'='unavailable';
    try {key=campaignKey(applicationId,campaignId,resetKey);} catch {
      store=undefined;visible=false;memory='invalid';
      untrack(()=>{io?.emit('showChange',false);io?.emit('memoryStatus','invalid');});return;
    }
    try {
      store=scope==='session'?window.sessionStorage:window.localStorage;
      if(dismissed)dismissCampaign(store,key);
      nextVisible=!campaignSeen(store,key);nextMemory='ready';
    } catch { store=undefined;nextVisible=!dismissed;nextMemory='unavailable'; }
    visible=nextVisible;memory=nextMemory;
    untrack(()=>{io?.emit('showChange',nextVisible);io?.emit('memoryStatus',nextMemory);});
  });
  function dismiss(){if(store){try{dismissCampaign(store,key);}catch{memory='unavailable';io?.emit('memoryStatus',memory);}}visible=false;io?.emit('showChange',false);io?.emit('dismissedChange',true);}
  function reset(){
    if(!store||memory!=='ready')return;
    try {resetCampaign(store,key);} catch {
      memory='unavailable';resetError='Campaign memory could not be reset. Persistence is unavailable.';
      io?.emit('memoryStatus',memory);return;
    }
    resetError='';visible=true;
    io?.emit('dismissedChange',false);io?.emit('showChange',true);
  }
</script>
<section {...patternTarget(presentation,'root','vict-first-visit')} data-memory-status={memory}>
  {#if memory==='invalid'}<p role="alert">First-visit content requires application and campaign identities.</p>{/if}
  {#if visible}<div {...presentation?.target('body')}>{@render io?.slots?.body?.()}</div><Button.Root {...patternTarget(presentation,'dismiss','vict-btn vict-btn--secondary')} type="button" onclick={dismiss}>{String(props.dismissLabel??'Dismiss')}</Button.Root>{/if}
  {#if props.allowReopen===true&&!visible}<Button.Root class="vict-btn vict-btn--secondary" type="button" onclick={()=>{visible=true;io?.emit('showChange',true);}}>{String(props.reopenLabel??'Show offer')}</Button.Root>{/if}
  {#if props.allowReset===true}<Button.Root {...patternTarget(presentation,'reset','vict-btn vict-btn--secondary')} type="button" disabled={memory!=='ready'} onclick={reset}>{String(props.resetLabel??'Reset welcome')}</Button.Root>{/if}
  {#if resetError}<p role="alert">{resetError}</p>{/if}
</section>
<style>.vict-first-visit{min-width:0}.vict-first-visit :global([data-button-root]){min-width:44px;min-height:44px}</style>
