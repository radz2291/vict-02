# Structure completion candidate

2026-10-24. Authorized by the owner's completion-round attachment. Baseline
`d47af9f869fa506943e04cd4a3fe921f5830bcb2`, isolated branch
`codex/studio-cycle-1-3-completion`; root manager owns candidate commits,
independent verification and delivery. This builder report is not a gate verdict.

## Delivered behavior

Structure starts with authored containment rather than permanent catalog/state
hubs. Larger containers collapse to cards with descendant counts. Search reveals
matching source with its ancestor path; focus limits the view to the selected
subtree or a selected state's actual readers/writers. Optional state/action and
definition/template layers expose the corresponding declared relationships.
Inspection shows exact property/output paths and values, without inferring live
values, execution or missing-binding defects.

Cards use the shared editor naming vocabulary, distinct kinds, kind-specific
colors and meaningful accessible labels. IDs remain available in inspection and
selection options. Human selection and Structure selection share the canonical
occurrence. Navigation opens Design, Layers, the selected property/binding editor,
Data or Actions. The disposable Studio showcase uses the same callbacks and
source/history adapter; its links are functional.

Read-only relationship inspection is separate from the explicit containment-move
mode. Only authored content and compatible container kinds expose edit handles;
the upstream connection validator calls the existing canonical guard before
acceptance. Named content/destination controls offer the same operation to
keyboard users and list only valid destinations for the selected content.
Stale/cross-document/draft/root/cycle/ambiguous/placement guards remain in the
existing canonical move adapter, with shared Undo/Redo/Save/reopen tests retained.

Structure remains mounted while its view is hidden. The graph retains viewport,
manual positions, filtering and inspection during Design/Interact switches.
Per-document view snapshots retain useful view settings during screen switches.
Returning to the same underlying Interact mode no longer calls resetRuntime.
Switching actual preview modes still performs the existing reset.

## Package boundary and layout decision

The reusable ui-flow package now owns original SourceNode, RoutedEdge,
FlowNavigation, measured layout orchestration and LayoutFence helpers. Studio
owns source projection, source facts, grouping and canonical callbacks. The
ui-editor package adds compositionNames, a batched presentation helper with the
same labels/duplicate ordinals as compositionName; it changes no authoring
semantics. Provenance/licenses are recorded in ui-flow README/UPSTREAM and the
root lockfile.

Both real engines were compared on deterministic 12, 89 and 500 authored-node
fixtures, both orientations, supplied variable measured sizes, zero node overlaps,
finite positions, source digest invariance and small-fixture deterministic
repetition. See `layout-comparison.json` and its generating
`apps/studio/tests/structure-completion.test.ts`.

The initial unbounded ELK observation is deliberately preserved in
`layout-comparison-initial-unbounded-elk.json`: 500 expanded nodes took about
48.5–64.6 seconds, versus Dagre 0.59–0.64 seconds in that run. This disqualifies
unrestricted ELK as the default. The adapter now enforces ELK only through 120
visible nodes, with fixed directional ports and orthogonal routed points. Above
120 it selects Dagre automatically and returns/displays the actual engine and
reason. There is no user-facing bypass to launch the slow large ELK path.

Final loaded-host measurements: ELK 89-node layouts about 0.63–0.90 seconds;
500-node Dagre fallback about 0.67–1.12 seconds after warm-up. First Dagre
500-node runs were 1.3–1.7 seconds. Projection of 500 source nodes improved from
about 1.68 seconds to 0.83 seconds with batched naming/ownership checks. These
are synthetic host observations, not browser performance budgets or guarantees.
The 500-node expanded graph is naturally very tall/wide: collapse, search and
focus are the readability strategy, rather than scaling text down to 10%.

Actual upstream measured width/height takes precedence over initial dimensions.
Handles follow the selected right/down orientation. ELK results carry port-aligned
routes; manually moved endpoints fall back to smooth-step drawing until Arrange.
Every document/revision/filter/geometry/layout request invalidates older layout
tickets; node dragging invalidates pending work. Layout remains presentation
data and never enters canonical source or source Undo.

