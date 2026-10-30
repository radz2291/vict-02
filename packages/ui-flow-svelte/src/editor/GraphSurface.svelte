<script lang="ts">
  import { untrack } from 'svelte';
  import { type UiComponentPresentation } from '@victframework/ui-svelte';
  import {
    SvelteFlow,
    Background,
    type Node,
    type Edge,
    type Connection,
  } from '@xyflow/svelte';
  import FlowNavigation from '../FlowNavigation.svelte';
  import RichGraphNode from './RichGraphNode.svelte';
  import type { GraphHistoryController,GraphPresentationController,GraphPresentationState } from './host.js';
  import {
    GraphSession,
    emptyGraph,
    parseGraph,
    serializeGraph,
    graphType,
    graphPorts,
    copyGraphSelection,
    connectionIssue,
    type GraphDocument,
    type GraphOperation,
    type GraphResult,
    type GraphSelection,
    type GraphValue,
    type GraphIssue,
  } from './model.js';
  let {
    graph,
    presentation,
    label = 'Node editor',
    height = 600,
    readOnly = false,
    history,
    viewState,
    validate,
    ongraphchange,
    onselectionchange,
  }: {
    graph: string;
    presentation?: UiComponentPresentation;
    label?: string;
    height?: number;
    readOnly?: boolean;
    history?: GraphHistoryController;
    viewState?:GraphPresentationController;
    validate?: (graph: GraphDocument) => readonly GraphIssue[];
    ongraphchange?: (value: string) => void;
    onselectionchange?: (selection: GraphSelection) => void;
  } = $props();
  let session = new GraphSession(emptyGraph());
  const restored=untrack(()=>viewState?.get());
  const restoredViewport=restored?.viewport;
  const validRestoredViewport=restoredViewport&&Number.isFinite(restoredViewport.x)&&Number.isFinite(restoredViewport.y)&&Number.isFinite(restoredViewport.zoom)&&restoredViewport.zoom>=.15&&restoredViewport.zoom<=2?{...restoredViewport}:undefined;
  const fitInitially=!validRestoredViewport;
  let cameraReady=$state(!fitInitially);
  let initialized=$state(false);
  let rootElement: HTMLElement | undefined;
  let policyReadOnly = false;
  let validSource = true;
  let dragging = false,
    dragCancelled = false,
    dragRevision = 0;
  let current = $state<GraphDocument>(emptyGraph()),
    nodes = $state<Node[]>([]),
    edges = $state<Edge[]>([]),
    selection = $state<GraphSelection>({ nodes:[...(restored?.selection.nodes??[])],edges:[...(restored?.selection.edges??[])] });
  let error = $state(''),
    incoming = '',
    emitted = '',
    clipboard = $state(''),
    viewport = $state(validRestoredViewport??{ x: 0, y: 0, zoom: 1 });
  const nodeTypes = { rich: RichGraphNode };
  $effect(()=>{const store=viewState;const state:GraphPresentationState={viewport:{...viewport},selection:{nodes:[...selection.nodes],edges:[...selection.edges]}};if(initialized&&cameraReady)untrack(()=>store?.set(state));});
  $effect(()=>{const document=rootElement?.ownerDocument;if(!document)return;document.addEventListener('keydown',keyboard,true);document.addEventListener('pointercancel',cancelDrag);return()=>{document.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointercancel',cancelDrag);};});
  function undo() {
    if (readOnly) return;
    if (history) history.undo();
    else accept(session.undo());
  }
  function redo() {
    if (readOnly) return;
    if (history) history.redo();
    else accept(session.redo());
  }
  $effect(() => {
    const source = graph,
      nextReadOnly = readOnly;
    untrack(() => {
      const changedPolicy = policyReadOnly !== nextReadOnly;
      policyReadOnly = nextReadOnly;
      if (source === incoming && !changedPolicy) return;
      if (source === emitted || source === incoming) {
        if (changedPolicy) {
          session.setReadOnly(nextReadOnly);
          sync();
        }
        incoming = source;
        return;
      }
      incoming = source;
      const parsed = parseGraph(source);
      if (!parsed.ok) {
        validSource=false;
        error = parsed.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join(' ');
        return;
      }
      let domainIssues:readonly GraphIssue[]|undefined;
      try {domainIssues=validate?.(parsed.graph);}catch {validSource=false;error='Application graph validation is unavailable; previous graph retained.';return;}
      if (domainIssues?.length) {
        validSource=false;
        error = domainIssues.map((issue) => issue.message).join(' ');
        return;
      }
      session = new GraphSession(parsed.graph, {
        readOnly: nextReadOnly,
        validate: (next) => validate?.(next) ?? [],
      });
      validSource=true;
      initialized=true;
      current = session.graph;
      selection = {
        nodes: selection.nodes.filter((id) =>
          current.nodes.some((node) => node.id === id),
        ),
        edges: selection.edges.filter((id) =>
          current.edges.some((edge) => edge.id === id),
        ),
      };
      sync();
      error = '';
    });
  });
  function sync() {
    nodes = current.nodes.map((node) => ({
      id: node.id,
      type: 'rich',
      position: { ...node.position },
      dragHandle: '.vict-graph-drag-handle',
      selected: selection.nodes.includes(node.id),
      draggable: !readOnly,
      connectable: !readOnly,
      deletable: false,
      data: {
        node,
        presentation,
        family: graphType(current, node),
        ports: graphPorts(current, node),
        readOnly,
        onField: (nodeId: string, fieldId: string, value: GraphValue) =>
          apply([{ type: 'setField', nodeId, fieldId, value }]),
        onCollapse: (nodeId: string, collapsed: boolean) =>
          apply([{ type: 'collapse', nodeId, collapsed }]),
        onTracePort: tracePort,
      },
    }));
    edges = current.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourcePort,
      targetHandle: edge.targetPort,
      reconnectable: !readOnly,
      deletable: false,
      selected: selection.edges.includes(edge.id),
    }));
  }
  function accept(result: GraphResult) {
    if (!result.ok) {
      error = result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(' ');
      sync();
      return;
    }
    current = result.graph;
    selection = {
      nodes: selection.nodes.filter((id) =>
        current.nodes.some((node) => node.id === id),
      ),
      edges: selection.edges.filter((id) =>
        current.edges.some((edge) => edge.id === id),
      ),
    };
    error = '';
    sync();
    emitted = serializeGraph(current);
    ongraphchange?.(emitted);
  }
  function apply(operations: GraphOperation[]) {
    if (readOnly||!validSource) {
      error = validSource?'This editor is read-only.':'Current graph source is invalid; restore a valid source before editing.';
      return;
    }
    accept(session.apply(operations, current.revision));
  }
  function select(next: GraphSelection) {
    if(!initialized)return;
    if (JSON.stringify(next) === JSON.stringify(selection)) return;
    selection = next;
    onselectionchange?.({ nodes: [...next.nodes], edges: [...next.edges] });
  }
  function connection(value: Connection | Edge) {
    return {
      source: value.source,
      sourcePort: value.sourceHandle ?? '',
      target: value.target,
      targetPort: value.targetHandle ?? '',
    };
  }
  function copy() {
    clipboard = copyGraphSelection(current, selection);
  }
  function tracePort(nodeId: string, portId: string) {
    const related = current.edges.filter(
      (edge) =>
        (edge.source === nodeId && edge.sourcePort === portId) ||
        (edge.target === nodeId && edge.targetPort === portId),
    );
    select({ nodes: [nodeId], edges: related.map((edge) => edge.id) });
    sync();
  }
  function cancelDrag() {
    if (!dragging) return;
    dragCancelled = true;
    dragging = false;
    sync();
  }
  function keyboard(event: KeyboardEvent) {
    if(event.defaultPrevented)return;
    if (event.key === 'Escape' && dragging) {
      event.preventDefault();
      cancelDrag();
      return;
    }
    const view=rootElement?.ownerDocument.defaultView;
    const candidate=event.target as Element|null;
    if(!view||!candidate||candidate.nodeType!==1||candidate.namespaceURI!=='http://www.w3.org/1999/xhtml')return;
    // Adoption changes ownerDocument but retains the creation prototype. Use
    // the same DOM brand check as owned popups rather than destination instanceof.
    try {if(!view.Element.prototype.matches.call(candidate,'*'))return;}catch{return;}
    const target = candidate as HTMLElement;
    if (
      !rootElement?.contains(target) ||
      target.closest(
        'input,textarea,select,button,[contenteditable=true],[role=slider],[role=combobox]',
      )
    )
      return;
    const modifier = event.ctrlKey || event.metaKey;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&target.closest('.svelte-flow__node')&&selection.nodes.length&&!readOnly){event.preventDefault();event.stopPropagation();const delta=event.shiftKey?40:10;apply([{type:'moveNodes',positions:Object.fromEntries(current.nodes.filter(node=>selection.nodes.includes(node.id)).map(node=>[node.id,{x:node.position.x+(event.key==='ArrowLeft'?-delta:event.key==='ArrowRight'?delta:0),y:node.position.y+(event.key==='ArrowUp'?-delta:event.key==='ArrowDown'?delta:0)}]))}]);return;}
    if (modifier && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      event.stopPropagation();
      copy();
    } else if (modifier && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      event.stopPropagation();
      if (clipboard) apply([{ type: 'paste', clipboard }]);
    } else if (modifier && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      event.stopPropagation();
      apply([{ type: 'duplicate', selection }]);
    } else if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.stopPropagation();
      event.shiftKey ? redo() : undo();
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      event.stopPropagation();
      redo();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      if (selection.nodes.length || selection.edges.length)
        apply([{ type: 'remove', selection }]);
    }
  }
