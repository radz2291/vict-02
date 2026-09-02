# VICT Stage 03 — Independent Re-Audit

## Verdict

**VERIFIED WITH NON-BLOCKING ISSUES — STAGE 04 PERMITTED**

## Stage 04 readiness

**YES WITH NON-BLOCKING ISSUES**

All four mandatory findings from the independent Stage 03 audit
(`HIGH-1`, `HIGH-2`, `HIGH-3`, `MED-1`) are independently **closed** with
fresh adversarial probes through the public APIs, executed on BOTH adapters
(in-memory and SQLite), including real SQLite close/reopen and real
transaction fault injection, with negative controls proving each probe
fails against the originally audited implementation for exactly the
semantic reasons originally recorded. No Critical, High, or Medium finding
remains. The remaining findings are Low and Informational only.

## Audited target

| Item | Value |
| --- | --- |
| Repository | https://github.com/radz2291/vict-02 (fresh clone, fresh workspace — not the prior audit workspace) |
| `origin/main` after fetch | `810144ff0327f8ffc3c7ca48b1dcad63dd901eaa` — exact match to the required target; `HEAD == origin/main` |
| Remediation commits | `9a69fe1` (implementation, 25 files, +852/−232) and `810144f` (remediation report ONLY — 1 file, 306 insertions, no code) |
| Audited implementation in ancestry | `11bbae5` present (`git merge-base --is-ancestor` ✓) |
| Original independent audit | `f8c8d5b` present; `VICT-STAGE-03-INDEPENDENT-AUDIT.md` is **byte-identical** to its version at `f8c8d5` (empty diff `f8c8d5..HEAD` for that file) |
| Owner commits preserved | `79430a3` and `0ca8c18` present in ancestry ✓ |
| Prior disposition | NOT VERIFIED — STAGE 04 BLOCKED |
| Working tree at audit start | clean (`git status --short` empty; no `dist` output present — confirmed before `npm ci`) |

Ancestry (top 15, `main`): `810144f` → `9a69fe1` → `f8c8d5b` → `0ca8c18`
→ `79430a3` → `11bbae5` → `9c4fc27` → `53cddeb` → `e4bd9bf` → `1d48c53` →
`7725ccd` → `b82638a` → `a5c3793` → `2f932d5` → `f6c4da8`.

## Executive conclusion

The remediation genuinely corrects runtime semantics; it does not merely
make permanent tests pass:

- **HIGH-1** is fixed at the driver's wake/park decision, which is now
  bound to the durable wait instance `(tokenId, nodeId)` instead of the
  lineage-shared `tokenId` alone. I verified two sequential waits on one
  linear lineage park, resolve, sequence, and complete correctly on both
  adapters with distinct durable wait identities, exactly-once events,
  replay immunity, and SQLite reopen survival — and proved the same probe
  fails against `f8c8d5` (the run completed after ONE signal there). I
  also confirmed `(tokenId, nodeId)` is sufficiently precise: graphs are
  acyclic (a cycle through a wait node is rejected `UNSUPPORTED_CYCLE`),
  fork children and join tokens get distinct token ids, and `waitId` is
  derived from `(runId, lineage, nodeId)`, so an earlier resolved wait can
  never match a later node.
- **HIGH-2** is fixed with a null-safe planner check. A plain signal wait
  (no `timeoutMs`, no timeout edge) stores `timeoutAt: null`, creates zero
  timer rows and zero `wait-timeout` events, survives immediate pumping, a
  400-day manual-clock advance, and SQLite close/reopen, and resumes
  exactly once on the correct signal — on both adapters. A declared
  positive timeout still creates exactly one timer, fires only when
  eligible, routes through its declared timeout edge, never invokes the
  success continuation, and stays exactly-once across reopen. Negative
  control at `f8c8d5`: the same plain wait had `timeoutAt == createdAt`, a
  `wait-timeout` timer row plus `timer.scheduled` event, and one pump
  blocked the run (`already_resolved` signal thereafter).
