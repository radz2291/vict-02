<script lang="ts">
 import AssetProvider from '../src/AssetProvider.svelte';import AssetLibrary from '../src/AssetLibrary.svelte';import type {MediaAssetStore} from '../src/assets.js';
 let {store,onchange,onselected,namespace='partial-upload-proof'}:{store:MediaAssetStore;onchange:()=>void;onselected?:(reference:string)=>void;namespace?:string}=$props();
 export function replaceHost(nextNamespace:string,nextStore:MediaAssetStore){namespace=nextNamespace;store=nextStore;}
</script>
<AssetProvider {namespace} {store} {onchange}><AssetLibrary nodeId="library" occurrenceKey="library" props={{label:'Partial-write proof'}} io={{emit:(name,value)=>{if(name==='selectedAsset')onselected?.(String(value));}}}/></AssetProvider>
