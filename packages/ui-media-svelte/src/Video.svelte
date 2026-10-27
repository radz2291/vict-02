<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {resolveMediaAsset,type ResolvedMediaAsset} from './assets.js';
  import {mediaHost} from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();const host=mediaHost();
  let source=$state(''),poster=$state(''),captions=$state(''),error=$state('');
  const target=$derived(presentation?.target('root'));
  $effect(()=>{const values=[props.source,props.poster,props.captions].map(v=>String(v??''));let disposed=false;const resources:ResolvedMediaAsset[]=[];source='';poster='';captions='';error='';Promise.all(values.map(async value=>{if(!value)return '';const result=await resolveMediaAsset(value,host?.assets);if(disposed){result.release();return '';}resources.push(result);return result.url;})).then(urls=>{if(!disposed)[source,poster,captions]=urls as [string,string,string];}).catch(reason=>{if(!disposed){error=String(reason.message??reason);io?.emit('failed',error);}});return()=>{disposed=true;resources.forEach(r=>r.release());};});
</script>
<figure {...target} class={`${target?.class??''} vict-media-video`}>
  {#if error}<p role="alert">{error}</p>{:else if source}<video {...presentation?.target('player')} src={source} {poster} crossorigin={captions?'anonymous':undefined} controls playsinline preload="metadata" aria-label={String(props.label??'Video')} onplay={()=>io?.emit('playing',true)} onpause={()=>io?.emit('playing',false)} onended={()=>io?.emit('ended')} onerror={()=>{error='Video could not be loaded or its codec is unsupported.';io?.emit('failed',error);}}>
    {#if captions}<track kind="captions" src={captions} srclang={String(props.language??'en')} label={String(props.captionLabel??'Captions')} default/>{/if}
  </video>{:else}<span role="status">{props.source?'Loading video…':'Choose a video'}</span>{/if}
  {#if props.caption}<figcaption {...presentation?.target('caption')}>{String(props.caption)}</figcaption>{/if}
</figure>
<style>.vict-media-video{margin:0;min-width:0}.vict-media-video video{display:block;width:100%;max-width:100%;height:auto}.vict-media-video figcaption{font-size:.875em;margin-top:.5rem}</style>
