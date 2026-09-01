# VICT Stage 03 — Independent Verification Audit

## Verdict

NOT VERIFIED — STAGE 04 BLOCKED

## Executive conclusion

Stage 03's durable join boundaries, contract-issue sanitization, keyed-write
timeout fencing, cancellation semantics, SQLite atomicity, canonical identity,
and packaging were independently reproduced with fresh adversarial graphs,
unique secret canaries, real SQLite fault injection, and a portable Node 24
run — and they held. The shared sanitizer is genuinely fail-closed across
every probed boundary; joins validate outside the store exactly once;
faulted transactions leave no half-state and retry cleanly; identity is
canonical and compiler diagnostics are stable.

However, two independent adversarial probes found real defects in the CORE
wait primitive on BOTH adapters:

1. A run with two sequential waits skips every wait after the first
   resolution — the run silently proceeds without the external signal or
   timer it declared (wake-path misidentification in the driver).
2. A plain signal wait with no declared `timeoutMs` receives an
   immediately-due wait-timeout timer; any `processDueTimers` call spuriously
   resolves the wait and blocks the run, which is then unrecoverable except
   by fail/cancel.

A third defect makes the documented operator `fail` action on a blocked run
throw unconditionally (`RUN_TRANSITIONS.blocked` omits `'failed'`). Finally,
the mandatory `npm run lint` gate fails at the audit target (61 errors), and
the implementation report's claim "eslint clean" is false.

Wait-boundary bypass is contract-boundary bypass in durable orchestration:
Stage 04 is blocked until these are fixed and re-verified.

## Audit target and environment

| Item | Observed |
| --- | --- |
| Repository | https://github.com/radz2291/vict-02 (fresh clone) |
| `origin/main` after fetch | `11bbae5c17cf174fefdce1f10ec443d399e63647` — exact match |
| Stage 02 verified closure in history | `644c84f8` present in commit chain |
| Commit chain | `53cddeb` → `9c4fc27` → `11bbae5` all present, in order |
| OS | Windows 11 Pro (MINGW64_NT-10.0-26200), win32 |
| Architecture | AMD64 (x64) |
| Node (primary) | v22.13.1 |
| Node (secondary, portable) | v24.10.0 (downloaded during audit; both available, both tested) |
| npm | 10.9.2 (Node 22) / 11.6.1 (Node 24) |
| Git | 2.50.1.windows.1 |
| Initial `git status --short` | empty (clean fresh clone) |
| Audit modifications | temporary adversarial scripts only (removed before commit); final diff = this report only |

## Command evidence

