# VICT — Stage 03 Implementation Report

## Outcome

`READY FOR INDEPENDENT AUDIT`

Stage 03 durable orchestration is implemented, verified end to end with the
repository's own evidence ladder plus adversarial real-process fixtures,
and committed. The Stage 03 handoff's exit gates (§36) are each addressed
below with direct file/test references. Per the handoff, this report does
not mark the system reference `Verified`; the proposal in
[Requirement status proposal](#requirement-status-proposal) is for later
owner/auditor acceptance.

## Starting state

| Item | Value |
| --- | --- |
| Starting commit | `644c84f807b677535b36b3ccc4112ecad18853c5` (== `origin/main`; confirmed via `git fetch`) |
| Node / npm | v22.13.1 / 10.9.2 |
| Platform | Windows 10.0.26200 (MINGW64), win32-x64 |
| Initial status | Stages 01, 01.1, 02 independently verified; owner worktree changes present (report/handoff files moved under `docs/report/` + new handoff docs) — preserved untouched |
| Baseline `verify:stage2` | PASS — unit 217/217 (21 files), integration 4/4, packed consumer + SQLite reopen OK (exit 0) |

## Architecture delivered

**Graph/control model** (`packages/kernel`): extended `GraphNodeDefinition`
union (capability | decision | wait | fork | join), edge kinds
`route`/`branch`/`timeout`, bounded `RetryPolicy`, `timeoutMs`, and
`DecisionResult`. `compileGraph` validates control structure with stable
structured diagnostics (`packages/kernel/src/compile.ts`) and compiles
control graphs in the `vict.graph@2` canonical form while capability-only
graphs keep their byte-compatible `vict.graph@1` identity
(`packages/kernel/src/canonical.ts`).

**Pure state/transition model** (`packages/kernel/src/orchestration-state.ts`):
serializable durable token/attempt/wait/receipt/branch-result records, pure
state machines (`RUN_TRANSITIONS`, `TOKEN_TRANSITIONS`,
`ATTEMPT_TRANSITIONS`), deterministic backoff, stable-code retry
classification, typed decision routing, lexicographic join output, and
quiescence derivation. No I/O, clocks, randomness, or persistence.

**Durable store port** (`packages/runtime/src/orchestration-store-types.ts`):
semantic commands — createOrchestrationRun, claimReadyToken (atomic claim +
attempt intent + `node.started`), completeAttempt (attempt terminal state,
token movement, waits, forks, branch arrivals, joins, retries, blocks, run
status, checkpoints, dense events — one transaction), signalWait,
claimDueTimers/resolveDueTimer, requestCancellation/applyCancellation,
findRecoverableClaims/recoverAttempt, resolveBlocked — all guarded by
optimistic revisions/fences and command-hash idempotency. Implemented by
the in-memory adapter (`orchestration-in-memory.ts`) and the SQLite adapter
(`store-sqlite/src/orchestration-adapter.ts`) against the same conformance
suite.

**Driver** (`packages/runtime/src/orchestration-driver.ts`): bounded local
worker pool (default 4, max 32), claim/execute/complete loop, cooperative
deadline + abort racing, effect-aware ambiguity handling, conflict
re-derivation (bounded retries), no call-stack replay.

**Exact-activation resolution** (`orchestration-activation.ts`): graphs and
bindings rebuilt ONLY from a stored manifest's pinned revisions; missing
artifacts fail closed. The registry keeps historical capability/contract
revisions (`registry.ts`).

**Runtime facade** (`runtime.ts`): `run()` dispatches control graphs to the
durable engine; capability-only graphs keep the verified Stage 02
sequential engine. New surface: `resumeRun`, `signal`, `cancel`,
`processDueTimers`, `recoverOrchestration` (effect-aware boot recovery),
`resolveBlocked` (operator authorization denied by default).

**Package dependencies** unchanged: contracts ← kernel ← runtime ←
store-sqlite; sdk re-exports only public Stage 03 types; no new packages.

## Identity and compatibility

- Capability-only graphs keep `vict.graph@1`/`vict.activation@1` exactly;
  stored v1 activations remain readable/restorable (kernel compile tests;
  packed consumer reopen).
- Control graphs use `vict.graph@2` + `vict.activation@2` +
  `vict.activation-manifest@2`. Manifests capture waits (name/contract/
  timeout), forks (branch keys), joins (output contract), and bindings
  (including declared `idempotency`).
- Declared `idempotency: 'keyed'` participates in capability-set identity
  only when declared (additive; canonical JSON omits undeclared fields).
- Graph identity changes for: route targets, route/branch keys, retry
  bounds/backoff, timeouts, wait descriptors, fork/join pairing. Node/edge
  declaration order never changes identity
  (`packages/kernel/test/control-graph-identity.test.ts`).
- Registry: same id + new revision adds a resolvable revision; same
  id+revision twice is rejected; contracts likewise.
- SQLite migration v2 rebuilds `vict_run` (extended lifecycle) and adds
  orchestration tables; a real Stage 02 fixture database migrates without
  identity/event/activation loss
  (`packages/store-sqlite/test/stage2-migration.test.ts`).

## Durable transition model

- **Claim/fence**: `claimReadyToken` atomically claims the deterministically
  selected ready token (creation instant, then token id), records the
  attempt (fence = attempt number), persists `node.started`, and returns
  the private checkpoint. Completion requires the exact owner + fence;
  stale completions are rejected (`VICT_STORE_ATTEMPT_FENCE_CONFLICT`).
- **Transaction boundaries**: every command is one atomic transition
  (in-memory: staged synchronous commit with rollback; SQLite: IMMEDIATE
  transactions). Compound boundaries proven by fault injection
  (`packages/runtime/test/orchestration-faults.test.ts`).
- **Quiescence**: derived from durable work (`deriveRunStatus`); never from
  in-memory queues.
- **Checkpoint lifecycle**: private operational payloads live only for
  active/waiting/blocked work; terminal transitions tombstone them
  (in-memory: payload cleared; SQLite: `checkpoint = NULL`); canary tests
  prove absence from public reads
  (`packages/runtime/test/orchestration-canary.test.ts`).
- **Event ordering**: dense per-run `seq` assigned inside the transition
  transaction; `join.completed` is appended atomically with the join.

## Effects and recovery

- **Retries/backoff**: bounded, deterministic, durable timers; token stays
  ineligible until the retry timer fires
  (conformance suite: `bounded retry with durable backoff and stable
  idempotency keys`).
- **Stable idempotency keys**: derived from
  `run + activation + lineage + node + invocation`; identical across
  attempts and restarts (same conformance test; restart fixture).
- **Timeouts**: persisted deadline, cooperative abort, fenced late results
  (`node.timed_out`); pure/read retry under policy; keyed writes retry with
  the same key; unsafe writes and irreversible work with unknown outcomes
  block (conformance: `unsafe write timeout blocks without replay`).
- **Write reconciliation evidence**: real-process fixture — child killed
  after the external ledger commit but before the VICT commit; fresh
  process recovers with the same key; the ledger returns the reconciled
  result; exactly one external mutation; one completed logical invocation
  across two attempts
  (`packages/store-sqlite/test/orchestration-restart.test.ts`).
- **Irreversible/unsafe ambiguity**: blocking, never auto-replay;
  operator retry denied for irreversible work; validated `confirm_applied`
  only through the authorized API (runtime policy in
  `runtime.ts#recoverOrchestration` / `resolveBlocked`).
- **Blocked resolution**: authorized, revision-guarded, idempotent,
  contract-validated (conformance + facade logic).

## Files changed

**Packages — production code**
- `packages/kernel`: `types.ts` (control node/edge unions, RetryPolicy,
  events, durable context), `orchestration-state.ts` (new), `canonical.ts`
  (v2 forms), `compile.ts` (control validation), `testing.ts`, `index.ts`.
- `packages/runtime`: `orchestration-store-types.ts`, `orchestration-in-memory.ts`,
  `orchestration-driver.ts`, `orchestration-driver-types.ts`,
  `orchestration-activation.ts`, `orchestration-commands.ts`,
  `orchestration-plan.ts`, `orchestration-conformance.ts` (all new),
  `runtime.ts` (dispatch + new API), `registry.ts` (revision-pinned
  lookups), `store-types.ts` (v2 manifests, extended statuses),
  `store-validation.ts` (v2-aware identity revalidation), `store-errors.ts`,
  `errors.ts`, `serialization.ts` (unchanged), `types.ts`, `index.ts`,
  `testing.ts`, `in-memory-stores.ts`.
- `packages/store-sqlite`: `migrations.ts` (v2), `orchestration-adapter.ts`
  (new), `adapter.ts`, `index.ts`.
- `packages/sdk`: re-exported Stage 03 types via `@vict/runtime`.

**Tests / fixtures**
- `packages/kernel/test/control-graph-identity.test.ts` (new).
- `packages/runtime/test/orchestration-smoke.test.ts`,
  `orchestration-conformance.test.ts`, `orchestration-canary.test.ts`,
  `orchestration-faults.test.ts` (new).
- `packages/store-sqlite/test/orchestration-conformance.test.ts`,
  `orchestration-restart.test.ts`, `stage2-migration.test.ts` (new);
  `fixtures/orchestration-worker.mts`, `fixtures/stage2-database.ts` (new);
  `migrations.test.ts` (extended-status expectation updated for v2 schema).

**Examples / tooling / docs**
- `examples/orchestration-proof` (new).
- `scripts/verify-stage3.mjs` (new); `scripts/benchmark.ts` (Stage 03
  sections); `scripts/isolated-consumer-check.mjs` (orchestration consumer
  scenario).
- `docs/architecture/STAGE-03-DURABLE-ORCHESTRATION.md` (new); `README.md`
  (Stage 03 sections).

## Verification evidence

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | 48 packages, 0 vulnerabilities |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | 0 | eslint clean |
| `npm run typecheck` | 0 | strict, no errors |
| `npm run build` | 0 | all five packages build |
| `npm run test:unit` | 0 | **25 files / 248 tests passed** |
| `npm run test:integration` | 0 | 4/4 |
| `npm test` | 0 | 252/252 |
| `npm run verify:consumer` | 0 | neutral + zod + orchestration consumers, packed tarballs |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run example` | 0 | ARA proof (13 events) |
| `npm run bench` | 0 | Stage 02 + Stage 03 sections |
| `npm run verify:stage3` | 0 | unit + integration + offline proof + packed orchestration consumer |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | — | clean except preserved owner docs |

Observed unit-suite content: 25 files / 248 tests, including
- shared orchestration conformance (8 tests × 2 adapters),
- 4 real-process restart/crash fixtures,
- real Stage 02 migration fixture,
- 4 atomic fault-injection cases, canary suite,
- kernel control-graph identity/diagnostics suite.

## Required verification matrix

| Area | Required result | Evidence |
| --- | --- | --- |
| Baseline | Stage 02 commands/tests still pass | `verify:stage2` exit 0; 248+4 tests green |
| Old schema | Real Stage 02 DB migrates without loss | `stage2-migration.test.ts` |
| Fresh schema | New DB opens at current version | `migrations.test.ts` |
| Future schema | Fails closed without mutation | `migrations.test.ts` (fails closed) |
| Old activation | Stored v1 activation restorable | packed consumer reopen; `runtime.restoreActivation` |
| Control identity | Route/wait/fork/join/retry changes affect correct layers | `control-graph-identity.test.ts` |
| Canonical order | Declaration order does not alter identity | same |
| Exact resume | Suspended run resumes only under its pinned activation | `orchestration-restart.test.ts`; conformance `exact-activation...` |
| Selection change | New run uses B; suspended stays on A | conformance `exact-activation resume across a newer selection` |
| Missing artifacts | Resume blocks; no substitute executes | `resolveGraphForActivation` fail-closed + driver skip policy |
| Attempt intent | Durable before every invocation | claim transaction; restart fixtures (`node.started` count) |
| Claim ownership | One owner wins; stale completion fenced | store guards; `VICT_STORE_ATTEMPT_FENCE_CONFLICT` |
| Retry bound | Attempts ≤ declared max | conformance retry test (attempt numbers [1,2]) |
| Retry schedule | Backoff due times deterministic + durable | conformance retry test; `backoffDelayMs` tests |
| Write idempotency | Crash/retry → one external mutation | keyed-write SIGKILL fixture (ledger count 1) |
| Unsafe write | Ambiguous outcome blocks without replay | conformance unsafe-write test; faults |
| Irreversible | Never automatically retries | compile-time denial + recovery policy |
| Signal wait | Restart + valid signal resume once | restart fixture (1 receipt, 1 resume) |
| Invalid signal | Wait stays open; nothing executes | conformance signal test |
| Duplicate signal | Idempotent | conformance (duplicate/late) |
| Signal collision | Same ID/different content conflicts | conformance + consumer |
| Signal/timeout race | Exactly one winner | store compare-and-set guards |
| Timer recovery | Overdue timer fires once after restart | restart timer fixture |
| Cancellation before start | Invocation count unchanged | conformance cancellation test |
| Active cancellation | Abort/fencing/ambiguity hold | driver abort + `run.cancel_requested` semantics |
| Fan-out concurrency | Branches overlap within bound | conformance overlap barrier (max > 1) |
| Join order | Deterministic by branch key | store canonical join output |
| Join once | Duplicate/stale arrival cannot rejoin | store membership check; conformance |
| Branch crash | Only unfinished safe work resumes | SIGKILL fixtures |
| Branch failure | Siblings cancel; run resolves once | `branchFailure` continuation |
| Blocked resolution | Authorized, validated, idempotent, revision-guarded | `resolveBlocked` + conformance |
| Operator denial | Default authorization invokes nothing | facade check (`VICT_ORCH_OPERATOR_DENIED`) |
| Atomicity | No half-state at any compound transition | fault-injection suite (4 boundaries) |
| Event order | Dense, append-only, exact identities | adapters; conformance dense-events checks |
| Default history | No canaries or raw messages | canary suite |
| Checkpoint boundary | Private, validated, lifecycle-managed | canary suite; tombstone cleanup |
| In-memory parity | Shared Stage 03 conformance passes | `orchestration-conformance.test.ts` (runtime) |
| SQLite parity | Shared Stage 03 conformance passes | `orchestration-conformance.test.ts` (store-sqlite) |
| ARA regression | 4 nodes, 3 edges, 13 events, offline | `npm run example` exit 0 |
| Benchmark regression | 10-event/6-validation semantics preserved | `npm run bench` |
| Packed consumer | Close/reopen/wait/signal/resume works isolated | `verify:consumer` orchestration scenario |
| Scope | No Stage 04+ feature introduced | see Scope confirmation |

## Crash and race evidence (real processes)

1. **Signal wait across restart** — Process A: activate + start + park at
   the signal wait; exits normally. Process B: reopen, deliver ONE signal
   (`restart-sig-1`), resume to completion. Durable facts: exactly 1
   `vict_signal_receipt` row, exactly 1 `run.resumed` event
   (`orchestration-restart.test.ts`, signal-wait case).
2. **Offline timer** — Process A parks at a 5 ms timer and exits; process B
   pumps due timers after the process was offline; exactly 1 `timer.fired`,
   1 `run.resumed`.
3. **SIGKILL during a pure attempt** — child commits durable intent
   (`node.started` + attempt row) then hangs; parent SIGKILLs; fresh process
   runs `recoverOrchestration({ resume: true })`; the pure attempt is
   reclaimed (pre-authorized mechanical policy); exactly 2 attempts of one
   logical invocation complete; the stale killed handler's result is fenced
   (it never returned one).
4. **SIGKILL after external keyed-write commit** — child writes the external
   ledger entry keyed by the stable idempotency key, then dies before the
   VICT completion commit. Recovery reclaims with the SAME key; the ledger
   returns the reconciled prior result; exactly one external mutation; 2
   attempts, 1 logical invocation.

## Performance and resource limits

Measured on the reported platform (informational; correctness uses explicit
concurrency/barrier assertions, never wall-clock thresholds):

- Sequential in-memory 3-node run: ~0.15 ms/run median (2000 iters).
- SQLite file-backed (wal + synchronous=FULL): ~6.8 ms/run median.
- SQLite `:memory:`: ~2.0 ms/run median (API parity only; no fsync).
- Activation publish+select: ~2.3 ms median; exact restore ~0.42 ms median.
- Completed-run read (record + 10 events): ~0.34 ms median.
- **Stage 03** durable orchestration round trip (start → fork/join →
  signal wait → signal → resume → complete, SQLite file-backed, fsync per
  commit): median ~43.7 ms, p95 ~57.9 ms (n=50).
- Durable timer path (park → pump → wake → complete): median ~47.3 ms.

Bounded defaults/hard limits are published in
`docs/architecture/STAGE-03-DURABLE-ORCHESTRATION.md` §13 and enforced in
`ORCHESTRATION_LIMITS`, the compiler bounds, and the worker pool.

## Compatibility decisions (intentional pre-1.0 changes)

1. `RunStatus` extended with `waiting` and `cancelled` (terminal set now
   completed/failed/cancelled). Old databases migrate via the v2 rebuild.
2. `RunResult` gained optional `waits` and `steps`; orchestration results
   carry the full ordered trace.
3. Graph node/edge definitions extended (additive; capability-only
   definitions unchanged and byte-compatible in identity).
4. `CapabilityDefinition`/descriptor gained optional `idempotency`; it
   enters capability-set identity only when declared.
5. Registry re-registration semantics refined: same id + new revision
   allowed (kept for restoration); same id+revision duplicate still
   rejected (contracts likewise).
6. New store port `orchestration` on `VictStores` (optional for
   backward compatibility; required for orchestration runs).
7. Sequential Stage 02 recovery (`recoverInterruptedRuns`) is unchanged and
   still applies to sequential runs; orchestration runs use effect-aware
   `recoverOrchestration`.
8. `vict.activation-manifest@2` and `vict.graph@2` markers added; v1 never
   edited. Event schema stays `vict.run-event@1` (additive event types).
9. `runNode()` test isolation unchanged (no durable records created).

## Requirement status proposal

Proposed deltas for the independent disposition (NOT applied by this
implementation):

- `KERN-006` → Verified (typed route keys; conformance + kernel tests).
- `RUN-003` → Verified (deterministic claim order, join order, timer order).
- `RUN-004` → Verified (clocks/time through the injected time port; results
  recorded; see architecture doc §6).
- `RUN-005` → Verified (durable cooperative cancellation + child
  propagation; conformance).
- `RUN-006` → Verified (bounded, classified, durable retries; compile-time
  effect guards; crash fixtures).
- `RUN-007` → Verified (durable attempts, claims, leases, fences).
- `OBS-005` → Implemented (recovery limited to pre-authorized mechanical
  policy; proposal pending audit).
- `OBS-006` → Implemented (recovery never mutates definitions/permissions/
  activations; proposal pending audit).
- `EFF-006` → Implemented (keyed-idempotency declaration required for write
  retry; proposal pending audit).
- `CAP-003`, `CAP-004`, `VER-005/007/008`, `DATA-002/003/008`, `API-002`,
  `TEST-001/002/006/007`, `KERN-002/004` — implemented/extended as described
  in the architecture document; exact status edits deferred to the audit.

No status in `docs/VICT-SYSTEM-REFERENCE.md` was changed by this stage.

## Remaining risks

**Blocking**: none known.

**Non-blocking**:
- The due-timer pump is explicit; a process-internal convenience scheduler
  is not wired by default (applications call `processDueTimers` or drive it
  themselves). Correctness never depends on a hidden loop.
- Nested fan-out is rejected at compilation; supporting it later requires
  extending the branch-region model and the join lineage derivation.
- In-memory orchestration events live in the orchestration adapter (separate
  map from the sequential execution store); SQLite shares one event table.
  Cross-adapter event reads go through `listOrchestrationEvents`.
- Windows file-lock quirk: cleanup after SIGKILL fixtures uses a separate
  removal process (the worker's own lazy SQLite finalizers can hold the WAL
  mapping); a leaked OS-temp dir is warned and never masks test outcomes.
- Join output contract validation is enforced via the next node's input
  validation (and the driver's pre-arrival check); a declared join contract
  differing from the next node's input contract is not separately
  re-validated inside the store transition (documented residual gap).

**Accepted local trust boundaries**: SQLite is a trusted local deployment;
checkpoint bytes are not a multi-tenant secret store; secrets/artifact
platform remains Stage 04.

**Deferred (Stage 04+)**: SDK dependency-direction refactor, capability
packs/registries, control plane/approvals, HTTP/SSE/CLI surfaces, Postgres/
queue backends, distributed workers, semantic migration of in-flight runs
across activations.

## Scope confirmation

No Stage 04+ work was implemented: no SDK authoring-ABI reversal, no
capability packs/playbooks, no configuration/secret platform, no approvals/
roles/ChangeSets, no HTTP/SSE/WebSocket/MCP/CLI/Studio surfaces, no
Postgres/Redis/queues, no multi-host workers or leader election, no dynamic
fan-out, no expression language, no automatic healing/compensation, no
application-domain event sourcing, no automatic migration of suspended runs
to newer activations, no universal exactly-once external claim. Explicit
bounded iteration was excluded per the handoff and was not implemented.

## Repository state

- Final implementation commit: see `git log` — latest
  `docs(stage-03): ...` / feature commits from `644c84f` through this
  report; history is append-only (no rewrites, no force-push).
- Push: `git push origin main` attempted as a normal fast-forward; output
  recorded in the session log (credentials/repo workflow permitting).
- Working tree: clean except the preserved owner changes (moved report/
  handoff documents) noted in the starting state.

## Independent verification readiness

Shortest clean-room sequence:

```bash
git clone https://github.com/radz2291/vict-02 && cd vict-02
npm ci
npm run verify:stage3    # full ladder + offline proof + packed orchestration consumer
npm run verify:stage2    # Stage 02 regression closure
npm run bench            # informational measurements
```

Most important adversarial fixtures:
1. `packages/store-sqlite/test/orchestration-restart.test.ts` — SIGKILL
   during a pure attempt and after an external keyed-write commit.
2. `packages/store-sqlite/test/stage2-migration.test.ts` — real Stage 02
   data through the forward migration.
3. `packages/runtime/test/orchestration-faults.test.ts` — atomicity at
   compound boundaries.
4. `packages/runtime/test/orchestration-canary.test.ts` — payload/error
   leakage.
5. `packages/kernel/test/control-graph-identity.test.ts` — canonical
   identity under reordering and semantic change.