# VICT Stage 03 — Audit Remediation Report

## Outcome

COMPLETE

All four mandatory findings (HIGH-1, HIGH-2, HIGH-3, MED-1) are corrected
with permanent shared conformance evidence on both adapters. The full
verification ladder passes on Node 22.13.1 and the targeted checks pass on
Node 24.10.0, including a fresh-clone verification. Stage 03 is ready for a
focused independent re-audit; this report does NOT claim independent
verification, and Stage 04 has not begun.

## Starting state

| Item | Value |
| --- | --- |
| Audited implementation SHA | `11bbae5c17cf174fefdce1f10ec443d399e63647` |
| Independent audit commit | `f8c8d5bd9388ddeed308a367d87fe8521f4a2130` |
| Remediation base (= origin/main at start) | `f8c8d5b` (contains `11bbae5`, `79430a3`, `0ca8c18`) |
| Independent disposition | NOT VERIFIED — STAGE 04 BLOCKED |
| Behavior reproduction | HIGH-1, HIGH-2, HIGH-3 all reproduced with fresh minimal probes on the in-memory adapter before any correction (HIGH-1: run completed after the first signal; HIGH-2: `timer.scheduled` kind `wait-timeout` at creation time, pump fired it; HIGH-3: `resolveBlocked` action `fail` → `VICT_STORE_RUN_CONFLICT`). MED-1 reproduced: `npm run lint` EXIT 1 with 61 errors. |

## Mandatory findings

| Finding | Corrected? | Implementation | Permanent evidence |
| --- | --- | --- | --- |
| HIGH-1 — sequential waits on one lineage bypass later waits | YES | `packages/runtime/src/orchestration-driver.ts`: wake/park decision now requires `wait.nodeId === claim.token.nodeId` in addition to `wait.tokenId` | Shared suite tests 1–2 (both adapters, incl. real SQLite close/reopen between waits) |
| HIGH-2 — plain signal waits receive an immediately-due timeout | YES | `packages/runtime/src/orchestration-plan.ts`: null-safe timeout check; `null`/absence mean no timeout | Shared suite tests 3–4 (both adapters, manual clock, pump survival, declared-timeout routing) |
| HIGH-3 — operator fail cannot transition blocked → failed | YES | `packages/kernel/src/orchestration-state.ts`: `RUN_TRANSITIONS.blocked` now includes `'failed'` | Shared suite test 5 (both adapters; denial-by-default, atomicity, idempotency, conflict, stale revision, reopen) |
| MED-1 — `npm run lint` fails with 61 errors | YES | 61 findings fixed across 17 files; zero rule changes | `npm run lint` EXIT 0 on Node 22.13.1 and Node 24.10.0, and in a fresh clone |

## Sequential-wait correction

**Root cause.** The wait node handler decided park-vs-wake with
`snapshot.waits.some(w => w.tokenId === claim.token.tokenId && w.status ===
'resolved')`. On a linear lineage every node shares one token id, so after
the FIRST wait resolved, the second wait's first claim saw that stale
resolved record, took the wake path, never parked, and the run silently
proceeded without the declared second signal.

**Corrected identity semantics.** The wake/park decision is bound to the
current wait instance — the durable pair (token identity, node identity):
`w.tokenId === claim.token.tokenId && w.nodeId === claim.token.nodeId`.
A resolved earlier wait elsewhere on the same lineage can never satisfy a
later wait. Both fields are durable store identity (persisted on
`DurableWaitState` and `DurableTokenState`); no process-local or unstable
identity is used. The first arrival parks; the post-wake execution of the
SAME node takes the wake path; replayed or duplicate first signals cannot
resolve the second wait.

**Two-wait evidence** (shared suite, both adapters; deliberately two waits
on one linear lineage so it fails under the audited implementation):

1. The run reaches the first signal wait (`waiting`, exactly one open wait).
2. The first signal resolves only that wait (`accepted`; receipts/`signal.received` counted).
3. Execution advances to and parks at the second wait (`waiting`, new
   `waitId`, `signalName: 'second'`; `mid` node invoked exactly once).
4. The run remains non-terminal (`getOrchestrationRun().status === 'waiting'`).
5. Nodes after the second wait have not executed (`done` invocation count 0).
6. Replaying the first signal returns `duplicate` (same signalId) and
   `already_resolved` (new signalId, resolved wait) and the run stays
   `waiting`.
7. Only the second declared signal permits completion (`completed`).
8. Event/receipt/continuation counts remain exactly once:
   `signal.received` 2, `run.waiting` 2, `run.resumed` 2, `run.completed` 1,
   `node.completed` 7 (entry 1 + wait-park/wake 2×2 + mid 1 + done 1),
   signal receipts 2, `mid` 1, `done` 1.