All commands executed from the fresh clone on Node v22.13.1 unless noted.
Node 24 ladder re-ran the full suite with Node v24.10.0.

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | 48 packages, 0 vulnerabilities |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | **1** | **61 errors (0 warnings)** across src and test files (`no-unused-vars`, `prefer-const`, `no-useless-assignment`, `no-unused-private-class-members`); also fails identically under Node 24 |
| `npm run typecheck` (before build) | 1 | `store-sqlite` test fixture imports `../../dist/index.js`; fails until `npm run build` — typecheck depends on build artifacts (fresh-clone ordering matters) |
| `npm run typecheck` (after build) | 0 | strict, no errors |
| `npm run build` | 0 | all five packages build |
| `npm run test:unit` | 0 | 30 files / 335 tests passed |
| `npm run test:unit` (runs 2, 3) | 0 | 335/335, 335/335 (three consecutive green) |
| `npm run test:integration` | 0 | 1 file / 4 tests passed |
| `npm test` | 0 | 31 files / 339 tests passed |
| `npm test` (run 2) | 0 | 339/339 (two consecutive green) |
| `npm run verify:consumer` | 0 | neutral + zod + orchestration consumers on packed tarballs |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run example` | 0 | ARA proof: **13 ordered events** (00 run.started → 12 run.completed), offline |
| `npm run bench` | 0 | bench-three-node-pure: 3 nodes / 2 edges / **10 events per completed run**; durable orchestration round-trip and timer-wait sections present; SQLite file-backed with `synchronous=FULL` |
| `npm run verify:stage3` | 0 | build + unit + integration + offline proof (9 nodes/10 edges, 31 semantic events, exactly 1 external ledger mutation) + packed orchestration consumer |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | 0 | clean |
| Node 24.10.0: format:check / lint / typecheck / build | 0 / **1** / 0 / 0 | lint fails identically on Node 24 |
| Node 24.10.0: test:unit / test / test:integration / example / verify:consumer | 0 | 335/335, 339/339, 4/4 |
| `npx vitest run packages/store-sqlite/test/orchestration-restart.test.ts` | 0 | 6/6 real-process fixtures (SIGKILL pure attempt, keyed-write external commit, partial fan-out SIGKILL, terminal join close/reopen) |

Independent adversarial probes (temporary scripts, since removed): join
boundaries, contract-issue canaries, races/timeouts, cancellation, fault
injection, identity/compiler, plus focused defect probes. All executed on
BOTH the in-memory and SQLite adapters unless noted.

## Join-boundary verification

Independent adversarial graphs (not the bundled join suite), both adapters:

- **Accepting contract**: activation ok; run completed; join parser invoked
  exactly once; downstream executed once; canonical join input keys exactly
  `["a","b"]` (lexicographic); exactly one `join.completed` event. PASS.
- **Rejecting contract**: parser invoked exactly once; no downstream
  invocation; no `join.completed` committed; run failed durably with stable
  sanitized code `VICT_KERNEL_CONTRACT_REJECTED`; raw parser content absent
  from error, trace, and stored events; SQLite close/reopen preserved the
  terminal failure with the same code and did not re-invoke the parser. PASS.
- **Transforming contract**: the parser's transformed value (not the
  canonical original) reached the downstream boundary; the downstream
  boundary invoked its own contract parse separately (stage-distinguishing
  parser proved the join-stage transform ran once and the downstream stage
  received the transformed shape). PASS.
- **Terminal join (zero success edges)**: completed with the validated
  transformed output in `RunResult.output` in-process; default run history
  contained no payload value (summary-only); no undefined node or
  continuation identifiers in events; close/reopen preserved terminal
  status with no parser re-invocation; rejecting terminal join failed
  safely with no unhandled exception. PASS.
- **Reverse branch-completion order**: identical canonical join input
  (a-then-b) under forced reverse order. PASS.
- **Concurrent final arrivals** (shared barrier, concurrency 4): exactly one
  `join.completed`, downstream executed once. PASS.
- **Duplicate/stale completions**: recovery of a terminal run added zero
  events; downstream still exactly once. PASS.
- **Join validation outside the store**: `contract.parse` never appears in
  either store adapter (grep-verified); the driver validates between the
  claim and the completion transition. Author parser invocation counts stay
  exactly once. PASS.
- Compiler note: declaring a join contract under the wrong field name
  (`outputContractId` instead of the schema's `output`) compiles cleanly and
  the contract is silently never executed (probe-verified). See LOW-2.

## Contract-issue and payload safety

Unique random markers injected independently into issue `code`, `path`,
`message`, `expected`, `received`, `safeMessage`, extra nested properties,
array entries, payload-derived dynamic keys, and plain non-object issue
entries (42, null, raw strings). Boundaries exercised: sequential input,
sequential output, durable input, durable output, join output, signal, and
operator `confirm_applied`.

- Every `contract.rejected` observable carried ONLY the closed allowlist
  codes / `untrusted_issue` fallback, ordinal paths (`issues[0]`), and
  framework-generated messages. Zero markers in: `onEvent` events,
  `RunResult.trace`, `RunResult.error`, run records, default history,
  wait descriptors, signal receipts, stored events, and — for the durable
  runs — a **whole-database dump of every table** (events, tokens, attempts,
  waits, timers, receipts, cancellations, operator resolutions, branch
  results). PASS on both engines and both adapters.
- Sequential and durable engines emit the identical sanitized shape.
- Successful `RunResult.output` still returns the actual validated
  application output (nested payloads intact), while the default retained
  history contains no payload values. PASS.
- Signal payload rejection returns a fixed framework message; the payload
  value is absent from receipts, waits, and the whole DB (payloads live only
  in the private checkpoint boundary). PASS.
- Cancellation reason codes: invalid codes rejected with a non-echoing
  message; persisted reason codes only from `{operator_request, shutdown,
  policy, superseded}`. PASS.
- Thrown-getter issue objects: a hostile parser whose issue `code` getter
  throws does NOT leak, but wedges the durable run (see LOW-1).

## Signals, timers and timeout races

Manual clock (`createManualOrchestrationClock`) injected as BOTH the runtime
clock and the orchestration time port; no wall-clock guessing in the race
probes. Both adapters:

- **Signal vs due timeout**: signal wins with exactly one `run.resumed`;
  advancing past the timeout afterwards produces NO second transition and no
  `timer.fired` for the resolved wait. PASS.
- **Timeout-first, then late signal**: late signal returns
  `already_resolved`; exactly one `run.resumed` and one `timer.fired`. PASS.
- **Repeated timer polling**: idempotent. PASS.
- **Keyed-write timeout (full deterministic sequence)**: attempt one held
  behind a test barrier → persisted deadline advanced → `node.timed_out`
  committed → exactly ONE durable retry timer (`node.retry_scheduled` +
  `timer.scheduled` kind `retry`) → attempt two used the SAME idempotency
  key (external ledger equivalent) → the late attempt-one value was fenced
  (accepted output is attempt two's; exactly one `node.completed`) → run
  completed within the attempt bound. PASS on both adapters. The manual
  clock is genuinely wired into both runtime deadline computation and
  orchestration timer eligibility (deadline racing moved only when the test
  advanced the clock).
- **Retry timers survive SQLite close/reopen**: retry timer persisted;
  after reopen + clock advance + pump the retry completed with `ok`. PASS.
- **Irreversible timeout**: run `blocked`; pumping and resuming did NOT
  re-invoke the irreversible capability (invocation count stayed 1). PASS.
- **Unsafe non-keyed write timeout**: blocks (plan routes
  `VICT_ORCH_OUTCOME_UNKNOWN`); verified in code and by the passing race
  suite; irreversible work never auto-replays.
- **Timer ordering**: deterministic due times (monotone). PASS — but see
  HIGH-2 for a plain-signal-wait defect and HIGH-1 for skipped second waits
  (the two-timer chain never schedules the second timer).

## Cancellation

Barrier-controlled active capabilities, both adapters:

- Cancel before the next claim: nothing invoked afterwards (second
  capability invocation count 0). PASS.
- Cancel with an in-flight attempt: request accepted; the capability's
  abort signal was observed; downstream never started; exactly one
  `run.cancelled`; duplicate (same ID, same content) is `duplicate`;
  late `resumeRun` cannot resurrect (stays `cancelled`). PASS.
- Competing cancellation IDs: exactly one `run.cancelled`. PASS.
- Invalid reason codes: rejected with a non-echoing safe error. PASS.
- Fan-out cancellation mid-join: no unfinished ready/claimed/waiting
  sibling tokens remained; the completed branch fact remained completed;
  no `join.completed` (join never validated). PASS.
- In-flight irreversible + cancel: the non-cooperative capability may
  complete after the request; the run then finalizes per the completion
  (documented cooperative-abort semantics; the request is recorded and
  nothing is replayed or claimed reversed). Informational — see INFO-2.
- `abortInflight` ownership: controllers are per-attempt, tracked per run,
  untracked after the attempt settles; no cross-run or stale-controller
  effects (code inspection + behavior).

## Attempts, fencing and effects

- Durable intent before invocation: claim transaction commits the attempt
  row and `node.started` before the handler runs (store code inspection;
  verified by the SIGKILL pure-attempt fixture: intent committed, stale
  result fenced, one policy retry completes). PASS.
- Two claimers cannot own one token; completion requires the current owner
  and fence (shared race suite, both adapters, plus the late-completion
  fencing in my keyed-write probe). PASS.
- `outcome_unknown` is terminal for attempts (kernel `ATTEMPT_TRANSITIONS`
  → `outcome_unknown: []`); a late handler cannot reopen or commit after
  fence loss. Verified by code inspection and the passing race suite.
- Attempt numbers increase; logical invocation ID and idempotency key
  stable across retry (proven directly in the keyed-write probe: same key
  across attempts one and two).
- Max attempts enforced (compiler rejects `maxAttempts > 10`; probe).
- Retry classification uses stable codes only: capability throws are
  wrapped as `VICT_RUNTIME_CAPABILITY_THREW` with the thrown message never
  retained (canary-verified); `timeout` is a stable code.

## Fan-out and crash recovery

Real child processes + real SQLite file (restart fixture suite, 6/6 green,
fixture code independently read and confirmed: external ledger counts actual
cross-process invocations; SIGKILL mid-branch):

- **Partial fan-out SIGKILL**: branch `a` invoked exactly ONCE across both
  processes (never re-invoked after the crash); branch `b` twice (killed
  attempt + recovered attempt of the same logical invocation); join
  contract parsed exactly once; final status completed. Confirmed.
- **Terminal join close/reopen**: exactly one `join.completed` and one
  `run.resumed` in the durable event ledger; canonical output across the
  restart boundary; `joinParse` exactly once. Confirmed.
- **Signal-wait restart / offline timer / keyed-write death after external
  commit**: fixture-verified; my keyed-write race probe independently
  confirmed same-key retry and fencing.
- **Exact activation**: the full 8-step sequence (suspend under A, select
  B, resume under A, restart with both, restart without A artifacts) is
  covered by the corrective suite and passed; additionally, my probes hit
  fail-closed exact-activation twice incidentally (fresh runtime without
  registered code → `VICT_RUNTIME_ACTIVATION_UNAVAILABLE`/UNKNOWN_CAPABILITY,
  never a substitute revision). My identity probe separately proved a
  stored activation restores exactly against revision-pinned lookups and
  fails closed on a capability revision mismatch. PASS.
- **Terminal join across close/reopen**: PASS (join probe + fixture).
- No recovery path mutated definitions, permissions, or pinned activation
  identity (activation snapshots immutable; identity probe PASS).

## Exact-activation recovery

- New runs follow the newly selected activation; a suspended run completes
  under its pinned activation (corrective suite + fixture evidence).
- Restart without pinned artifacts fails closed
  (`VICT_RUNTIME_ACTIVATION_UNAVAILABLE`); the newer activation is never
  substituted (suite + incidental probe evidence).

## SQLite atomicity

Independent fault injection via the store's real transaction hooks
(`beforeCommit` = immediately before COMMIT, inside the real transaction),
with direct inspection of EVERY table in the database file after each fault,
then one clean retry of the same logical command. Boundaries probed:

| Boundary | Fault surfaced | Half-state after fault | Clean retry |
| --- | --- | --- | --- |
| run creation | yes | no run.started event, no attempt rows, no tokens | completes once |
| attempt claim | yes | no attempt rows, no node.started | completes once |
| attempt completion | swallowed by worker (INFO-1); attempt stays claimed until lease recovery | no `node.completed` committed | completes once |
| wait creation (completion form) | yes | no partial wait/timer | — |
| signal resolution | yes | no receipt, no `run.resumed` | accepted once |
| timer resolution | yes | no `timer.fired`; timer row retained (recoverable) | completes once |
| cancellation request | yes | no `run.cancelled` | cancels once |
| cancellation application (in-flight case) | yes | request committed, terminal event NOT committed | cancels once |
| fork child creation / join arrival / terminal cleanup (completion forms) | fault inside the atomic transition | no `join.completed`, no partial branch set | completes once, one join |
| operator resolution | yes | no `operator.intervened` | one clean transition |
| attempt recovery | yes | no duplicate attempt | completes once |

No half-state, skipped/duplicated event sequence, orphan timer, orphan
wait, partial branch set, join event without validated completion,
downstream token without accepted transition, lost receipt, operator event
without applied resolution, or terminal event without terminal run state
was observed. Every non-atomic boundary would have been High; none found.

Note: the quiescent-run cancel path applies the terminal cancellation event
atomically INSIDE the request transaction (the separate
`orchestration.applyCancellation` operation runs only when work is
in-flight). Semantically correct; verified both ways.

## Identity and compiler verification

All probes PASS (independent script, fresh runtimes):

- Reordered equivalent node/edge declarations → identical `graphVersion`
  and `activationVersion`.
- Changed decision route, changed branch key, changed retry semantics,
  changed output contract, join output contract, and effect/idempotency
  metadata each → different identity.
- Capability-only graphs keep the Stage 02 path: activation publishes and a
  fresh runtime over the same stores restores exactly; a capability
  revision mismatch fails closed.
- Compiler rejects (all verified): malformed decision route (no route
  edges), duplicate branch keys, fork/join mismatch, escaping branch
  region, write retry without keyed idempotency, irreversible retry,
  invalid retry bounds (maxAttempts > 10), signal timeout without timeout
  edge, unknown join output contract, unsupported nested fan-out,
  non-pure decision capability.
- Function bodies, timestamps, randomness, insertion order: not part of
  identity (reordered + re-created runtimes produce identical versions).

## Package and regression verification

- All five public packages build; `verify:consumer` packs fresh dist
  output and runs neutral consumers (no direct Zod install/import), the
  optional Zod subpath, and a packed SQLite consumer that closes, reopens,
  signals, and resumes. PASS.
- Dependency graph acyclic: contracts ← kernel ← runtime ← store-sqlite;
  sdk layered on top (package.json dependencies verified).
- No Stage 04 surface introduced: exported surfaces are Stage 02/03 only;
  no control-plane/HTTP/roles/approval APIs present.
- Regressions preserved: ARA offline proof 13 events; benchmark
  three-node semantics 10 events per completed run; simulation/test
  doubles fail-closed (Stage 02 suites green); irreversible execution
  denied without explicit authorization (probe-verified denial); durable-
  before-invocation enforced (SIGKILL fixture); activation snapshots
  immutable; default retention summary-safe (canary-verified); cycle and
  maximum-step protection intact (compiler rejections); error-edge routing
  and `error`-field-as-application-data behavior covered by the passing
  Stage 02 suites.

## Claim matrix

| Claim | Verified/Partial/False | Independent evidence | Severity |
| --- | --- | --- | --- |
| Join contracts execute at the join, exactly once, outside the store | Verified | adv-join probes, both adapters; grep: no `contract.parse` in stores | — |
| `join.completed` commits only in the validated-completion transition | Verified | rejecting contract probe: zero `join.completed`; accepting: exactly one | — |
| Terminal joins validate, complete with validated output, atomic, reopen-safe | Verified | adv-join terminal probes + restart fixture | — |
| All validation boundaries use the shared fail-closed sanitizer | Verified | adv-canary: 7 boundaries, 10 marker classes, whole-DB scan, both engines | — |
| Every material SQLite transition is fault tested | Verified | adv-faults: 11 boundaries, real rollback, DB inspection, clean retry | — |
| Timeout/race tests are deterministic (manual clock both ports) | Verified | adv-races keyed-write sequence advanced only by the test clock | — |
| Five consecutive unit + three consecutive full suite passes | Partial | I observed three consecutive 335/335 unit runs and two consecutive 339/339 full runs (plus Node 24: 335/339/4 green). Stable; exact claimed counts not reproducible from a fresh audit session | Informational |
| Fresh-clone verification does not use stale artifacts | Verified | fresh clone; typecheck fails without a prior build (dist-dependent fixture), `verify:stage3` builds first | — |
| Owner worktree changes were preserved | Not independently tested | owner worktree state is outside repository history | — |
| Stage 04 was not begun | Verified | no Stage 04 surfaces in exports, packages, or scripts | — |
| `npm run lint` exits 0 ("eslint clean") | **False** | exit 1 with 61 errors on Node 22.13.1 and Node 24.10.0 at `11bbae5` | Medium |
| Node 24 "was NOT available on the verification machine" | Honest limitation | I made it available (portable v24.10.0); all suites pass; lint fails on both | Informational |
| Cancellation aborts in-flight work and leaves no unfinished siblings | Verified (with a documented cooperative race) | adv-cancel probes; see INFO-2 | — |
| Operator actions retry/confirm_applied/fail/cancel on blocked runs | **Partial — `fail` always throws** | see HIGH-3 | High |

## Findings

| ID | Severity | Finding | Evidence | Required correction |
| --- | --- | --- | --- | --- |
| HIGH-1 | High | **Sequential waits on the same root lineage skip every wait after the first resolution.** The driver's wait-node wake-path check (`waits.some(w => w.tokenId === claim.token.tokenId && w.status === 'resolved')`, `orchestration-driver.ts`) keys only on tokenId, which is shared along a linear lineage. After the first wait resolves, every later wait's FIRST claim sees the stale resolved record and takes the wake path — it never parks, creates no wait record or timer, and the run silently proceeds. A graph with two sequential signal waits completes after ONE signal; the declared `second` wait is bypassed. Reproduced on in-memory AND SQLite. | `probe-waitchain`: status after first signal = `completed` (should be `waiting`); events contain no second `run.waiting`/`timer.scheduled`; the `second` signal was never delivered. Same result on both adapters. | Bind the wake-path decision to the specific wait node/waitId of the claimed token (or per-node resolution state), not merely to "a resolved wait exists for this tokenId". Add a conformance case with two sequential waits. |
| HIGH-2 | High | **Every plain signal wait (no declared `timeoutMs`) receives an immediately-due wait-timeout timer; the due-timer pump spuriously resolves it and blocks the run.** The compiled manifest normalizes absent `timeoutMs` to `null`, but the planner checks `wait.timeoutMs !== undefined` and computes `input.now + null` = `now` (`orchestration-plan.ts:259`). A `wait-timeout` timer due at creation time is scheduled; any `processDueTimers` call fires it and forces the waiting run out of its wait (`timer.fired` + `run.blocked`). The run is then unrecoverable: the legitimate signal returns `already_resolved`, operator retry is denied (no retry policy), confirm_applied is impossible (wait nodes have no output contract); only fail/cancel remain. Reproduced on in-memory AND SQLite. Waits that declare `timeoutMs` are unaffected. | `probe-sigtimeout`: `timeoutAt == createdAt` on a signal wait with no timeout; one pump → `timer.fired` + `run.blocked`. `probe-sigblocked`: signal `already_resolved`, operator retry/confirm denied, run stuck `blocked`. Both adapters. | Use a null-safe check (`wait.timeoutMs != null`) when deriving `timeoutAt`, and do not schedule a wait-timeout timer for waits that declare no timeout. Add a conformance case: pump due timers while a plain signal wait is open — the wait must survive. |
| HIGH-3 | High | **The documented operator `fail` action on a blocked run always throws.** `RUN_TRANSITIONS.blocked` (`kernel/orchestration-state.ts`) omits `'failed'`, so `resolveBlocked(action: 'fail')` throws `VICT_STORE_RUN_CONFLICT` ("The run cannot fail from its status") on BOTH adapters. `cancel` works; `retry`/`confirm_applied` are enforced elsewhere. The architecture document (§9) and the report list `fail` as a supported action. | `probe-opfail`: run `blocked` (token `n:blocked`), authorized runtime, action `fail` → `VICT_STORE_RUN_CONFLICT` from the in-memory store (line 1426) and the SQLite adapter (line 1890, same guard). | Add `'failed'` to the blocked run transitions (or route the operator fail through the legal terminal path), and add a conformance case resolving a blocked run with `fail`. |
| MED-1 | Medium | **The mandatory `npm run lint` gate fails at the audit target**: exit 1 with 61 errors (unused vars, `prefer-const`, `no-useless-assignment`, unused private class members) across production-adjacent and test files. The implementation report's verification table claims lint exits 0 / "eslint clean" — false at `11bbae5`. An unreliable verification gate. | Fresh-clone `npm run lint` and direct `npx eslint .`; identical failure on Node 24.10.0. | Fix the 61 lint errors (or correctly scope test files in the eslint config) and make the gate pass on a fresh clone before re-audit. |
| LOW-1 | Low | A throwing author contract parser (or an issue object with a throwing getter) wedges the durable run: `#executeAttempt` throws outside the completion boundary, the worker loop swallows it (`attempt.catch(() => undefined)`), no diagnostic is committed, and lease recovery re-claims and re-throws indefinitely (observed 4+ cycles, run still `running`, event ledger growing). The sequential engine propagates the throw to the caller instead — inconsistent handling of the same author error. | adv-throw probe: repeated recoveries, status stays `running`; thrown marker never persisted (no leak). | Wrap author `contract.parse` calls in the driver; convert a parser throw into a sanitized terminal failure (or classify per effect policy) instead of silently wedging. |
| LOW-2 | Low | The compiler silently ignores unknown node fields: declaring a join/capability contract as `outputContractId` (instead of the schema field `output`) compiles cleanly and the declared contract is never enforced — the run completes past a "declared" boundary. TypeScript catches the typo, but JS authors are exposed. | `probe-joincontract`: `outputContractId: 'probe-join'` on a join node → activation ok, `parseCalls: 0`, `join.completed` committed. | Reject unknown node fields at compile time (or at least warn with a stable diagnostic). |
| INFO-1 | Informational | Store failures during `completeAttempt` are silently swallowed by the worker loop; the attempt stays claimed until lease lapse, then recovery completes the same logical command exactly once (verified). Accepted design (bounded conflict re-derivation), but a committed diagnostic or surfaced error would make the wedge observable. | adv-faults: fault swallowed, no half-state, clean single completion after recovery. | Consider emitting a durable diagnostic event when a completion commit fails outside the conflict-retry envelope. |
| INFO-2 | Informational | Cancellation of an in-flight non-cooperative capability: the attempt may complete after the durable cancel request; the run then finalizes per that completion (e.g. `completed` for a terminal node) while the request stays recorded. This matches the documented cooperative-abort semantics ("never a claim that external effects were undone"); no replay or reversal occurs. | adv-cancel c5. | None (accepted trust boundary); consider documenting the cancel-vs-in-flight-completion race explicitly. |
| INFO-2b | Informational | The implementation report claims "five consecutive unit and three consecutive full suite runs"; a fresh audit can attest three consecutive unit runs and two consecutive full runs (all green, plus a Node 24 ladder). The claimed exact counts could not be reproduced from a fresh session. | Repetition runs in this audit. | None (behavior is stable); report counts should match reproducible evidence. |