</script>

<section {...presentation?.target('root')} bind:this={rootElement} class={`vict-graph-editor ${presentation?.target('root').class ?? ''}`} aria-label={label} data-graph-revision={current.revision} data-graph-viewport={`${viewport.x},${viewport.y},${viewport.zoom}`}>
  {#if error}<p role="alert" class="graph-error">{error}</p>{/if}
    <div {...presentation?.target('canvas')} class={`graph-canvas ${presentation?.target('canvas').class ?? ''}`} style:height={`${Math.max(240,Math.min(height,2000))}px`}>
      <SvelteFlow bind:nodes bind:edges bind:viewport {nodeTypes} nodesDraggable={!readOnly} nodesConnectable={!readOnly} deleteKey={null} fitView={false} minZoom={0.15} maxZoom={2} multiSelectionKey={['Control','Meta','Shift']} selectionKey="Shift" panOnDrag={true}
        onselectionchange={({nodes:selectedNodes,edges:selectedEdges})=>select({nodes:selectedNodes.map(node=>node.id),edges:selectedEdges.map(edge=>edge.id)})}
        onnodedragstart={()=>{dragging=true;dragCancelled=false;dragRevision=current.revision;}}
        onnodedragstop={({nodes:moved})=>{dragging=false;if(dragCancelled||current.revision!==dragRevision){sync();return;}apply([{type:'moveNodes',positions:Object.fromEntries(moved.map(node=>[node.id,{...node.position}]))}]);}}
        isValidConnection={candidate=>!readOnly&&!connectionIssue(current,{id:'pending',...connection(candidate)})}
        onbeforeconnect={candidate=>{apply([{type:'connect',edge:connection(candidate)}]);return false;}}
        onbeforereconnect={(next,old)=>{apply([{type:'reconnect',edgeId:old.id,connection:{source:next.source,sourcePort:next.sourceHandle??'',target:next.target,targetPort:next.targetHandle??''}}]);return false;}}>
        <Background /><FlowNavigation initialFit={fitInitially&&initialized} initialNodeIds={current.nodes.map(node=>node.id)} onInitialFit={()=>{cameraReady=true;}}/>
      </SvelteFlow>
    </div>
</section>
<style>
  .vict-graph-editor{font:var(--vict-font-sizeBase,14px)/1.5 var(--vict-font-family,system-ui);color:var(--vict-flow-text,var(--vict-color-text,#203239));min-width:0}
  .graph-canvas{width:100%;min-width:0;background:var(--vict-flow-node,var(--vict-color-surface,#fff))}
  .graph-error{padding:var(--vict-space-2,8px) var(--vict-space-3,12px);color:var(--vict-color-danger,#b03143);background:var(--vict-color-surface,#fff)}
</style>
