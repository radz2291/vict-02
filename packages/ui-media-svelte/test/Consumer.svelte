<script lang="ts">
 import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
 import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
 import AssetProvider from '../src/AssetProvider.svelte';import {mediaAuthoringDescriptors} from '../src/descriptors.js';import {mediaAuthoringImplementations} from '../src/implementations.js';import type {MediaAssetStore} from '../src/assets.js';import type {EmbedProvider} from '../src/context.js';
 let {source,store,providers=[]}:{source:UiDocument;store:MediaAssetStore;providers?:readonly EmbedProvider[]}=$props();
 const compiled=$derived(compileUiDocument(source,defaultSemanticElementCatalog(),mediaAuthoringDescriptors));
</script>
<AssetProvider namespace="media-consumer-test" {store} embedProviders={providers}>{#if compiled.ok}<DocumentHost plan={compiled.plan} extensionDescriptors={mediaAuthoringDescriptors} extensionImplementations={mediaAuthoringImplementations} localState={source.localState} dispatch={async()=>undefined} navigate={()=>{}}/>{:else}<pre data-compile-errors>{JSON.stringify(compiled)}</pre>{/if}</AssetProvider>
