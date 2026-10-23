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