- **HIGH-3** is fixed in the kernel transition table
  (`RUN_TRANSITIONS.blocked` now includes `'failed'`). Through the public
  `runtime.resolveBlocked` API I verified denial by default, exact-run and
  pinned-activation binding (missing artifacts fail closed
  `VICT_ORCH_ACTIVATION_UNAVAILABLE`), expected-revision guarding, atomic
  `blocked → failed` with exactly one sanitized `operator.intervened` and
  one `run.failed`, no ready token, no downstream invocation, idempotent
  duplicates, `VICT_ORCH_OPERATOR_CONFLICT` on same-ID-different-content,
  `VICT_ORCH_STALE_REVISION` on stale revisions, and reopen stability. A
  real SQLite fault injected at the `orchestration.resolveBlocked`
  commit boundary left the run record and snapshot **byte-equivalent** in
  the blocked state with no lone events, and the same authorized command
  retried to exactly one clean terminal failure. Negative control at
  `f8c8d5`: the identical command threw `VICT_STORE_RUN_CONFLICT` ("The
  run cannot fail from its status"). Enabling `blocked → failed` did not
  legalize anything else: `waiting → failed` remains illegal in the kernel
  table and through the public API, and all other transition sets are
  unchanged.
- **MED-1** is fixed. `npm run lint` exits 0 with zero problems on both
  Node v22.13.1 and Node v24.10.0 in the fresh clone. `eslint.config.js`,
  `package.json`, `.gitignore`, and `.prettierignore` are untouched by the
  remediation (empty diff); no rule was disabled or downgraded, no files
  were excluded, and no suppression comments exist in the source. The 61
  findings were fixed in code; the lint-only diffs are dead-code removal
  verified behavior-neutral (the single `updatedRun` re-read that matters
  was preserved; its relocation in `resolveDueTimer` to after
  `appendEvents` is semantically equivalent — events do not change
  `record_revision`).

One new Low finding emerged from my probing (pre-existing, not a
remediation regression): the compiler does not bound-validate wait-level
declared timeouts (`wait.timeoutMs`) or timer delays (`wait.delayMs`) —
`timeoutMs: 0`/negative and `delayMs: 0`/negative activate cleanly and
schedule immediately-due timers (non-finite values do fail closed at the
persisted-value boundary). The behavior remains safe and deterministic
(declared timeouts still require a declared timeout edge, so the fire
routes somewhere declared; no wedge or corruption), but the remediation
report's claim that the compiler rejects non-positive declared wait
timeouts with `INVALID_TIMEOUT_POLICY` is inaccurate. LOW-1 and LOW-2
from the original audit were rechecked and remain unchanged Low. None of
these block Stage 04.

## Repository and environment

| Item | Observed |
| --- | --- |
| Clone | fresh `git clone https://github.com/radz2291/vict-02.git` into a new workspace; `git fetch origin` performed; `origin/main == 810144f == HEAD` |
| Pre-install state | no `dist` directories, no stale workspace artifacts (`ls packages/*/dist` empty before `npm ci`) |
| OS | Windows 11 Pro (MINGW64_NT-10.0-26200), win32-x64, AMD64 |
| Node (primary) | v22.13.1 (npm 10.9.2) — full ladder |
| Node (secondary) | v24.10.0 (npm 11.6.1, portable download during this re-audit) — lint, typecheck, format, focused remediation suites |
| Git | 2.50.1.windows.1 |
| Audited by | fresh independent adversarial probes with fresh graph/run/signal/resolution identifiers (deliberately different from the remediation suite), removed before commit |

## Mandatory command evidence

Node v22.13.1, from the fresh clone, in the required order (`npm ci` and
`typecheck` BEFORE `build`; `lint` before build output):

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm ci` | 0 | clean install, 0 vulnerabilities |
| `npm run typecheck` (before build, no dist) | 0 | strict, no errors — no stale-dist dependency (the Stage 02 dist-import fixture defect is gone) |
| `npm run lint` (before build) | 0 | 0 problems, 0 warnings |
| `npm run format:check` | 0 | all files Prettier-clean |
| `npm run build` | 0 | all five packages build with generated declarations (contracts 6, kernel 9, runtime 27, store-sqlite 5, sdk 3 `.d.ts` files) |
| `npm run test:unit` | 0 | 30 files / **345 tests passed** (run 2: 345/345) |
| `npm run test:integration` | 0 | 1 file / **4 tests passed** |
| `npm test` | 0 | 31 files / **349 tests passed — three consecutive runs: 349/349, 349/349, 349/349** |
| `npm run verify:consumer` | 0 | neutral + Zod-subpath + orchestration packed consumers; cross-process SQLite close/reopen + idempotent signal resume |
| `npm run verify:stage2` | 0 | Stage 02 closure intact (full unit + integration + packed SQLite consumer) |
| `npm run verify:stage3` | 0 | build + 345 unit + 4 integration + offline proof (**9 nodes / 10 edges / 31 semantic events / exactly 1 external ledger mutation**) + packed orchestration consumer |
| `npm run example` | 0 | ARA proof: **13 ordered events** (00 `run.started` … 12 `run.completed`), offline |
| `npm run bench` | 0 | bench-three-node-pure: 3 nodes / 2 edges / **10 events per completed run**; Stage 03 durable orchestration section present |
| `npx vitest run packages/store-sqlite/test/orchestration-restart.test.ts` | 0 | **6/6 real-process restart fixtures** (SIGKILL pure attempt, keyed-write external commit, partial fan-out SIGKILL, terminal-join close/reopen, signal-wait restart, offline timer) |
| Node v24.10.0: `npm run lint` | 0 | 0 problems |
| Node v24.10.0: `npm run typecheck` | 0 | strict, no errors |
| Node v24.10.0: `npm run format:check` | 0 | clean |
| Node v24.10.0: targeted correction tests (both adapter conformance files) | 0 | **96/96 passed** |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | 0 | clean at audit start and after probe cleanup |

Focused repetition (flakiness search):

| Group | Runs | Result |
| --- | --- | --- |
| Both-adapter conformance + remediation + join + race + canary suites, SQLite corrective fault injection, restart fixtures, in-memory faults, smoke | **5 consecutive** | 123/123 every run — sequential waits, signal/timeout races, operator resolution, join behavior, restart recovery, cancellation/fencing, SQLite transaction fault injection |
| My independent adversarial probes (HIGH-1/HIGH-2/HIGH-3/regression+Low) | **5 consecutive** | 0 failures every run |
| Full suite | **3 consecutive** | 349/349 each |
| Unit suite | 2 consecutive (+1 initial) | 345/345 each |

No intermittent failure was observed in any repetition; no sleeps were
added and no failed command was retried-until-green. All timing-sensitive
probes used the injected manual orchestration clock (wired as both runtime
clock and orchestration time port); the only wall-clock polling in my
probes was bounded invocation-barrier waiting for in-flight capabilities.

## Original finding closure

| Finding | Closed/Not closed | Independent evidence | Severity |
| --- | --- | --- | --- |
| HIGH-1 — sequential waits on one lineage bypass later waits | **CLOSED** | fresh two-wait chain probe (`audit.reaudit.chain`: `n-seed` → `gate-a`/signal `alpha-release` → `n-mid` → `gate-b`/signal `bravo-release` → `n-tail`) on both adapters with and without SQLite close/reopen between the waits: 134 checks, 0 failures; negative control at `f8c8d5` reproduced the original bypass (run completed after one signal, no second wait row, `tail` executed) | — |
| HIGH-2 — plain signal waits receive an immediately-due timeout | **CLOSED** | fresh plain-wait probe (`audit.reaudit.plainhold`, signal `freedom-bell`, no timeout) + declared-timeout probe (`timeoutMs: 33` with timeout edge) on both adapters with manual clock and reopen: 0 failures; manifest `wait.timeoutMs === null` verified from the stored canonical manifest; negative control at `f8c8d5` reproduced `timeoutAt == createdAt` + spurious timer + pump-blocked run | — |
| HIGH-3 — operator fail cannot transition blocked → failed | **CLOSED** | fresh deterministic blocked-run probe (`audit.reaudit.failpath`, non-keyed write `timeoutMs: 12`, manual clock) through public `resolveBlocked` on both adapters + real SQLite commit-boundary fault injection + kernel table inspection: 0 failures; negative control at `f8c8d5` threw `VICT_STORE_RUN_CONFLICT` | — |
| MED-1 — `npm run lint` fails | **CLOSED** | exit 0, 0 problems on Node v22.13.1 and v24.10.0 from the fresh clone; ESLint config/scripts/ignores unchanged by the remediation (empty diff); no rule weakening, no error→warning, no exclusions, no suppression comments; lint-only diffs reviewed as dead-code removal | — |

## Sequential-wait verification

Independent graph (one linear token lineage), identifiers distinct from
the remediation suite. Executed 4 scenarios (in-memory and SQLite, with
and without real SQLite close/reopen between the waits), 134 assertions,
0 failures, then repeated 5× with 0 failures.

Observed sequence (both adapters):

1. The run parks at the first wait: status `waiting`, exactly one open
   wait, `signalName === 'alpha-release'`, `timeoutAt === null`, one
   `run.waiting` event.
2. The first signal resolves only the first wait (`accepted`).
3. The intermediate capability executes **exactly once**.
4. The run parks at the second wait: new `waitId` (distinct durable
   identity — `waitId` is derived from `(runId, lineage, nodeId)`), open
   wait row at `gate-b`, resolved wait row at `gate-a` (both on the SAME
   linear-lineage token id, proving the fix's necessity).
5. The terminal capability has not executed (count 0).
6. The run remains non-terminal (`waiting`).
7. Replaying the first signal cannot satisfy the second wait: same ID →
   `duplicate`; fresh ID at the resolved wait → `already_resolved`; a
   fresh ID carrying the SECOND wait's name at the resolved first wait →
   rejected `VICT_ORCH_SIGNAL_NAME_MISMATCH`; a wrong-name signal at the
   open second wait → rejected, run stays `waiting`.
8. Only the declared second signal completes the run (`accepted` →
   `completed`); terminal capability invoked exactly once.
9. Exactly-once ledger: `signal.received` 2, `run.waiting` 2,
   `run.resumed` 2, `run.completed` 1, `node.completed` 7, 2 signal
   receipts.
10. SQLite close/reopen between the waits (before the first signal and
    across the wake) preserves the behavior; reopen after completion keeps
    the status and the exact event count.

Driver condition precision: the wake/park decision now requires
`wait.tokenId === claim.token.tokenId && wait.nodeId === claim.token.nodeId`.
This is sufficiently precise under VICT's semantics: the compiler rejects
cycles (probe: a success edge back into a wait node → `UNSUPPORTED_CYCLE`),
so a token lineage can never revisit the same node; fork children get
their own token ids (`forkChildTokenId`), joins get `joinTokenId`; a
same-`(tokenId, nodeId)` wait record therefore identifies exactly one wait
instance per token. An earlier resolved wait can no longer match a later
node, and the post-wake claim of the SAME node still takes the wake path
against its own resolved wait.

Negative control: at `f8c8d5` the same probe shows the run **completed**
after the first signal, with one wait row, one `signal.received`, and the
terminal capability executed — the originally audited bypass, reproduced.

## No-timeout verification

Plain signal wait (`freedom-bell`, no `timeoutMs`, no timeout edge),
manual orchestration clock, both adapters:

1. The stored canonical manifest (`vict.graph@2`) represents the absent
   timeout as claimed: `graph.nodes[wait].wait.timeoutMs === null`.
2. `DurableWaitState.timeoutAt === null`.
3. Zero `wait-timeout` timer rows in the store; zero `timer.scheduled`
   events of any kind.
4. Pumping due timers immediately fires **nothing** (`fired === 0`).
5. Advancing the manual clock 400 days and pumping still fires nothing.
6. The run remains `waiting` and recoverable throughout.
7. The correct signal resumes and completes **exactly once**
   (`signal.received` 1, `run.resumed` 1, sink invoked 1, zero
   wait-timeout events at completion).
8. SQLite close/reopen does not create or infer a timer: zero timer rows,
   zero wait-timeout events, `timeoutAt` still null; pumping after reopen
   fires nothing.

Declared positive timeout (`timeoutMs: 33`, timeout edge): exactly one
`wait-timeout` `timer.scheduled`; not eligible 20 ms in (`fired === 0`);
after advancing past the deadline it fires **exactly once** and routes
through the declared timeout edge (fallback invoked 1, success target 0,
`timer.fired` 1, `signal.received` 0); a late signal returns
`already_resolved`; reopen keeps exactly one `timer.fired` and one
`timer.scheduled` and re-pumping fires nothing.

Planner/manifest boundary: absent and `null` both normalize to "no
timeout" (null-safe check `timeoutMs !== undefined && !== null`); a
declared positive number creates a deadline; non-finite values
(`Infinity`, `NaN`) fail closed at activation via the strict
persisted-value domain (`VICT_STORE_INVALID_COMMAND`, structured). However
— see finding LOW-3 — `0` and negative declared values are **not**
compiler-rejected (contrary to the remediation report's stated basis);
they activate and schedule immediately-due timers that fire through the
declared timeout edge. Behavior is safe and non-wedging, but the
validation gap and the inaccurate report claim are recorded below.

Negative control: at `f8c8d5` the same plain wait had
`timeoutAt === createdAt` (1000000), a scheduled `wait-timeout` timer row
and `timer.scheduled` event, one pump fired it and blocked the run, and
the legitimate signal returned `already_resolved`.

## Operator-failure verification

Deterministic blocked run (non-keyed write, `timeoutMs: 12`, manual clock,
invocation barrier — no wall-clock deadlines), public
`runtime.resolveBlocked`, both adapters:

- **Denied by default** without `orchestration.operatorAuthorized`
  (`VICT_ORCH_OPERATOR_DENIED`).
- **Accepted when authorized**: `action: 'fail'` with
  `resolutionId 'RA9-res-fail-4021'` and safe `failCode` → `accepted`,
  `runStatus 'failed'`.
- **Bound to the exact run**: an unknown run id is rejected; a WAITING
  run's id is rejected (fail cannot be applied to a non-blocked run — no
  `operator.intervened`, run untouched).
- **Bound to the pinned activation**: an operator runtime without the
  pinned artifacts fails closed `VICT_ORCH_ACTIVATION_UNAVAILABLE`; no
  substitute revision is used.
- **Expected revision**: a stale `expectedRunRevision` with a fresh ID →
  `VICT_ORCH_STALE_REVISION` (run stays blocked); the exact revision is
  accepted.
- **Atomic `blocked → failed`**: exactly one sanitized
  `operator.intervened` (identifiers only: resolutionId, action, run and
  activation identity, seq — no payloads) and exactly one terminal
  `run.failed`; no ready token remains; the downstream capability is never
  invoked.
- **Idempotent**: an identical repeated resolution returns `duplicate`
  with zero additional events; same ID with different content →
  `VICT_ORCH_OPERATOR_CONFLICT`.
- **SQLite reopen** preserves terminal `failed`, identical event counts,
  one `operator.intervened`, one `run.failed`.

SQLite transaction-fault probe (real `beforeCommit` fault inside the
`orchestration.resolveBlocked` transaction):

1. The fault surfaced (structured store error thrown to the caller).
2. The run record and full orchestration snapshot are **byte-equivalent**
   (JSON-identical) to the pre-fault blocked state; record revision
   unchanged.
3. No lone `operator.intervened` and no lone `run.failed` event committed;
   event ledger length unchanged.
4. Retrying the same authorized command after disarm → `accepted`, one
   clean terminal `failed` outcome (one `operator.intervened`, one
   `run.failed`).
5. Reopen after the clean failure preserves the terminal state and counts.

Transition legality (`RUN_TRANSITIONS`, kernel, verified directly and
through the public API): `blocked` now permits
`['blocked','running','cancelled','failed']`; `waiting` still permits only
`['waiting','running','cancelled']` — **not** `failed`;
`completed`/`failed`/`cancelled` remain terminal (empty); `running` is
unchanged. Enabling `blocked → failed` did not legalize any unrelated
transition, and the in-memory and SQLite adapters enforce the same guard
(the previously audited `VICT_STORE_RUN_CONFLICT` message now legalizes
only the operator-fail path through the store's existing fail branch).

Negative control: at `f8c8d5` the identical authorized command threw
`VICT_STORE_RUN_CONFLICT` ("The run cannot fail from its status") from the
in-memory store.

## Lint and clean-build verification

- `npm ci` then `npm run typecheck` on the untouched fresh clone (no
  `dist` present — verified by directory listing before install):
  **exit 0**. The Stage 02 fixture's relative `../../dist/index.js`
  import was replaced with the package specifier in `9a69fe1`; clean
  typecheck no longer depends on prior build output.
- `npm run build` afterward: exit 0; all five packages emit JavaScript,
  source maps, and `.d.ts` declarations; `verify:consumer` then packs and
  exercises the fresh output (neutral consumer without Zod, the optional
  Zod subpath, and a packed SQLite orchestration consumer that reopens,
  signals idempotently, and resumes).
- `npm run lint`: **exit 0, 0 problems** on Node v22.13.1 AND Node
  v24.10.0. (`eslint .` sees all source and test files; my temporary probe
  scripts were the only files ever reported, and only while they existed.)
- Configuration review: `eslint.config.js`, `package.json` scripts,
  `.gitignore`, `.prettierignore` have an **empty diff** across the
  corrective range — no rule disabled, no severity converted, no ignore
  pattern added (the pre-existing ignores are only `**/dist/**`,
  `**/node_modules/**`, `coverage/**`), no Stage 03 code excluded, and a
  repository-wide grep found **zero** `eslint-disable`/suppression
  comments.
- Lint-only source changes were reviewed individually: removed unused
  imports/type aliases/counters, the dead `#eventEnvelope` and
  `immutable`/`tombstoneCheckpoints` helpers, `prefer-const`/useless-
  assignment corrections, and the unused `updatedRun` row reads. The one
  preserved used read (`resolveDueTimer`) moved after `appendEvents` —
  semantically equivalent, since appending events does not change
  `record_revision`. Dead-code removal did not alter orchestration
  behavior (all shared suites and my probes are green).
- Node coverage: full ladder on Node v22.13.1 (≥ 22.13.0 required); lint,
  typecheck, format, and the 96 targeted correction tests also green on
  Node v24.10.0 (portable, provisioned during this re-audit).

## Regression evidence

Fresh adversarial probes (different identifiers), both adapters, all
green, repeated 5×:

- **Wait-wake into a join**: a branch-borne signal wait whose success
  target is the fork's join routes through the durable branch-arrival
  boundary — join validated exactly once AFTER the signal (parse calls 0
  while parked, 1 after), one `join.completed`, two `branch.completed`,
  canonical output preserved, downstream executed once.
- **Signal-vs-timeout single winner** (declared-timeout wait, both
  orders): signal wins → no `timer.fired` after the win, one
  `run.resumed`, success target only; timeout wins → fires exactly once,
  late signal `already_resolved`, fallback only.
- **Irreversible non-replay**: an irreversible capability whose deadline
  passes mid-flight blocks the run; a manual-clock lease-lapse cycle plus
  `recoverOrchestration({resume:true})` reclaims nothing for the run and
  the capability is still invoked exactly once; the run remains blocked.
- **Cancellation fencing**: cancelling a waiting run is accepted and
  idempotent (duplicate), emits exactly one `run.cancelled`, a late
  signal cannot resurrect, downstream never executes.
- **Canary non-leakage**: a unique secret canary used as run input and
  signal payload appears in NO event ledger, signal receipt, run record,
  wait descriptor, or `RunResult.trace` (the caller-owned signalId
  identifier remains, per policy).
- **Durable intent, fencing, atomicity, restart, parity**: covered by the
  permanent suites re-run 5× green (123/123 each) — shared conformance,
  join, race, canary suites on BOTH adapters, SQLite corrective fault
  injection at every material boundary, and the 6/6 real-process SIGKILL
  restart fixtures. The remediation's three behavioral diffs (driver,
  planner, kernel table) introduced no regression in any re-run group.
- **Store parity**: every shared suite executes against both adapters
  from one source; my probes additionally confirmed identical semantics
  (including the fault-injection boundary) on both.

## Remaining findings

Independently observed, unresolved (none blocking):

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| LOW-1 (carry-forward) | Low | A throwing author contract parser wedges the durable engine: the run settles non-terminal `running`, the attempt stays claimed, lease recovery re-invokes and re-throws silently (re-invocation observed after a manual-clock lease-lapse cycle), and no diagnostic is ever committed. The sequential engine instead propagates the throw to the caller. Unchanged by the remediation; hostile content never persisted. | throwing-output-contract probe on a control-node graph, both adapters: run non-terminal `running`, silent re-claim cycle, `RA9-HOSTILE-PARSER-THROW` marker absent from the event ledger |
| LOW-2 (carry-forward) | Low | The compiler silently ignores unknown node fields: a join/capability contract declared as `outputContractId` (instead of `output`) compiles cleanly and the declared contract is never executed (parse calls 0) while the run completes past the boundary. Unchanged; TypeScript catches the typo, JS authors are exposed. | wrong-field probe, both adapters |
| LOW-3 (new, pre-existing at the audit target — not a remediation regression) | Low | Wait-level declared timeout/delay bounds are not compiler-validated: `wait.timeoutMs: 0`/negative and `wait.delayMs: 0`/negative activate cleanly on the public path and schedule immediately-due timers that fire on the first pump through their declared edge. Non-finite values fail closed at activation (persisted-value domain). Runtime behavior is safe, deterministic, and non-wedging (a declared timeout still requires a declared timeout edge), but the remediation report's claim that "the compiler rejects any declared timeout that is not a positive finite number (`INVALID_TIMEOUT_POLICY`, `timeoutMs <= 0`)" is **inaccurate** — no such wait-level rejection exists (node-level `timeoutMs` is bound-checked with `INVALID_TIMEOUT_BOUND`; the wait-level value is not, and `INVALID_TIMEOUT_POLICY` is not a real diagnostic code). | manifest-boundary probe on both adapters: `timeoutMs 0/-5` activate, park, one timer row, `immediate pump fired=1`, route through the declared timeout edge; `delayMs 0/-1` complete immediately through the success edge; `Infinity/NaN` throw structured `VICT_STORE_INVALID_COMMAND` at activate |
| INFO-1 (carry-forward) | Informational | Store failures during `completeAttempt` are swallowed by the worker loop until lease recovery (no half-state; clean single completion after recovery). Unchanged. | corrective fault suite (green 5×) + original audit evidence |
| INFO-2 (carry-forward) | Informational | Cancellation of an in-flight non-cooperative capability follows the documented cooperative-abort race semantics (late completion may finalize the run per the completion; nothing replayed or reversed). Unchanged. | race suite green; original audit evidence |
| Environmental | Informational | Full ladder executed on Windows (win32-x64) only; POSIX execution remains unverified (as at Stage 02). Node 24.10.0 was available for this re-audit (portable) and passed lint/typecheck/format and the targeted correction suites. | this re-audit's environment |

The original audit's consecutive-run count claims are now reproducible
from a fresh session: 345 unit (×2 observed plus the verify:stage3 run),
4 integration, 349 total (×3 consecutive), 96/96 targeted correction
tests, 6/6 restart fixtures — matching the remediation report.

## Severity summary

- Critical: 0
- High: 0 (all three original High findings independently closed)
- Medium: 0 (MED-1 independently closed)
- Low: 3 (LOW-1, LOW-2 unchanged carry-forward; LOW-3 new — wait-level
  timeout/delay bound validation gap plus an inaccurate remediation-report
  sub-claim; safe runtime behavior, non-blocking)
- Informational: 3 (swallowed completion faults; cooperative-abort cancel
  race; Windows-only environmental coverage)

## Recommendation

Stage 03 durable orchestration is now independently verified on both
adapters at `810144ff0327f8ffc3c7ca48b1dcad63dd901eaa`. All three High
defects and the lint gate from the independent audit are genuinely
corrected at the semantic level (driver wait identity, planner timeout
null-handling, kernel transition legality) — proven by fresh adversarial
probes through the public APIs, negative controls against the audited
implementation, real SQLite close/reopen and transaction-fault evidence,
and a fully green mandatory ladder on Node 22.13.1 and targeted Node 24
verification. The remaining Low findings (throwing-parser wedge,
compiler-ignored unknown node fields, wait-level timeout/delay bound
validation gap) should be carried forward — the last with a correction to
the remediation report's inaccurate claim — but none blocks the stage.

**VERIFIED WITH NON-BLOCKING ISSUES — STAGE 04 PERMITTED.**
Stage 04 may begin; the Low findings above remain visible carry-forward.