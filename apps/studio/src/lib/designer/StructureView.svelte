<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { FlowCanvas, SourceNode, RoutedEdge, FlowNavigation, layoutGraph, LayoutFence, type Node, type Edge, type Connection, type Viewport, type LayoutDirection } from '@victframework/ui-flow-svelte';
  import '@victframework/ui-flow-svelte/styles.css';
  import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
  import { type InsertRecipe } from '@victframework/ui-editor';
  import { projectStructure, filterStructure, structureFacts, structureId, parseStructureId, structureMove, type StructureNodeData, type StructureEditRequest, type StructureHandoff } from './structure.js';

  let { document, revision, selectedNodeId, blocked = false, active = true, descriptors = [], recipes = [], onSelect, onMove, onNotice, onNavigate }: {
    document: UiDocument; revision: string; selectedNodeId?: string; blocked?: boolean; active?: boolean;
    descriptors?: readonly UiExtensionDescriptor[]; recipes?: readonly InsertRecipe[];
    onSelect: (occurrence: string) => void; onMove: (request: StructureEditRequest) => boolean;
    onNotice: (message: string) => void; onNavigate?: (request: StructureHandoff) => void;
  } = $props();
  let nodes = $state<Node<StructureNodeData>[]>([]);
  let edges = $state<Edge[]>([]);
  let viewport = $state<Viewport>({ x: 24, y: 24, zoom: .85 });
  let allowMoves = $state(false);
  let inspectedId = $state<string>();
  let search = $state('');
  let showBindings = $state(false);
  let showDefinitions = $state(false);
  let focusedId = $state<string>();
  let collapsed = $state<Set<string>>(new Set());
  let direction = $state<LayoutDirection>('RIGHT');
  let layoutVersion = $state(0);
  let layoutStatus = $state('');
  let navigationRequest = $state<object>();
  let navigationIds = $state<string[]>([]);
  let moveSource = $state('');
  let moveTarget = $state('');
  const graph = $derived(projectStructure(document));
  const inspected = $derived(graph.nodes.find(node => node.id === inspectedId));
  const related = $derived(graph.edges.filter(edge => (edge.source === inspectedId || edge.target === inspectedId) && edge.data?.kind !== 'containment'));
  const facts = $derived(inspected ? structureFacts(document, inspected) : []);
  const projected = $derived(filterStructure(graph, { search, focusId: focusedId, collapsed, bindings: showBindings, definitions: showDefinitions }));
  const nodeTypes = { source: SourceNode };
  const edgeTypes = { routed: RoutedEdge };
  const fence = new LayoutFence();
  let connectionStart: { documentId: string; revision: string } | undefined;
  let layoutDocument = '';
  const presentations = new Map<string, { viewport: Viewport; positions: Map<string, { x: number; y: number }>; collapsed: Set<string>; inspectedId?: string; direction: LayoutDirection; search: string; focusedId?: string; bindings: boolean; definitions: boolean }>();
  function remember() {
    if (!layoutDocument) return;
    presentations.set(layoutDocument, { viewport: { ...viewport }, positions: new Map(nodes.map(node => [node.id, { ...node.position }])), collapsed: new Set(collapsed), inspectedId, direction, search, focusedId, bindings: showBindings, definitions: showDefinitions });
  }
  $effect(() => {
    const id = document.id;
    if (id === untrack(() => layoutDocument)) return;
    untrack(remember);
    layoutDocument = id;
    const saved = presentations.get(id);
    viewport = saved?.viewport ?? { x: 24, y: 24, zoom: .85 };
    collapsed = saved?.collapsed ?? new Set(graph.nodes.filter(node => node.data.occurrence && (node.data.childCount ?? 0) > 3 && node.data.sourceId !== document.root).map(node => node.id));
    inspectedId = saved?.inspectedId ?? (selectedNodeId ? structureId(id, 'node', selectedNodeId) : structureId(id, 'node', document.root));
    direction = saved?.direction ?? 'RIGHT'; search = saved?.search ?? ''; focusedId = saved?.focusedId;
    showBindings = saved?.bindings ?? false; showDefinitions = saved?.definitions ?? false; allowMoves = false;
  });
  $effect(() => {
    if (!selectedNodeId) return;
    const selectedId = structureId(document.id, 'node', selectedNodeId);
    inspectedId = selectedId;
    const next = new Set(untrack(() => collapsed));
    const seen = new Set<string>(); let current = selectedId;
    while (!seen.has(current)) {
      seen.add(current);
      const owner = graph.edges.find(edge => edge.data?.kind === 'containment' && edge.target === current)?.source;
      if (!owner) break;
      next.delete(owner); current = owner;
    }
    if (next.size !== untrack(() => collapsed.size)) collapsed = next;
  });
  $effect(() => {
    void revision;
    const currentGraph = projected;
    const orientation = direction;
    const editable = allowMoves && !blocked;
    const previous = untrack(() => new Map(nodes.map(node => [node.id, node])));
    const remembered = untrack(() => presentations.get(document.id)?.positions);
    nodes = currentGraph.nodes.map(node => {
      const old = previous.get(node.id);
      const source = node.data.sourceId && document.nodes[node.data.sourceId];
      const target = !!node.data.occurrence && !!source && ((source.kind === 'element' && ['main', 'section', 'div', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'fieldset', 'ul', 'ol', 'li'].includes(source.tag)) || (source.kind === 'component' && (descriptors.find(entry => entry.id === source.definitionId)?.slots?.length ?? 0) === 1));
      return { ...node, position: old?.position ?? remembered?.get(node.id) ?? node.position, measured: old?.measured, selected: node.id === inspectedId,
        data: { ...node.data, direction: orientation, moveSource: editable && !!node.data.occurrence && node.data.sourceId !== document.root, moveTarget: editable && target } };
    });
    edges = currentGraph.edges;
  });
  const measuredSignature = $derived(nodes.map(node => `${node.id}:${node.measured?.width ?? 0}:${node.measured?.height ?? 0}`).join('|'));
  $effect(() => {
    void measuredSignature; void revision; void layoutVersion; void direction; void projected;
    const ticket = fence.issue();
    const currentNodes = untrack(() => nodes.map(node => ({ ...node, data: { ...node.data } })));
    const currentEdges = untrack(() => [...edges]);
    const orientation = direction;
    layoutStatus = 'Arranging source…';
    void layoutGraph(currentNodes, currentEdges, { engine: 'elk', direction: orientation }).then(result => {
      if (!fence.current(ticket)) return;
      const positions = new Map(result.nodes.map(node => [node.id, node.position]));
      nodes = nodes.map(node => ({ ...node, position: positions.get(node.id) ?? node.position }));
      edges = result.edges;
      layoutStatus = `${nodes.length} visible items · ${result.engine === 'elk' ? 'routed ELK layout' : 'Dagre hierarchy'}${result.reason ? ' · focus or collapse for routed layout' : ''}`;
    }).catch(() => { if (fence.current(ticket)) layoutStatus = 'Layout unavailable. Existing positions retained; retry Arrange.'; });
    return () => fence.cancel();
  });
  onDestroy(() => { remember(); fence.cancel(); });
  function locate(ids: string[] = []) { navigationIds = ids; navigationRequest = {}; }
  async function select(node: Node<StructureNodeData>) {
    if (blocked) { onNotice('Apply or cancel your draft before changing selection.'); return; }
    inspectedId = node.id;
    if (node.data.kind !== 'node') { search = ''; focusedId = node.id; showBindings = true; showDefinitions = true; }
    if (node.data.occurrence) onSelect(node.data.occurrence);
    onNotice(`${node.data.label} selected · ${node.data.occurrence ? 'shared screen selection' : 'declared source reference'}.`);
    await tick(); locate([node.id]);
  }
  function connect(connection: Connection) {
    const start = connectionStart; connectionStart = undefined;
    if (!allowMoves || !start) return;
    onMove({ ...start, source: connection.source, target: connection.target });
  }
  function valid(connection: Connection | Edge): boolean {
    return allowMoves && !blocked && structureMove(document, revision, { documentId: document.id, revision, source: connection.source, target: connection.target }, false, descriptors, recipes).ok;
  }
  function collapse(id: string) { const next = new Set(collapsed); if (next.has(id)) next.delete(id); else next.add(id); collapsed = next; }
  function navigate(destination: StructureHandoff['destination']) {
    if (!inspected || blocked) return;
    onNavigate?.({ destination, sourceId: inspected.data.sourceId, occurrence: inspected.data.occurrence, key: parseStructureId(inspected.id)?.[2] });
  }
  const targetOptions = $derived(nodes.filter(node => node.data.moveTarget && (!moveSource || valid({ source: moveSource, target: node.id, sourceHandle: 'content', targetHandle: 'container' }))));
