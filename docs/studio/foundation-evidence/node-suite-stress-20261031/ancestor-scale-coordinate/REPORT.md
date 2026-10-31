# Ancestor-scale coordinate-frame builder candidate

Base: `f328ee17aa01e49f3f2a34ed14f0f5e709cc0211`.
Branch: `codex/flow-ancestor-scale-20261031`.

Status: focused offline builder checks PASS. This agent previously verified the
gesture-admission repair but became the explicitly authorized builder for this
new geometry repair. This report is **not an independent verdict**. Actual
packed native geometry, independent review and integrated acceptance remain HELD.
No root worktree, running app, browser, provider, activation or remote was changed.

## Retained failure and cause

Root's `22-native-transformed-geometry-failure.json` measured outer scale
0.348405. A pointer delta (30,10) moved the inner rendered node only
(10.452,3.484); wheel focal error was approximately (49.415,70.227) pixels.
Gesture ownership alone therefore did not fix geometry.

Pinned dependencies are `@xyflow/svelte@1.7.0` and `@xyflow/system@0.0.83`.
Their HTML pointer conversion subtracts the root rectangle but does not invert
an ancestor CSS transform. The engine must receive a root in screen CSS-pixel
units. For positive uniform ancestor scale s, this candidate expands the engine
root's CSS dimensions by s and counter-scales that root by 1/s, then supplies
viewport `(s*x,s*y,s*z)`. The existing graph mapping remains
`screen = origin + s*(logicalPan + logicalZoom*world)`. Bound viewports convert
back to logical units; source positions and camera policy are not rescaled.

The first mounted implementation relying only on the public viewport binding
failed (49.5 rather than 30 pixel pan). The binding updates rendered/store state
but this pin also needs the public viewport setter to synchronize native gesture
state. Dynamic min/max props likewise do not update the native zoom extent in
this pin. The candidate uses documented **own-provider** `useStore` actions
`setMinZoom` and `setMaxZoom`, plus `useSvelteFlow().setViewport`, in a child
inside each owning SvelteFlow. No private engine fields/context keys, global
stores, native-event mutation, keyed remount, polling, new finite backstop or
replacement gesture engine is used.

Public API references:

- [useStore](https://svelteflow.dev/api-reference/hooks/use-store)
- [SvelteFlowStore actions](https://svelteflow.dev/api-reference/types/svelte-flow-store)
- [useSvelteFlow viewport methods](https://svelteflow.dev/api-reference/hooks/use-svelte-flow)

## Scope and lifecycle

The frame wraps the composed viewport, retained graph editor and read-only
authored canvas. The top-level raw `src/FlowCanvas.svelte` is unchanged. Existing
logical zoom ranges are retained and converted to engine units; FlowNavigation
fit ranges are converted too. Root ResizeObserver and ancestor style/class
MutationObservers update the frame without remounting controls. Observers are
owned and disconnected on teardown; queued callbacks check liveness. Parent
unit changes cancel an in-flight canonical node drag before it can commit stale
units. Rotation, reflection and nonuniform measured frames explicitly become
inert with a diagnostic. Hidden/zero-size frames retain their initial frame
until positive layout evidence is available.

## Exact checks

Commands run from the isolated worktree:

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/src/flow-coordinate-frame.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/flow-coordinate-frame.svelte.test.ts
```

Final results: **43/43 tests**, Svelte **0 errors / 5 inherited warnings**,
changed TypeScript ESLint exit 0. Logs `scale-final-focused-second.log`,
`scale-final-types.log`, `scale-final-lint.log` are retained here.

The 31 existing mounted composition/authoring/gesture checks remain green.
Eleven coordinate checks cover scales 1, 0.348405, 0.5, depth2/depth3 products,
and 2; logical roundtrip; actual public pointer and handle measurements;
wheel-anchor algebra; fit/min/max conversion; parent changes; observer teardown;
and rotated/nonuniform/reflected refusal. The actual pinned mounted D3 test
covers screen pan and node drag, wheel focal anchor, logical max2/min0.1 clamps
and recovery, depth3 ancestry, parent zoom retaining logical camera, the same
focused input and its unsaved value, and a separately mounted own-provider
sibling remaining unchanged.

The mounted test supplies explicit frame rectangles/CSS dimensions because
HappyDOM does not perform layout. Node auto-pan is disabled **in that fixture
only**, with zero drag threshold, to isolate coordinate conversion from its
zero-layout edge auto-pan. Production defaults are unchanged. Initial retained
probe failures include fixture compilation/CSS setup, bind-only engine sync,
zero-layout node auto-pan and HappyDOM WheelEvent ignoring constructor pointer
coordinates (the corrected test defines coordinates on synthetic events only).
Two numeric expectations were corrected: floating-point roundtrip tolerance,
and the upstream fitter's physical-pixel padding flooring (at most 1 pixel
translation and 2 pixels extent difference in the retained fixture).

## Remaining gates

A fresh packed installed public consumer must measure actual node bounding-box
delta, cursor-anchored wheel zoom, node drag and port/edge geometry at the
reported 0.348405 ancestor scale and at changing parent zoom/depth2/depth3.
Native fit/clamp, focused controls, read-only canvas controls/minimap and
source/history preservation need association to the final integrated artifact.
The controlled-layout tests above do not establish real browser layout,
connection/reconnection gestures, painted wires, device behavior or actual-agent
completion. Keep all earlier native failures and the complete camera verdict
HELD until these checks pass.
