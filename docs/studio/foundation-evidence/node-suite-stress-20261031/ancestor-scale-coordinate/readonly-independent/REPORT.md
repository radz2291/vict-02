# Independent authored read-only canvas fit review

**QUALIFIED SOURCE/FIXTURE PASS** for exact candidate
`84aae0f68c2dc3a14ec634e443807dea5238bc30`, child of
`44b36bf6f48fbdfd746413b34c72c525bc5531ab`. No bounded source blocker found.
**Native initial framing, packed artifact/activation association and whole-suite
acceptance remain unawarded.**

Review branch `review/readonly-initial-fit-20261031` starts directly at84. The
prior independent initial-fit evidence was imported as8a660560, with no production
changes; the reviewed production tree remains exactly84. Earlier branches,
builder/native failures and scoped independent verdicts remain preserved.

## Source and fit-policy assessment

The actual authored `vict.flow.canvas@1` disables only its upstream automatic
fit and delegates its initial fit to the shared own-provider readiness helper.
The helper retains workspace/editor defaults .15..1.1/padding .2 while accepting
internal initial-fit options. The read-only canvas supplies its exact prior
logical minZoom .5/maxZoom2/padding .1, scaled into engine units. The pinned store
defaults and `@xyflow/system` public fitter confirm those original values. No new
public descriptor, saved schema, migration or capability identity is introduced.

The common gate waits for the engine's actual observed dimensions and all current
declared nodes to be measured. The prior independent pending-layout/teardown
fences remain in use. After successful initial fit, later ancestor zoom does not
trigger another fit, retaining logical camera and user navigation.

Read-only source flags remain `nodesDraggable=false`, `nodesConnectable=false`,
per-node draggable/connectable/deletable false and `deleteKey=null`. Selection,
camera controls and optional minimap stay presentation behavior. There is no
graph/source writer or source-host bypass. The raw top-level exported
`packages/ui-flow-svelte/src/FlowCanvas.svelte` has an empty diff from the base.
No private engine/context, geometry-store writes, polling or event mutation was
added. Scope is the registered authored canvas path, not every historical raw
consumer.

## Independent challenges and completed execution

New `readonly-fit-options-independent.svelte.test.ts` and its diagnostic host
provide two independent cases: read-only original options and unchanged
workspace/editor defaults. Both refuse to fit stale737×380 provider dimensions,
fit once after237×122 dimensions arrive, pass exact scaled min/max and unchanged
padding to the public fitter, and do not refit after subsequent parent zoom.
These cases use public-hook mocks to control layout timing; they are not browser
geometry observations.

The builder's actual registered DocumentHost/Canvas@1/Node@1 pinned-engine test
was independently rerun unchanged. It compiles ordinary canonical source,
measures three cards with controlled HappyDOM layout/RO, checks the resulting
camera against public `getViewportForBounds` with .5..2/.1 policy, verifies all
three cards inside the viewport, pans +30/+10, changes parent scale while retaining
logical camera and the same focused ordinary input/unsaved value, and records
zero source writes. Source inspection separately confirms editing stays disabled.

Completed command at exact84 production bytes:

```
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/readonly-fit-options-independent.svelte.test.ts packages/ui-flow-svelte/test/readonly-initial-layout.svelte.test.ts packages/ui-flow-svelte/test/navigation-layout-independent.svelte.test.ts packages/ui-flow-svelte/test/navigation-layout.svelte.test.ts packages/ui-flow-svelte/test/navigation.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts
```

**22/22 PASS, seven files, exit0**, `focused-green.log`: own options2, real
registered readonly1, earlier independent async3, builder layout3, existing
navigation5, pinned engine1 and nested-camera7. The earlier independent async
tests cover replacement dimensions arriving before old fit settlement and
false/rejected-fit recovery without promise loops. Existing cases cover initial
once, restored cameras, pending-fit teardown, source isolation, parent zoom and
focus/provider boundaries. These overlapping prior suites are not counted again
as separate unique totals. Existing Svelte warnings remain visible.

New independent test ESLint completed exit0 (`lint.log`). Builder58/type0errors/
5inherited warnings remain separate builder evidence. No new broad test run was
performed during evidence sealing.

## Baseline, disk interruption and remaining gate

The builder independently retained the old read-only source failure: after
737→237 resize, projected right edge631.94 exceeded viewport237. This reviewer
inspected the old/new source and reran the repaired actual-path test. An optional
separate old-source rerun was attempted but **did not execute**: disk full blocked
both Git index creation and log creation before branch switch/restore. It is not
counted as another baseline reproduction or a candidate failure.

The completed green output and new tests remained intact. A later attempted
removal of this checkout's regenerated `.svelte-kit` cache was rejected before
execution by automatic approval/policy review as "blocked by policy". No cache,
source, evidence, root build or owner data was removed. Root separately requested
space recovery. Once more than5MB was available, only the already-completed logs,
tests and this report were sealed; no test/dependency/baseline work resumed.

This closes the separately demonstrated authored read-only readiness source gap
at its controlled-layout boundary. It does not turn the native six-card clipping
failure into a pass. Freeze/repack the combined exact source, then verify actual
initial fit/clipping, pan/wheel, node/port/connection geometry, controls/minimap,
parent zoom, focus/source/history and saved/portable replay in the native app.
The earlier unsupported-transition in-flight gesture concern is unchanged and
unproved, not silently certified. No root worktree/dist, browser, provider/account/
security change, activation, push/publication, owner acceptance, milestone or
Stage9 closure occurred in this review.
