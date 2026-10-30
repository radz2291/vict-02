# Source Redo echo invalidation — independent review

**QUALIFIED OFFLINE PASS** for exact candidate
`ab3296e6503a63b2587ed36a1e1a121179082396`. The source/session synchronization
repair is independently supported within the cases below. A native
Redo-then-next-edit sequence on the newly activated candidate, affected public
artifact/build evidence, whole Gate E, devices and owner acceptance are separate
and are not awarded by this report.

## Identity and preserved failure

Clean independent checkout before review; created new isolated branch
`review/history-redo-echo-20261030` directly from exact candidate ab3296e.
Previous `review/native-continuity-20261030` and its evidence remain unchanged.
Local origin/main tracking ref remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`; no network fetch/push occurred.
Scope is the stage manager's authorized independent source/test review, not
serving activation or owner acceptance.

Read the builder REPORT and retained failed reproduction logs. The native source
Redo result was correct; the later edit disclosed a stale runtime session. The
mounted public-operation baseline reproduces moved canonical revision161 but
stale rendered position, followed by revision162/old position rather than
revision163/moved position. The graph1 baseline reproduces the same problem on
an ordinary field edit. These earlier failures and the initially incomplete
synthetic Delete attempt retain their distinct stated scopes. No failed evidence
was removed or relabeled as native passing evidence.

## Source assessment

The only product changes clear `emitted` in GraphWorkspace and legacy
GraphSurface after the incoming source passes their existing current/own-echo
shortcuts and before external parsing/validation. Thus a different external source
ends the last emission's echo lifetime. A later return to those bytes is parsed
and adopted, including Undo/Redo or restoration after invalid source.

The immediate own-emission fast paths remain intact. Workspace still requires
valid source for that shortcut, and legacy policy changes still update the
session's read-only policy without reparsing its current echo. Parse/domain
validation, invalid-source mutation fences, source ownership/history admission,
scoped occurrence routes and per-node callback generations are unchanged. An
external adopted graph retains the existing generation invalidation and selection
reconciliation. Clearing a string marker grants no write/history authority.
There is no schema/API/component revision change or new Studio-private package
import. No gating source defect was found in this narrow delta.

## Independent adversarial additions

`packages/ui-flow-svelte/test/history-echo-independent.svelte.test.ts` adds one
test each for workspace@1 and workspace@2, using the real public composition and
DocumentHost. An ordinary field change is immediately echoed through host state;
local Undo must still emit, proving the echo did not erase its local history.
After another edit/echo, a different external graph changes position while
deliberately keeping the graph revision equal. Returning to the exact last emitted
bytes must restore the session before another label edit; that next edit must
advance the correct revision and preserve the restored position. This challenges
source identity independently of monotonic revision numbers, rather than merely
repeating the builder's native-derived move/edge sequence.

## Commands and results

From repository root:

```powershell
npx vitest run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/history-echo-independent.svelte.test.ts
```

**19/19 PASS**, two files, exit 0: 17 existing composition cases and two new
independent cases. Raw: `independent-history-echo-flow.log`. Includes workspace
versions1/2, standalone local history, host@1 compatibility, ordinary controls,
scoped/nested ownership, rejected/invalid source restoration, read-only operations,
domain-refused geometry and callback recovery.

From `apps/studio`:

```powershell
npx vitest run tests/pointer-history-probe.test.ts tests/legacy-history-probe.test.ts tests/graph-scoped-bridge.test.ts tests/graph-runtime-refusal.test.ts tests/graph-history-source-policy.test.ts tests/graph-scoped-ownership.test.ts
```

**21/21 PASS**, six files, exit 0. Raw: `independent-history-echo-studio.log`.
These cases cover genuine EditorBridge/EditorCanvas source history, the mounted
move→Undo→Redo→edge remove/connect sequence, legacy graph1 Redo→field edit,
controlled nested/repeated ownership, private local history without source
promotion, stale/ambiguous/incomplete-scope refusal, shared manual/agent edits,
save/reopen/import and runtime rollback. All operations use disposable fixture
state and nonpersisting or disposable stores; no owner application was edited.

Existing renderer accessibility/initial-reference and shortcut warnings remain
visible. No broad popup/media rerun was performed: prior exact72 independent
44 renderer /15 media /8 Studio affected regressions remain valid evidence for
unchanged popup/media/capture source and their stated scope. The exact repair's
builder Flow check (0 errors/5 inherited warnings) and Studio TypeScript exit0
are retained rather than repeated. New consumer/production/native evidence for
changed Flow package bytes remains the integrator's next responsibility.

## Next allowed action

The integrator may finish affected artifact/build checks and authorized reversible
local activation, then verify actual native move→Undo→Redo followed by another
ordinary edit and edge mutation. Check canonical revision/position and visible
session after each settled step; source-only immediate reads are insufficient.
This report supplies no fresh pointer, browser, device or actual-agent result.
Whole Gate E and owner acceptance remain pending. No activation, browser/provider
action, push, merge, publication or Stage 9 closure occurred in this lane.
