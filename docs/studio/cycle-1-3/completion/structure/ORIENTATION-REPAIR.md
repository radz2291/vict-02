# Browser finding: cached handle bounds after direction changes

Root's actual browser review on candidate
`990742db1dd143775c83997f52a69c8a749284b9` found that changing DOWN → RIGHT
updated the visible custom handle sides to left/right while edge paths still
used the old bottom/top centers. The retained browser screenshot and root DOM
measurements are the original failure evidence; see root's browser record.
This is a product defect, not a synthetic dimension or fixture-oracle issue.

Svelte Flow 1.7.0's public useUpdateNodeInternals hook explicitly requires a
refresh when a custom handle's position changes. SourceNode previously changed
the Handle position prop, but that does not resize the card; ResizeObserver
therefore did not necessarily update Flow's cached handle bounds. RoutedEdge
correctly refused a now-mismatched ELK route and then received stale coordinates
for its smooth-step fallback, causing the visible wrong-side loops.

The minimal repair is in SourceNode only. It observes node ID and horizontal
versus vertical direction, waits for Svelte's DOM commit, then invokes the
public useUpdateNodeInternals(id) hook. Cleanup cancels a superseded pending
tick; the call is untracked to avoid a Flow-store feedback loop. Selection-only
changes do not force geometry refresh. No canonical source, layout engine,
Studio transport or server behavior changes.

The mounted regression uses controlled Handle stand-ins and spies at the public
library hook boundary. It verifies that refresh observes the committed actual
Handle DOM sides for DOWN → RIGHT → DOWN, with the correct node ID, and that a
selection-only update does not refresh again. It would fail the previous
SourceNode because no refresh was issued. It passed: one test, 66 ms assertions,
6.73 seconds including transform. This isolates the integration mechanism; it
does not claim to reproduce browser layout in happy-dom.

The ui-flow package svelte-check passed with zero errors and zero warnings.
The existing four mounted Structure journeys plus this regression passed as the
affected DOM suite: 5/5 tests, exit 0, 29.41 seconds including transform and
490 ms total assertions. Only the existing shared renderer/state-panel warnings
appeared. git diff --check also passed for the scoped changes.
Root must then rebuild the production client and
recheck actual DOM edge start/end points against current handle centers in both
directions, including a round trip. Browser geometry remains unverified for
this repaired candidate until that observation is recorded. The original
failure must remain alongside the new result.
