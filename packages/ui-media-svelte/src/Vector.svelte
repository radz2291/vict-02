<script lang="ts">
  import type {UiSvelteComponentProps} from '@victframework/ui-svelte';
  import { readManagedMediaAsset } from './assets.js';
  import {validateVector,importSvg,type VectorGraphic as Graphic} from './vectors.js';import VectorGraphic from './VectorGraphic.svelte';import {mediaHost} from './context.js';
  let {props,presentation}:UiSvelteComponentProps=$props();const host=mediaHost();let graphic=$state<Graphic|undefined>(),error=$state('');
  const target=$derived(presentation?.target('root'));
  $effect(()=>{const data=String(props.data??''),reference=String(props.source??'');let disposed=false;graphic=undefined;error='';if(data){try{graphic=validateVector(JSON.parse(data));}catch(reason){error=reason instanceof Error?reason.message:'Invalid vector.';}}else if(reference){readManagedMediaAsset(reference,host?.assets).then(asset=>{if(disposed)return;if(asset.mime!=='image/svg+xml')throw Error('A managed inert SVG asset is required.');graphic=importSvg(new TextDecoder().decode(asset.bytes));}).catch(reason=>{if(!disposed)error=reason instanceof Error?reason.message:'Vector asset unavailable.';});}return()=>{disposed=true;};});
</script>
<span {...target} class={`${target?.class??''} vict-media-vector`}>
  {#if error}<span role="alert">{error}</span>{:else if graphic}<VectorGraphic {graphic} label={String(props.label??'Vector graphic')} decorative={props.decorative===true}/>{:else}<span role="status">Choose or compose a vector graphic</span>{/if}
</span>
<style>.vict-media-vector{display:inline-block;max-width:100%;min-width:0}.vict-media-vector :global(svg){max-width:100%;display:block}</style>
