<script lang="ts">
  import {setContext,type Snippet} from 'svelte';
  import {indexedDbAssetStore,type MediaAssetStore} from './assets.js';
  import {createIconRegistry,type IconRegistry} from './icons.js';
  import {MEDIA_HOST,type EmbedProvider,type MediaHost} from './context.js';
  let {namespace,store,icons,embedProviders=[],onchange,children}:{namespace:string;store?:MediaAssetStore;icons?:IconRegistry;embedProviders?:readonly EmbedProvider[];onchange?:()=>void;children:Snippet}=$props();
  const hostedStore=$derived(store??indexedDbAssetStore(namespace)),defaultIcons=createIconRegistry();
  setContext<MediaHost>(MEDIA_HOST,{get namespace(){return namespace;},get assets(){return hostedStore;},get icons(){return icons??defaultIcons;},get embedProviders(){return embedProviders;},changed:()=>onchange?.()});
</script>
{@render children()}
