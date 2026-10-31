# Optional Svelte Flow UI

This package is a specialist presentation dependency independent of Studio and
application execution. Canonical composition depends on `ui-svelte` and `ui`;
neither package depends on flow. It exports the pinned upstream
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

## Application-owned graph composition

`vict.flow.workspace@1` owns a validated graph and exposes two canonical scoped
slots. `content` is the application's normal layout: place `vict.flow.viewport`
and any controls wherever the application's journey requires them. `body` is a
normal VICT subtree rendered per node. There is no generated editor shell,
fixed node form or toolbar to hide. Graph operations are public and UI-neutral.

Install `flowAuthoringDescriptors`, `flowAuthoringImplementations` and
`flowAuthoringPackage` alongside the normal component catalog. Each scoped fill
uses `vict.ui-slot-scope@1`; see `packages/ui-svelte/SCOPED-SLOTS.md`. Declare
body props such as nodeId/nodeType/label, controlled parameter state, private UI
state, meaningful typed outputs and lexical conditions. Normal subtrees can
select a different composition per family. Stored local definitions retain their
historical props-only interface and can supply reusable presentation with props.

Graph field declarations validate parameter values; they no longer prescribe
body controls or layout. Place `vict.flow.port@1` next to its relevant field or
in a footer. The exact graph port ID owns direction/type/capacity; duplicated or
missing anchors show diagnostics. Body dimensions are measured, including
conditional port changes. Choose explicit `vict-graph-drag-handle` elements and
keep inputs/scroll regions `nodrag nopan nowheel`.

For a readable horizontal editor, `vict.flow.port-row@1` is an opt-in named
socket row in workspace bodies @1/@2/@3. It derives the visible label, data type
and input-left/output-right direction from the exact graph port ID. Compose one
full-width row per port at the unpadded card boundary, and pad ordinary settings
separately. This prevents several unrelated inputs becoming anonymous footer
dots. The measured socket and visual dot are 10px; a separate transparent 28px
pointer halo enlarges the hit area without moving the wire endpoint. Rows grow with
content. Choose consistent hex or semantic-token colours by data type and keep
the labels visible. The root/handle/socket/label/type parts are authorable, and
optional content remains ordinary UI. This changes presentation only: graph
types, capacity, connection history and ownership stay authoritative. Existing
bare-port identities retain their original behavior.

Canvas/node/port ownership is projected into opaque renderer handle IDs. Saved
port IDs, body props, graph edges and operations remain semantic IDs. Connections
translate back only through ports currently owned by that viewport and node;
nested or sibling handles cannot alias an enclosing socket. Applications should
author semantic port IDs and style the socket/halo rather than engine ID strings.

A newly registered ordinary VICT component can be authored inside a body without
a flow-specific variant or allowlist. Its ordinary placement, required context,
accessibility and overlay contracts still apply; this is not a claim that every
fullscreen or host-dependent component fits every node. Theme/ControlScope and
owned popup behavior come from the same public renderer used outside graphs.

Studio insert/add/modify operations expose canonical `classes` arrays, including
chosen drag handles and input/scroll regions. Omission preserves authored tokens;
`[]` clears them. `attributes.class` remains unavailable in the default semantic
catalog. Code/manual tooling uses the same canonical `setClasses` command.

Nested authored flow surfaces own their pan/zoom boundary. Local `nopan` and
`nowheel` controls stay guarded; guards on an enclosing node or authored wrapper
do not disable the inner empty canvas. Inner camera gestures leave enclosing and
sibling cameras and canonical graph data unchanged. The retained editor and
read-only authored canvas use the same boundary and their own public provider.

These authored surfaces also normalize a positive uniform ancestor CSS scale
into their own engine coordinate frame. Persisted viewports and node positions
remain in logical graph units; parent zoom changes retain mounted controls and
their drafts. The adapter uses the public provider-scoped zoom-limit actions and
viewport setter, and leaves the raw exported `FlowCanvas` caller policy alone.
Rotated, reflected or nonuniform frames explicitly refuse interaction. A frame
that has not received a positive layout measurement waits for layout evidence.

