# VICT Stage 02 — Independent Verification Audit

> **Auditor:** independent adversarial verification agent (no implementation changes; probes only)
> **Audit date:** 2026-09-01
> **Authority:** docs/handoff/VICT-STAGE-02-INDEPENDENT-VERIFICATION-HANDOFF.md over VICT-SYSTEM-REFERENCE.md v0.1.1

---

## 1. Final disposition

**PASS — STAGE 03 PERMITTED**

All blocking requirements (notably A: causal durability before capability invocation) were independently reproduced with an adversarial, non-fixture probe and passed on both adapters. Every required verification command exits 0. Two Low findings and one NOT VERIFIED item are recorded below; none is blocking, high, or medium, and none hides a semantic or packaging defect.

## 2. Repository, branch, and commit audited

- Repository: `https://github.com/radz2291/vict-02` (fresh clone at audit start; independence from the working checkout was preserved)
- Branch: `main`
- Implementation commit audited: **`a1ccea144add05e4a92303d13392510b16fa311a`** (`fix(stage-02): enforce durable execution and store invariants`)
- Report-delivery commit (HEAD, parent = correction commit): **`baed453b0b1a84fbf8893cf71bde07d10eff35d7`** (`docs(stage-02): corrective finalization report`)
- This matches the SHAs stated in `docs/report/VICT-STAGE-02-CORRECTIVE-FINALIZATION-REPORT.md`; verified with `git log` and `git rev-parse` before testing. No mismatch; no stop condition triggered.

## 3. Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro (Windows_NT 10.0.26200), win32-x64, NTFS |
| Shell | Git Bash (MINGW64) |
| Node | v22.13.1 (satisfies engines floor >=22.13.0) |
| npm | 10.9.2 |
| SQLite driver | built-in `node:sqlite`, SQLite 3.47.2 |
| Durability mode (file DBs) | WAL journal + `synchronous=FULL` (verified by pragma, §7 G1) |

**OS coverage:** only Windows was genuinely available. The POSIX path (including the documented `npm pack` GitHub-shorthand ambiguity) was **NOT VERIFIED** by execution; it is addressed by construction (absolute pack paths in `scripts/isolated-consumer-check.mjs`), which was inspected, not executed on POSIX. This is the same stated limitation as the corrective report.

## 4. Verification matrix

All commands run from the fresh clone, in order. `npm ci` was run before any test command. `format:check` initially failed on this auditor's machine with 92 files flagged — diagnosed as a checkout artifact of the auditor's `core.autocrlf=true` (LF→CRLF on checkout); after re-checkout with `core.autocrlf=false` (repository content unchanged, verified by `git status`) it passes. This is recorded as Low finding L-1.

| Command | Result | Duration | Evidence |
|---|---|---|---|
| `npm ci` | PASS (exit 0) | ~20 s | 0 vulnerabilities, clean install from committed lockfile |
| `npm run format:check` | PASS (exit 0) | 4 s | "All matched files use Prettier code style!" (after L-1 checkout correction) |
| `npm run lint` | PASS (exit 0) | 30 s | ESLint clean |
| `npm run typecheck` | PASS (exit 0) | 10 s | strict monorepo typecheck |
| `npm run build` | PASS (exit 0) | 19 s | all five packages |
| `npm run test:unit` | PASS (exit 0) | 24 s | 21 files, 217 tests, 0 failures |
| `npm run test:integration` | PASS (exit 0) | 2 s | 1 file, 4 tests |
| `npm run verify:consumer` | PASS (exit 0) | 31 s | packed tarball consumer (§9) |
| `npm run verify:stage2` | PASS (exit 0) | 54 s | unit + integration + packed SQLite consumer |
| `npm run example` | PASS (exit 0) | 2 s | ARA proof: 4 nodes, 3 edges, 13 events, ordered trace intact |
| `npm run bench` | PASS (exit 0) | 17 s | labeled envelopes; SQLite file WAL `synchronous=FULL` median ~18 ms/run with per-commit fsync |

