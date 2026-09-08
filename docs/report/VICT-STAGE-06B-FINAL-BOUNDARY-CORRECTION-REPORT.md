# VICT Stage 06B — Final Boundary Correction Report

Stage 06B — Final Invocation and Control-Boundary Correction (pass 3 on top
of the corrective finalization and the final reliability correction).

Status of this document: records a focused correction pass. It does NOT
promote any stage status. Stage 06B remains In Progress, awaiting the
fresh comprehensive independent Stage 06 audit.

## 1. Identity

```text
Starting SHA (origin/main at pass start): 8bc8da1177df8ec998efe152d1ed30f0b62c7342
Implementation SHA:                        recorded in §12 (commit-time addendum)
Documentation/final SHAs:                  recorded in §12
Stage 06A closure commit in ancestry:      b491ededed32a796aa035befe77946e8b107338b (verified)
```

Every historical report and audit document is preserved byte-for-byte.
No force-push, rebase, history rewrite, or owner-work discard occurred.

## 2. Negative-control observations at the starting SHA

Temporary probes were executed against the EMITTED runtime boundary
(built `dist` at `8bc8da1`) and against the live bridge/store behavior,
then removed. Exact outcomes:

BOUNDARY-1 — ChangeSet base getter executes before capture
(`validateChangeSetContent`, base whose `base.kind` is an enumerable
getter incrementing a counter and throwing a unique canary):

```text
getter count = 1
error name   = Error
error code   = (none)
raw canary appears in error.message = true
```

BOUNDARY-2 — revoked Proxy escapes as raw TypeError
(`validateChangeSetOperation` and the full ChangeSet validator with
revoked/hostile proxies at every input position):

```text
revoked proxy as ONE OPERATION    -> TypeError: Cannot perform 'IsArray' on a proxy that has been revoked
revoked proxy as OPERATIONS ARRAY -> TypeError: Cannot perform 'IsArray' on a proxy that has been revoked
revoked proxy as the BASE         -> TypeError: Cannot perform 'get' on a proxy that has been revoked
revoked proxy as RELEASE CONTENT  -> TypeError: Cannot perform 'IsArray' on a proxy that has been revoked
descriptor-trap proxy (canary)    -> Error: B2-CANARY-descriptor   (raw, canary crosses)
```

INVOCATION-1 — live duplicate poisons the winning invocation
(barrier-controlled read capability; duplicate submitted with the SAME
`toolCallId` and arguments while the owner is durably `running`):

```text
mid-flight durable statuses = ["outcome_unknown"]   (the duplicate flipped the LIVE owner)
effect count                = 1
invocation rows             = 1, status = outcome_unknown
owner result                = {"done":true}                       (normal success returned anyway)
duplicate result            = {"victCapabilityFailure":"VICT_CAPABILITY_OUTCOME_UNKNOWN"}
=> durable state and returned outcome contradict each other
```

INVOCATION-2 — digest-only fallback aliases distinct calls (two distinct
tool occurrences, same capability, identical canonical arguments, no
usable framework `toolCallId`):

```text
effect count    = 1
invocation rows = 1
second call     = {"victCapabilityReplay":{"disposition":"completed",...}}   (treated as replay)
```

## 3. Root causes

RC-BOUNDARY-1: `validateChangeSetContent` performed a semantic
pre-check (`(input.base as ChangeSetBase).kind`) BEFORE any capture, so a
plain member read invoked a caller getter; the thrown canary crossed the
boundary as a raw `Error`.

RC-BOUNDARY-2: the boundary used UNGUARDED inspection primitives on
untrusted input — `Array.isArray` throws on revoked proxies (`IsArray`),
`Object.getPrototypeOf`/`Reflect.ownKeys`/descriptor access can throw on
hostile traps, and the operations list was read through the caller array
(`.length`, `.map()`, `hasOwnProperty`) — so raw `TypeError`s and trap
canaries escaped. Additionally, the base/operations/release capture was
not applied to the OUTER input envelope, and direct
`ControlPlaneService` entry points read caller members before validation.

