<script lang="ts">
  import {setContext} from 'svelte';
  import type {UiDocument,UiValue} from '@victframework/ui';
  import {DocumentHost} from '@victframework/ui-svelte';
  import {AssetProvider,memoryAssetStore} from '@victframework/ui-media-svelte';
  import {GRAPH_EDITOR_HOST,type GraphEditorHost} from '@victframework/ui-flow-svelte';
  import {compileScreen,catalogDescriptors,catalogImplementations,screenActionState} from '../../src/lib/designer/application.js';
  let {source,onStateChange,history,stateValues,resetSignal}:{source:UiDocument;onStateChange?:(key:string,value:UiValue)=>void;history?:GraphEditorHost;stateValues?:Readonly<Record<string,UiValue>>;resetSignal?:number}=$props();
  setContext<GraphEditorHost>(GRAPH_EDITOR_HOST,{historyFor:identity=>history?.historyFor(identity)});
  const store=memoryAssetStore();
  const compiled=$derived(compileScreen(source));
  const plan=$derived(compiled.ok?compiled.plan.documentPlans?.[`${source.id}@${source.revision}`]:undefined);
  export function updateSource(next:UiDocument){source=next;}
  export function updateRuntime(values:Readonly<Record<string,UiValue>>,signal:number){stateValues=values;resetSignal=signal;}
</script>
<div data-ui-application-viewport style="position:relative;isolation:isolate;height:600px;overflow:hidden">
  <AssetProvider namespace={`fixture.${source.id}`} {store}>
    {#if plan}<DocumentHost {plan} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} localState={source.localState} actionState={screenActionState} {stateValues} {resetSignal} {onStateChange} dispatch={async()=>({ok:false,code:'FIXTURE_NO_SERVICE'})} navigate={()=>{}} />{:else}<p role="alert">Fixture did not compile.</p>{/if}
  </AssetProvider>
</div>