Focused suite evidence: real-subprocess restart suite 10/10 (`packages/store-sqlite/test/restart.test.ts`, verbose names recorded); durable boundary suite 12/12 ([in-memory] and [sqlite] × 6) verified in verbose unit output.

## 5. Independent probe design and ordered traces

Four probe programs were written by the auditor from the handoff's invariants alone (not from the implementation's own fixtures), executed against the built `dist/` artifacts of the audited commit, then deleted. Probes were the only repository additions besides this report and were removed before finalization (§10).

### Probe A — causal durability (blocking gate)

Independent controllable-store probe around the REAL `VictRuntime` wiring: a gated `ExecutionStore` wrapper blocks `createRun` and `commitTransition` at explicit deferred gates; the capability's FIRST synchronous statement records an invocation. Seven scenarios: in-memory and SQLite × {ordered gate sequence (1-node), rejected `createRun`, rejected `node.started`, 2-node ordering}. All PASS.

Ordered trace (SQLite, 2-node run, from Probe A7 — one line per observable store operation):

```text
GATE createRun                                   <- createRun reaches the store, unresolved
RELEASE createRun
COMMIT createRun                                 <- run creation durable
GATE transition[node.started@a] rev=1 seq=1      <- node-start intent at the store, unresolved
RELEASE transition[node.started@a]
COMMIT transition[node.started@a]                <- node-start durable
  (capability a's invocation count goes 0 -> 1 only here; asserted via event-loop steps)
GATE transition[node.completed@a+signal.routed@-] rev=2 seq=2   <- a's result batch gated
RELEASE transition[node.completed@a+signal.routed@-]
COMMIT transition[node.completed@a+signal.routed@-]
GATE transition[node.started@b] rev=3 seq=4      <- b's intent durable-in-flight; invocations still == 1
RELEASE transition[node.started@b]
COMMIT transition[node.started@b]
  (b invoked: count 1 -> 2, only after this commit)
GATE transition[node.completed@b+run.completed@-] rev=4 seq=5
RELEASE ... COMMIT ...                           <- terminal batch durable; run() then resolves
```

Observed assertions (identical on both adapters):
1. `createRun` unresolved → invocation count **0** (after 25+ event-loop turns; not timing-dependent — the gate is a deferred promise).
2. `node.started` unresolved → count **0**.
3. Node-start commit resolved → count exactly **1**, observed only after the `COMMIT` line.
4. Rejected `createRun` (injected `VICT_STORE_UNAVAILABLE`) → `run()` rejects structured, count **0**.
5. Rejected `node.started` (injected `VICT_STORE_BUSY`) → `run()` rejects structured, count **0**.
6. Two-node graph: `b` invoked only after `COMMIT(node.completed@a)` **and** `COMMIT(node.started@b)`; both count transitions verified.
7. `run()` resolution → durable terminal record (`status=completed`), dense event seqs `0..N`.
8. The capability records its invocation as its first statement — a synchronous observable side effect cannot precede the durable intent.

Happens-before is proven by gate settlement order (queue semantics), not timing. **No capability invocation before the required durable boundary was observed in any scenario: the blocking gate passes.**

### Probes B/C/D/E — store semantics, identity, atomicity, serialization

78 assertions against **both** adapters (in-memory and SQLite via `createSqliteStores` on fresh temp files), all PASS:

