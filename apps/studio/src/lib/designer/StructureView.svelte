<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { FlowCanvas, SourceNode, RoutedEdge, FlowNavigation, Controls, layoutGraph, LayoutFence, type Node, type Edge, type Connection, type Viewport, type LayoutDirection } from '@victframework/ui-flow-svelte';
  import '@victframework/ui-flow-svelte/styles.css';
  import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
  import { type InsertRecipe } from '@victframework/ui-editor';
  import { projectStructure, filterStructure, compactStructure, structureNodePresentation, structureFacts, structureId, parseStructureId, structureMove, type StructureNodeData, type StructureEditRequest, type StructureHandoff } from './structure.js';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  import WorkspaceMenu from './WorkspaceMenu.svelte';
  import EditorContextMenu, { type ContextCommand } from './EditorContextMenu.svelte';

  let { document, revision, selectedNodeId, blocked = false, active = true, presentation = 'workspace', descriptors = [], recipes = [], onSelect, onDeselect, onMove, onNotice, onNavigate, onDismiss, onInspect, onInspectItem, externalInspectionOpen = false, onCloseInspector }: {
    document: UiDocument; revision: string; selectedNodeId?: string; blocked?: boolean; active?: boolean;
    descriptors?: readonly UiExtensionDescriptor[]; recipes?: readonly InsertRecipe[];
    onSelect: (occurrence: string) => void; onMove: (request: StructureEditRequest) => boolean;
    onDeselect?: () => void;
    presentation?: 'workspace' | 'drawer'; onDismiss?: () => void;
    onNotice: (message: string) => void; onNavigate?: (request: StructureHandoff) => void;
    onInspect?: (id: string | undefined, page: 'properties' | 'relationships') => void;
    onInspectItem?: (id: string) => void; externalInspectionOpen?: boolean; onCloseInspector?: () => void;
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
  let activeMenu = $state('');
  let inspectionOpen = $state(false);
  let inspectionPage = $state<'properties' | 'relationships' | 'find' | 'move'>('properties');
  let showTextNodes = $state(false);
  let inspectionButton: HTMLButtonElement;
  let structureElement: HTMLElement;
  const fittedDocuments = new Set<string>();
  const graph = $derived(projectStructure(document));
  const compactGraph = $derived(compactStructure(graph, document));
  const groupGraph = $derived(showTextNodes || search ? graph : compactGraph);
  const inspected = $derived(graph.nodes.find(node => node.id === inspectedId));
  const related = $derived(graph.edges.filter(edge => (edge.source === inspectedId || edge.target === inspectedId) && edge.data?.kind !== 'containment'));
  const facts = $derived(inspected ? structureFacts(document, inspected) : []);
  const filtered = $derived(filterStructure(graph, { search, focusId: focusedId, collapsed, bindings: showBindings, definitions: showDefinitions }));
  const projected = $derived(showTextNodes || search ? filtered : compactStructure(filtered, document));
  const nodeTypes = { source: SourceNode };
  const edgeTypes = { routed: RoutedEdge };
  const fence = new LayoutFence();
  let connectionStart: { documentId: string; revision: string } | undefined;
  let layoutDocument = '';
  const presentations = new Map<string, { viewport: Viewport; positions: Map<string, { x: number; y: number }>; collapsed: Set<string>; inspectedId?: string; direction: LayoutDirection; search: string; focusedId?: string; bindings: boolean; definitions: boolean; text: boolean; inspection: boolean; page: typeof inspectionPage }>();
  function remember() {
    if (!layoutDocument) return;
    presentations.set(layoutDocument, { viewport: { ...viewport }, positions: new Map(nodes.map(node => [node.id, { ...node.position }])), collapsed: new Set(collapsed), inspectedId, direction, search, focusedId, bindings: showBindings, definitions: showDefinitions, text: showTextNodes, inspection: inspectionOpen, page: inspectionPage === 'move' ? 'properties' : inspectionPage });
  }
  $effect(() => {
    const id = document.id;
    if (id === untrack(() => layoutDocument)) return;
    untrack(remember);
    layoutDocument = id;
    const saved = presentations.get(id);
    viewport = saved?.viewport ?? { x: 24, y: 24, zoom: .85 };
    collapsed = saved?.collapsed ?? new Set(graph.nodes.filter(node => node.data.occurrence && (node.data.childCount ?? 0) > (presentation === 'drawer' ? 1 : 3) && node.data.sourceId !== document.root).map(node => node.id));
    inspectedId = saved?.inspectedId ?? (selectedNodeId ? structureId(id, 'node', selectedNodeId) : structureId(id, 'node', document.root));
    direction = saved?.direction ?? 'RIGHT'; search = saved?.search ?? ''; focusedId = saved?.focusedId;
    showBindings = saved?.bindings ?? false; showDefinitions = saved?.definitions ?? false; allowMoves = false;
    showTextNodes = saved?.text ?? false; inspectionOpen = saved?.inspection ?? false; inspectionPage = saved?.page ?? 'properties';
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
        data: { ...structureNodePresentation(document, node.data), direction: orientation, moveSource: editable && !!node.data.occurrence && node.data.sourceId !== document.root, moveTarget: editable && target,
          collapsed: collapsed.has(node.id), onToggleGroup: groupGraph.edges.some(edge => edge.source === node.id && edge.data?.kind === 'containment') ? () => collapse(node.id) : undefined } };
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
      layoutStatus = '';
    }).catch(() => { if (fence.current(ticket)) layoutStatus = 'Layout unavailable. Existing positions retained; retry Arrange.'; });
    return () => fence.cancel();
  });
  onDestroy(() => { remember(); fence.cancel(); });
  $effect(() => {
    if (presentation !== 'drawer' || !active || layoutStatus || !nodes.length || nodes.some(node => !node.measured?.width) || fittedDocuments.has(document.id)) return;
    fittedDocuments.add(document.id); locate();
  });
  function locate(ids: string[] = []) { navigationIds = ids; navigationRequest = {}; }
  function select(node: Node<StructureNodeData>) {
    if (blocked) { onNotice('Apply or cancel your draft before changing selection.'); return; }
    inspectedId = node.id;
    if (node.data.occurrence) onSelect(node.data.occurrence);
    onInspectItem?.(node.id);
  }
  async function reveal(node: Node<StructureNodeData>) {
    if (blocked) { onNotice('Apply or cancel your draft before changing selection.'); return; }
    search = ''; focusedId = node.id;
    if (node.data.kind !== 'node') { showBindings = true; showDefinitions = true; }
    else if (document.nodes[node.data.sourceId ?? '']?.kind === 'text') showTextNodes = true;
    select(node); await tick(); locate([node.id]);
  }
  function closeInspection(restoreFocus = true) {
    inspectionOpen = false; allowMoves = false; moveSource = ''; moveTarget = '';
    if (restoreFocus) inspectionButton?.focus({ preventScroll: true });
  }
  function openInspection(page: typeof inspectionPage = 'properties') {
    if (onInspect && (page === 'properties' || page === 'relationships')) { closeInspection(false); onInspect(inspectedId, page); return; }
    allowMoves = page === 'move'; inspectionPage = page; inspectionOpen = true;
  }
  function deselect() {
    closeInspection(false);
    if (blocked) return;
    inspectedId = undefined; onDeselect?.();
  }
  function keyboardSelection(event: KeyboardEvent) {
    // Flow's Enter/Space selection does not emit onnodeclick. Only handle a
    // focused node wrapper, never an input or its nested disclosure button.
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('.svelte-flow__node')) return;
    const node = nodes.find(entry => entry.id === target.dataset.id);
    if (node && (event.key === 'Enter' || event.key === ' ')) select(node);
  }
  function graphEscape(event: KeyboardEvent) {
    if (!active || activeMenu || event.key !== 'Escape' || !(event.target instanceof HTMLElement) || !event.target.matches('.svelte-flow__node')) return;
    // Run before Flow's wrapper, which otherwise clears its own selection even
    // when Escape is only closing our dock. Keep the two selection owners equal.
    event.preventDefault(); event.stopPropagation();
    if (inspectionOpen) closeInspection(); else if (externalInspectionOpen) onCloseInspector?.(); else if (inspectedId || !onDismiss) deselect(); else onDismiss();
  }
  function beginMove() {
    moveSource = inspected?.data.occurrence && inspected.data.sourceId !== document.root ? inspected.id : '';
    moveTarget = ''; openInspection('move');
  }
  function commitMove(request: StructureEditRequest) {
    if (onMove(request)) { allowMoves = false; moveSource = ''; moveTarget = ''; openInspection('properties'); }
  }
  function escape(event: KeyboardEvent) {
    if (!active || event.defaultPrevented || event.key !== 'Escape' || activeMenu) return;
    if (presentation === 'drawer' && (!(event.target instanceof Element) || !structureElement?.contains(event.target))) return;
    if (inspectionOpen) { event.preventDefault(); closeInspection(); }
    else if (focusedId || search) { event.preventDefault(); search = ''; focusedId = undefined; }
    else if (onDismiss) { event.preventDefault(); onDismiss(); }
  }
  function connect(connection: Connection) {
    const start = connectionStart; connectionStart = undefined;
    if (!allowMoves || !start) return;
    commitMove({ ...start, source: connection.source, target: connection.target });
  }
  function valid(connection: Connection | Edge): boolean {
    return allowMoves && !blocked && structureMove(document, revision, { documentId: document.id, revision, source: connection.source, target: connection.target }, false, descriptors, recipes).ok;
  }
  function collapse(id: string) { const next = new Set(collapsed); if (next.has(id)) next.delete(id); else next.add(id); collapsed = next; }
  function navigate(destination: StructureHandoff['destination']) {
    if (!inspected || blocked) return;
    onNavigate?.({ destination, sourceId: inspected.data.sourceId, occurrence: inspected.data.occurrence, key: parseStructureId(inspected.id)?.[2] });
  }
  const moveSources = $derived(graph.nodes.filter(node => node.data.occurrence && node.data.sourceId !== document.root));
  const targetOptions = $derived(graph.nodes.filter(node => !!moveSource && valid({ source: moveSource, target: node.id, sourceHandle: 'content', targetHandle: 'container' })));
  let contextNode = $state(false);
  let contextCursor: { documentId: string; revision: string; item?: string } | undefined;
  function prepareContext(target: Element): boolean {
    if (blocked) { onNotice('Apply or cancel your draft first.'); return false; }
    const wrapper = target.closest<HTMLElement>('.svelte-flow__node');
    const node = wrapper && nodes.find(node => node.id === wrapper.dataset.id);
    contextNode = !!node;
    if (node) select(node);
    contextCursor = { documentId: document.id, revision, item: inspectedId };
    return true;
  }
  function validateContext() {
    if (blocked || !contextCursor || contextCursor.documentId !== document.id || contextCursor.revision !== revision || contextCursor.item !== inspectedId) { onNotice('The selection or document changed. Open the context menu again.'); return false; }
    return true;
  }
  const contextCommands = $derived<ContextCommand[]>(contextNode && inspected ? [
    { label: 'Inspect', action: () => openInspection('properties') },
    { label: 'Inspect relationships', action: () => openInspection('relationships') },
    ...(inspected.data.childCount ? [{ label: collapsed.has(inspected.id) ? 'Expand group' : 'Collapse group', action: () => { if (inspected) collapse(inspected.id); } }] : []),
    ...(inspected.data.occurrence ? [
      { label: 'Locate on canvas', action: () => navigate('design'), separator: true },
      { label: 'Reveal in Layers', action: () => navigate('layers') },
      { label: 'Move inside…', action: beginMove, disabled: inspected.data.sourceId === document.root },
    ] : []),
    ...(inspected.data.kind === 'state' ? [{ label: 'Edit in Data', action: () => navigate('data') }] : []),
    ...(inspected.data.kind === 'action' ? [{ label: 'Open Actions', action: () => navigate('actions') }] : []),
  ] : [
    { label: 'Frame all nodes', action: () => locate() },
    { label: 'Arrange nodes', action: () => layoutVersion++ },
    { label: 'Expand all groups', action: () => collapsed = new Set() },
    { label: direction === 'RIGHT' ? 'Layout top to bottom' : 'Layout left to right', action: () => direction = direction === 'RIGHT' ? 'DOWN' : 'RIGHT' },
    { label: 'Find source item', action: () => openInspection('find'), separator: true },
  ]);