Each viewport owns a public Svelte Flow provider. Accepted keyboard movement is
committed through the same validated graph transaction/history as other geometry;
deferred writes are fenced against source replacement, read-only changes and
unmount. Body Arrow keys stay with controls and nested canvases after their own
handlers run. Consumed graph commands stop at their owning viewport; unhandled
Escape/Tab remain available to ordinary UI owners.

Body state changes transact against the owning node; declared body intents emit
`nodeAction` with node identity and payload, never invented execution. Content
intents `operation` (JSON public operation array), `undo` and `redo` apply only on
actual events. Other content intents emit `applicationAction`. Host code may
call `applyGraphOperations` without a viewport. Optional versioned graph commands
support explicit occurrence-owned replay receipts. All command IDs remain in
that explicit host lifecycle, without a fixed receipt ceiling or silent eviction.

Graph data, collection counts, operation batches and content have no fixed
authoring quota. Validation still checks the complete versioned shape, finite
values, unique safe identities, parameter types, named endpoints, application
port capacities, cycle policy and exact revisions. Invalid transactions remain
atomic. Default session history lasts until explicit replacement or disposal;
a consumer may explicitly choose `maxHistory`. Existing saved graph versions
and values need no migration. These changes do not promise unlimited platform
memory, stack capacity or rendering performance.

Graph persistence is an explicit host choice. In Studio, binding `graph` and
`graphChange` to the same document-owned string state opts into authored defaults
and canonical history. A scoped state name is resolved in its lexical scope;
matching a document key does not give it document ownership. Private body state
and its graph history remain local to each occurrence. A deliberate source edit
of a private scope's initial value changes the shared template default, rather
than promoting a live occurrence's state. Controlled body state delegates to its
containing graph node; selected-instance source edits fence every parent revision.
Independent applications choose their own host persistence policy. Durable graph
application data uses existing authorized application resources/actions/adapters.
No visual connection authorizes a provider, tool, action or backend workflow.

`graphAuthoringContract` exposes exact `vict.flow-authoring@1` code registrations
for model versions, read/write bindings and controlled body contracts. Ordinary
registered components inside a node need no Flow-specific adapter. Serialized
graph@1/@2 and UI document schemas remain unchanged and are never sniffed to
select a migration. Studio's new controlled nested source route supports graph@2;
legacy graph@1 controlled nested routes explicitly refuse, while direct graph@1
operations remain supported.

For source-backed history, new hosts use `GRAPH_EDITOR_HOST_V2`
(`vict.flow.editor-host@2`) and `GraphEditorHostV2.authoringFor`. The public
workspace/body contexts supply structured outer-to-inner graph-node routes with
current revisions; hosts must resolve the actual parameter/source before granting
history. Occurrence keys are opaque presentation identities and must not be parsed
to infer source authority. The host returns `source` with canonical history,
`runtime` for local history, or `refused` with a visible reason and no graph write
or undo. Invalid controlled ownership must not undo an unrelated authored change
or silently become temporary state. Hosts using the retained `GRAPH_EDITOR_HOST`
@1 keep their existing compatibility behavior; migrate explicitly to @2 for the
source-ownership admission contract. Preview and normal DocumentHost consumers
continue through the same graph renderer.

`test/composition-fixtures.ts` contains two contrasting **offline fixtures**;
mounted tests cover ordinary registered and new project controls, local intents,
state isolation, chosen operations/history and JSON roundtrip. They are not
actual-agent, painted-wire, pointer-gesture or device evidence.

## Graph compatibility and reusable mechanics