RC-INVOCATION-1: the bridge treated a duplicate observation of a
`running` record as PROOF the owner was dead and "reconciled" the record
to `outcome_unknown` — mutating a LIVE owner's state. Worse,
`transitionInvocation` blindly swallowed `VICT_CONTROL_INVOCATION_TERMINAL`
/`REGRESSION` errors, so the owner's later `completed` write hit the
terminal fence, was swallowed, and the owner still returned the raw
capability output as normal success: durable `outcome_unknown` vs
returned success.

RC-INVOCATION-2: when the framework supplied no valid `toolCallId`, the
bridge fell back to a durable slot keyed by `(turnId, toolName,
argDigest)`. A digest-only key cannot distinguish a retry from a SECOND
legitimate identical occurrence, so distinct identical calls were aliased
into one identity and the second was silently replayed. The pinned
Mastra Tool wrapper actually supplies a unique per-occurrence
`toolCallId` for agent-loop executions (nested under `context.agent`),
which the bridge never read.

## 4. Corrections

### 4.1 Complete ChangeSet capture boundary (`@vict/runtime`, `@vict/control`)

- `captureClosedControlRecord` now guards `Array.isArray` (the revoked-
  proxy `IsArray` throw) in addition to the already-guarded
  `getPrototypeOf`/`ownKeys`/descriptor reads.
- New `captureClosedControlArray`: real-array + `Array.prototype`
  prototype check, `length` read through its guarded own DESCRIPTOR
  (never a caller `get`), `Reflect.ownKeys` must be EXACTLY the dense
  index set plus `length` (extra string/symbol properties rejected),
  every index captured through its guarded own descriptor (enumerable
  DATA properties only — sparse holes, accessors, and non-enumerable
  indices rejected). No caller `.map()`, iterator, or getter is ever
  consulted.
- `validateChangeSetContent(untrustedInput: unknown)` now CAPTURES the
  complete outer envelope (exact closed 9-field set) before ANY semantic
  inspection; scalar members are captured by descriptor value too, so
  hostile getters on EVERY outer field run ZERO times; `base` is
  captured as a closed record and the operations as a closed dense array
  BEFORE validation. Errors remain stable and non-echoing; only
  VICT-owned validated captures are hashed; caller objects are never
  frozen, retained, or aliased.
- `ControlPlaneService.propose` and `revise` capture their complete
  public input through the same guarded capture BEFORE any member read;
  `publishRelease` validates through the already-capturing
  `validateApplicationReleaseContent`. The HTTP dispatcher's earlier
  capture no longer masks the direct package API.

### 4.2 Live invocation ownership and settlement (fencing)

Store port (`@vict/runtime`, in-memory + SQLite via migration 9):

- `AgentToolInvocationRecord` gains optional attempt-fence members:
  `runFenceToken`, `runFenceAt`, `runOwnerIdentity`, `runGeneration`.
- `claimInvocationRun`: `intent|approved → running`, stamps the fence and
  the next generation; a second claim on a running record throws
  `VICT_CONTROL_INVOCATION_OWNER_ACTIVE` (the caller is a duplicate);
  terminal records refuse new claims.
- `settleInvocationRun`: fenced terminal settlement (`completed` |
  `failed` | `outcome_unknown`) accepted ONLY from `running` under the
  EXACT fence token; an exact rematch of the requested terminal state
  AND binding (status + errorCode + resultSummary) under the SAME fence
  is idempotent; every other conflict fails (`FENCE_MISMATCH` /
  `TERMINAL`).
- `settleInvocationPending`: pre-running terminal settlements
  (`failed` | `declined` | `cancelled`) with exact-binding idempotency; a
  claimed (`running`) record is never touched (`OWNER_ACTIVE`).
- `reconcileAbandonedRun`: exact-binding reconciliation of an ABANDONED
  `running` attempt (observed `running` + observed fence token required)
  to the fenced, NON-replayable `outcome_unknown` — advancing the fence
  token and generation — without executing anything.
- Migration 9 (forward-only ADD COLUMNs on `vict_agent_tool_invocation`)
  preserves migration history; the migration-8 turn-tool-slot table is
  intentionally retained (forward-compatible surface).

Bridge (`@vict/mastra` tool-bridge):

- The durable claim is the SINGLE ownership gate. The live-owner
  registration is established BEFORE the claim, so a duplicate that
  observes `running` always finds the same-process owner.
