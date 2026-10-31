# Read-only authored canvas initial fit — reproduced and repaired

Base: `44b36bf6f48fbdfd746413b34c72c525bc5531ab`.
Isolated branch: `codex/flow-readonly-initial-fit-20261031`.

The previously qualified read-only path risk is now reproduced. The test compiles
an ordinary UiDocument and mounts DocumentHost with the actual registered
`vict.flow.canvas@1` and `vict.flow.node@1` implementations and pinned XYFlow
engine. It supplies controlled layout getters and ResizeObserver notifications
to model initial stale wrapper dimensions 737x380 becoming 237x122 under scale
0.321269. The existing built-in fit ran against the preceding size: after the
new dimensions arrived the rightmost card's projected right edge remained
631.94058, outside the 237-wide viewport. Baseline RED is retained in
`readonly-fit-baseline-second.log` (one failure, no unhandled errors).

The narrow repair disables that component's upstream automatic fit and uses the
shared initial layout-readiness gate. FlowNavigation gains internal initial-fit
options with unchanged defaults for workspace/editor. The read-only canvas
passes its exact prior logical minZoom .5, maxZoom 2 and padding .1, verified
against the pinned public fitter defaults and by comparison with the actual
public getViewportForBounds result. It waits for all currently declared nodes
to be measured. Initial fit settles once; no subsequent ancestor zoom refit is
introduced. There is no new public descriptor/identity, graph authority,
provider, saved schema or source-host change. The raw top-level exported
`src/FlowCanvas.svelte` remains unchanged.

## Exact validation

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/readonly-initial-layout.svelte.test.ts packages/ui-flow-svelte/test/navigation.svelte.test.ts packages/ui-flow-svelte/test/navigation-layout.svelte.test.ts packages/ui-flow-svelte/test/coordinate-fractional-native.svelte.test.ts packages/ui-flow-svelte/test/coordinate-independent-observer.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/test/readonly-initial-layout.svelte.test.ts
git diff --check
```

Exact final checks: **58/58 PASS**, Svelte **0 errors / 5 inherited warnings**;
own test lint and diff check exit 0. Final logs `readonly-fit-final58.log`,
`readonly-fit-types.log`, `readonly-fit-lint.log` retained. The real pinned
read-only test confirms all three cards fit after engine resize, matches the
original public fitter options, preserves pan delta +30/+10, then changes parent
scale from .321269 to .5 and confirms logical camera preservation, the same
focused ordinary input/unsaved value, and zero source writes. Existing shared
initial-once/pending-fit/teardown, two-canvas isolation, readonly camera and
gesture regressions remain green.

The first fixture-development failure omitted contentRect from a synthetic RO
entry required by XYFlow's own public engine resize observer. It is retained
separately as `readonly-fit-baseline-first.log`; that exception is not a product
finding. Corrected entries include the public observation dimensions. All
measurements here are controlled HappyDOM layout evidence, not a native browser
or installed-artifact claim. Test configuration uses the existing UI source alias.

Independent review and fresh installed native preview must still verify combined
initial framing, clipping, native gesture geometry, source/history, controls and
final artifact association. The earlier native failure remains authoritative
until that recheck. This is builder evidence, not an independent verdict. No
root worktree/dist, browser, actual app, provider, activation, push or publication
was changed.
