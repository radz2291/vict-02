<script lang="ts">
  import { untrack } from 'svelte';
  import { FlowCanvas, type Node, type Edge, type Connection } from '@victframework/ui-flow-svelte';
  import '@victframework/ui-flow-svelte/styles.css';
  import type { UiDocument } from '@victframework/ui';
  import { projectStructure, type StructureNodeData, type StructureEditRequest } from './structure.js';

  let { document, revision, selectedNodeId, blocked = false, onSelect, onMove, onNotice }: {
    document: UiDocument;
    revision: string;
    selectedNodeId?: string;
    blocked?: boolean;
    onSelect: (occurrence: string) => void;
    onMove: (request: StructureEditRequest) => boolean;
    onNotice: (message: string) => void;
  } = $props();
  let nodes = $state<Node<StructureNodeData>[]>([]);
  let edges = $state<Edge[]>([]);
  let connectionStart: { documentId: string; revision: string } | undefined;
  let allowMoves = $state(false);
  let layoutDocument = '';
  let inspectedId = $state<string>();
  const inspected = $derived(nodes.find(node => node.id === inspectedId));
  $effect(() => {
    const graph = projectStructure(document);
    const previous = untrack(() => layoutDocument === document.id ? new Map(nodes.map(node => [node.id, node.position])) : new Map());
    layoutDocument = document.id;
    nodes = graph.nodes.map(node => ({ ...node, position: previous.get(node.id) ?? node.position, selected: node.data.sourceId === selectedNodeId }));
    edges = graph.edges;
  });
  function select(node: Node<StructureNodeData>) {
    inspectedId = node.id;
    if (blocked) { onNotice('Apply or cancel your draft before changing selection.'); return; }
    if (node.data.occurrence) onSelect(node.data.occurrence);
    else onNotice(`${node.data.label.replaceAll('\n', ' · ')} · reference or template; no unique rendered selection.`);
  }
  function connect(connection: Connection) {
    const start = connectionStart;
    connectionStart = undefined;
    if (!allowMoves || !start) { onNotice('Enable Move by connection and start a new connection to move source content.'); return; }
    onMove({ ...start, source: connection.source, target: connection.target });
  }
  function resetLayout() { const graph = projectStructure(document); nodes = graph.nodes.map(node => ({ ...node, selected: node.data.sourceId === selectedNodeId })); }
</script>

<section class="structure-view" aria-label="Source structure">
  <div class="structure-help">
    <div><strong>Source structure</strong><p>Containment and declared bindings. Drag nodes to arrange this view. Select a source node to share the canvas selection.</p></div>
    <label><input type="checkbox" bind:checked={allowMoves} disabled={blocked} /> Move by connection</label>
    <button type="button" onclick={resetLayout}>Reset layout</button>
  </div>
  {#if allowMoves}<p class="structure-hint">Connect the bottom handle of content to the top handle of its new container. Only unambiguous authored containment moves are allowed. Use Design tools for explicit slot choices and bindings.</p>{/if}
  <div class="structure-canvas">
    <FlowCanvas bind:nodes bind:edges fitView minZoom={0.1} maxZoom={2} colorMode="dark"
      nodesConnectable={allowMoves && !blocked} elementsSelectable={!blocked} deleteKey={null}
      onnodeclick={({ node }) => select(node as Node<StructureNodeData>)}
      onconnectstart={() => { connectionStart = { documentId: document.id, revision }; }}
      onclickconnectstart={() => { connectionStart = { documentId: document.id, revision }; }}
      onconnect={connect} />
  </div>
  <div class="structure-details">
    <label>Inspect source or reference<select aria-label="Structure source selection" value={inspectedId ?? ''} onchange={event => { const node = nodes.find(entry => entry.id === event.currentTarget.value); if (node) select(node); }}><option value="">Select a source item</option>{#each nodes as node (node.id)}<option value={node.id}>{node.data.label.replaceAll('\n', ' · ')}</option>{/each}</select></label>
    {#if inspected}<span>{inspected.data.kind}: {inspected.data.label.replaceAll('\n', ' · ')}{inspected.data.occurrence ? ' · authored selection' : ' · inspect only'}</span>{/if}
  </div>
</section>

<style>
  .structure-view { display: flex; flex-direction: column; flex: 1; min-height: 420px; height: 100%; min-width: 0; color: #e2e8f0; background: #111827; }
  .structure-help { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #334155; }
  .structure-help div { flex: 1; min-width: 210px; }
  .structure-help p, .structure-hint { font-size: 12px; color: #94a3b8; margin: 4px 0 0; }
  .structure-hint { padding: 8px 16px; }
  .structure-help label { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .structure-help button { background: #1e293b; color: #e2e8f0; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; }
  .structure-canvas { flex: 1; min-height: 320px; }
  .structure-canvas :global(.svelte-flow__node-default) { width: 210px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
  .structure-details { padding: 8px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 12px; border-top: 1px solid #334155; }
  .structure-details label { display: flex; gap: 8px; align-items: center; }
  .structure-details select { max-width: 260px; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 5px; }
</style>
