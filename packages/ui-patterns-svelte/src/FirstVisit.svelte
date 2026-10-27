<script lang="ts">
  import {patternTarget} from './target.js';
  import { untrack } from 'svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import { campaignKey,campaignSeen,dismissCampaign,type VisitStore } from './state.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  let visible=$state(false);
  let memory=$state<'ready'|'unavailable'|'invalid'>('unavailable');
  let store:VisitStore|undefined;
  let key='';
  const applicationId=$derived(String(props.applicationId??''));
  const campaignId=$derived(String(props.campaignId??''));
  const resetKey=$derived(String(props.resetKey??''));
  const scope=$derived(props.scope==='session'?'session':'browser');
  const dismissed=$derived(props.dismissed===true);
  $effect(()=>{
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
</script>
<section {...patternTarget(presentation,'root','vict-first-visit')} data-memory-status={memory}>
  {#if memory==='invalid'}<p role="alert">First-visit content requires application and campaign identities.</p>{/if}
  {#if visible}<div {...presentation?.target('body')}>{@render io?.slots?.body?.()}</div><button {...presentation?.target('dismiss')} type="button" onclick={dismiss}>{String(props.dismissLabel??'Dismiss')}</button>{/if}
  {#if props.allowReopen===true&&!visible}<button type="button" onclick={()=>{visible=true;io?.emit('showChange',true);}}>{String(props.reopenLabel??'Show offer')}</button>{/if}
</section>
<style>.vict-first-visit{min-width:0}button{font:inherit;min-width:44px;min-height:44px}</style>