9. SQLite close/reopen between the waits (reopen BEFORE the first signal,
   and across the wake) preserves the same behavior — reopen variant test,
   real SQLite file close/reopen, artifacts re-registered identically.

## No-timeout correction

**Semantics.** The canonical `vict.graph@2` manifest normalizes an ABSENT
`timeoutMs` to `null`; the planner previously checked only `!== undefined`
and computed `input.now + null` = now, scheduling a `wait-timeout` timer due
at creation time for every plain signal wait. The corrected planner treats
BOTH `undefined` and `null` as "no timeout" and sets `timeoutAt: null`:

- `null` and absence mean no timeout — no wait-timeout timer or
  `timer.scheduled` (kind `wait-timeout`) receipt is created.
- Pumping due timers cannot resolve or block the wait.
- `timeoutMs: 0` is NOT valid in the public contract — the compiler rejects
  any declared timeout that is not a positive finite number
  (`INVALID_TIMEOUT_POLICY`, `timeoutMs <= 0`), so no zero-timeout special
  case exists; only a declared positive `timeoutMs` creates a deadline.
- The fix operates at planning time from the stored canonical manifest, so
  behavior is identical before and after serialization/restart (proven by
  the close/reopen variant of the test).

**Post-re-audit correction — 2026-09-02.** The null/absence fix and all
HIGH-2 behavioral evidence remain valid, but the explanation above about
non-positive declared wait bounds is inaccurate. The compiler validates the
node-level capability timeout, not `wait.timeoutMs` or timer-wait `delayMs`.
Finite zero/negative wait-level values currently activate and produce
immediately-due timers; non-finite values fail later at the persisted-value
boundary. `INVALID_TIMEOUT_POLICY` is not an implemented diagnostic code.
The independent re-audit classified this as LOW-3 and carried explicit
wait-level bound validation into Stage 4 before the external authoring ABI is
stabilized. This amendment preserves the original implementation claim while
correcting the accepted system record.

**Timer-pump evidence** (shared suite, both adapters, deterministic manual
clock `createManualOrchestrationClock` wired as both runtime clock and
orchestration time port; no sleeps or wall-clock timing):

1. A plain signal wait creates no timeout timer: zero `wait-timeout`
   `timer.scheduled` events, zero rows in the store's timer table, and
   `DurableWaitState.timeoutAt === null`.
2. Pumping timers immediately: `fired === 0`.
3. Advancing the manual clock by one full year and pumping: `fired === 0`.
4. The run remains parked (`waiting`) and recoverable throughout.
5. The proper signal resumes it exactly once (`accepted` → `completed`;
   `signal.received` 1, `run.resumed` 1, `done` invoked 1).
6. SQLite close/reopen does not manufacture a timer (zero timer rows and
   zero wait-timeout events after reopen; pump after reopen: `fired === 0`).
7. A wait with a declared `timeoutMs: 20` still schedules exactly one
   wait-timeout timer, and after `advance(25)` + pump it fires exactly once
   (`timer.fired` 1) and routes through its declared timeout edge to the
   fallback node (`fallback` 1, success target 0, `signal.received` 0).
8. The no-timeout wait is exercised on a graph whose wait has NO timeout
   edge (plain signal wait → success edge only) and is safe.

## Operator-failure correction

**Behavior.** `RUN_TRANSITIONS.blocked` now permits `'failed'`. The public
`runtime.resolveBlocked` API with `action: 'fail'` (unchanged code — both
store adapters already implemented the fail branch atomically; only the
kernel transition table blocked it):

- valid only for the exact blocked run, guarded by the expected run record
  revision, and resolved against the exact pinned activation;
- fails the run atomically (run terminal state + blocked-token cancellation
  + sanitized `operator.intervened` and terminal `run.failed` events in one
  transaction; SQLite applies it inside the real transaction);
- creates no downstream continuation (no ready token remains);
- is idempotent for a repeated identical resolution (`duplicate`, zero
  additional events) via the caller-supplied resolution ID + command hash;
- rejects conflicting resolutions (same ID, different action →
  `VICT_ORCH_OPERATOR_CONFLICT`) and stale revisions (fresh ID, wrong
  expected revision → `VICT_ORCH_STALE_REVISION`);
- remains denied by default (`VICT_ORCH_OPERATOR_DENIED` without explicit
  `orchestration.operatorAuthorized: true`);
- behaves identically across both adapters and after SQLite reopen (the
  terminal `failed` state and exactly-once events survive reopen).

