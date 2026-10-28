<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {mediaHost,embedUrl,type EmbedProvider} from './context.js';
  let {props,presentation}:UiSvelteComponentProps=$props();const host=mediaHost();
  const target=$derived(presentation?.target('root'));
  const resolved=$derived.by(()=>{try{const provider=String(props.provider??'');if(!host?.embedProviders.includes(provider as EmbedProvider))throw Error('This embed provider is not enabled by the application host.');return {url:embedUrl(provider,String(props.videoId??'')),error:''};}catch(reason){return {url:'',error:reason instanceof Error?reason.message:'Invalid embed.'};}});
  let frame=$state<HTMLIFrameElement>();
  let frameState=$state<'idle'|'loading'|'slow'|'loaded'|'failed'>('idle');
  let pendingTimer:ReturnType<typeof setTimeout>|undefined;
  function clearPending(){if(pendingTimer!==undefined){clearTimeout(pendingTimer);pendingTimer=undefined;}}
  $effect(()=>{
    const source=resolved.url;
    clearPending();
    if(!source){frameState='idle';return;}
    frameState='loading';
    let active=true;
    const timer=setTimeout(()=>{
      if(active&&resolved.url===source&&frameState==='loading')frameState='slow';
    },10_000);
    pendingTimer=timer;
    return()=>{active=false;clearTimeout(timer);if(pendingTimer===timer)pendingTimer=undefined;};
  });
  const currentEvent=(event:Event)=>event.currentTarget===frame&&frame?.getAttribute('src')===resolved.url;
  function frameLoaded(event:Event){
    if(!currentEvent(event)||frameState==='failed')return;
    clearPending();frameState='loaded';
    // A native frame load ends the loading indicator, not proof that the
    // provider's video is available or that playback succeeded.
  }
  function frameFailed(event:Event){if(!currentEvent(event))return;clearPending();frameState='failed';}
</script>
<div {...target} class={`${target?.class??''} vict-media-embed`} aria-busy={resolved.url!==''&&(frameState==='loading'||frameState==='slow')}>
  {#if resolved.error}<p role="alert">{resolved.error}</p>{:else}
    {#if frameState==='failed'}
      <p role="alert">Embedded frame could not be loaded.</p>
    {:else if frameState==='loading'||frameState==='slow'}
      <p class="media-embed-status" role="status" aria-live="polite">{frameState==='slow'?'The embedded frame is taking longer to load.':'Loading embedded frame.'}</p>
    {/if}
    {#key resolved.url}
      <iframe bind:this={frame} {...presentation?.target('frame')} hidden={frameState==='failed'} src={resolved.url} title={String(props.title??'Embedded video')} loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowfullscreen onload={frameLoaded} onerror={frameFailed}></iframe>
    {/key}
  {/if}
</div>
<style>.vict-media-embed{min-width:0}.vict-media-embed iframe{display:block;width:100%;aspect-ratio:16/9;border:0}.vict-media-embed iframe[hidden]{display:none}.media-embed-status{margin:.5rem 0;font-size:.875em;color:inherit}</style>
