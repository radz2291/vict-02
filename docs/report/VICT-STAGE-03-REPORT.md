# VICT — Stage 03 Implementation Report

## Outcome

`READY FOR INDEPENDENT AUDIT`

Stage 03 durable orchestration is implemented, corrected against two
confirmed boundary-enforcement defects (join contracts were not executed;
terminal joins were undefined), extended with direct adversarial evidence
for the mandatory invariants of the Stage 03 handoff (§§23–24), and
verified end to end. This report records only executed evidence; the
system reference is NOT marked `Verified` — independent verification and
owner acceptance happen first.

## Starting state (corrective finalization)

| Item | Value |
| --- | --- |
| Corrective base | `b82638a472b585477006e8ee329dacfc5f8d025b` (== `origin/main`, confirmed via `git fetch`) |
| Stage 02 verified closure | `644c84f807b677535b36b3ccc4112ecad18853c5` |
| Node / npm | v22.13.1 / 10.9.2 (win32-x64, MINGW64) |
| Owner worktree changes | preserved untouched (moved report/handoff docs) |
| Baseline suites at base | 29 files / 248 unit tests + 4 integration tests, all Stage 03 verifiers PASS |

## Corrected join transaction sequence (RUN-002)

Confirmed defect at `b82638a`: a join node's declared output contract was
never executed — the compiler stripped `outputContractId` from control
nodes, the branch-arrival continuation jumped straight past the join, and
the activation manifest's contract environment omitted the join's
contract. An adversarial graph observed `join parse calls: 0`,
`downstream invocations: 1`, `run status: completed`.

Corrected sequence (both adapters):

1. The final branch arrival transaction atomically records the branch
   result and creates exactly ONE join-ready token **at the join node**,
   carrying the private canonical checkpoint (lexicographically sorted
   branch keys).
2. The runtime claims that join token as durable intent under the run's
   exact pinned activation.
3. The runtime validates the join's declared output contract OUTSIDE any
   persistence transaction (author parsers never run in the store).
4. One atomic transition records either the validated join completion with
   its downstream continuation (or terminal completion), or a sanitized
   join contract failure and terminal failure.
5. `join.completed` is committed exactly once, in the validated-completion
   transition — never by the store at arrival time, and never for a
   rejecting contract.

Supporting corrections discovered and fixed during the work:

- the activation manifest's `contracts` array was snapshotted before join
  output contracts were recorded (join-only contracts went missing);
- a resolved wait advancing into a fork's join bypassed the durable
  branch-arrival boundary (it now re-plans and routes through it);
- pinned capability bindings dropped the declared `idempotency`, so
  keyed-write timeout retries were misclassified as ambiguous (blocked);
- contract `issues` entering events are now sanitized to a bounded,
  character-restricted `code`/`path` (hostile parsers cannot leak raw
  messages, payload echoes, or nested secrets);
- `cancelRun` did not map the store's `duplicate` status;
- per-run effect-policy overrides were silently dropped for orchestration
  runs;
- a faulted due-timer resolution left the timer leased in `firing` forever
  (wakes could be lost); lapsed `firing` leases are now reclaimable;
- `outcome_unknown` is now a TERMINAL attempt state — the late result of a
  genuinely still-running handler whose lease was recovered is rejected
  after fence loss, never applied;
- SQLite stored `continuation.joinId` (not `child.forkId`) in fork child
  tokens' `fork_id`, diverging from the in-memory adapter.

## Terminal joins

A join with zero success edges is a terminal join. It validates its
declared output contract; on success the run completes with the validated
(possibly transformed) canonical join output in `RunResult.output`, while
default retained history continues to hold only the configured safe
summary; on contract rejection the run fails safely and durably with a
sanitized structured error. No undefined node or continuation identifier
is ever constructed, and terminal cleanup plus events commit atomically.
The behavior is identical for the in-memory and SQLite adapters (shared
conformance suite) and survives SQLite close/reopen (real-process
fixture).

## Architecture delivered