- Duplicate of a live owner: NEVER mutates; awaits the owner's
  settlement and replays the truthful terminal disposition (cancelled
  waiters receive the non-terminal `in_progress` replay disposition).
- No live owner in this process (owner loss across a process life):
  conservative exact-binding reconciliation to fenced `outcome_unknown`;
  the effect is never re-executed; later retries stay fenced.
- Owner path: capability throw / output-contract violation / ANY
  completion-persistence failure settles fenced `outcome_unknown` and
  returns the structured failure — normal success is returned ONLY after
  the exact durable `completed` transition is confirmed.
- Stale owners can never settle a later claim generation (fence-first
  binding, generation-aware).
- The silent-swallow transition helper is GONE: the only store-conflict
  codes the bridge compares are the three arbitration codes, each
  resolved by a truthful re-read and re-dispatch — never swallowed into a
  normal continuation.
- Approval-path denials mutate nothing (the denied caller is a duplicate,
  not the owner); the consumption winner proceeds to the claim.

### 4.3 Tool-call occurrence identity (INVOCATION-2)

- The framework-supplied `toolCallId` IS the occurrence identity; the
  bridge reads BOTH surfaces the pinned Mastra Tool wrapper exposes
  (top-level for direct calls, `agent.toolCallId` for agent-loop
  executions).
- No valid identity → `VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED` BEFORE any
  durable intent, approval request, or capability invocation. Occurrence
  identity is never inferred from arguments alone.
- The digest-only `allocateTurnToolSlot` fallback is REMOVED from the
  bridge deps and composition; the migration-8 table and the store port
  remain forward-compatible.
- The deterministic offline model now emits UNIQUE per-occurrence
  identities (`offline-call-<tool>-<n>`, monotonic per fixture) and its
  tool-chain scripting supports repeated identical calls as DISTINCT
  occurrences — so the real pinned `Agent` loop provably delivers
  distinct identities for distinct identical occurrences.

### 4.4 Completed replay through the real pinned pipeline

The completed-replay envelope remains metadata-only and is now PROVEN
through the real pinned Mastra path: accepted by the actual
output-schema/tool pipeline, visibly an explicit replay disposition
(`victCapabilityReplay`), carrying only the structural shape summary (no
raw output, no payload content), producing no second effect, and REJECTED
by the strict capability output contract (it passes only through the
explicit marker surface, never as a new execution result). Within one
conversation the pinned loop itself also deduplicates a repeated
occurrence id — at-most-once per identity holds at the framework layer
too.

## 5. Final tool-call occurrence identity policy

```text
identity  := framework-supplied toolCallId (validated ^[A-Za-z0-9._:-]{1,128}$),
             read from both pinned-wrapper surfaces
missing   := VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED, fail-closed BEFORE
             intent/approval/invocation; never inferred from arguments,
             time, counters, or row counts
logical   := (turnId, toolCallId, capabilityId, capabilityRevision, argDigest)
             idempotency key — retry of the SAME occurrence reuses ONE
             identity and executes at most once
distinct  := two distinct occurrences with identical arguments carry
             distinct identities and may execute twice
```

## 6. Final live-duplicate / attempt-fencing policy

```text
claim    := intent|approved -> running, ONE winner per generation
            (fence token + owner identity + monotonic generation)
duplicate:= observing a live-owned running record NEVER mutates it:
            same-process owner  -> await settlement, replay terminal
                                   disposition (cancelled -> in_progress)
            no live owner here  -> exact-binding reconciliation to fenced
                                   non-replayable outcome_unknown
settle   := fenced, exact-binding (fence token FIRST); idempotent ONLY on
            the exact requested state + binding under the SAME fence
success  := normal success ONLY after the durable completed transition is
            confirmed; any ambiguity -> outcome_unknown failure
stale    := an earlier fence/generation can never settle (store refuses)
abandoned:= reconcile (exact observed binding) -> outcome_unknown without
            re-executing; close/reopen and real SIGKILL preserve the rules
envelope := single-process/local; NOT a cross-process distributed lock
            claim (see §11 limitations)
```

## 7. Files changed (by purpose)

