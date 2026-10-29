<script lang="ts">
  import {setContext,untrack} from 'svelte';
  import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
  import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
  import {GRAPH_EDITOR_HOST,type GraphEditorHost,type GraphPresentationState} from '../src/editor/host.js';
  import {flowAuthoringDescriptors} from '../src/authoring/descriptors.js';
  import {flowAuthoringImplementations} from '../src/authoring/implementations.js';
  let {initial,presentation}:{initial:UiDocument;presentation:GraphPresentationState}=$props();
  let source=$state(untrack(()=>initial));
  const states=new Map<string,GraphPresentationState>([['editor',untrack(()=>presentation)]]);
  const host:GraphEditorHost={historyFor:()=>undefined,presentationFor:({nodeId})=>({get:()=>states.get(nodeId),set:state=>{states.set(nodeId,state);}})};
  setContext(GRAPH_EDITOR_HOST,host);
  const compiled=$derived(compileUiDocument(source,defaultSemanticElementCatalog(),flowAuthoringDescriptors));
  function persist(key:string,value:unknown){if(key!=='graph'||typeof value!=='string')return;source={...source,revision:String(Number(source.revision)+1),localState:{...source.localState,graph:{key:'graph',type:'string',initial:value}}};}
  export function replace(next:UiDocument){source=next;}
  export function snapshot(){return source;}
  export function presentationSnapshot(){return states.get('editor');}
</script>
<div data-source-revision={source.revision}>
  {#key source.revision}
    {#if compiled.ok}<DocumentHost plan={compiled.plan} localState={source.localState} extensionDescriptors={flowAuthoringDescriptors} extensionImplementations={flowAuthoringImplementations} dispatch={async()=>undefined} navigate={()=>{}} onStateChange={persist}/>{/if}
  {/key}
</div>