## Severity summary

- Critical: 0
- High: 3 (HIGH-1 skipped sequential waits, HIGH-2 spurious immediate wait-timeout on plain signal waits, HIGH-3 operator `fail` action always throws)
- Medium: 1 (MED-1 mandatory lint gate fails; report claim "eslint clean" false)
- Low: 2 (LOW-1 throwing-parser wedge, LOW-2 compiler ignores unknown node fields)
- Informational: 3 (INFO-1 swallowed completion faults, INFO-2 cancel race semantics, INFO-2b consecutive-run claim counts; plus Node 24 availability note)

## Remaining limitations

- Node 22.13.1 and Node 24.10.0 (portable) were both available and both
  fully exercised; all suites pass on both. npm 10.9.2 / 11.6.2-adjacent
  versions observed (11.6.1 under Node 24).
- The "owner worktree changes preserved" claim is not verifiable from
  repository contents alone (not independently tested).
- The ARA example output does not print node/edge counts; the 13-event
  count was verified directly. The benchmark script does not print a
  per-run validation count, so the "6 validations" detail was not
  independently observable (10 events per completed run was).
- Local SQLite remains a trusted local deployment; checkpoint bytes are not
  a multi-tenant secret store (accepted Stage 03 boundary; Stage 04 owns the
  secret/artifact platform).