- **B (sequence/atomicity):** stored seq 0 + `expectedNextEventSeq: 5` rejected (`VICT_STORE_EVENT_SEQUENCE_CONFLICT`); stale expectation 0 rejected; rejected transitions left run record and event history byte-identical (adapter reads **and** direct SQLite table reads: `record_revision=1`, `steps=1`, one event row); `createRun` rejects start-at-1 and gapped (0,2) initial batches with no partial rows and accepts dense batches; two same-revision transitions → exactly one winner, one structured `VICT_STORE_RUN_CONFLICT`, no partial writes; event-vs-run identity mismatches (5 fields) all rejected; terminal run rejects further transitions without mutation.
- **C (identity integrity):** same-version republish with different canonical string → `VICT_STORE_ACTIVATION_COLLISION`; fresh-creation publish with forged binding/graph content → `VICT_STORE_ACTIVATION_MISMATCH` (content-derived identity recompute enforced by the real kernel identity functions); selection under a different graph ID rejected; run `graphId`/`graphVersion`/`capabilitySetVersion` mismatches vs the referenced activation rejected with no partial run; event identity mismatches (all five fields) rejected; equivalent republish idempotent (`created=false`); corrupted at-rest canonical manifest (injected via direct SQL) → `VICT_STORE_INVALID_RECORD` on read, for `get` and `list`.
- **D (publishAndSelect parity):** with an existing selection, `publishAndSelect` of a previously-absent activation under a stale selection revision failed with `VICT_STORE_SELECTION_CONFLICT`; catalog list unchanged, selection unchanged, and on SQLite the database file bytes (including `-wal`/`-shm`) were hash-identical. The current-revision guard succeeded. Equivalent caller-visible semantics on both adapters.
- **E (persisted-value serialization + immutability):** `undefined` in an object/array, `Map`, `Set`, class instance, function, `symbol`, `bigint`, `NaN`, `±Infinity`, cyclic value — all rejected with `VICT_STORE_INVALID_COMMAND`, run untouched; accepted values (plain objects, arrays, `Date`) round-trip with `Date` as documented ISO-8601 UTC and deterministically sorted keys; returned snapshots are deep-frozen (mutation throws) and persisted state unchanged after caller mutation attempts on both adapters (raw SQLite row verified).

### Probe F — independent hard-kill/restart/recovery

A child process ran the real runtime against a SQLite file with a capability whose first statement writes a marker file and then blocks; the parent **SIGKILL**ed it (verified `signal=SIGKILL`). A fresh process restored the exact activation (`restoreActivation` ok), `recoverInterruptedRuns` transitioned the run to `blocked` (last node context and steps preserved), a second recovery was a no-op, exactly one `run.blocked` event with code `VICT_RUN_INTERRUPTED_BY_RESTART` exists, event history dense (`0,1,2`), and a replay-monitoring registration proved **no capability replay** (exactly one marker line). Activation mismatch (`VICT_RUNTIME_ACTIVATION_MISMATCH`) and missing activation (`VICT_RUNTIME_ACTIVATION_NOT_FOUND`) fail safely without execution.

The existing real-subprocess suite (`restart.test.ts`, 10 tests) was additionally run in isolation with verbose names — 10/10 PASS — and its fixture code inspected: the parent observes the second node's `node.started` durable via an independent reader before killing, and the marker semantics distinguish "capability was invoked" from "capability blocked internally". This does not replace Probe A.

### Probe G — migrations, corruption, driver guarantees

19/19 PASS on SQLite: clean initialization at schema version 1 with all five expected tables; `journal_mode=wal` and `synchronous=FULL` (2) verified by pragma; reopen at current version is a no-op (single migration row, no duplicated schema objects); shipped migration ceiling enforced — an injected version-2 migration is skipped and never executed; a database stamped with future version 99 fails closed with `VICT_STORE_UNSUPPORTED_SCHEMA` and the file (plus WAL/SHM) is hash-identical before/after; malformed event payload JSON → structured `VICT_STORE_INVALID_RECORD`; DB-level `CHECK` constraint blocks an invalid status; corrupted `record_revision` → structured invalid-record on read; FK constraint blocks an orphan run row (direct SQL) and `createRun` with an unknown activation fails structured (`VICT_STORE_ACTIVATION_NOT_FOUND`); `BEGIN IMMEDIATE` + `ROLLBACK` discards staged writes; committed state readable after close/reopen.

## 6. Findings by severity

### Blocking

None. The A-gate probe (§5, Probe A) found zero capability invocations before the required durable boundaries on both adapters, with structured rejections and no replay.

### High

None.

### Medium

None.

### Low

