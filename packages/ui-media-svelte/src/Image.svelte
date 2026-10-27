<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {resolveMediaAsset,type ResolvedMediaAsset} from './assets.js';
  import {mediaHost} from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  const host=mediaHost();let source=$state(''),error=$state(''),loaded=$state(false);
  const target=$derived(presentation?.target('root'));
  $effect(()=>{const input=String(props.source??'');let disposed=false,resolved:ResolvedMediaAsset|undefined;source='';error='';loaded=false;if(input)resolveMediaAsset(input,host?.assets).then(result=>{if(disposed){result.release();return;}resolved=result;source=result.url;}).catch(reason=>{if(!disposed){error=String(reason.message??reason);io?.emit('failed',error);}});return()=>{disposed=true;resolved?.release();};});
</script>
<figure {...target} class={`${target?.class??''} vict-media-image`} data-media-state={error?'error':loaded?'loaded':'loading'}>
  {#if error}<p role="alert">{error}</p>{:else if source}<img {...presentation?.target('image')} src={source} alt={String(props.alt??'')} loading={props.eager===true?'eager':'lazy'} style:object-fit={String(props.fit??'cover')} style:aspect-ratio={String(props.aspectRatio??'auto')} onload={()=>{loaded=true;io?.emit('loaded');}} onerror={()=>{error='Image could not be loaded.';io?.emit('failed',error);}}/>{:else}<span role="status">{props.source?'Loading image…':'Choose an image'}</span>{/if}
  {#if props.caption}<figcaption {...presentation?.target('caption')}>{String(props.caption)}</figcaption>{/if}
</figure>
<style>.vict-media-image{margin:0;min-width:0}.vict-media-image img{display:block;width:100%;max-width:100%;height:auto}.vict-media-image figcaption{font-size:.875em;margin-top:.5rem}</style>
