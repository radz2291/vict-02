<script lang="ts">
  import {setContext,onDestroy} from 'svelte';
  import {EditorCanvas,type EditorBridge} from '@victframework/ui-editor';
  import type {UiValue,UiExtensionDescriptor} from '@victframework/ui';
  import {GRAPH_EDITOR_HOST_V2,type GraphOccurrenceIdentity} from '@victframework/ui-flow-svelte';
  import {catalogDescriptors,catalogImplementations,designerCatalogs} from '../../src/lib/designer/application.js';
  import {sourceRuntimeRefresh} from '../../src/lib/designer/source-runtime-refresh.js';
  import {graphRuntimeChanged} from '../../src/lib/designer/graph-runtime.js';
  import {graphAuthoringFor} from '../../src/lib/designer/graph-history.js';
  import Commands from './HistoryWorkspaceCommands.svelte';
  let {bridge,onDiagnostic}:{bridge:EditorBridge;onDiagnostic:(issue:{code:string})=>void}=$props();
  const descriptor:UiExtensionDescriptor={id:'test.history-commands',revision:'1',abi:'vict.ui-component-abi@1',events:['vict.ui-component-abi@1'],rendererImplementationId:'test.history-commands',props:[],outputs:[]};
  const extensions=[...catalogDescriptors,descriptor],implementations=[...catalogImplementations,{extensionId:descriptor.id,revision:'1',abi:'vict.ui-component-abi@1' as const,events:['vict.ui-component-abi@1'],rendererImplementationId:descriptor.rendererImplementationId,component:Commands}];
  let source=$state(bridge.document),values=$state<Record<string,UiValue>>({}),signal=$state(Symbol('canvas'));
  let previousDocumentId=source.id;
  const sync=()=>{const next=bridge.document,refresh=sourceRuntimeRefresh(next,values,previousDocumentId);previousDocumentId=next.id;values=refresh.values;if(refresh.resetRenderer)signal=Symbol('document-switch');source=next;};
  const unsubscribe=bridge.subscribe(()=>sync());onDestroy(unsubscribe);
  const history={canUndo:()=>bridge.getSnapshot().canUndo,canRedo:()=>bridge.getSnapshot().canRedo,undo:()=>{bridge.undo();sync();},redo:()=>{bridge.redo();sync();}};
  setContext(GRAPH_EDITOR_HOST_V2,{authoringFor:(identity:GraphOccurrenceIdentity)=>graphAuthoringFor(source,identity,history)});
  function write(key:string,value:UiValue){graphRuntimeChanged(source,key,value,{values,applyGraph:document=>bridge.apply({requestId:crypto.randomUUID(),reason:'Public graph operation',commands:[{op:'replaceDocument',document}]}).ok,reset:()=>{signal=Symbol('refused');},supply:next=>{values=next;},invalid:()=>onDiagnostic({code:'GRAPH_REFUSED'})});}
</script>
<EditorCanvas document={source} catalogs={{...designerCatalogs,extensions}} {extensions} extensionImplementations={implementations} interactionMode="interact" stateValues={values} resetSignal={signal} onStateChange={write} onRenderDiagnostic={onDiagnostic} dispatch={async()=>({ok:false,code:'NO_SERVICE'})} navigate={()=>{}} onSelect={()=>{}}/>
