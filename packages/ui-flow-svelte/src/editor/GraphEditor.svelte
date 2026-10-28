<script lang="ts">
  import { untrack } from 'svelte';
  import { Button, Select, type UiComponentPresentation } from '@victframework/ui-svelte';
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    type Connection,
  } from '@xyflow/svelte';
  import FlowNavigation from '../FlowNavigation.svelte';
  import { layoutGraph, LayoutFence } from '../layout.js';
  import RichGraphNode from './RichGraphNode.svelte';
  import GraphFields from './GraphFields.svelte';
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
  const controlId = $props.id();
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
  let arranging = $state(false);
  const layoutFence = new LayoutFence();
  let current = $state<GraphDocument>(emptyGraph()),
    nodes = $state<Node[]>([]),
    edges = $state<Edge[]>([]),
    selection = $state<GraphSelection>({ nodes:[...(restored?.selection.nodes??[])],edges:[...(restored?.selection.edges??[])] });
  let error = $state(''),
    incoming = '',
    emitted = '',
    historyVersion = $state(0),
    canUndo = $state(false),
    canRedo = $state(false),
    clipboard = $state(''),
    query = $state(''),
    palette = $state(''),
    fit = $state<object | undefined>(),
    fitIds = $state<string[]>([]),
    viewport = $state(validRestoredViewport??{ x: 0, y: 0, zoom: 1 });
  let sourceNode = $state(''),
    sourcePort = $state(''),
    targetNode = $state(''),
    targetPort = $state(''),
    edgeChoice = $state('');
  const nodeTypes = { rich: RichGraphNode };
  const selectedNode = $derived(
    selection.nodes.length === 1
      ? current.nodes.find((node) => node.id === selection.nodes[0])
      : undefined,
  );
  const selectedEdges = $derived(
    current.edges.filter((edge) => selection.edges.includes(edge.id)),
  );
  const matches = $derived(
    current.nodes.filter(
      (node) =>
        !query ||
        `${node.label} ${node.type}`.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const undoAvailable = $derived.by(() => {
    void graph;
    void current;
    return history ? history.canUndo() : canUndo;
  });
  const redoAvailable = $derived.by(() => {
    void graph;
    void current;
    return history ? history.canRedo() : canRedo;
  });
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
    layoutFence.cancel();
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
    historyVersion++;
    canUndo = session.canUndo;
    canRedo = session.canRedo;
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
  function add() {
    if (!palette) return;
    apply([
      {
        type: 'addNode',
        nodeType: palette,
        position: {
          x: 40 - viewport.x / viewport.zoom,
          y: 40 - viewport.y / viewport.zoom,
        },
      },
    ]);
  }
  function copy() {
    clipboard = copyGraphSelection(current, selection);
  }
  function focus(ids: string[] = []) {
    fitIds = ids;
    fit = {};
  }
  async function layout() {
    if (readOnly || !nodes.length) return;
    const revision = current.revision,
      ticket = layoutFence.issue();
    arranging = true;
    try {
      const result = await layoutGraph(
        nodes.map((node) => ({
          ...node,
          width: 280,
          height: node.measured?.height ?? 360,
        })),
        edges,
        { engine: 'dagre', direction: 'RIGHT', spacing: 60 },
      );
      if (!layoutFence.current(ticket) || current.revision !== revision) return;
      apply([
        {
          type: 'moveNodes',
          positions: Object.fromEntries(
            result.nodes.map((node) => [node.id, node.position]),
          ),
        },
      ]);
    } catch {
      error = 'Graph arrangement failed; existing positions were retained.';
    } finally {
      arranging = false;
    }
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
  function manualConnection() {
    const link = {
      source: sourceNode,
      sourcePort,
      target: targetNode,
      targetPort,
    };
    apply(
      edgeChoice
        ? [{ type: 'reconnect', edgeId: edgeChoice, connection: link }]
        : [{ type: 'connect', edge: link }],
    );
  }
  function keyboard(event: KeyboardEvent) {
    if(event.defaultPrevented)return;
    if (event.key === 'Escape' && dragging) {
      event.preventDefault();
      cancelDrag();
      return;
    }
    const view=rootElement?.ownerDocument.defaultView;
    if(!view||!(event.target instanceof view.HTMLElement))return;
    const target = event.target;
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
  <div {...presentation?.target('toolbar')} class={`graph-toolbar ${presentation?.target('toolbar').class ?? ''}`} role="group" aria-label="Graph tools">
    <label for={`${controlId}-family`}>Node family<Select id={`${controlId}-family`} name="node-family" value={palette} options={current.nodeTypes.map(type=>({value:type.id,label:type.label}))} disabled={readOnly} onChange={value=>palette=value}/></label><Button variant="secondary" label="Add node" onclick={add} disabled={readOnly||!palette}/>
    <Button variant="secondary" label="Undo" onclick={undo} disabled={readOnly||!undoAvailable}/><Button variant="secondary" label="Redo" onclick={redo} disabled={readOnly||!redoAvailable}/>
    <Button variant="secondary" label="Copy" onclick={copy} disabled={!selection.nodes.length}/><Button variant="secondary" label="Paste" onclick={()=>apply([{type:'paste',clipboard}])} disabled={readOnly||!clipboard}/><Button variant="secondary" label="Duplicate" onclick={()=>apply([{type:'duplicate',selection}])} disabled={readOnly||!selection.nodes.length}/><Button variant="secondary" label="Delete selected" onclick={()=>apply([{type:'remove',selection}])} disabled={readOnly||!(selection.nodes.length||selection.edges.length)}/>
    <Button variant="secondary" label="Fit all" onclick={()=>focus()}/><Button variant="secondary" label="Focus selection" onclick={()=>focus(selection.nodes)} disabled={!selection.nodes.length}/><Button variant="secondary" label={arranging?'Arranging.':'Arrange'} onclick={layout} disabled={readOnly||arranging||!nodes.length}/>
    <label>Find nodes<input class="vict-input" aria-label="Find nodes" type="search" bind:value={query} /></label>{#if query}<span>{matches.length} matches</span><Button variant="secondary" label="Focus matches" onclick={()=>focus(matches.map(node=>node.id))} disabled={!matches.length}/>{/if}
  </div>
  {#if error}<p role="alert" class="graph-error">{error}</p>{/if}
  <div class="graph-workspace">
    <div {...presentation?.target('canvas')} class={`graph-canvas ${presentation?.target('canvas').class ?? ''}`} style:height={`${Math.max(240,Math.min(height,2000))}px`}>
      <SvelteFlow bind:nodes bind:edges bind:viewport {nodeTypes} nodesDraggable={!readOnly} nodesConnectable={!readOnly} deleteKey={null} fitView={false} minZoom={0.15} maxZoom={2} multiSelectionKey={['Control','Meta','Shift']} selectionKey="Shift" panOnDrag={true}
        onselectionchange={({nodes:selectedNodes,edges:selectedEdges})=>select({nodes:selectedNodes.map(node=>node.id),edges:selectedEdges.map(edge=>edge.id)})}
        onnodedragstart={()=>{dragging=true;dragCancelled=false;dragRevision=current.revision;layoutFence.cancel();}}
        onnodedragstop={({nodes:moved})=>{dragging=false;if(dragCancelled||current.revision!==dragRevision){sync();return;}apply([{type:'moveNodes',positions:Object.fromEntries(moved.map(node=>[node.id,{...node.position}]))}]);}}
        isValidConnection={candidate=>!readOnly&&!connectionIssue(current,{id:'pending',...connection(candidate)})}
        onbeforeconnect={candidate=>{apply([{type:'connect',edge:connection(candidate)}]);return false;}}
        onbeforereconnect={(next,old)=>{apply([{type:'reconnect',edgeId:old.id,connection:{source:next.source,sourcePort:next.sourceHandle??'',target:next.target,targetPort:next.targetHandle??''}}]);return false;}}>
        <Background /><Controls showLock={false}/><MiniMap pannable zoomable/><FlowNavigation request={fit} ids={fitIds} initialFit={fitInitially&&initialized} initialNodeIds={current.nodes.map(node=>node.id)} onInitialFit={()=>{cameraReady=true;}}/>
      </SvelteFlow>
    </div>
    <aside {...presentation?.target('inspector')} class={`graph-inspector ${presentation?.target('inspector').class ?? ''}`} aria-label="Graph selection">
      <h3>Selection</h3><p>{selection.nodes.length} nodes · {selection.edges.length} connections</p>
      {#if selectedNode}<label>Node name<input class="vict-input" value={selectedNode.label} disabled={readOnly} onchange={event=>apply([{type:'setLabel',nodeId:selectedNode.id,label:event.currentTarget.value}])}/></label><GraphFields {presentation} owner={`${selectedNode.id}/inspector`} fields={graphType(current,selectedNode).fields} values={selectedNode.values} {readOnly} advanced onchange={(fieldId,value)=>apply([{type:'setField',nodeId:selectedNode.id,fieldId,value}])}/>{:else if selection.nodes.length}<ul>{#each current.nodes.filter(node=>selection.nodes.includes(node.id)) as node}<li>{node.label}</li>{/each}</ul>{/if}
      {#if selectedNode}<div class="node-position"><label>Node X<input class="vict-input" type="number" value={selectedNode.position.x} disabled={readOnly} onchange={event=>apply([{type:'moveNodes',positions:{[selectedNode.id]:{x:event.currentTarget.valueAsNumber,y:selectedNode.position.y}}}])}/></label><label>Node Y<input class="vict-input" type="number" value={selectedNode.position.y} disabled={readOnly} onchange={event=>apply([{type:'moveNodes',positions:{[selectedNode.id]:{x:selectedNode.position.x,y:event.currentTarget.valueAsNumber}}}])}/></label></div>{/if}
      {#each selectedEdges as edge}<p>{edge.source} / {edge.sourcePort} → {edge.target} / {edge.targetPort}</p>{/each}
      <details><summary>Connect or reconnect</summary>
        <label for={`${controlId}-edge`}>Existing connection<Select id={`${controlId}-edge`} name="existing-connection" value={edgeChoice} options={current.edges.map(edge=>({value:edge.id,label:edge.id}))} disabled={readOnly} onChange={value=>edgeChoice=value}/></label>
        <label for={`${controlId}-source`}>Source node<Select id={`${controlId}-source`} name="source-node" value={sourceNode} options={current.nodes.map(node=>({value:node.id,label:node.label}))} disabled={readOnly} onChange={value=>sourceNode=value}/></label>
        <label for={`${controlId}-output`}>Output port<Select id={`${controlId}-output`} name="output-port" value={sourcePort} options={current.nodes.filter(node=>node.id===sourceNode).flatMap(node=>graphPorts(current,node)).filter(port=>port.direction==='output').map(port=>({value:port.id,label:`${port.label} (${port.type})`}))} disabled={readOnly} onChange={value=>sourcePort=value}/></label>
        <label for={`${controlId}-target`}>Target node<Select id={`${controlId}-target`} name="target-node" value={targetNode} options={current.nodes.map(node=>({value:node.id,label:node.label}))} disabled={readOnly} onChange={value=>targetNode=value}/></label>
        <label for={`${controlId}-input`}>Input port<Select id={`${controlId}-input`} name="input-port" value={targetPort} options={current.nodes.filter(node=>node.id===targetNode).flatMap(node=>graphPorts(current,node)).filter(port=>port.direction==='input').map(port=>({value:port.id,label:`${port.label} (${port.type})`}))} disabled={readOnly} onChange={value=>targetPort=value}/></label>
        <Button variant="secondary" label={edgeChoice?'Reconnect':'Connect'} disabled={readOnly||!sourceNode||!sourcePort||!targetNode||!targetPort} onclick={manualConnection}/>
      </details>
      <details><summary>Graph clipboard</summary><label>Portable graph selection<textarea class="vict-textarea" aria-label="Graph clipboard" rows="4" bind:value={clipboard}></textarea></label><p>Copy uses this editor's bounded selection buffer. Paste a compatible graph selection here; no system clipboard permission is requested.</p></details>
    </aside>
  </div>
</section>
<style>
  .vict-graph-editor{container-type:inline-size;font:var(--vict-font-sizeBase,14px)/1.5 var(--vict-font-family,system-ui);color:var(--vict-flow-text,var(--vict-color-text,#203239));border:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5));border-radius:var(--vict-radius-base,10px);background:var(--vict-flow-node,var(--vict-color-surface,#fff));overflow:hidden;min-width:0}
  .graph-toolbar{display:flex;align-items:flex-end;gap:var(--vict-space-1,4px);flex-wrap:wrap;padding:var(--vict-space-2,8px);border-bottom:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5))}
  label{display:grid;gap:var(--vict-space-1,4px);font-size:12px}.graph-workspace{display:flex;min-width:0}.graph-canvas{flex:1;min-width:200px}.graph-inspector{box-sizing:border-box;width:250px;min-width:200px;max-height:650px;overflow:auto;border-left:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5));padding:var(--vict-space-3,12px);display:flex;flex-direction:column;gap:var(--vict-space-2,8px)}h3,p{margin:0}h3{font-size:var(--vict-font-sizeBase,14px)}details{border-top:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5));padding-top:var(--vict-space-2,8px)}summary{cursor:pointer;font-weight:500}details label{margin-top:var(--vict-space-2,8px)}.graph-error{padding:8px 12px;color:var(--vict-color-danger,#b03143);background:var(--vict-color-surface,#fff)}@container (max-width:650px){.graph-workspace{flex-direction:column}.graph-inspector{width:100%;max-height:260px;border-left:0;border-top:1px solid var(--vict-flow-border,var(--vict-color-border,#dce5e5))}}
</style>