Capture boundary:
- `packages/runtime/src/control-types.ts` — guarded record capture, new
  guarded dense-array capture, outer-envelope capture in
  `validateChangeSetContent`; attempt-fence record members + new store
  commands in `AgentToolInvocationStore`.
- `packages/runtime/src/control-in-memory.ts` — fence command
  implementations (in-memory reference adapter).
- `packages/runtime/src/index.ts` — export the capture primitives.
- `packages/runtime/src/control-conformance.ts` — shared conformance
  block for the fence commands (runs against BOTH adapters).
- `packages/control/src/control-plane.ts` — direct-entry-point capture
  for `propose`/`revise` (closed input capture before member reads).

Attempt fencing (SQLite):
- `packages/store-sqlite/src/migrations.ts` — migration 9 (fence columns;
  forward-only; migration 8 table preserved).
- `packages/store-sqlite/src/agent-control-adapter.ts` — row mapping +
  the four fence commands (atomic read-validate-update in one
  transaction).

Bridge / execution:
- `packages/mastra/src/tool-bridge.ts` — fail-closed occurrence identity,
  live-owner registry, attempt-ownership dispatch, fenced settlements,
  digest/summary guards, no silent swallowing.
- `packages/mastra/src/turn-executor.ts` — composition wires the fence
  commands; digest-only slot fallback removed.
- `packages/mastra/src/offline-model.ts` — unique per-occurrence ids,
  repeated-occurrence scripting, explicit-id override, tool-result
  observer.

Permanent regression coverage (new):
- `packages/runtime/test/changeset-capture-boundary.test.ts` (17 tests)
- `packages/mastra/test/tool-bridge-ownership.test.ts` (7 tests)
- `packages/mastra/test/occurrence-identity-pipeline.test.ts` (2 tests)
- `packages/store-sqlite/test/invocation-fencing.test.ts` (6 tests)
- `packages/store-sqlite/test/fixtures/invocation-claim-worker.mts`
  (SIGKILL crash fixture)

Updated suites:
- `packages/mastra/test/tool-bridge-reliability.test.ts` — R2 rewritten to
  the fail-closed identity policy (the digest-only fallback tests are
  gone with the fallback).
- `packages/mastra/test/tool-bridge.faults.test.ts` — source-contract pin
  rewritten: the silent swallow helper is GONE; conflict recognition is
  explicit and re-read-based.
- `packages/mastra/test/tool-bridge.test.ts`, `turn-executor.test.ts`,
  `packages/server/test/e2e-canary.test.ts` — fixture wiring for the new
  commands.
- `packages/runtime/test/changeset-structure.test.ts` — type-only
  adaptation to the new `validateChangeSetContent` signature.

Verifier and documentation:
- `scripts/verify-stage6b.mjs` — new "final boundary correction" suite
  group.
- `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` —
  capture boundary, occurrence identity, attempt fencing, and replay
  semantics updated where behavior changed.
- `docs/report/VICT-STAGE-06B-FINAL-BOUNDARY-CORRECTION-REPORT.md` — this
  report.

## 8. Commands, exits, and test counts

Final working-tree verification ladder (executed ONCE, in order; all
exits 0):

```text
npm run format:check                     exit 0
npm run lint                             exit 0
npm run typecheck                        exit 0
npm run build                            exit 0
npx vitest run --root . <15 new and directly affected suites>
                                         138 passed / 138
npm test                                 exit 0 — 106 files passed | 1 skipped;
                                         2045 tests passed | 3 skipped (2048 total)
npm run verify:consumer                  exit 0
npm run verify:stage6b                   exit 0 — 30 gates, ALL PASSED
npm run example                          exit 0
npm run bench                            exit 0
git diff --check                         exit 0 (no whitespace errors)
```

New permanent suites (all pass after the correction):

```text
packages/runtime/test/changeset-capture-boundary.test.ts   17 passed
packages/mastra/test/tool-bridge-ownership.test.ts          7 passed
packages/mastra/test/occurrence-identity-pipeline.test.ts   2 passed
packages/store-sqlite/test/invocation-fencing.test.ts       6 passed
shared conformance fence block (+1 per adapter)             both adapters pass
```

