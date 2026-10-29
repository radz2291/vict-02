# Optional Svelte Flow UI

This package is a specialist presentation dependency, independent of Studio,
`@victframework/ui`, and application execution. It exports the pinned upstream
Svelte Flow API: SvelteFlow, SvelteFlowProvider, Background, Controls,
ControlButton, MiniMap, Handle, Panel, custom node/edge types, connection
callbacks, useSvelteFlow, addEdge and path/layout utilities. `FlowCanvas` adds
an optional default background, controls and minimap to SvelteFlow. All Flow
props, snippets, nodeTypes, edgeTypes, selection, pan/zoom, keyboard interaction
and connection callbacks pass through. Set showControls/showMiniMap/
showBackground false to replace the default parts.

```svelte
<script lang="ts">
  import { FlowCanvas, addEdge, type Node, type Edge, type Connection } from '@victframework/ui-flow-svelte';
  import '@victframework/ui-flow-svelte/styles.css';
  let nodes = $state<Node[]>([
    { id: 'one', position: { x: 0, y: 0 }, data: { label: 'First' } },
    { id: 'two', position: { x: 250, y: 100 }, data: { label: 'Second' } }
  ]);
  let edges = $state<Edge[]>([]);
  function connect(connection: Connection) { edges = addEdge(connection, edges); }
</script>
<div style="height: 480px; width: 100%">
  <FlowCanvas bind:nodes bind:edges onconnect={connect} fitView />
</div>
```

The consumer owns graph meaning, persistence, validation and edits. Do not
treat arbitrary visual connections as executable workflows. Studio maps source
definitions into this API and submits permitted edits to its canonical editor.
Positions, viewport and selection are presentation data unless a consumer
explicitly chooses its own storage policy. Current package is a private local
artifact; no registry publication is implied. See UPSTREAM.md for provenance.

Cycle 1.3 completion adds original reusable presentation helpers:

- `SourceNode`: compact, kind-aware cards. The caller supplies friendly labels,
  summaries and supported edit-handle flags; handles remain inert for inspection.
- `RoutedEdge`: renders measured ELK bend points when endpoints still match,
  falling back to an upstream smooth-step path after manual positioning.
- `FlowNavigation`: fits requested graph IDs from inside the Svelte Flow context.
- `layoutGraph(nodes, edges, options)`: immutable measured-size layout, with
  `RIGHT` or `DOWN` orientation. Results include the actual engine and fallback
  reason. `nodeSize` prefers upstream measured dimensions.
- `LayoutFence`: generation tickets for consumers to discard obsolete async
  results. The host must invalidate on document/revision/filter/geometry changes.
- `FlowCanvas` now binds `viewport` as well as nodes and edges, allowing the
  consumer to retain view state independently of its canonical document.

Layout uses pinned Dagre 1.1.5 (MIT) and ELK.js 0.11.0 (EPL-2.0). ELK is selected
for routed focused views of at most 120 visible nodes. Requests above that bound
automatically use Dagre, because an expanded 500-node benchmark exposed very
slow ELK work. There is no unrestricted large-ELK option. Node positions and
collapse/focus state remain consumer presentation data. These helpers do not
interpret VICT bindings, mutate documents or implement workflow execution.

## Graph compatibility and reusable mechanics

The rejected bundled `GraphEditor` interface and its new-authoring recipe have
been removed. `GraphSurface` preserves the graph canvas, node fields, typed
connections, selection, keyboard history and the canonical graph-change bridge.
It does not include a toolbar, family picker, selection inspector, connection
form, clipboard panel, minimap or zoom control panel. Hosts choose their own UI.
Graph model operations and layout utilities remain public and unchanged.

Saved `vict.flow.editor@1/@2` source still loads through compatibility renderers.
Both registrations are excluded from new manual/agent insertion and contain no
seed or examples. Their immutable descriptor pins remain intact; historical
`toolbar` and `inspector` style targets are now inert and do not target other
surfaces. Existing graph data and bindings are not migrated or deleted.

This compatibility surface is not the promised arbitrary node-body authoring
architecture. That separate iteration remains under development; existing
fixed field kinds do not demonstrate general project-defined node composition.
