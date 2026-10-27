<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import {mediaHost,embedUrl,type EmbedProvider} from './context.js';
  let {props,presentation}:UiSvelteComponentProps=$props();const host=mediaHost();
  const target=$derived(presentation?.target('root'));
  const resolved=$derived.by(()=>{try{const provider=String(props.provider??'');if(!host?.embedProviders.includes(provider as EmbedProvider))throw Error('This embed provider is not enabled by the application host.');return {url:embedUrl(provider,String(props.videoId??'')),error:''};}catch(reason){return {url:'',error:reason instanceof Error?reason.message:'Invalid embed.'};}});
</script>
<div {...target} class={`${target?.class??''} vict-media-embed`}>
  {#if resolved.error}<p role="alert">{resolved.error}</p>{:else}<iframe {...presentation?.target('frame')} src={resolved.url} title={String(props.title??'Embedded video')} loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>{/if}
</div>
<style>.vict-media-embed{min-width:0}.vict-media-embed iframe{display:block;width:100%;aspect-ratio:16/9;border:0}</style>