Grouping is explicitly source-subtree collapse/focus. This completion does not
claim draggable native parentId compound subflow frames or arbitrary workflow
connections. Those would require further product design. Dagre's external-group
limitations are avoided because the presented graph has no native compound
parents. ELK handles the optional shared reference edges in the smaller focused
view; source rules still govern every move.

Official sources inspected:

- https://svelteflow.dev/examples/layout/dagre
- https://svelteflow.dev/examples/layout/elkjs
- https://svelteflow.dev/examples/layout/horizontal-flow
- https://svelteflow.dev/learn/layouting/sub-flows

## Checks and retained observations

- ui-flow package svelte-check: zero errors, zero warnings after repairs.
- ui-editor TypeScript build: passed after batched naming export.
- Studio designer svelte-check: zero errors, six existing warnings in the shared
  renderer/state panel in the observed run; final integration check belongs to
  the root manager.
- Existing seven structure semantic tests passed, including canonical shared
  history, source identity and move refusals.
- Five completion tests passed: containment/layers, exact binding locations,
  collapse/search, stale layout tickets, real engine comparisons and naming
  parity (some assertions share a test).
- Initial DOM test expected a minimap for a one-node screen and failed after
  intentional minimap suppression below 13 visible items. Its expectation was
  updated to the new explicit small-graph design; no product behavior was
  changed to satisfy the old expectation. Final rerun is recorded by the root
  verification output.
- Initial ui-flow check failed on ELK CommonJS/NodeNext constructor typing and
  two consequent implicit-any errors. Explicit public ELK types repaired it.
  Root's initial build log retains that observation.
- A later DOM navigation run produced a reactive error stack from fitView's
  writes to bound nodes. The navigation effect had inadvertently tracked Flow
  store reads. The call now runs inside untrack, so only the explicit navigation
  request triggers it. That run was interrupted rather than left consuming
  resources; the focused DOM rerun is required evidence for the repair.
- The new keyboard-control test then exposed a disabled Move button after
  selecting valid content and destination. Both native select values and the
  valid target option list were correct in happy-dom, while the dynamically
  changing select bindings did not update the action state. The controls now
  use explicit change handlers reading currentTarget.value, consistent with
  the existing inspection selector, and changing content clears the previous
  destination. This is a retained DOM observation, not proof of the original
  behavior in every browser.

New DOM tests exercise state-to-Data navigation without a fake rendered
selection and the keyboard move controls with filtered destinations. Final
focused rerun passed all four DOM tests (exit 0, 44.83 seconds total including
transform, 586 ms assertions). This closes the two new DOM observations above
within that fixture scope. The combined source suite had already passed seven
existing plus five completion tests; the final DOM run is separate and explicitly
follows the navigation and select-handler repairs.

## Browser acceptance still required

Unit/DOM fixtures do not establish real viewport geometry, browser responsive
layout, route endpoint alignment, keyboard focus journeys or preview-session
retention. Independent review should exercise the isolated review instance:

1. Interact with an independently wired field, open Structure, inspect state,
   return to Interact and confirm the entered value/session remains.
2. Search a collapsed descendant, focus it, inspect checked versus checkedChange
   paths, navigate to Data and return to the same graph viewport.
3. Arrange and change orientation; inspect measured card bounds and routed
   edges. Pan/zoom/drag a card, switch views and confirm retained positions.
4. Perform an allowed keyboard move, Undo/Redo and Save/reopen; attempt a stale
   or placement-incompatible move and confirm refusal.
5. Exercise narrow/mobile widths and keyboard traversal. The native source
   selector is an inspect fallback; search reduces the technical option list.

No owner tab, owner server, saved screen, conversation or provider configuration
was touched by this subtask. No independent PASS or owner acceptance is claimed.