</script>
<svelte:window onkeydown={escape} onkeydowncapture={graphEscape} />
<section class="structure-view" class:drawer-presentation={presentation === 'drawer'} class:inspection-open={inspectionOpen} aria-label="Source structure" bind:this={structureElement}>
  <div class="structure-tools">
    <input type="search" aria-label="Search structure" placeholder="Search structure" bind:value={search} />
    <Menubar.Root class="workspace-menus" aria-label="Structure menus" bind:value={activeMenu} loop>
      <WorkspaceMenu label="View" value="structure-view" {activeMenu}>
        <Menubar.Item disabled={!inspected} onSelect={() => { if (inspected) void reveal(inspected); }}>Frame selection</Menubar.Item>
        <Menubar.Item disabled={!focusedId && !search} onSelect={() => { focusedId = undefined; search = ''; }}>Show whole screen</Menubar.Item>
        <Menubar.Item onSelect={() => openInspection('find')}>Find source item</Menubar.Item>
        <Menubar.Separator />
        <Menubar.Item onSelect={() => layoutVersion++}>Arrange nodes</Menubar.Item>
        <Menubar.Item onSelect={() => { collapsed = new Set(); }}>Expand all groups</Menubar.Item>
        <Menubar.Group><Menubar.GroupHeading class="menu-caption">Layout</Menubar.GroupHeading>
          <Menubar.RadioGroup bind:value={direction} aria-label="Structure layout direction">
            <Menubar.RadioItem value="RIGHT" closeOnSelect>Left to right</Menubar.RadioItem>
            <Menubar.RadioItem value="DOWN" closeOnSelect>Top to bottom</Menubar.RadioItem>
          </Menubar.RadioGroup>
        </Menubar.Group>
        <Menubar.Separator />
        <Menubar.Group><Menubar.GroupHeading class="menu-caption">Relationships</Menubar.GroupHeading>
          <Menubar.CheckboxItem bind:checked={showBindings} closeOnSelect={false}>State and actions<span aria-hidden="true">{showBindings ? '✓' : ''}</span></Menubar.CheckboxItem>
          <Menubar.CheckboxItem bind:checked={showDefinitions} closeOnSelect={false}>Definitions and templates<span aria-hidden="true">{showDefinitions ? '✓' : ''}</span></Menubar.CheckboxItem>
          <Menubar.CheckboxItem bind:checked={showTextNodes} closeOnSelect={false}>Show text nodes<span aria-hidden="true">{showTextNodes ? '✓' : ''}</span></Menubar.CheckboxItem>
        </Menubar.Group>
      </WorkspaceMenu>
      {#if inspected}
        <WorkspaceMenu label="Object" value="structure-object" {activeMenu}>
          {#if inspected.data.childCount}<Menubar.Item onSelect={() => collapse(inspected.id)}>{collapsed.has(inspected.id) ? 'Expand group' : 'Collapse group'}</Menubar.Item>{/if}
          {#if inspected.data.occurrence}
            <Menubar.Item disabled={blocked} onSelect={() => navigate('inspector')}>Edit properties</Menubar.Item>
            <Menubar.Item disabled={blocked} onSelect={() => navigate('layers')}>Reveal in Layers</Menubar.Item>
            <Menubar.Item disabled={blocked} onSelect={() => navigate('design')}>{presentation === 'drawer' ? 'Locate on canvas' : 'Show in Design'}</Menubar.Item>
            <Menubar.Separator />
            <Menubar.Item disabled={blocked || inspected.data.sourceId === document.root} onSelect={beginMove}>Move inside…</Menubar.Item>
          {/if}
          {#if inspected.data.kind === 'state'}<Menubar.Item disabled={blocked} onSelect={() => navigate('data')}>Edit in Data</Menubar.Item>{/if}
          {#if inspected.data.kind === 'action'}<Menubar.Item disabled={blocked} onSelect={() => navigate('actions')}>Open Actions</Menubar.Item>{/if}
          <Menubar.Item onSelect={() => openInspection('relationships')}>Inspect relationships</Menubar.Item>
        </WorkspaceMenu>
      {/if}
    </Menubar.Root>
    {#if focusedId}<button class="scope-control" type="button" onclick={() => { focusedId = undefined; search = ''; }}>Show whole screen</button>{/if}
    <span class="structure-count" aria-live="polite">{nodes.length} items</span>
    <button type="button" class="inspection-toggle" aria-label="Inspect structure" aria-expanded={inspectionOpen || externalInspectionOpen} aria-controls={onInspect ? undefined : 'structure-inspection'} bind:this={inspectionButton} onclick={() => { if (inspectionOpen) closeInspection(); else openInspection(inspected ? 'properties' : 'find'); }}>Inspect</button>
  </div>
  <div class="structure-body">
    <EditorContextMenu class="structure-context" label="Structure context commands" prepare={prepareContext} validate={validateContext} commands={contextCommands}>
    <div class="structure-canvas" inert={presentation === 'drawer' && inspectionOpen}>
      <FlowCanvas bind:nodes bind:edges bind:viewport {nodeTypes} {edgeTypes} minZoom={.35} maxZoom={2} colorMode="light" showControls={false} showMiniMap={nodes.length > 12}
        nodesConnectable={allowMoves && !blocked} elementsSelectable={!blocked} deleteKey={null} multiSelectionKey={null} selectionKey={null} autoPanOnNodeFocus={false} isValidConnection={valid}
        onnodeclick={({ node }) => select(node as Node<StructureNodeData>)}
        onkeydown={keyboardSelection}
        onpaneclick={deselect}
        onnodedragstart={() => fence.cancel()}
        onconnectstart={() => { connectionStart = { documentId: document.id, revision }; }}
        onclickconnectstart={() => { connectionStart = { documentId: document.id, revision }; }} onconnect={connect}>
        <Controls showLock={false} />
        <FlowNavigation request={navigationRequest} ids={navigationIds} />
      </FlowCanvas>
      {#if layoutStatus}<p class="structure-status" role="status">{layoutStatus}</p>{/if}
      {#if !nodes.length}<div class="structure-empty"><p>No matching items</p><button type="button" onclick={() => { search = ''; focusedId = undefined; }}>Clear search</button></div>{/if}
    </div>
    </EditorContextMenu>
    {#if inspectionOpen}
      <aside class="structure-details" id="structure-inspection" aria-label="Structure inspection">
        <div class="inspection-heading"><strong title={inspected?.data.label}>{inspected ? structureNodePresentation(document, inspected.data).label : 'Find source item'}</strong><button type="button" aria-label="Close inspection" onclick={() => closeInspection()}>×</button></div>
        {#if inspectionPage === 'move'}
          <div class="structure-moves">
            <h3>Move inside</h3>
            <label>Content<select aria-label="Content to move" value={moveSource} onchange={event => { moveSource = event.currentTarget.value; moveTarget = ''; }}><option value="">Choose content</option>{#each moveSources as node (node.id)}<option value={node.id}>{structureNodePresentation(document, node.data).label} · {node.data.sourceId}</option>{/each}</select></label>
            <label>Container<select aria-label="Move destination" value={moveTarget} onchange={event => moveTarget = event.currentTarget.value}><option value="">Choose container</option>{#each targetOptions as node (node.id)}<option value={node.id}>{structureNodePresentation(document, node.data).label} · {node.data.sourceId}</option>{/each}</select></label>
            <div class="move-actions"><button type="button" disabled={blocked || !moveSource || !targetOptions.some(node => node.id === moveTarget)} onclick={() => commitMove({ documentId: document.id, revision, source: moveSource, target: moveTarget })}>Move</button><button type="button" onclick={() => openInspection('properties')}>Cancel</button></div>
            <p class="inspection-hint">Moves content in the document. Undo restores its previous place.</p>
          </div>
        {:else}
          <div class="inspection-pages" aria-label="Inspection view">
            <button type="button" aria-pressed={inspectionPage === 'properties'} onclick={() => openInspection('properties')}>Properties</button>
            <button type="button" aria-pressed={inspectionPage === 'relationships'} onclick={() => openInspection('relationships')}>Relationships</button>
            <button type="button" aria-pressed={inspectionPage === 'find'} onclick={() => inspectionPage = 'find'}>Find</button>
          </div>
          <div class="inspection-content">
            {#if inspectionPage === 'find'}
              <label class="source-finder">Source item<select aria-label="Structure source selection" value={inspectedId ?? ''} onchange={event => { const node = graph.nodes.find(entry => entry.id === event.currentTarget.value); if (node) void reveal(node); }}><option value="">Select an item</option>{#each graph.nodes as node (node.id)}<option value={node.id}>{structureNodePresentation(document, node.data).label} · {node.data.sourceId ?? parseStructureId(node.id)?.[2]}</option>{/each}</select></label>
              <p class="inspection-hint">Includes hidden items and source references.</p>
            {:else if !inspected}
              <p class="inspection-hint">Select an item on the graph, or use Find.</p>
            {:else if inspectionPage === 'properties'}
              <div class="inspection-identity"><span>{inspected.data.kindLabel ?? inspected.data.kind}</span><code>{inspected.data.sourceId ?? parseStructureId(inspected.id)?.[2]}</code></div>
              {#if inspected.data.occurrence}<button class="edit-handoff" type="button" disabled={blocked} onclick={() => navigate('inspector')}>Edit properties</button>{/if}
              {#if inspected.data.kind === 'state'}<button class="edit-handoff" type="button" disabled={blocked} onclick={() => navigate('data')}>Edit in Data</button>{/if}
              {#if inspected.data.kind === 'action'}<button class="edit-handoff" type="button" disabled={blocked} onclick={() => navigate('actions')}>Open Actions</button>{/if}
              <div class="structure-facts">{#each facts as fact}<div><code>{fact.path}</code><span>{fact.value}</span></div>{/each}</div>
            {:else}
              <div class="structure-relations">{#each related as edge (edge.id)}{@const other = graph.nodes.find(node => node.id === (edge.source === inspectedId ? edge.target : edge.source))}<button type="button" disabled={blocked} onclick={() => { if (other) select(other); }}><strong>{other ? structureNodePresentation(document, other.data).label : 'Source item'}</strong><span>{edge.label}</span><code>{edge.data?.path}</code></button>{/each}</div>
              {#if !related.length}<p class="inspection-hint">No declared relationships.</p>{:else}<button type="button" onclick={() => { if (inspected) void reveal(inspected); }}>Show on graph</button>{/if}
            {/if}
          </div>
        {/if}
      </aside>
    {/if}
  </div>
</section>

<style>
  .structure-view { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; min-width: 0; color: #26334b; background: #f8fafc; font: 12px/1.45 'Segoe UI', system-ui, sans-serif; }
  .drawer-presentation { container: structure-panel / inline-size; }
  .drawer-presentation .structure-body { position: relative; }
  .drawer-presentation.inspection-open .structure-canvas { visibility: hidden; }
  .drawer-presentation .structure-details { position: absolute; inset: 0; width: 100%; min-width: 0; max-height: none; flex-basis: auto; border: 0; }
  @container structure-panel (max-width: 540px) {
    .structure-tools { flex-wrap: wrap; }
    .structure-tools input { flex-basis: 100%; max-width: none; }
  }
  .structure-tools { display: flex; align-items: center; gap: 6px; padding: 6px 10px; min-height: 40px; flex-shrink: 0; border-bottom: 1px solid #e1e6ee; }
  button, select, input[type=search] { box-sizing: border-box; max-width: 100%; border: 1px solid #dce2eb; border-radius: 5px; background: white; color: inherit; padding: 6px 8px; font: inherit; }
  button { cursor: pointer; } button:hover { background: #edf1ff; } button:disabled { opacity: .5; cursor: default; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  input[type=search] { flex: 1; min-width: 100px; max-width: 340px; }
  .structure-count { margin-left: auto; color: #65748d; white-space: nowrap; }
  .inspection-toggle { background: transparent; border-color: transparent; } .inspection-toggle[aria-expanded=true] { color: #405abd; background: #edf1ff; }
  .scope-control { border: 0; background: #eef1f7; white-space: nowrap; }
  .structure-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
  .structure-body :global(.structure-context) { display: flex; flex: 1; min-height: 0; min-width: 0; }
  .structure-canvas { position: relative; flex: 1; min-width: 0; min-height: 0; }
  .structure-canvas :global(.svelte-flow) { --xy-background-color: #f8fafc; --xy-minimap-background-color: #fff; --xy-controls-button-background-color: #fff; }
  .structure-canvas :global(.svelte-flow__minimap) { width: 110px; height: 72px; }
  .structure-canvas :global(.svelte-flow__edge.selected path) { stroke: #4f46e5 !important; stroke-width: 2.5px; }
  .structure-empty { position: absolute; top: 35%; left: 10%; right: 10%; text-align: center; color: #64748b; }
  .structure-status { position: absolute; top: 8px; left: 10px; right: 10px; margin: 0; color: #65748d; pointer-events: none; font-size: 11px; }
  .structure-details { display: flex; flex-direction: column; width: min(320px, 44%); min-width: 240px; min-height: 0; flex-shrink: 0; border-left: 1px solid #e1e6ee; background: white; overflow: hidden; }
  .inspection-heading { display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; flex-shrink: 0; }
  .inspection-heading strong { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .inspection-heading button { border: 0; padding: 0; width: 28px; height: 28px; background: transparent; font-size: 20px; flex-shrink: 0; }
  .inspection-pages { display: flex; gap: 3px; padding: 0 10px 8px; border-bottom: 1px solid #e1e6ee; flex-shrink: 0; }
  .inspection-pages button { flex: 1; border: 0; padding: 5px 4px; color: #65748d; background: transparent; font-size: 11px; }
  .inspection-pages button[aria-pressed=true] { background: #edf1ff; color: #405abd; }
  .inspection-content, .structure-moves { padding: 12px; overflow: auto; min-height: 0; }
  .inspection-identity { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-bottom: 10px; color: #65748d; }
  .edit-handoff { margin-bottom: 12px; width: 100%; }
  code { font-size: 11px; overflow-wrap: anywhere; color: #65748d; }
  .structure-facts>div { display: grid; grid-template-columns: minmax(70px, 1fr) 1fr; gap: 10px; padding: 7px 0; border-top: 1px solid #eef1f6; overflow-wrap: anywhere; }
  .structure-relations { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .structure-relations button { display: flex; flex-direction: column; align-items: start; gap: 3px; text-align: left; overflow-wrap: anywhere; }
  .structure-relations span, .inspection-hint { color: #65748d; font-size: 11px; }
  .source-finder, .structure-moves label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  select { width: 100%; min-width: 0; }
  .structure-moves h3 { font-size: 13px; margin: 0 0 14px; }
  .move-actions { display: flex; gap: 6px; } .move-actions button { flex: 1; }
  @media (max-width: 640px) {
    .structure-tools { flex-wrap: wrap; padding: 6px 8px; gap: 4px; }
    .structure-tools input { max-width: none; }
    .structure-count { font-size: 11px; }
    .structure-body { flex-direction: column; }
    .structure-canvas { min-height: 0; }
    .structure-details { width: 100%; min-width: 0; flex-basis: 44%; max-height: 50%; border-left: 0; border-top: 1px solid #e1e6ee; }
  }
</style>