**Kernel** (`packages/kernel`): decision/wait/fork/join nodes, typed
`route`/`branch`/`timeout` edges, bounded `RetryPolicy`, `timeoutMs`,
`DecisionResult`; `compileGraph` control validation with stable
diagnostics; `vict.graph@2` canonical form (capability-only graphs keep
byte-compatible `vict.graph@1`/`vict.activation@1` identity); pure
orchestration state machines, deterministic backoff, join canonicalization,
quiescence derivation.

**Durable store port** (`packages/runtime/src/orchestration-store-types.ts`):
createOrchestrationRun, claimReadyToken (atomic claim + attempt intent +
`node.started`), completeAttempt (attempt terminal state, token movement,
waits, fork children, branch arrivals with exactly-once join-ready token
creation, retry timers, blocks, run status, checkpoints, dense events —
one transaction), signalWait, claimDueTimers/resolveDueTimer (with
lease-lapse recovery), requestCancellation/applyCancellation,
findRecoverableClaims/recoverAttempt, resolveBlocked. Implemented by the
in-memory adapter and the SQLite adapter against shared conformance suites.

**Driver** (`orchestration-driver.ts`): bounded worker pool (default 4,
max 32), durable-before-invocation, cooperative deadline + abort racing,
join validation outside the store, effect-aware ambiguity, conflict
re-derivation, cooperative abort of in-flight contexts on cancellation.

**Runtime facade**: `run` dispatch (sequential vs durable engines),
`resumeRun` (exact pinned activation), `signal`, `cancel` (with
`abortInflight`), `processDueTimers`, `recoverOrchestration`,
`resolveBlocked` (operator authorization denied by default).

**SQLite** (`packages/store-sqlite`): migration v2, orchestration adapter,
forward migration from real Stage 02 databases (fixture-proven).

## Files changed (corrective finalization)

**Kernel**
- `packages/kernel/src/compile.ts` — join nodes KEEP their declared output
  contract in the compiled graph (control nodes otherwise drop it).
- `packages/kernel/src/orchestration-state.ts` — `outcome_unknown` is
  terminal for attempts (fencing hardening).

**Runtime / adapters**
- `packages/runtime/src/orchestration-plan.ts` — join-ready token created
  AT the join node; resolved waits re-plan through branch arrival.
- `packages/runtime/src/orchestration-driver.ts` — durable join boundary
  (claim → validate contract outside the store → one atomic transition);
  sanitized `join.completed`; contract-issue sanitization
  (`safeContractIssues`); in-flight abort-context tracking;
  per-run policy overrides honored.
- `packages/runtime/src/orchestration-in-memory.ts` — join-ready token at
  the join node; store no longer appends `join.completed`; timer
  lease-lapse recovery.
- `packages/store-sqlite/src/orchestration-adapter.ts` — same join
  semantics on SQLite; timer recovery; child-token `fork_id` parity fix.
- `packages/runtime/src/runtime.ts` — manifest contracts snapshot ordering
  fix (join-only contracts); `cancel` triggers cooperative abort; per-run
  policy pass-through.
- `packages/runtime/src/orchestration-commands.ts` — cancellation
  `duplicate` status mapping; already-applied operator resolutions
  short-circuit truthfully from the durable record.
- `packages/runtime/src/orchestration-activation.ts` +
  `packages/runtime/src/registry.ts` — pinned bindings carry the declared
  `idempotency`.
- `packages/kernel/src/compile.ts` (join output contract retained).

**Tests**
- `packages/runtime/src/orchestration-join-conformance.ts` (new) — shared
  join-boundary suite: accepting/rejecting/transforming contracts,
  downstream input independence, reverse branch order, concurrent final
  arrivals, duplicate/stale arrival rejection, terminal joins.
- `packages/runtime/src/orchestration-race-conformance.ts` (new) — shared
  race/adversarial suite: claim exclusivity, stale-owner fencing with
  lease recovery, durable intent before invocation, signal-vs-timeout race
  (both winner orders), keyed-write timeout retries with stable keys,
  irreversible timeout blocking, timer pump idempotence, cancellation
  (late completion, abort observation, fan-out siblings, duplicate/competing
  IDs), unhandled branch failure, public `resolveBlocked` surface.
