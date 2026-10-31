# Independent ancestor-coordinate review

Reviewed builder `0225c6678d681972e49b98d4edc66ace13562368` integrated at exact
`b865c8ec7936a5d8932f1c487022f86d867929c3`. Isolated clean start on
`review/ancestor-coordinate-20261031` in `vict-realignment-independent-20261030`;
origin/main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. The integrated
GraphViewport edge-v3 appearance projection is preserved, not reviewed as a whole
protocol verdict. Current owner local-only authority supersedes old push rules.

**Initial verdict: FAIL / bounded repair required for G1.** The existing43 tests
pass independently. A new two-case observer challenge passes teardown/sibling
isolation and fails computed responsive scale invalidation. Native packed geometry
and whole integrated candidate readiness remain unawarded in either case.

## Source and dependency audit

The coordinate conjugation is mathematically consistent for measured positive
uniform scale: engine `(sx,sy,sz)` and root counter-scale preserve source graph
units and screen-pointer units. The wrappers cover composed GraphViewport,
retained GraphSurface and authored read-only canvas. The raw legacy FlowCanvas
remains outside this change. Logical camera, source node coordinates and zoom
policies stay distinct. FlowNavigation converts fit limits to engine units.

The repair uses public provider-local `useStore().setMinZoom/setMaxZoom` and
`useSvelteFlow().setViewport`. Official documentation lists these hooks/actions:
[store](https://svelteflow.dev/api-reference/types/svelte-flow-store),
[viewport](https://svelteflow.dev/api-reference/hooks/use-svelte-flow).
Installed pinned source also confirms those public exports. This review found no
private panZoom access, native-event mutation or global store introduced by the
repair. Dependency presence alone is not used as geometry proof.

Existing mounted pinned-engine tests independently pass pointer pan/drag, wheel
anchor, logical clamp/recovery, depth3 products, changed parent attribute scaling,
retained focused input identity/value and sibling own-provider isolation. Handle
measurement and source-coordinate algebra have fixture coverage. Unsupported
rotation/reflection/nonuniform initial frames explicitly become inert. These are
controlled-layout tests: HappyDOM rectangle/computed-size mocks do not prove
painted wires, browser layout or native connection/reconnection geometry.

## G1 — responsive computed ancestor transforms leave stale units

**P2, reproduced.** `observeFlowCoordinateFrame()` observes root content-box size
and ancestor style/class attribute mutation only. A media-query or viewport-unit
ancestor transform can change its computed positive uniform scale on a window
resize without changing those attributes or the frame's untransformed content
box. CSS transforms do not resize that content box. Therefore no current trigger
remeasures the frame, and the engine continues using the preceding normalization.

Independent `coordinate-independent-observer.svelte.test.ts` supplies the
layout-free environment's computed transform and rectangle, starts at scale0.5,
changes both computed evidence to0.25 and dispatches ordinary window resize.
The last published state remains `{scale:0.5,supported:true}` instead of0.25.
The sibling/queued-after-teardown case passes. This is an executable observer
invalidation failure with controlled layout, not a claimed native observation.

Minimal bounded repair is to schedule measurement on the frame owner's window
resize (and clean up that listener on teardown), without polling/global stores or
changing source/gesture authority. The in-flight unsupported-frame transition
also merits care: inert prevents new interaction, while existing window-bound
gestures require proper invalidation. This latter observation is a source-review
concern, not a second independently reproduced source-commit failure here.

## Exact runs and next boundary

From repository root:

```
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
```

43/43 PASS, five files, exit0: `independent-baseline.log`.

```
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts
```

1PASS/1FAIL, exit1: `independent-observer-red.log`. Preserve both results and all
earlier builder/native failures. No production source was repaired by this
verifier; test and evidence are the only changes. No browser/root-worktree/build/
activation/provider/security/remote changes occurred. Reverify the exact bounded
repair, then associate fresh packed native geometry and source/history before
awarding the camera repair. No whole-candidate/protocol acceptance, milestone or
Stage9 closure follows from this scoped report.