New typed composition pins `vict.flow.workspace@2`, `vict.flow.viewport@2` and
`vict.flow.port@2`. Graph `@2` families declare `parameters: {key: {type, default,
label?}}` using canonical VICT value types. A normal slider therefore binds a
`numberList` parameter directly; no graph-specific control conversion is needed.
Use `GraphWorkspaceV2`, `GraphSessionV2` and `applyGraphOperationsV2` in code hosts.
The original workspace and unpinned identities continue to mean graph `@1`.

Exact document and operation schemas are exported and discoverable in Studio
through `registry: "dataContracts"` and keys `vict.flow-graph@2` /
`vict.flow-operations@2`. Component contract pages link hash-labelled data
contracts; complete schemas have independent lossless pages. Schema shape is not
permission to execute effects, and domain/topology validation still applies.

`migrateGraphV1ToV2` is explicit. It reports constraints/presentation metadata that
cannot be represented and requires acknowledgement rather than silently dropping
them. A legacy scalar slider stays scalar; its parameter type and authored body
bindings must be deliberately changed together. No automatic migration occurs.
Command `vict.flow-command@1` remains the retained graph `@1` protocol; typed hosts
use the explicit `@2` operation/session APIs rather than passing new graphs to it.

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

This compatibility surface retains fixed historical field presentation. New node-body
composition uses the workspace identities above; legacy sources are not silently
converted to a different body architecture.


## Portable connection appearance (graph 3)

Pin `vict.flow.workspace@3`, `vict.flow.viewport@3` and `vict.flow.port@3` for
`vict.flow-graph@3`. Graph 1 and 2 retain their strict shapes and behavior. The
public `migrateGraphV2ToV3` function explicitly preserves typed parameters,
ports, positions and graph revision; `graphMigrationV2ToV3` publishes exact
component revision pairs for a host's atomic, source-owned migration. It never
searches or rewrites arbitrary JSON strings or switches existing sources silently.

Optional `edgeDefaults` and each edge's optional `appearance` accept partial
records: `route` (`bezier`, `straight`, `orthogonal`), `pattern` (`solid`, `dash`,
`dot`), `color` (hex RGB/RGBA, short or long, or `token:<semantic-color-name>`),
positive finite `width`, and `startArrow`/`endArrow` (`none`, `arrow`, `closed`).
Orthogonal uses the pinned smooth-step path; it does not promise obstacle
avoidance. Override fields inherit over canvas defaults, then theme border,
width 1.5, solid Bezier and no arrows. Arrow markers are generated per rendered
occurrence. Arbitrary CSS, paths and marker URLs are not accepted. Appearance
communicates authored semantics, never execution, live flow or completion.

`setEdgeDefaults {appearance}` replaces canvas defaults (`{}` resets them).
`setEdgeAppearance {edgeId,appearance}` replaces that edge's override record;
`clearEdgeAppearance {edgeId}` restores inheritance. They use the same atomic
revision/domain/history checks as topology and parameters. Reconnect preserves
appearance. Duplicate preserves inheritance and overrides; cross-canvas paste
materializes the source effective appearance values without replacing
destination defaults; semantic colors still resolve through the destination theme. Clipboard identity is `vict.flow-clipboard@3`.

Place `vict.flow.edge-settings@1` anywhere in workspace content with `target`
`canvas` or `selection`. Its scoped `content` supplies primitive controlled state
for the six appearance keys and props `target`, `edgeId`, `readOnly`,
`hasOverride`. Declare the keys and matching primitive types you use; normal
native controls bind `state.color`, `state.width`, etc., set their declared state
on change, and bind disabled to `prop.readOnly`. Declared `reset:void` output
resets defaults or clears the selected override. No selection, multiple edges,
any selected node or a refused/read-only workspace makes selection editing
read-only. The component supplies no toolbar, inspector layout or control form.
Stale selection identities, source revisions and renderer channels cannot write
to another edge. Whole-canvas and exceptional per-edge styling are ordinary
portable source changes through the workspace, not Studio-only CSS or an object
mutation expression.
