# Independent public edge package review

Exact source `a6c7d30522f263f39e3f724bf5c15c08f111192d`, public Flow candidate
`0e73b1181e52e0233cf4cdfd2972d00258f9b208`. Reviewer authored the separate
Studio adapter, **not** this public package; this verdict excludes that adapter.
Isolated branch `codex/independent-edge-v3-20261101`. No product source was
changed. The initial finding and RED remain preserved in `772dfe57`.

**Verdict: FAIL, pending public package repair and exact successor recheck.**

## Confirmed findings

**F-EDGE-01 — unsafe caller-controlled conversion after public admission.**
`validateGraphV3` and `parseGraphOperationsV3` shape-check caller data, then invoke
`JSON.stringify` on the caller object. Virtual Proxy `toJSON` hooks can replace
the admitted graph defaults/operation with forbidden URL appearance while both
APIs return success. The refined tests permit either explicit refusal or a benign
owned descriptor snapshot; they require no JSON-hook execution and prohibit the
substituted result. They do not demand impossible general browser Proxy detection.
The initial test's unconditional refusal expectation was overconstrained; its
historical RED is retained, and the refined invariant remains RED.

A related owned-clipboard challenge detects caller property reads. Source review
also finds that `copyGraphSelectionV3` reads original `graph.edgeDefaults` and
`graph.allowCycles` after validation instead of using its checked owned graph.
The current hostile property-read test refuses during validation but executes
the caller read; it does not claim an already-persisted unsafe clipboard. The
same owned snapshot must govern subsequent copying so fixing validation alone
cannot expose the later raw reads. Integrator/public builder accepted this scope.

This is a medium public object/data admission contract defect. It is not a
demonstrated Studio JSON transport, credential, provider or execution bypass.
All URL strings in these tests are inert data; no network request was performed.

**F-EDGE-02 — disposed scoped settings callback can still publish.**
After a public GraphWorkspaceV3/GraphEdgeSettings subtree unmounts, retaining its
canvas frame and calling `onStateChange('color', '#abc')` produces `graphChange`
and `operationResult` through the old sink. The existing graph/revision/selection
checks do not fence disposal. A real asynchronous authored control can retain a
callback; this challenge does not claim detached native DOM listeners remain.
`public-settings-unmount.log` is RED (1 failed /3 passed).

## Independent checks

Final combined public model/settings/geometry batch: **3 failed /11 passed**
across14 cases (`public-final-challenge.log`). The additional clipboard-owned-read
challenge is separately RED; its9 unselected model cases are explicitly skipped
(`public-clipboard-ownership.log`). Altogether15 distinct challenges,4 RED and
11 PASS;4 failing cases represent the2 findings above.

Passing cases independently cover public registry new identities; strict retained
graph1/graph2 JSON admission; atomic failed batch immutability; positive finite
widths including VM finite extremes and rejection of zero/negative/nonfinite;
replacement overrides and changed-default inheritance; canvas/per-edge reset and
local Undo/Redo preserving nodes/parameters; reconnect preservation/cycle refusal;
cross-canvas paste preserving effective values versus same-canvas duplicate
retaining inheritance; accessor/cycle/sparse/BigInt/nonfinite/URL/token negatives;
selection away/back, source replacement, invalid source and ambiguous selection
fences; source-host refusal and exact v3 domain validation hook; native input
writes isolated between equal edge IDs in separate public workspaces.

The SVG geometry case is explicitly a **white-box source probe** of the private
renderer, not a public export or packed-consumer claim. It mounts separate roots
with equal edge IDs for all3 routes, checks unique local marker references and
finite path/style output at `Number.MAX_VALUE` width. It passes. Other model,
registry and scoped runtime tests import normal installed public entries without
aliases. HappyDOM is a diagnostic DOM runner, not native browser/device evidence.

Historical compatibility source comparison changes only the added
`compatibility-composition-v3.json`; retained compatibility files are unchanged.
Source review confirms V3 uses the shared typed topology reducer rather than a
second graph runtime. These passing checks do not override the confirmed REDs.

Reviewer TypeScript passes before the additional clipboard challenge
(`reviewer-typecheck-final.log`). First reviewer
fixture annotations and an invented extra host `schema` property caused only
test-source type errors (`reviewer-typecheck-first.log`); corrected to the public
host interface. No product repair or assertion weakening followed from those
fixture errors. Prettier formats TS; no Svelte formatter is installed, so the
small diagnostic Svelte fixtures retain their ordinary source formatting.

## Provenance and next action

Fresh own npm install718 packages;573 unchanged dependency dist files SHA256
verified after complete package source tree equality with the recorded artifact
source. See `npm-ci.log`, `reused-dependency-artifact-hashes.json` and the initial
report for reuse limits. Flow's documented source export resolves within this
fresh review checkout. This is not a fresh dependency build or packed-consumer
proof. No root mutation, provider/browser call, owner-data change, activation,
push, main merge, publication or owner acceptance occurred.

The integrator assigned the original public builder to repair passive ownership
and disposal. Recheck the exact successor against retained independent tests.
Actual graph3 agent migration, native app interaction and final integrated
readiness remain pending and outside this bounded independent public verdict.
