<script lang="ts">
 import type {UiDocument} from '@victframework/ui';
 import {compileUiDocument,defaultSemanticElementCatalog} from '@victframework/ui';
 import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
 import {patternAuthoringDescriptors} from '../src/authoring/descriptors.js';
 import {patternAuthoringImplementations} from '../src/authoring/implementations.js';
 import {mediaAuthoringDescriptors} from '../../ui-media-svelte/src/descriptors.js';
 import {mediaAuthoringImplementations} from '../../ui-media-svelte/src/implementations.js';
 import AssetProvider from '../../ui-media-svelte/src/AssetProvider.svelte';
 import {memoryAssetStore,type MediaAssetStore} from '../../ui-media-svelte/src/assets.js';
 let {source,store=memoryAssetStore()}:{source:UiDocument;store?:MediaAssetStore}=$props();
 const descriptors=[...patternAuthoringDescriptors,...mediaAuthoringDescriptors];
 const implementations=[...patternAuthoringImplementations,...mediaAuthoringImplementations];
 const result=$derived(compileUiDocument(source,defaultSemanticElementCatalog(),descriptors));
</script>
<AssetProvider namespace={`patterns-test-${source.id}`} {store}><main class="vict-controls vict-rhea" data-ui-application-viewport style="position:relative;overflow:auto;width:390px;height:600px">
 {#if result.ok}<DocumentHost plan={result.plan} extensionDescriptors={descriptors} extensionImplementations={implementations} localState={source.localState} dispatch={async()=>undefined} navigate={()=>{}} />{:else}<pre>{JSON.stringify(result.diagnostics)}</pre>{/if}
</main></AssetProvider>
