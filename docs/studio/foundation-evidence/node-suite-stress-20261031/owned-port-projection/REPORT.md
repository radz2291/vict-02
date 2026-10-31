# Owned handle projection and measured socket repair — builder candidate

Exact base `bac786840d7519c041638e1b9d239d54efdf56f5`, isolated branch
`codex/flow-owned-port-projection-20261101`.

Root's native actual-r1.r13 evidence `28-native-edge-socket-endpoints.json`
reported two distinct defects: ordinary row endpoints were 14 logical pixels
from the visible socket center (a 9-pixel gap beyond its radius5), and four
outer edges attached to same-ID inner handles at substantially wrong positions.
Canonical graph/port/value source remained unchanged. Native screenshots and
observations remain retained by root; this builder did not operate that browser.

## Reproduction and cause

The actual public pinned `@xyflow/system@0.0.83` getHandleBounds queries every
descendant `.source`/`.target` below a node. It does not exclude nested nodes or
other providers. Its edge-position lookup chooses the first matching handle ID.
A real registered fixture with three outer nodes, each containing another graph
and the same semantic `i/o` port IDs, reproduced **2/2 RED** for both bare ports
and labeled rows: the public measurement contained two matching IDs for an outer
port instead of one. `owned-port-baseline-red.log` is preserved.

The public endpoint calculation attaches to the outward boundary of the measured
handle. A transparent 28px measured box therefore places the endpoint14 pixels
from center, beyond the visible10px dot. The pinned public getHandlePosition
regression proves the old9-pixel gap and new zero gap, for both left and right.
This is contact with the dot boundary (center +/-5), not a claim that the wire
endpoint equals the dot center.

## Bounded source repair

- New internal map-free projection encodes owning viewport, node and semantic
  port into selector-safe opaque renderer IDs. It supports punctuation/Unicode
  including lone UTF-16 surrogates without parsing an opaque occurrence key.
  Neither graph IDs/JSON nor body `props.id`, semantic `data-port`/`data-node-port`,
  graph operations or saved revisions change.
- Composed viewport edges and bare/row handles use that same projection.
  Candidate connections translate back only by comparing with actual currently
  owned node ports in the required output/input direction. Raw semantic engine
  IDs, other viewport/node IDs, missing/removed ports and foreign nested IDs are
  refused before existing connection validation/gesture/history admission.
  No opaque ID is decoded or promoted into canonical source.
- Retained GraphSurface/RichGraphNode and authored read-only canvas/node handles
  and edges receive their own projections too. Existing model/session/history,
  source fences and domain validation remain authoritative. GraphBodyContext has
  an optional additive projection method; older external context hosts retain
  their previous fallback and caller-owned policy.
- Row Handle measurement is10px, matching its visible dot. A separate28px CSS
  pseudo-element pointer halo inherits the pinned handle's pointer-events policy,
  so readonly/connection guards remain effective. It does not enter descendant
  handle measurement or enlarge getBoundingClientRect. Guidance/README now state
  this distinction. The five style parts and descriptor/compatibility identities
  are unchanged.
- Audited SourceNode has a fixed text/button body without an authored nested
  content slot; it is not changed. The raw exported top-level FlowCanvas and
  upstream engine are unchanged. No global store, private engine patch, native
  event rewrite, new runtime/gesture engine, polling or artificial quota exists.

## Exact tests

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/handle-projection.svelte.test.ts packages/ui-flow-svelte/test/port-owner-projection.svelte.test.ts packages/ui-flow-svelte/test/connection-gesture.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/port-row.svelte.test.ts packages/ui-flow-svelte/test/port-row-independent.svelte.test.ts packages/ui-flow-svelte/test/edge-settings.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts packages/ui-flow-svelte/test/nested-camera.svelte.test.ts packages/ui-flow-svelte/test/coordinate-frame-mounted.svelte.test.ts packages/ui-flow-svelte/test/readonly-initial-layout.svelte.test.ts packages/ui-flow-svelte/test/navigation-layout.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/src/handle-projection.ts packages/ui-flow-svelte/src/composition/context.ts packages/ui-flow-svelte/src/composition/knowledge.ts packages/ui-flow-svelte/test/handle-projection.svelte.test.ts packages/ui-flow-svelte/test/port-owner-projection.svelte.test.ts packages/ui-flow-svelte/test/connection-gesture.svelte.test.ts
git diff --check
```

Final **75/75 PASS**, Svelte **0 errors / 5 inherited warnings**, changed TS lint
and diff check exit0. Final logs `owned-port-final.log`,
`owned-port-final-types.log`, `owned-port-final-lint.log` are retained here.

New checks cover injective IDs; foreign viewport/node, raw, wrong direction and
removed-port refusal; exact canonical reconnect/history roundtrip in graph1/2;
and actual registered three-node nested measurement across graph1/2/3 bare/row,
retained editor and read-only canvas. All measured owning sockets resolve once,
all rendered physical IDs are unique, source objects remain unchanged and mount
emits no source writes. Compiled actual row CSS is supplied to HappyDOM because
the test Vite transform omits stylesheet injection; it confirms10px handle/dot
and separate28px inherited-pointer halo. An earlier retained test attempt expected
CSS computed width without injecting the stylesheet and saw an empty string;
that fixture issue is preserved as `owned-port-projection-second.log`.

Existing typed fields, labels, duplicate anchors, readonly, edge appearance,
source ownership, reconnect capacity/type/cycle, history, initial fit, pan/wheel,
parent zoom/focus and repeated-canvas regression checks remain green.

## Remaining gate

This is builder evidence, not an independent verdict or native pass. A fresh
installed artifact must verify actual outer/inner edge endpoints versus the
owning semantic sockets (matching their new opaque handle IDs), no visible gap,
actual pointer starts/drops within the28px halo, readonly/duplicate refusal,
reconnect and source/history preservation, nested zoom and camera behavior.
Application clipping/explicit part overrides can affect the halo and must be
checked in the actual authored app. Existing earlier installed leaf proof does
not qualify these newly changed bytes. No root worktree/dist, browser, live
Studio app, provider, activation, push or publication was changed.