</script>

<section class="structure-view" aria-label="Source structure">
  <div class="structure-heading"><strong>Structure</strong><span>Declared source relationships · runtime behavior is inspected in Interact</span></div>
  <div class="structure-tools">
    <input type="search" aria-label="Search structure" placeholder="Find a name or source ID" bind:value={search} />
    <button type="button" onclick={() => locate()}>Fit visible</button>
    <button type="button" disabled={!inspected} onclick={() => { if (inspected) { search = ''; focusedId = inspected.id; locate([inspected.id]); } }}>Focus selection</button>
    {#if focusedId}<button type="button" onclick={() => { focusedId = undefined; }}>Show screen</button>{/if}
    <button type="button" onclick={() => { collapsed = new Set(); }}>Expand all</button>
    <button type="button" onclick={() => layoutVersion++}>Arrange</button>
    <label>Direction<select aria-label="Structure layout direction" bind:value={direction}><option value="RIGHT">Left to right</option><option value="DOWN">Top to bottom</option></select></label>
  </div>
  <div class="structure-layers">
    <label><input type="checkbox" bind:checked={allowMoves} disabled={blocked} /> Move containment</label>
    <label><input type="checkbox" bind:checked={showBindings} /> State / actions</label>
    <label><input type="checkbox" bind:checked={showDefinitions} /> Definitions / templates</label>
    <span role="status">{layoutStatus}</span>
  </div>
  {#if allowMoves}
    <div class="structure-moves"><p>Move content into a compatible container. Purple handles edit containment only; dashed relationships are inspectable. The source history records each accepted move.</p>
      <label>Content<select aria-label="Content to move" value={moveSource} onchange={event => { moveSource = event.currentTarget.value; moveTarget = ''; }}><option value="">Choose content</option>{#each nodes.filter(node => node.data.moveSource) as node (node.id)}<option value={node.id}>{node.data.label} · {node.data.sourceId}</option>{/each}</select></label>
      <label>Valid container<select aria-label="Move destination" value={moveTarget} onchange={event => moveTarget = event.currentTarget.value}><option value="">Choose container</option>{#each targetOptions as node (node.id)}<option value={node.id}>{node.data.label} · {node.data.sourceId}</option>{/each}</select></label>
      <button type="button" disabled={!moveSource || !targetOptions.some(node => node.id === moveTarget)} onclick={() => onMove({ documentId: document.id, revision, source: moveSource, target: moveTarget })}>Move inside</button>
    </div>
  {/if}
  <div class="structure-canvas">
    <FlowCanvas bind:nodes bind:edges bind:viewport {nodeTypes} {edgeTypes} minZoom={.35} maxZoom={2} colorMode="light" showMiniMap={nodes.length > 12}
      nodesConnectable={allowMoves && !blocked} elementsSelectable={!blocked} deleteKey={null} isValidConnection={valid}
      onnodeclick={({ node }) => select(node as Node<StructureNodeData>)}
      onnodedragstart={() => fence.cancel()}
      onconnectstart={() => { connectionStart = { documentId: document.id, revision }; }}
      onclickconnectstart={() => { connectionStart = { documentId: document.id, revision }; }} onconnect={connect}>
      <FlowNavigation request={navigationRequest} ids={navigationIds} />
    </FlowCanvas>
    {#if !nodes.length}<p class="structure-empty">No source matches. Clear the search or change relationship layers.</p>{/if}
  </div>
  <div class="structure-details">
    <label>Inspect<select aria-label="Structure source selection" value={inspectedId ?? ''} onchange={event => { const node = graph.nodes.find(entry => entry.id === event.currentTarget.value); if (node) { if (!nodes.some(entry => entry.id === node.id)) { search = node.data.sourceId ?? node.data.label; focusedId = undefined; } void select(node); } }}><option value="">Select a source item</option>{#each graph.nodes as node (node.id)}<option value={node.id}>{node.data.label} · {node.data.kindLabel ?? node.data.kind} · {node.data.sourceId ?? parseStructureId(node.id)?.[2]}</option>{/each}</select></label>
    {#if inspected}
      <div class="structure-selection"><strong>{inspected.data.label}</strong><code>{inspected.data.sourceId ?? parseStructureId(inspected.id)?.[2]}</code><span>{inspected.data.kindLabel ?? inspected.data.kind}{inspected.data.occurrence ? ' · shared selection' : ' · inspect only'}</span>
        {#if inspected.data.childCount}<button type="button" onclick={() => collapse(inspected.id)}>{collapsed.has(inspected.id) ? 'Expand group' : 'Collapse group'}</button>{/if}
        {#if inspected.data.occurrence}<button type="button" disabled={blocked} onclick={() => navigate('design')}>Open Design</button><button type="button" disabled={blocked} onclick={() => navigate('layers')}>Reveal in Layers</button><button type="button" disabled={blocked} onclick={() => navigate('inspector')}>Edit properties / bindings</button>{/if}
        {#if inspected.data.kind === 'state'}<button type="button" disabled={blocked} onclick={() => navigate('data')}>Open Data</button>{/if}
        {#if inspected.data.kind === 'action'}<button type="button" disabled={blocked} onclick={() => navigate('actions')}>Open Actions</button>{/if}
      </div>
      <details><summary>Declared properties and bindings ({facts.length})</summary><div class="structure-facts">{#each facts as fact}<div><code>{fact.path}</code><span>{fact.value}</span></div>{/each}</div></details>
      <details open={related.length > 0}><summary>Related source ({related.length})</summary><div class="structure-relations">{#each related as edge (edge.id)}{@const other = graph.nodes.find(node => node.id === (edge.source === inspectedId ? edge.target : edge.source))}<button type="button" onclick={() => { if (other) { showBindings = true; showDefinitions = true; search = ''; void select(other); } }}><strong>{edge.label}</strong><code>{edge.data?.path}</code><span>{other?.data.label}</span></button>{/each}</div></details>
    {/if}
  </div>
</section>

<style>
  .structure-view { display: flex; flex-direction: column; flex: 1; min-height: 560px; height: 100%; min-width: 0; color: #172033; background: #f8fafc; font-size: 12px; }
  .structure-heading { padding: 12px 14px 4px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .structure-heading strong { font-size: 14px; } .structure-heading span, .structure-layers>span { color: #64748b; }
  .structure-tools, .structure-layers, .structure-moves { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 14px; }
  .structure-layers { border-bottom: 1px solid #dbe3ed; } .structure-layers>span { margin-left: auto; }
  button, select, input[type=search] { box-sizing: border-box; max-width: 100%; background: #fff; color: #172033; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font: inherit; }
  button { cursor: pointer; } button:hover { background: #eef2ff; } button:disabled { opacity: .5; cursor: default; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  input[type=search] { flex: 1; min-width: 170px; } label { display: flex; align-items: center; gap: 5px; }
  .structure-canvas { position: relative; flex: 1; min-height: 350px; }
  .structure-canvas :global(.svelte-flow) { --xy-background-color: #f8fafc; --xy-minimap-background-color: #fff; --xy-controls-button-background-color: #fff; }
  .structure-canvas :global(.svelte-flow__minimap) { width: 130px; height: 85px; }
  .structure-canvas :global(.svelte-flow__edge.selected path) { stroke: #4f46e5 !important; stroke-width: 2.5px; }
  .structure-empty { position: absolute; top: 35%; left: 10%; right: 10%; text-align: center; color: #64748b; pointer-events: none; }
  .structure-details { padding: 10px 14px; border-top: 1px solid #dbe3ed; max-height: 240px; overflow: auto; background: #fff; }
  .structure-details>label select { flex: 1; min-width: 0; } .structure-selection { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 0; }
  code { font-size: 11px; overflow-wrap: anywhere; color: #64748b; } summary { cursor: pointer; padding: 6px 0; font-weight: 600; }
  .structure-facts>div { display: grid; grid-template-columns: minmax(120px, 1fr) 1fr; gap: 10px; padding: 4px 0; border-top: 1px solid #f1f5f9; overflow-wrap: anywhere; }
  .structure-relations { display: flex; flex-wrap: wrap; gap: 6px; } .structure-relations button { display: flex; flex-direction: column; align-items: start; gap: 3px; max-width: 100%; text-align: left; }
  .structure-moves { background: #eef2ff; } .structure-moves p { flex-basis: 100%; margin: 0; } .structure-moves select { max-width: 210px; }
  @media (max-width: 600px) { .structure-heading span { font-size: 11px; } .structure-tools, .structure-layers { padding: 7px 10px; gap: 6px; } .structure-layers>span { flex-basis: 100%; margin: 0; } .structure-details { max-height: 210px; } }
</style>
