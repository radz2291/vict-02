<script lang="ts">
  import {getContext,onDestroy} from 'svelte';
  import type {UiSvelteComponentProps,UiScopedSlotFrame} from '@victframework/ui-svelte';
  import type {UiValue} from '@victframework/ui';
  import {resolveGraphEdgeAppearance,type GraphEdgeAppearance} from '../editor/model-v3.js';
  import {GRAPH_WORKSPACE,type GraphWorkspaceContext} from './context.js';
  let {props,io,presentation}:UiSvelteComponentProps=$props();
  const workspace=getContext<GraphWorkspaceContext|undefined>(GRAPH_WORKSPACE);
  const validTarget=$derived(props.target===undefined||props.target==='canvas'||props.target==='selection');
  const canvas=$derived(props.target==='canvas');
  const edge=$derived(workspace?.selection.edges.length===1&&workspace.selection.nodes.length===0?workspace.graph.edges.find(edge=>edge.id===workspace.selection.edges[0]):undefined);
  const readOnly=$derived(!validTarget||!workspace||workspace.modelVersion!==3||workspace.readOnly||(!canvas&&!edge));
  let previousIdentity:string|undefined;
  let generation=Symbol('edge-settings');
  let alive=true;
  onDestroy(()=>{alive=false;generation=Symbol('disposed');});
  const frame=$derived.by(():UiScopedSlotFrame=>{
    const graph=workspace?.graph,edgeId=canvas?undefined:edge?.id,revision=graph?.revision;
    const identity=canvas?'canvas':`edge:${edgeId??'none'}`;
    if(identity!==previousIdentity){previousIdentity=identity;generation=Symbol(identity);}
    const token=generation;
    const effective=resolveGraphEdgeAppearance(graph??{},edgeId?edge:undefined);
    const active=()=>alive&&generation===token&&!!workspace&&!readOnly&&workspace.graph===graph&&workspace.graph.revision===revision&&(canvas||(workspace.selection.nodes.length===0&&workspace.selection.edges.length===1&&workspace.selection.edges[0]===edgeId));
    function write(key:string,value:UiValue){
      if(!active()||!['route','pattern','color','width','startArrow','endArrow'].includes(key))return;
      const current=canvas?graph?.edgeDefaults:edge?.appearance;
      const appearance={...current,[key]:value} as GraphEdgeAppearance;
      workspace!.apply([canvas?{type:'setEdgeDefaults',appearance}:{type:'setEdgeAppearance',edgeId,appearance}],revision);
    }
    return {key:identity,props:{target:canvas?'canvas':'selection',edgeId:edgeId??'',readOnly,hasOverride:canvas?!!graph?.edgeDefaults&&Object.keys(graph.edgeDefaults).length>0:!!edge?.appearance&&Object.keys(edge.appearance).length>0},state:effective,onStateChange:write,
      onOutput(name){if(name==='reset'&&active())workspace!.apply([canvas?{type:'setEdgeDefaults',appearance:{}}:{type:'clearEdgeAppearance',edgeId}],revision);}};
  });
</script>
<section {...presentation?.target('root')} aria-label={String(props.label??(canvas?'Canvas connection appearance':'Selected connection appearance'))}>
  {#if !workspace||workspace.modelVersion!==3}<p role="alert">Connection appearance settings require a graph@3 workspace.</p>{/if}
  {@render io?.scopedSlots?.content?.(frame)}
</section>