**Permanent evidence:** shared suite test 5, executed through the actual
public `runtime.resolveBlocked` API on both adapters (no internal
shortcut). The architecture document's lifecycle diagram now records
`blocked --> failed`, and §9 documents the semantics.

## Lint restoration

**Root cause.** 61 ESLint errors across 17 files had accumulated around the
Stage 03 implementation: ~52 unused variables/imports/types (including six
unused `updatedRun` row reads, unused command-type imports in both stores,
and dead counters), 3 `prefer-const` violations, 1 `no-useless-assignment`
(a fault-test variable whose initial value was always overwritten), and 1
`no-unused-private-class-members` (a dead `#eventEnvelope` helper in the
driver).

**Resolution.** Every finding was fixed individually: genuinely dead code
was removed (`#eventEnvelope`, an unused `immutable` helper, an unused
`tombstoneCheckpoints` helper, unused type imports, unused counters), real
variables were converted to `const`, and one actually-used `updatedRun`
re-read was preserved (it supplies the post-update record revision in the
due-timer result). No ESLint rule was disabled or weakened, no error was
converted to a warning, no ignore pattern was added, and no Stage 03 source
or test file was excluded. The gate exits 0 everywhere it is run.

**Historical fact preserved.** The previous report's "eslint clean" claim
was false at the audited SHA; a clearly labelled post-audit amendment to
`docs/report/VICT-STAGE-03-REPORT.md` records this without rewriting the
historical table. The owner's existing correction note in commit `0ca8c18`
(Node 24 verification + stage2 fixture fix) is preserved untouched.

## Files changed