- This audit did not begin Stage 04 and did not modify
  `docs/VICT-SYSTEM-REFERENCE.md`.

## Stage 04 readiness

NO

## Required corrections

Genuine blockers only:

1. **HIGH-1** — restore correct multi-wait sequencing: a wait node must park
   on its own first claim regardless of other (earlier) resolved waits on
   the same lineage; add a two-sequential-waits conformance case on both
   adapters.
2. **HIGH-2** — never schedule a wait-timeout timer for a signal wait
   without a declared `timeoutMs` (`timeoutAt` must be null when
   `timeoutMs` is absent/null); add a conformance case pumping due timers
   while a plain signal wait is open; also make the resulting wait-timeout
   resolution path safe when no timeout edge exists.
3. **HIGH-3** — make the operator `fail` action on a blocked run a legal
   transition (state machine + both adapters) with a conformance case.
4. **MED-1** — restore `npm run lint` to exit 0 on a fresh clone and
   correct the report's lint claim.

After correction, re-run the full ladder (including `npm run lint`) on
Node 22.13.x and re-verify the three findings with adversarial probes
before Stage 04.

## Recommendation

Stage 03's join, sanitization, fencing, atomicity, identity, and packaging
work is strong and independently reproducible, and the two confirmed
wait-primitive defects are precisely scoped (driver wake-path condition;
planner `timeoutMs` null-check; kernel run-transition table). Fix the three
High findings and the lint gate, then re-submit for a focused re-audit of
those areas. Stage 04 remains blocked until then.

Stage 03 independent audit is complete. Stage 04 remains blocked.