- `packages/store-sqlite/test/orchestration-corrective.test.ts` (new) —
  SQLite fault injection at every material boundary (real transaction
  rollback), retry timers surviving close/reopen, exact-activation full
  sequence across close/reopen and fail-closed without artifacts.
- `packages/runtime/test/orchestration-canary.test.ts` — additional
  sources (hostile join-contract message, join output, operator flow).
- `packages/store-sqlite/test/fixtures/orchestration-worker.mts` +
  `orchestration-restart.test.ts` — partial fan-out SIGKILL fixture and
  terminal-join close/reopen fixture.
- Adapter conformance test files wire the join + race suites into BOTH
  backends.

**Tooling**
- `scripts/verify-stage3.mjs` — now builds the workspace FIRST, so packed
  consumers never package stale `dist` output.

**Documentation**
- `docs/architecture/STAGE-03-DURABLE-ORCHESTRATION.md` — new §5 (durable
  join boundaries, transaction sequence, terminal joins, issue
  sanitization), cancellation abort semantics, timer recovery, fault
  coverage.
- `README.md` (join/orchestration sections unchanged from the initial
  Stage 03 documentation; still accurate).

## Verification evidence (corrective finalization)

All commands exit 0. Observed from the actual runs:

| Command | Exit | Observed |
| --- | --- | --- |
| `npm ci` | 0 | 48 packages, 0 vulnerabilities |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | 0 | eslint clean |
| `npm run typecheck` | 0 | strict, no errors |
| `npm run build` | 0 | all five packages build |
| `npm run test:unit` | 0 | **30 files / 307 tests passed** |
| `npm run test:integration` | 0 | 1 file / 4 tests passed |
| `npm test` | 0 | 311/311 |
| `npm run verify:consumer` | 0 | neutral + zod + orchestration consumers on packed tarballs |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run example` | 0 | ARA proof (13 events) |
| `npm run bench` | 0 | Stage 02 + Stage 03 sections |
| `npm run verify:stage3` | 0 | build + unit + integration + offline proof + packed orchestration consumer |
| `git diff --check` | 0 | no whitespace errors |

Targeted runs (executed individually during the corrective work):
orchestration join suite (both adapters), race suite (both adapters),
corrective SQLite fault/reopen suite, canary suite, join-boundary
regression checks, `examples/orchestration-proof` (`PROOF PASSED`).

The final count is taken from observed output of the full ladder run at
the end of this finalization (30 unit files / 307 unit tests, 1
integration file / 4 tests).

## Direct evidence for formerly missing adversarial groups

**Signal, timer and timeout races** (both adapters, shared suite):
signal-vs-due-timeout race resolves with exactly one winner; the losing
signal returns `already_resolved` with no receipt; a timeout that fires
first fences the late signal (no receipt, no wake); keyed-write timeouts
retry with the SAME idempotency key and complete once; irreversible
timeouts block without replay; retry timers are durable and survive
close/reopen; repeated due-timer polling is idempotent.

**Cancellation races** (both adapters): a run finalized cancelled after a
durable claim leaves no ready tokens and invokes nothing downstream; an
active capability observes its abort signal and unwinds; duplicate
cancellation IDs dedupe; competing IDs produce exactly one
`run.cancelled`; mid-fan-out cancellation leaves every unfinished sibling
in a non-running state while completed branches stay completed; ambiguous
unsafe effects never claim reversal.

**Attempts and fencing** (both adapters): two concurrent claims cannot own
one attempt; after lease recovery the stale owner's genuinely still-running
completion is REJECTED (the `outcome_unknown` attempt state is terminal);
attempt numbers and logical invocation IDs remain stable across recovery;
durable intent (attempt row + `node.started`) is committed and readable
before every capability invocation.

**Fan-out, join and branch recovery**: concurrent final arrivals create
one join token and one `join.completed`; duplicate/stale branch
completions are rejected by membership and fencing; one unhandled branch
failure cancels unfinished siblings and fails the run exactly once (thrown
message never enters the ledger); fork child creation and final-join
boundaries roll back atomically under injected fault and retry cleanly; a
real-process partial fan-out SIGKILL fixture proves completed branches are
never re-invoked (external ledger count 1) while the interrupted branch
resumes to completion.

**Blocked-state operator resolution** (public `resolveBlocked` surface,
both adapters): denied by default; authorized resolution limited to the
exact run and its pinned activation; `confirm_applied` validates its
output against the pinned contract; irreversible retry denied; duplicate
resolution IDs idempotent; same ID with different content conflicts; stale
expected revisions conflict; exactly one `operator.intervened` event.

**Exact activation across suspension**: full 8-step sequence including
close/reopen at every stage — resume under A completes with A's semantics
after B is selected; new runs use B; restart without the pinned artifacts
fails closed (`VICT_RUNTIME_ACTIVATION_UNAVAILABLE`) and the newer
activation is never substituted.

**Atomic fault injection** (SQLite, real transactions): fault at run
creation, attempt claim, attempt completion, signal resolution, timer
resolution, fork child creation, and final join — each leaves no half-state
(no run record, no attempt, no event, no receipt, no child tokens, no join
token respectively) and a clean retry succeeds exactly once.

**Canaries**: unique canaries injected through run input/checkpoint,
decision value, branch outputs, join output, thrown message with nested
cause, hostile contract parser message + payload echo, and the operator
resolution flow; searched across the event ledger, default (summary) run
records, public failure errors, safe errors, signal receipts, and wait
descriptors. Checkpoint payloads stay inside the private boundary and are
tombstoned at terminal transitions.

## Truthful limitations

- The due-timer pump is explicit (`runtime.processDueTimers`); no hidden
  in-process scheduler. Correctness never depends on one.
- A failed due-timer resolution leaves the timer leased in `firing` until
  the lease lapses; recovery reclaims it (never lost, but not immediate).
- Nested fan-out is rejected at compilation; dynamic (data-sized) fan-out
  is not supported.
- Irreversible effects are denied in normal execution unless explicitly
  authorized (per-run policy override); this is the accepted Night-01
  effect policy, now also honored by the durable engine.
- Local SQLite is a trusted local deployment; checkpoint bytes are not a
  multi-tenant secret store (Stage 04 owns the secret/artifact platform).
- Join contract compatibility between adjacent nodes is identity-based
  (accepted Night-01 rule), so a downstream node's input contract must be
  the same contract id as the join's output contract when both are
  declared; independence is proven by the downstream boundary rejecting
  what the join passed through and by per-boundary invocation counts.

## Deferred (Stage 04+)

Unchanged from the original Stage 03 scope: SDK dependency-direction
refactor, capability packs, control plane/approvals/roles, HTTP/SSE/CLI
surfaces, Postgres/queue backends, distributed workers, dynamic fan-out,
semantic migration of in-flight runs across activations.

## Clean-room audit sequence

```bash
git clone https://github.com/radz2291/vict-02 && cd vict-02
npm ci
npm run verify:stage3   # build + full unit/integration suites + offline proof + packed orchestration consumer
npm run verify:stage2   # Stage 02 regression closure
npm run bench           # informational measurements
```

Most important adversarial evidence:
1. `packages/store-sqlite/test/orchestration-restart.test.ts` — SIGKILL
   during a pure attempt, after an external keyed-write commit, partial
   fan-out, and terminal-join close/reopen.
2. `packages/store-sqlite/test/orchestration-corrective.test.ts` — fault
   injection at every boundary on real SQLite transactions.
3. `packages/runtime/test/orchestration-conformance.test.ts` +
   `packages/store-sqlite/test/orchestration-conformance.test.ts` — shared
   conformance + join + race suites on both adapters.
4. `packages/kernel/test/control-graph-identity.test.ts` — canonical
   identity invariants.
5. `packages/runtime/test/orchestration-faults.test.ts` +
   `orchestration-canary.test.ts` — in-memory atomicity and leakage.