Three-repeat runs of the new concurrency/crash/fault-injection suites
(`tool-bridge-ownership`, `invocation-fencing`, `tool-bridge.faults`,
`reliability-restart`): 3 × 22 tests, all passed on every run.

## 9. Negative control (one temporary worktree at 8bc8da1)

One detached worktree at `8bc8da1177df8ec998efe152d1ed30f0b62c7342`, the
five new test files copied in (no build needed — vitest aliases resolve
workspace sources), only the four new suites executed:

```text
changeset-capture-boundary.test.ts    14 failed / 3 passed
tool-bridge-ownership.test.ts          7 failed / 0 passed
invocation-fencing.test.ts             6 failed / 0 passed
occurrence-identity-pipeline.test.ts   1 failed  / 1 passed
TOTAL                                 28 failed / 4 passed (32)
```

Expected failures confirmed (root causes reproduced exactly as in §2).
The 4 passing tests pin pre-existing-correct behaviors (sparse-array
rejection, no-mutation-on-rejection, caller-mutation safety, and the
completed-replay envelope semantics kept as regression guards). The
worktree was removed after recording.

## 10. Fresh-clone proof

Exactly ONE fresh clone at the final implementation SHA
(`b37320c80de5069ab9654893fb55739ba53c4445`) was created, verified, and
removed:

```text
worktree at ../vict-fresh-clone (detached, b37320c) — no dist/ present
npm ci                              exit 0
npm run typecheck (BEFORE build)    exit 0
npm run build                       exit 0
npx vitest run --root . <the 4 new suites>
                                    32 passed / 32 (4 files)
npm run verify:stage6b              exit 0 — ALL GATES PASSED
git status --short                  clean (no artifacts)
clone removed                       worktree list shows the main tree only
```

## 11. Remaining genuine limitations

- The live-owner registry proves owner liveness WITHIN one process. The
  accepted single-process/local envelope makes this sound; MULTIPLE
  processes sharing one SQLite invocation domain must NOT be treated as
  fenced against each other's live attempts (a live foreign-process owner
  is indistinguishable from an abandoned one here and would be
  reconciled conservatively). Cross-process lease coordination remains
  future work and is NOT claimed.
- The `in_progress` replay disposition reports a still-running attempt
  truthfully, but the tool-call normalization marks such tool results as
  `tool.completed` (the TOOL CALL completed with a non-terminal
  disposition inside); the wire schema has no separate in-progress
  tool-event kind.
- Completed replay remains metadata-only (structural shape summary): the
  model can observe THAT the invocation completed, not its semantic
  output. The product path does not require the original output to
  continue (scripted continuations prove the loop completes on the
  envelope); an actor-authorized content-reference boundary for semantic
  replay remains future work.
- The offline fixture's occurrence ids are unique per fixture instance
  and deterministic per composition; they are correlation handles, not
  security tokens.
- One OS (Windows, Node 22.13.1) was exercised for THIS pass; the fresh
  independent Stage 06 audit will re-run the authoritative ladder
  (Linux/Node 24) as in prior passes.
- Stage 06B remains In Progress: all gates green, but promotion to
  Verified requires the fresh comprehensive independent Stage 06 audit.

## 12. Commit-time SHA record

```text
implementation SHA : b37320c80de5069ab9654893fb55739ba53c4445
                     (fix(stage-06b): close invocation and control capture
                      gaps — carries §4/§7 sources, tests, and verifier)
documentation SHA  : the docs(stage-06b) commit that carries this report
                     and the architecture-document update (its exact value
                     is this file's own commit; see `git log -- docs/report/
                     VICT-STAGE-06B-FINAL-BOUNDARY-CORRECTION-REPORT.md`)
final remote head  : the completion-time remote head at the time of this
                     record is af4d85a (this report's own documentation
                     commit); the push is a fast-forward from that head,
                     so the post-push origin/main is the commit carrying
                     this record
starting SHA       : 8bc8da1177df8ec998efe152d1ed30f0b62c7342 (see §1)
```

## 13. Status

```text
Stage 06B — In Progress, awaiting fresh comprehensive independent Stage 06 audit
Stage 06  — In Progress
Stage 07  — Not begun
```
