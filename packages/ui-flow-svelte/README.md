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

## Rich application graphs

`GraphEditor` and the separately registered `vict.flow.editor@1` add an editable
graph contract. Existing `vict.flow.canvas/node/edge@1` contracts remain read-only.
Install the exported `flowAuthoringDescriptors`, `flowAuthoringImplementations`
and `flowAuthoringPackage` together; discovery and rendering use the same identity.
The package includes a valid rich-editor authoring seed with declared graph state.

The `graph` prop is JSON with schema `vict.flow-graph@1`, a numeric revision,
node families, nodes and edges. Families declare fields and named typed ports;
nodes retain their parameter values, positions and collapsed bodies. Fields
include native text/textarea/list/number/preview and the registered VICT catalog
slider, switch, select and button controls. Family definitions are data, so each
application can supply different node families without adding framework patches.
This finite field vocabulary does not permit arbitrary executable component code.
Buttons increment an explicit local intent count; application effects require a
separately declared application integration.

Image, video, icon and vector field kinds reuse `@victframework/ui-media-svelte`.
Their string values are managed asset references, supported supplied media sources,
exact icon names or inert vector JSON as appropriate. Optional field `media` metadata
supplies alt text, poster/captions/language and icon pack/revision/decorative choices.
The inspector can edit these references; loading/failure remains the media component's
real state. Node families and node instances accept stable `icon:{pack,name,revision,
source?,data?}` identities; an instance overrides its family. Custom SVG/vector marks
preserve multicolour branding. All instances use the nearest explicit `MEDIA_HOST`;
the graph stores references, never binary bytes or temporary blob URLs.

The editor supports header-only node dragging, background pan, multi-selection,
port tracing, selection inspection, fit/focus/search, measured Dagre arrangement,
add/duplicate/delete, explicit connection editing/reconnection, typed port checks,
and a visible portable copy/paste buffer. Controls isolate drag/pan/wheel gestures.
The inspector supplies keyboard-accessible connection and coordinate controls.
Copy/paste does not request access to the system clipboard. Camera and selection
are transient; positions, parameters, topology and collapsed state are in the graph.

Connect `graphChange:string` to the same declared string state used by `graph`.
The output is a validated complete snapshot. A static literal still allows local
editing but cannot persist itself. The host must explicitly commit output into its
canonical document/history/save protocol. `GRAPH_EDITOR_HOST` optionally supplies
`historyFor({nodeId,occurrenceKey})` with `canUndo/canRedo/undo/redo` methods; the
authored toolbar and keyboard then use that shared host history. Standalone
consumers without this context use bounded local `GraphSession` undo/redo.
The host's optional `presentationFor({nodeId,occurrenceKey})` controller supplies
`get/set` of `{viewport:{x,y,zoom},selection:{nodes,edges}}`. Keep this transient
store outside canonical-plan remounts, keyed by screen/document and occurrence;
the editor restores camera/selection and drops removed IDs. Restored cameras
disable initial auto-fit. These writes do not emit graph changes or weaken
renderer generation fences. Keyboard listeners use the owned document, so
iframe-mounted editors receive commands without affecting a sibling editor.

`parseGraphOperations(unknown)` validates 1–50 strict operations.
`applyGraphPatch(serializedGraph, operations, expectedRevision)` returns a
discriminated result and, on success, `graph` plus serialized `source`.
Agents can use `defineNodeType`, `addNode`, `setField`, `moveNodes`, `connect`,
`reconnect`, `replacePorts`, `remove`, `duplicate` and `paste` without replacing
one oversized string. Family replacement and invalid-edge removal require explicit
intent. Stale, invalid or domain-refused changes never partially apply.

The model bounds one graph to 1000 nodes, 4000 edges, 128 families and 128 fields/
ports per family. These are validation budgets, not a demonstrated performance
guarantee. Validation checks IDs, endpoints, direction, port type, multiplicity,
field kinds/options/bounds and cycle policy (cycles are rejected by default).
`GraphSession` additionally accepts a host domain-validator callback.

Import both Flow styles and the installed VICT catalog styles. Save/reopen,
canonical shared history, actual pointer/touch behavior and complete application
integration must be verified in the consuming host; package model/DOM tests alone
do not establish those product claims or parity with every Langflow feature.

Comparison and retained slow observation:
`docs/studio/cycle-1-3/completion/structure/layout-comparison*.json` in the source
repository. Studio reduces complexity first through containment layers, collapse,
search and selected dependency neighborhoods. It does not render canonical
containers as draggable compound subflow frames; collapse is a view projection.