Implementation commit `9a69fe1` ("fix(stage-03): remediate independent
audit findings"), 25 files, +852/−232:

Correction (3 files):
- `packages/runtime/src/orchestration-driver.ts` — HIGH-1 wake/park identity fix
- `packages/runtime/src/orchestration-plan.ts` — HIGH-2 null-safe timeout
- `packages/kernel/src/orchestration-state.ts` — HIGH-3 blocked → failed transition

Permanent shared evidence (4 files):
- `packages/runtime/src/orchestration-remediation-conformance.ts` — NEW shared suite (5 tests)
- `packages/runtime/src/testing.ts` — suite + manual clock exports
- `packages/runtime/test/orchestration-conformance.test.ts` — in-memory wiring
- `packages/store-sqlite/test/orchestration-conformance.test.ts` — SQLite wiring (real close/reopen)

Documentation (2 files):
- `docs/architecture/STAGE-03-DURABLE-ORCHESTRATION.md` — lifecycle edge + operator-fail semantics
- `docs/report/VICT-STAGE-03-REPORT.md` — post-audit lint amendment

Lint-only corrections (16 files, no behavior change):
`examples/orchestration-proof/src/proof.ts`, `packages/kernel/test/control-graph-identity.test.ts`,
`packages/runtime/src/orchestration-activation.ts`, `orchestration-canary-conformance.ts`,
`orchestration-commands.ts`, `orchestration-conformance.ts`, `orchestration-in-memory.ts`,
`packages/runtime/test/orchestration-conformance.test.ts`, `orchestration-faults.test.ts`,
`orchestration-smoke.test.ts`, `packages/store-sqlite/src/orchestration-adapter.ts`,
`packages/store-sqlite/test/fixtures/stage2-database.ts`,
`packages/store-sqlite/test/orchestration-conformance.test.ts`,
`orchestration-corrective.test.ts`, `orchestration-restart.test.ts`,
`stage2-migration.test.ts`, `scripts/benchmark.ts`, `scripts/isolated-consumer-check.mjs`

## Verification evidence

Environment: Windows 11 Pro (MINGW64_NT-10.0-26200), win32-x64, AMD64, git 2.50.1.
Primary runtime: Node v22.13.1, npm 10.9.2.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run lint` | 0 | **0 problems** (was 61 errors) |
| `npm run typecheck` | 0 | strict, no errors |
| `npm run typecheck` (before build, fresh clone after `npm ci`) | 0 | no stale-dist dependency |
| `npm run build` | 0 | all five packages build |
| `npm run test:unit` | 0 | 30 files / **345 tests passed** (335 previous + 10 new remediation tests), four consecutive runs all 345/345 |
| `npm run test:integration` | 0 | 1 file / 4 tests passed |
| `npm test` | 0 | 31 files / **349 passed**, three consecutive runs all 349/349 |
| `npm run verify:consumer` | 0 | neutral + zod + orchestration packed consumers |
| `npm run verify:stage2` | 0 | Stage 02 closure intact |
| `npm run verify:stage3` | 0 | build + suites + offline proof (9 nodes/10 edges, 31 semantic events) + packed orchestration consumer |
| `npm run example` | 0 | ARA proof: **13 ordered events** (unchanged) |
| `npm run bench` | 0 | three-node semantics: **10 events per completed run** (unchanged); Stage 03 durable orchestration section present |
| `npx vitest run packages/store-sqlite/test/orchestration-restart.test.ts` | 0 | **all six real-process restart fixtures pass** (SIGKILL pure attempt, keyed-write external commit, partial fan-out, terminal-join close/reopen, signal-wait restart, offline timer) |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | clean | only the intended remediation changes |

## Repeated and fresh-clone verification

Targeted correction tests (both adapter files, 96 tests = 48 in-memory + 48
SQLite, including the 10 new remediation tests):

- **Five consecutive runs: 96/96, 96/96, 96/96, 96/96, 96/96** (Node v22.13.1).
- Node v24.10.0 (npm 11.6.1, portable install): `npm run lint` EXIT 0,
  `npm run typecheck` EXIT 0, targeted correction tests **96/96**.

Fresh clone from `origin/main` at `9a69fe1` (no workspace artifacts present):

| Step | Exit |
| --- | --- |
| `git clone` (HEAD = `9a69fe1`) | 0 |
| `npm ci` | 0 (143 packages) |
| `npm run typecheck` (no build, no dist) | 0 |
| `npm run lint` | 0 |
| `npm run build` | 0 |
| `npm run verify:consumer` | 0 |
| `npm run verify:stage2` | 0 |
| `npm run verify:stage3` | 0 |
| targeted correction tests (both adapters) | 96/96 |

Note: `verify:consumer` documents "run `npm run build` first" (it packs the
built `dist` output of all five packages); in a fresh clone it therefore
runs after the explicit build step, which generates — never relies on —
workspace artifacts. Typecheck was additionally verified to pass with NO
dist present. The temporary fresh clone was removed after verification.

## Preserved regressions

All independently verified Stage 03 behavior was re-confirmed unchanged:

- Stage 02 verification (`verify:stage2`, store conformance, migrations,
  corruption/transaction suites) — green; the six real-process restart
  fixtures pass 6/6.
- Join boundaries, canonical aggregation, transformed terminal output, and
  join-parser exactly-once-outside-store semantics — shared join suite green
  on both adapters.
- Race semantics: signal-vs-timeout single winner, keyed-write idempotency
  across retries, irreversible timeout blocking and non-replay — shared
  race suite green on both adapters (manual-clock tests unchanged).
- Cancellation, attempt fencing/lease recovery, activation pinning and
  restart fail-closed behavior — untouched code paths, suites green.
- Contract-issue sanitization and canary non-leakage — shared canary suite
  green on both adapters.
- Default payload-retention safety — untouched; canary suite green.
- SQLite transaction rollback at every tested boundary — fault-injection
  suite green on both adapters (no adapter transition logic changed beyond
  dead-code removal).
- In-memory/SQLite semantic parity — every shared suite (conformance, join,
  race, canary, remediation) runs against BOTH adapters from one source.
- Packed-consumer isolation — `verify:consumer` green in a fresh clone.
- ARA 13 events, benchmark 10 events/run — re-observed.
- No assertions were loosened, no adversarial tests deleted, no sleeps
  added, no verification scripts modified to skip coverage (the only
  script changes are lint dead-code removals inside `scripts/benchmark.ts`
  and `scripts/isolated-consumer-check.mjs`).

## Remaining non-blocking issues

Unchanged Low/Informational carry-forward items from the independent audit
(deliberately not expanded into this remediation; no mandatory correction
touched their behavior):

- **Low:** a throwing author contract parser (or an issue object with a
  throwing getter) can wedge a durable run as silently re-claimed
  (`running`) instead of failing it sanitized; the sequential engine
  propagates the throw to the caller instead.
- **Low:** the compiler silently ignores unknown node fields (e.g.
  `outputContractId` instead of `output`); TypeScript catches the typo but
  JS authors are exposed.
- **Informational:** store failures during `completeAttempt` are silently
  swallowed by the worker loop until lease recovery (no half-state; single
  clean completion after recovery).
- **Informational:** cancellation of an in-flight non-cooperative
  capability follows the documented cooperative-abort race semantics.
- **Environmental:** full ladder verified on Windows (win32-x64) only.

Stage 03 must NOT be marked Verified and Stage 04 must NOT begin based on
this report; only the subsequent independent re-audit may change the
disposition.

## Ready for focused independent re-audit?

YES
