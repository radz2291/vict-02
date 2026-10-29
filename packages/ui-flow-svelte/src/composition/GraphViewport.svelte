<script lang="ts">
  import { getContext, untrack, tick, onDestroy } from 'svelte';
  import { SvelteFlow, SvelteFlowProvider, Background, type Node, type Edge, type Connection } from '@xyflow/svelte';
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import FlowNavigation from '../FlowNavigation.svelte';
  import ComposedGraphNode from './ComposedGraphNode.svelte';
  import ComposedGraphEdge from './ComposedGraphEdge.svelte';
  import {GraphConnectionGesture} from './connection-gesture.js';
  import { GRAPH_WORKSPACE, type GraphWorkspaceContext } from './context.js';
  let {props,presentation,occurrenceKey}:UiSvelteComponentProps=$props();
  const workspace=getContext<GraphWorkspaceContext|undefined>(GRAPH_WORKSPACE);
  const initial=untrack(()=>workspace?.viewFor(occurrenceKey));
  let viewport=$state(initial?.viewport??{x:0,y:0,zoom:1});
  let nodes=$state<Node[]>([]),edges=$state<Edge[]>([]);
  const nodeTypes={composed:ComposedGraphNode};
  const edgeTypes={composed:ComposedGraphEdge};
  let dragRevision=0,dragging=false,dragCancelled=false;
  let rootElement=$state<HTMLDivElement>();
  let mounted=true,keyboardTicket=0;
  const connectionGesture=new GraphConnectionGesture(()=>workspace,()=>mounted);
  onDestroy(()=>{mounted=false;keyboardTicket++;connectionGesture.cancel();});
  $effect(()=>{
    if(!workspace)return;
    nodes=workspace.graph.nodes.map(node=>({id:node.id,type:'composed',ariaLabel:node.label,position:{...node.position},data:{node,workspace,projectionKey:occurrenceKey},dragHandle:'.vict-graph-drag-handle',selected:workspace.selection.nodes.includes(node.id),draggable:!workspace.readOnly,connectable:!workspace.readOnly,deletable:false}));
    edges=workspace.graph.edges.map(edge=>({...edge,type:'composed',data:{readOnly:workspace.readOnly},sourceHandle:edge.sourcePort,targetHandle:edge.targetPort,reconnectable:!workspace.readOnly,deletable:false,selected:workspace.selection.edges.includes(edge.id)}));
  });
  $effect(()=>{if(workspace)workspace.remember(occurrenceKey,{...viewport});});
  function connection(value:Connection|Edge){return {source:value.source,sourcePort:value.sourceHandle??'',target:value.target,targetPort:value.targetHandle??''};}
  function restorePositions(){
    if(workspace)nodes=nodes.map(node=>({...node,position:{...(workspace.graph.nodes.find(item=>item.id===node.id)?.position??node.position)}}));
  }
  async function commitKeyboardMove(event:KeyboardEvent){
    if(!workspace||workspace.readOnly||dragging||!event.defaultPrevented||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return false;
    const target=event.target as Element|null;
    if(target?.nodeType!==1||!target.classList.contains('svelte-flow__node')||target.closest('.graph-viewport')!==rootElement||target.ownerDocument.activeElement!==target)return false;
    const selected=new Set(nodes.filter(node=>node.selected).map(node=>node.id));
    if(!selected.size)return false;
    const source=workspace.graph,revision=source.revision,ticket=++keyboardTicket;
    // XYFlow has already accepted/clamped the gesture. Its public nodes binding
    // settles after this event; no private store or DOM geometry enters source.
    await tick();
    if(!mounted||ticket!==keyboardTicket||!rootElement?.isConnected)return true;
    if(dragging)return true;
    if(workspace.readOnly||workspace.graph!==source||workspace.graph.revision!==revision){restorePositions();return true;}
    const positions=Object.fromEntries(nodes.filter(node=>{
      const before=source.nodes.find(item=>item.id===node.id);
      return selected.has(node.id)&&before&&Number.isFinite(node.position.x)&&Number.isFinite(node.position.y)&&(node.position.x!==before.position.x||node.position.y!==before.position.y);
    }).map(node=>[node.id,{...node.position}]));
    if(Object.keys(positions).length)workspace.apply([{type:'moveNodes',positions}],revision);
    // A canonical/domain host refusal must not leave an uncommitted projection.
    restorePositions();return true;
  }
  function keyboard(event:KeyboardEvent){
    if(!workspace||workspace.readOnly)return;
    if(event.defaultPrevented&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){void commitKeyboardMove(event);return;}
    if(event.key==='Escape'&&connectionGesture.cancel()){event.preventDefault();event.stopPropagation();return;}
    if(event.defaultPrevented)return;
    if(event.key==='Escape'&&dragging){event.preventDefault();event.stopPropagation();cancelDrag();return;}
    const target=event.target as Element|null;
    if(target?.closest('input,textarea,select,button,[contenteditable=true],[role=slider],[role=combobox]'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();event.shiftKey?workspace.redo():workspace.undo();}
    else if(event.key==='Delete'&&workspace.selection.nodes.length+workspace.selection.edges.length){event.preventDefault();event.stopPropagation();workspace.apply([{type:'remove',selection:workspace.selection}]);}
  }
  function cancelDrag(){dragging=false;dragCancelled=true;connectionGesture.cancel();restorePositions();}
</script>
{#if workspace}
  <div {...presentation?.target('root')} bind:this={rootElement} aria-label={String(props.label??'Graph canvas')} role="application" tabindex="-1" onkeydown={keyboard} onpointercancel={cancelDrag} style:height={`${Math.max(160,Math.min(Number(props.height)||480,2000))}px`} class={`graph-viewport ${presentation?.target('root').class??''}`}>
    <SvelteFlowProvider><SvelteFlow bind:nodes bind:edges bind:viewport {nodeTypes} {edgeTypes} deleteKey={null} nodesDraggable={!workspace.readOnly} nodesConnectable={!workspace.readOnly} fitView={false} minZoom={0.1} maxZoom={2} selectionKey="Shift" multiSelectionKey={['Control','Meta','Shift']}
      onselectionchange={({nodes:n,edges:e})=>workspace.select({nodes:n.map(x=>x.id),edges:e.map(x=>x.id)})}
      onnodedragstart={()=>{dragging=true;dragCancelled=false;dragRevision=workspace.graph.revision;}}
      onnodedragstop={({nodes:moved})=>{dragging=false;if(dragCancelled){cancelDrag();return;}workspace.apply([{type:'moveNodes',positions:Object.fromEntries(moved.map(n=>[n.id,{...n.position}]))}],dragRevision);}}
      onconnectstart={event=>connectionGesture.beginConnect(event)} onconnectend={()=>connectionGesture.cancel()}
      onclickconnectstart={event=>connectionGesture.beginConnect(event)} onclickconnectend={()=>connectionGesture.cancel()}
      onreconnectstart={(event,edge)=>connectionGesture.beginReconnect(edge.id,event)} onreconnectend={()=>connectionGesture.cancel()}
      isValidConnection={candidate=>connectionGesture.valid(connection(candidate))}
      onbeforeconnect={candidate=>{connectionGesture.connect(connection(candidate));return false;}}
      onbeforereconnect={(next,old)=>{connectionGesture.reconnect(old.id,connection(next));return false;}}>
      <Background/><FlowNavigation initialFit={!initial?.viewport&&workspace.graph.nodes.length>0} initialNodeIds={workspace.graph.nodes.map(n=>n.id)}/>
    </SvelteFlow></SvelteFlowProvider>
  </div>
{:else}<p role="alert">Graph viewport requires a graph workspace.</p>{/if}
<style>.graph-viewport{width:100%;min-width:0;color:var(--vict-color-text,inherit);background:var(--vict-color-surface,transparent)}</style>
