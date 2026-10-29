<script lang="ts">
  import { getContext, setContext, untrack } from 'svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import type { GraphSelection } from '../editor/model.js';
  import {emptyWorkspaceGraph,parseWorkspaceGraph,createWorkspaceSession,workspaceParameters,workspacePorts,workspaceConnectionIssue,workspaceParameterOperation,type WorkspaceGraph,type WorkspaceResult,type WorkspaceModelVersion} from './workspace-model.js';
  import { GRAPH_EDITOR_HOST, type GraphEditorHost } from '../editor/host.js';
  import { GRAPH_WORKSPACE, type GraphWorkspaceContext } from './context.js';
  let {props,io,presentation,nodeId,occurrenceKey,modelVersion=1}:UiSvelteComponentProps & {modelVersion?:WorkspaceModelVersion}=$props();
  // Fixed by the exact registered implementation, never by serialized props.
  const version=untrack(()=>modelVersion);
  const host=getContext<GraphEditorHost|undefined>(GRAPH_EDITOR_HOST);
  const identity=$derived({nodeId,occurrenceKey});
  const history=$derived(host?.historyFor(identity));
  const view=$derived(host?.presentationFor?.(identity));
  function domainValidation(graph:WorkspaceGraph){return graph.schema==='vict.flow-graph@1'?host?.validate?.(identity,graph)??[]:host?.validateV2?.(identity,graph)??[];}
  let session=createWorkspaceSession(emptyWorkspaceGraph(version),false,domainValidation);
  let current=$state<WorkspaceGraph>(emptyWorkspaceGraph(version));
  let selection=$state<GraphSelection>({nodes:[],edges:[]});
  let error=$state('');
  let incoming='',emitted='';
  let valid=$state(false);
  const generations=new Map<string,symbol>();
  function reconcile(){
    for(const id of generations.keys())if(!current.nodes.some(n=>n.id===id))generations.delete(id);
    for(const node of current.nodes)if(!generations.has(node.id))generations.set(node.id,Symbol(node.id));
    selection={nodes:selection.nodes.filter(id=>current.nodes.some(n=>n.id===id)),edges:selection.edges.filter(id=>current.edges.some(e=>e.id===id))};
  }
  $effect(()=>{const source=String(props.graph??''),readOnly=props.readOnly===true;untrack(()=>{
    session.setReadOnly(readOnly);
    if(source===incoming)return;
    incoming=source;
    if(valid&&source===emitted)return;
    const parsed=parseWorkspaceGraph(source,version);
    if(!parsed.ok){valid=false;error=parsed.issues.map(i=>i.message).join(' ');return;}
    let domainIssues;
    try{domainIssues=domainValidation(parsed.graph);}catch{valid=false;error='Application graph validation is unavailable; previous graph retained.';return;}
    if(domainIssues.length){valid=false;error=domainIssues.map(issue=>issue.message).join(' ');return;}
    // An external source replacement invalidates callbacks from the prior source,
    // even if a project reuses a semantic node ID for a new incarnation.
    generations.clear();
    if(!valid){const restored=view?.get();if(restored)selection=restored.selection;}
    session=createWorkspaceSession(parsed.graph,readOnly,domainValidation);
    current=parsed.graph;valid=true;error='';reconcile();
  });});
  function accept(result:WorkspaceResult){
    if(!result.ok){current={...current};error=result.issues.map(i=>i.message).join(' ');io?.emit('operationResult',JSON.stringify({ok:false,issues:result.issues}));return;}
    current=result.graph;reconcile();error='';emitted=JSON.stringify(current);
    io?.emit('graphChange',emitted);
    io?.emit('operationResult',JSON.stringify({ok:true,revision:current.revision}));
  }
  function apply(operations:unknown,expectedRevision=current.revision){
    if(!valid||props.readOnly===true){error=valid?'Graph is read-only.':'Restore valid graph source before editing.';return;}
    const result=session.apply(operations,expectedRevision);
    if(result.ok)for(const id of result.removedNodeIds??[])generations.delete(id);
    accept(result);
  }
  function output(name:string,payload:unknown){
    if(name==='operation'){
      let parsed:unknown;
      try{if(typeof payload!=='string'||payload.length>1_000_000)throw Error();parsed=JSON.parse(payload);}catch{error='Operation output requires a bounded JSON graph operation array.';return;}
      apply(parsed);
    }else if(name==='undo')workspace.undo();
    else if(name==='redo')workspace.redo();
    else io?.emit('applicationAction',JSON.stringify({output:name,payload:payload??null}));
  }
  const workspace:GraphWorkspaceContext={
    get graph(){return current;},get selection(){return selection;},get readOnly(){return props.readOnly===true||!valid;},
    viewFor(projectionKey){return host?.presentationFor?.({nodeId,occurrenceKey:JSON.stringify([occurrenceKey,'viewport',projectionKey])})?.get();},get body(){return io?.scopedSlots?.body;},
    ports(node){return workspacePorts(current,node.id);},
    connectionIssue(edge){return workspaceConnectionIssue(current,edge);},
    frame(reference,projectionKey='default'){
      const node=current.nodes.find(item=>item.id===reference.id)!;
      const generation=generations.get(node.id);
      const active=()=>generations.get(node.id)===generation&&current.nodes.some(n=>n.id===node.id);
      return {key:JSON.stringify([projectionKey,node.id]),props:{nodeId:node.id,nodeType:node.type,label:node.label,selected:selection.nodes.includes(node.id),readOnly:props.readOnly===true||!valid,graphRevision:current.revision},
        state:workspaceParameters(current,node.id),
        onStateChange:(key,value)=>{if(active())apply([workspaceParameterOperation(current,node.id,key,value)]);},
        onOutput:(name,payload)=>{if(active()&&valid&&props.readOnly!==true)io?.emit('nodeAction',JSON.stringify({nodeId:node.id,nodeType:node.type,output:name,payload:payload??null}));},
      };
    },apply,
    select(next){if(JSON.stringify(selection)===JSON.stringify(next))return;selection=next;io?.emit('selectionChange',JSON.stringify(next));},
    remember(projectionKey,viewport){
      host?.presentationFor?.({nodeId,occurrenceKey:JSON.stringify([occurrenceKey,'viewport',projectionKey])})?.set({viewport,selection});
      view?.set({viewport:view.get()?.viewport??viewport,selection});
    },
    undo(){if(props.readOnly===true||!valid)return;if(history){if(history.canUndo())history.undo();}else{const result=session.undo();if(result.ok)generations.clear();accept(result);}},
    redo(){if(props.readOnly===true||!valid)return;if(history){if(history.canRedo())history.redo();}else{const result=session.redo();if(result.ok)generations.clear();accept(result);}},
  };
  setContext(GRAPH_WORKSPACE,workspace);
</script>
<section {...presentation?.target('root')} aria-label={String(props.label??'Graph workspace')}>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if io?.scopedSlots?.content}{@render io.scopedSlots.content({key:'application',props:{graphRevision:current.revision,nodeCount:current.nodes.length,edgeCount:current.edges.length,readOnly:props.readOnly===true||!valid},onOutput:output})}{:else}<p role="alert">This workspace needs authored content.</p>{/if}
</section>
