<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import { SvelteFlow, Background, type Node, type Edge, type Connection } from '@xyflow/svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import FlowNavigation from '../FlowNavigation.svelte';
  import ComposedGraphNode from './ComposedGraphNode.svelte';
  import { GRAPH_WORKSPACE, type GraphWorkspaceContext } from './context.js';
  let {props,presentation,occurrenceKey}:UiSvelteComponentProps=$props();
  const workspace=getContext<GraphWorkspaceContext|undefined>(GRAPH_WORKSPACE);
  const initial=untrack(()=>workspace?.viewFor(occurrenceKey));
  let viewport=$state(initial?.viewport??{x:0,y:0,zoom:1});
  let nodes=$state<Node[]>([]),edges=$state<Edge[]>([]);
  const nodeTypes={composed:ComposedGraphNode};
  let dragRevision=0,dragging=false,dragCancelled=false;
  $effect(()=>{
    if(!workspace)return;
    nodes=workspace.graph.nodes.map(node=>({id:node.id,type:'composed',position:{...node.position},data:{node,workspace,projectionKey:occurrenceKey},dragHandle:'.vict-graph-drag-handle',selected:workspace.selection.nodes.includes(node.id),draggable:!workspace.readOnly,connectable:!workspace.readOnly,deletable:false}));
    edges=workspace.graph.edges.map(edge=>({...edge,sourceHandle:edge.sourcePort,targetHandle:edge.targetPort,reconnectable:!workspace.readOnly,deletable:false,selected:workspace.selection.edges.includes(edge.id)}));
  });
  $effect(()=>{if(workspace)workspace.remember(occurrenceKey,{...viewport});});
  function connection(value:Connection|Edge){return {source:value.source,sourcePort:value.sourceHandle??'',target:value.target,targetPort:value.targetHandle??''};}
  function keyboard(event:KeyboardEvent){
    if(!workspace||workspace.readOnly||event.defaultPrevented)return;
    if(event.key==='Escape'&&dragging){event.preventDefault();cancelDrag();return;}
    const target=event.target as Element|null;
    if(target?.closest('input,textarea,select,button,[contenteditable=true],[role=slider],[role=combobox]'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?workspace.redo():workspace.undo();}
    else if(event.key==='Delete'&&workspace.selection.nodes.length+workspace.selection.edges.length){event.preventDefault();workspace.apply([{type:'remove',selection:workspace.selection}]);}
  }
  function cancelDrag(){dragging=false;dragCancelled=true;if(workspace)nodes=nodes.map(node=>({...node,position:{...(workspace.graph.nodes.find(item=>item.id===node.id)?.position??node.position)}}));}
</script>
{#if workspace}
  <div {...presentation?.target('root')} aria-label={String(props.label??'Graph canvas')} role="application" tabindex="-1" onkeydown={keyboard} onpointercancel={cancelDrag} style:height={`${Math.max(160,Math.min(Number(props.height)||480,2000))}px`} class={`graph-viewport ${presentation?.target('root').class??''}`}>
    <SvelteFlow bind:nodes bind:edges bind:viewport {nodeTypes} deleteKey={null} nodesDraggable={!workspace.readOnly} nodesConnectable={!workspace.readOnly} fitView={false} minZoom={0.1} maxZoom={2} selectionKey="Shift" multiSelectionKey={['Control','Meta','Shift']}
      onselectionchange={({nodes:n,edges:e})=>workspace.select({nodes:n.map(x=>x.id),edges:e.map(x=>x.id)})}
      onnodedragstart={()=>{dragging=true;dragCancelled=false;dragRevision=workspace.graph.revision;}}
      onnodedragstop={({nodes:moved})=>{dragging=false;if(dragCancelled){cancelDrag();return;}workspace.apply([{type:'moveNodes',positions:Object.fromEntries(moved.map(n=>[n.id,{...n.position}]))}],dragRevision);}}
      isValidConnection={candidate=>!workspace.readOnly&&!workspace.connectionIssue({id:'pending',...connection(candidate)})}
      onbeforeconnect={candidate=>{workspace.apply([{type:'connect',edge:connection(candidate)}]);return false;}}
      onbeforereconnect={(next,old)=>{workspace.apply([{type:'reconnect',edgeId:old.id,connection:connection(next)}]);return false;}}>
      <Background/><FlowNavigation initialFit={!initial?.viewport&&workspace.graph.nodes.length>0} initialNodeIds={workspace.graph.nodes.map(n=>n.id)}/>
    </SvelteFlow>
  </div>
{:else}<p role="alert">Graph viewport requires a graph workspace.</p>{/if}
<style>.graph-viewport{width:100%;min-width:0;color:var(--vict-color-text,inherit);background:var(--vict-color-surface,transparent)}</style>
