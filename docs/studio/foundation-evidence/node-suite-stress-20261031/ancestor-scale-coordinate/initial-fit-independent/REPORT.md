# Independent initial-fit layout-readiness review

**QUALIFIED SOURCE/MOCK PASS** for
`44b36bf6f48fbdfd746413b34c72c525bc5531ab`, base
`efa28ff414ab62cc5e3abfed5deeea9c275edb38`. No new bounded source blocker found.
Fresh clean isolated branch `review/coordinate-initial-fit-20261031`; prior
review branches remain preserved. This review changes tests/evidence only.

**Native initial framing is not verified.** Root's retained source-efa28/sPzwYN
receipt shows supported frames and correct measured pan/wheel, yet all six inner
cards initially clipped outside their views. A copy is `native-observation.json`.
Those are integrator-native observations reviewed as records, not browser actions
performed by this reviewer. The stale-provider-dimension hypothesis is plausible
and independently challengeable in controlled hooks, not proved as the exclusive
native cause. No activation, artifact association, whole camera/suite acceptance
or milestone/Stage9 closure is awarded.

## Source assessment

The measured frame publishes expected engine width/height as fresh logical CSS
dimensions times measured ancestor scale. An unsupported frame reports zero
expected extent. FlowNavigation reads documented public own-provider store
width/height and waits for positive matching dimensions before automatic fit.
The one-CSS-pixel allowance corresponds to integer client dimensions; it does not
relax the coordinate-frame uniformity/rotation/reflection guard. No private
engine/context, store geometry write, event rewrite, polling or replacement
fitter was introduced. The existing public fitView remains the fitter.

Initial readiness includes the coordinate/layout signature and complete measured
node identities. A pending automatic fit may settle only while its captured
layout is current and its component alive. If a replacement layout is already
ready when the old promise finishes, in-flight state release lets the new fit run;
if dimensions have not arrived it waits. A failed fit does not retry on promise
settlement alone. Once initial fit settles, later ancestor changes do not refit,
preserving user camera navigation and ordinary input identity/focus. Existing
restored-camera and explicit-Fit behavior remain unchanged. No public serialized
schema, descriptor identity, source/history or connection authority changes here.

The source uses only READS of public provider layout fields, documented at
[SvelteFlowStore](https://svelteflow.dev/api-reference/types/svelte-flow-store).
Pinned source confirms fitView consumes that owning store geometry. Merely using
those APIs is not painted-browser fit proof.

## Independent tests and scope

New `navigation-layout-independent.svelte.test.ts` contributes three challenges:

- A replacement frame's matching dimensions arrive **before** the preceding fit
  resolves. The stale success cannot settle; exactly one replacement fit runs and
  settles once. The same input remains focused with its manual unsaved value.
  Further layout change after settlement does not refit.
- A false fit and a rejected fit do not spin on unchanged readiness. A new frame
  with stale provider dimensions does not retry; matching dimensions permit one
  successful recovery. These use the public-hook mock to control timing.

Focused command from repository root:

```
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/navigation-layout-independent.svelte.test.ts packages/ui-flow-svelte/test/navigation-layout.svelte.test.ts packages/ui-flow-svelte/test/navigation.svelte.test.ts packages/ui-flow-svelte/test/coordinate-coherent-independent.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts
```

**31/31 PASS in six files, exit0**, `focused-green.log`. The additional historical
`coordinate-coherent-independent` filter is absent from this base and is **not**
counted as run. Actual31 are own3, builder layout3, existing navigation5, coordinate
algebra/handles/unsupported/lifecycle12, pinned-engine mounted1 and nested-camera7.
Builder layout tests cover stale737×378 versus237×122, delayed new dimensions,
initial-once/focus and teardown before fit completion. Existing navigation tests
cover restored/empty graphs, full-node measurement, failure recovery and explicit
Fit. The real pinned-engine mounted test retains pan/node drag/wheel anchor,
depth3, parent zoom/camera/focus and provider-sibling isolation. Other geometry
tests use controlled HappyDOM rectangles; mock navigation tests are not actual
browser layout. No painted-card, port path or clipping success is inferred.

New independent test ESLint exits0 (`lint.log`); scoped whitespace checks pass.
Existing Svelte warnings remain in the run. Builder57/type0errors/5warnings are
retained at their own scope, not counted as additional unique independent cases.
Earlier native clipping and builder2RED remain intact.

## Separate scopes and next step

This candidate changes FlowNavigation callers (composed workspace and retained
editor). Read-only authored FlowCanvas still uses the prior built-in fit path;
its analogous race remains outside this verdict pending the builder's separate
bounded reproduction/repair. The unchanged in-flight supported→unsupported
gesture concern is not newly certified. These limits must not be hidden by a
blanket whole-camera PASS.

Integrate this scoped source evidence, independently review any separate readonly
candidate, then freeze/repack the combined bytes and run the authorized native
initial visibility/clipping/fit, exact pan/wheel, ports/connections, parent zoom,
focus/source/history and save/export/reopen checks. This reviewer did not touch
the root worktree/dist, browser, app data, provider/account/security settings or
remote. No push/publication or owner acceptance follows from the source pass.