- **L-1 — repository lacks `.gitattributes`; Windows-default `core.autocrlf=true` breaks `format:check` on a fresh clone.** Reproduction: `git clone` on Windows with `core.autocrlf=true` (git default on that platform) → working tree is CRLF → `npm run format:check` fails with "Code style issues found in 92 files". The repository files are LF; Prettier has no `endOfLine` override, so any Windows contributor/auditor with default settings hits a spurious failure. Fix is one line (`.gitattributes` with `* text=auto eol=lf`) or a Prettier `endOfLine` setting. No semantic risk; recorded as an operability/ergonomics issue for the owner.
- **L-2 — SQLite adapter skips its documented pragmas when a pre-opened handle is injected.** `createSqliteStores({ database: handle })` (documented test-only option, `packages/store-sqlite/src/adapter.ts`) does not apply `PRAGMA foreign_keys/busy_timeout/journal_mode/synchronous`; an injected handle in this audit reported `journal_mode=delete`. The production path (`options.path`) applies all pragmas (verified, §7 G1c/G1d). No production impact; noted so the test-only option is not mistaken for a production durability path.

### NOT VERIFIED (environmental, not a defect)

- **POSIX execution** of the full ladder and of `verify:consumer`: only Windows was genuinely available in this audit environment. Recorded per handoff §H ("record exactly which operating systems were tested"); no POSIX PASS is claimed or inferred.

## 7. Store-conformance results (both adapters)

Independent scenarios B1–B7, C1–C7, D1–D5, E1–E4 from §5: **78/78 assertions PASS on the in-memory adapter and 78/78 on the SQLite adapter**, including direct raw-SQLite inspection after failures (atomicity confirmed at the storage layer, not only through adapter reads) and file-hash equality (including WAL sidecar files) for operations claimed not to mutate. The repository's shared conformance suite additionally passes on both adapters as part of `test:unit` (217 tests, including the 12-test durable boundary suite).

## 8. Restart/recovery evidence

- Existing real-subprocess suite: 10/10 (completed-run restart, forced interruption + idempotent recovery, pure-node prefix interruption, five exact-activation mismatch cases, retention canaries across restart, explicit full retention boundary).
- Independent SIGKILL probe: 12/12 (§5, Probe F), including double-recovery idempotency, no replay, dense event history, and fail-safe restoration.

## 9. Packed-consumer evidence

`npm run verify:consumer` (exit 0) and script inspection (`scripts/isolated-consumer-check.mjs`):

- Packs all five public packages via absolute `packages/<name>` paths (unambiguous on any platform by construction).
- Creates a clean temp consumer **outside** the workspace; installs the five tarballs (plus consumer-side `@types/node` only); resolves no workspace source.
- Neutral consumer imports only public exports (`@vict/sdk`, `@vict/store-sqlite`), has NO zod installed (checked), passes strict `tsc` with `skipLibCheck: false` against packed declarations.
- Activates and executes a graph persisted to a real SQLite file; the first consumer process terminates; a **new process** reopens the same database, restores the exact activation, and reads the completed run + trace back (`NEUTRAL_CONSUMER_REOPEN_OK`).
- Zod consumer exercises the frozen `@vict/sdk/zod` subpath; base declarations scanned and confirmed Zod-free.
- Temp artifacts cleaned (with Windows lock retry).
- Operating systems tested: **Windows 11 (win32-x64) only.** POSIX: NOT VERIFIED.

## 10. Worktree cleanliness

`git status --short` after testing and probe removal shows **only** the audit report:

```text
?? VICT-STAGE-02-INDEPENDENT-AUDIT.md
```

No source, test, package-configuration, or documentation file was modified. All probe scripts and temporary databases (including SQLite WAL sidecars) were deleted. No force-push or history rewrite occurred.

## 11. Recommendation

**Stage 03 may begin.** Stage 02 is safe to accept: the durable write-ahead invariant is enforced and independently proven, both store adapters are semantically conformant and equivalent, identity is content-derived and cross-validated, recovery is safe and idempotent, and the packed-consumer boundary is real on the tested platform. The owner may optionally address L-1 (`.gitattributes`) before Stage 03 to avoid spurious Windows-clone format failures.

---

*Report-only audit artifact. Per GOV-004/TEST-005 this is the independent acceptance record for Stage 02; it changes the stage delivery status to Verified for the audited commit `a1ccea1` (report commit `baed453`).*