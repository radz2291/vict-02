# VICT — Stage 02 Implementation Report

## Durable Identity and Stores

> **Repository:** C:/Users/RZ1/Desktop/RZ/260831-VCT-02
> **Authority:** VICT-SYSTEM-REFERENCE.md v0.1.1
> **Handoff:** docs/handoff/VICT-STAGE-02-HANDOFF.md
> **Report date:** 2026-09-01

---

## Outcome

**READY FOR INDEPENDENT AUDIT**

All Stage 02 work items are implemented, all verification commands exit 0, and
the repository is clean apart from intentional committed deliverables. This is
an implementation claim, not a verification claim. Stage 03 was not started.

---

## 1. Starting state

| Item | Value |
|---|---|
| Starting commit | `877d859a0707fa83e795b1ec33d9164ca58e03a5` ("Night 01.1: activation integrity and data safety finalization") |
| Node / npm | v22.13.1 / 10.9.2 |
| Platform | Windows 11 Pro (win32-x64), NTFS, local working directory |
| Initial git status | `docs/VICT-SYSTEM-REFERENCE.md` modified (v0.1.1 authoritative content, preserved); untracked: `docs/handoff/VICT-STAGE-02-HANDOFF.md`, `docs/nightly/VICT-NIGHT-01-FINALIZATION-AUDIT.md` — both preserved and committed with this stage |
| Baseline commands | `npx vitest run` → **105 of 105 tests passed** at the starting commit, before any Stage 02 change |

No unrelated user change was reset, discarded, or overwritten. The modified
system reference (v0.1.0 → v0.1.1) was the supplied authoritative document
required by the handoff; it is committed unchanged in content except for the
Stage 2 status deltas listed in §9 below.

---

## 2. Architecture delivered

### 2.1 Port model

`@vict/runtime` now defines the semantic store ports (DATA-001):

- **`ActivationCatalog`** — `publish`, `get`, `list`, `select`,
  `getSelection`, `getSelected`, `publishAndSelect` (one transaction for
  publish + select, used by activation). Publishing is idempotent for
  canonically equivalent content; the same version with different canonical
  content raises `VICT_STORE_ACTIVATION_COLLISION`. Selection uses an
  optimistic `selectionRevision` (`VICT_STORE_SELECTION_CONFLICT` on stale
  writers).
- **`ExecutionStore`** — `createRun`, `commitTransition`, `getRun`,
  `listRuns`, `listEvents`, `recoverInterruptedRuns`. Every write is atomic
  (run state + ordered event batch, DATA-003), guarded by the expected record
  revision and expected next event sequence. Events are append-only with no
  update/delete path in the port. Reads return deep-frozen immutable
  snapshots (DATA-012).
- Records: `StoredRun`, `StoredEvent`, `StoredActivation`,
  `ActivationManifest` (serializable meaning only: manifest schema, canonical
  graph declaration, three version identities, binding metadata, contract
  identities). Functions, schema-library internals, timestamps and registry
  order never enter manifests.

Both ports are implemented twice: `createInMemoryStores()` (default runtime
backend, full parity) and `createSqliteStores()` in the new
`@vict/store-sqlite` package.

### 2.2 Package/dependency changes

```
@vict/contracts ← @vict/kernel ← @vict/runtime ← @vict/store-sqlite
                        ↑              ↑
                        └── @vict/sdk ─┘   (facade; never imports the adapter)
```

- New package `@vict/store-sqlite` (schema, migrations, driver wrapper,
  adapters, tests). Depends only on `@vict/runtime` and the built-in
  `node:sqlite`; does not depend on `@vict/sdk`; contains no graph or
  application logic.
- `@vict/runtime` gained `./testing` subpath exporting the shared conformance
  suite. The legacy sync `RunRepository` was removed and refactored into the
  semantic ports.
- `@vict/kernel` changes are minimal and additive: `run.blocked` events carry
  an optional stable `code` field; cycle diagnostics now coexist with other
  issues (see §3.4). Kernel remains pure.

### 2.3 SQLite-driver decision (handoff §7)

**Chosen: the built-in `node:sqlite`** (SQLite 3.47.2 in Node 22.13.1).

Evidence gathered in the supported environment (Windows 11, win32-x64,
Node 22.13.1, ABI 127):

1. `better-sqlite3@13.0.3` **segfaults** (exit 139) on first use in this
   environment — installed cleanly but the native binding crashes.
2. `better-sqlite3@12.4.1` works (prebuilt ABI 127), but each Node major
   upgrade re-couples the install to a new prebuild release; the v13 failure
   demonstrates the real failure mode.
3. `node:sqlite` probed: file-backed WAL journaling, `synchronous=FULL`,
   `busy_timeout`, foreign-key enforcement, and `BEGIN IMMEDIATE` /
   `COMMIT` / `ROLLBACK` all work. It ships with Node — zero install, zero
   ABI coupling, deterministic CI.
4. Cost: `node:sqlite` requires Node ≥ 22.5 (unflagged from 22.13). The
   repository engines floor was raised **explicitly and documented** from
   `>=22.0.0` to `>=22.13.0` (root `package.json`,
   `packages/store-sqlite/package.json`, README, this report). No ORM, no
   query builder, no other dependency was added.

Operational settings (documented in `docs/architecture/STAGE-02-STORES.md`):
`foreign_keys=ON` (always), `busy_timeout=5000` (option), `journal_mode=WAL`
(file DBs; option), `synchronous=FULL` (option; real local durability —
fsync per commit; `normal` available and labeled as weaker).

### 2.4 Schema and migrations

Five tables created by forward-only, transactionally-recorded migrations
(version 1): `vict_schema_migration`, `vict_activation` (immutable rows),
`vict_activation_selection` (optimistic revision), `vict_run`
(CHECK-enforced status/mode/retention, FK to activation), `vict_run_event`
(`(run_id, seq)` PK, append-only, FK to run). Timestamps persist as
ISO-8601 UTC strings; public records carry epoch ms. Event order is `seq`,
never row order or timestamps.

Migration rules (handoff §13) are implemented and tested: explicit integer
version starting at 1; ordered forward-only migrations; automated
fresh-database test; idempotent reopen; unsupported future version fails
closed without mutation; a partially applied migration rolls back and leaves
the version unchanged; no ad-hoc DDL outside the migration owner; no
production down-migration; documented developer reset path (delete the
disposable file — Vict never deletes automatically). Manifest/event schema
versions are independent of the SQLite schema version.

### 2.5 Activation restoration

`runtime.restoreActivation(definition, { activationVersion? })` implements
exact restoration (DATA-008, VER-008): load the stored manifest → recompile
the caller's current definition against the current registry → recompute all
three identities → compare the rebuilt canonical manifest byte-for-byte →
activate only on exact equality. Mismatch/missing/corrupt cases return
structured failures (`VICT_RUNTIME_ACTIVATION_MISMATCH`,
`_ACTIVATION_UNAVAILABLE`, `_ACTIVATION_NOT_FOUND`) with safe difference
descriptions; the stored manifest is preserved, the active graph is
unchanged, no capability executes, no "closest" revision is chosen.
Restoration verifies availability only; it never invokes anything.

### 2.6 Run/event transaction model

`DurableRunTracker` (`packages/runtime/src/durable-run.ts`) drives a FIFO
write queue that drains concurrently with sequential execution:

1. `createRun` + `run.started` — one transaction (run created `running`);
2. `node.started` + current-node/step context — one transaction, committed
   before the capability is invoked;
3. node result batches (`node.completed`/`node.failed`/`contract.rejected`/
   `effect.blocked` plus their `signal.routed` follow-ups) — one transaction;
4. terminal event + terminal record — one transaction; under `'full'`
   retention the complete validated output rides the terminal transition.

A completed three-node run performs **7 durable transactions** (1 create +
3 node-start + 2 node-result + 1 terminal). This intentionally replaces the
Stage 01 fact of "one repository write per run"; tests and documentation
state the new number. The in-memory trace and the durable event sequence
agree exactly (type and seq) for completed runs.

A failed storage write fail-fasts execution: the next event boundary throws
the structured store error, so no capability runs unrecorded beyond the
failure point; durable state remains at the last good transition. Inputs are
never stored; complete outputs only under explicit `'full'` (enforced in the
tracker AND re-enforced by both stores — a command carrying output data for
a `none`/`summary` run is rejected).

### 2.7 Interruption policy

`recoverInterruptedRuns()` is an explicit boot operation. It finds nonterminal
`running` runs, atomically transitions each to `blocked`, and appends exactly
one `run.blocked` event with the stable code
`VICT_RUN_INTERRUPTED_BY_RESTART`, a reason, and remediation stating that
automatic resume is unavailable and a deliberate new run (new run id) is the
operator path. Activation identity and last durable node context are
preserved. Nothing is invoked, replayed, or inferred. Repeated recovery
(within a process or from a later process) is idempotent.

### 2.8 Retention and error boundary at the durable edge

- `summary` remains the default; `'none'` drops summaries; `'full'` stores
  the complete validated output by explicit choice only (and never inputs or
  raw errors).
- Persisted errors are the sanitized structured errors already produced by
  the safe runtime boundary (safe code, safe message, class name, correlation
  id). Raw thrown/schema messages never enter stored rows.
- Store errors are structured (`VictStoreError` + 13 safe codes); raw driver
  messages, SQL text, and bound values never appear in public messages and
  are attached only to the protected `driverCause` field, which is never
  serialized into run/event data.

---

## 3. Carry-forward corrections

### 3.1 Contract/adaptor immutability (CONT-008, VER-010) — closed

- `defineZodContract` now returns `Object.freeze(contract)`
  (packages/contracts/src/zod/define-zod-contract.ts); `defineContract`
  already froze (verified by test).
- Activation captures every referenced contract's **parse callable by value**
  (bound at capture) plus immutable metadata into the snapshot
  (`#captureSnapshot`, runtime.ts). Tests:
  `packages/runtime/test/contract-immutability.test.ts` — a hand-rolled
  mutable contract's `parse` swapped after activation does not affect later
  runs (original parse called, identity unchanged); frozen official contracts
  cannot be mutated; explicit reactivation with a deliberately changed
  contract (new revision) produces a new capability-set/activation identity
  and enforces the new meaning.
- Accepted trust boundary (documented in code and report): capturing the
  callable protects against property replacement; it cannot detect mutated
  closure state. Revision discipline remains the author/build trust boundary.

### 3.2 Full-retention responsibility (DATA-011) — closed

Explicit warning added to:

- `PayloadRetention` type documentation (runtime/types.ts, re-exported by the
  SDK) — "Selecting `'full'` makes the caller/operator responsible for the
  sensitivity, access control, minimization, and lifecycle of the complete
  output that will be persisted.";
- `VictRuntimeOptions.payloadRetention` documentation;
- `docs/architecture/NIGHT-01-FOUNDATION.md` (foundation document, blockquote
  warning);
- `docs/architecture/STAGE-02-STORES.md`;
- this report (restating the meaning verbatim).

`summary` remains the default everywhere; no default was weakened.

### 3.3 Read encapsulation (DATA-012) — closed

In-memory and SQLite reads return deep-frozen immutable snapshots.
Evidence: conformance suite case "returned records cannot mutate stored
state" (mutation attempt then re-read, both adapters);
`contract-immutability.test.ts` "run records never expose a way to mutate
stored traces" (frozen record and trace, mutation attempts throw, re-read
unchanged).

### 3.4 Cycle diagnostic hygiene (KERN-008) — improved, no semantic change

`compileGraph` previously ran cycle detection only when no other issues
existed. It now detects cycles whenever the adjacency is structurally
resolvable and appends the finding in the same deterministic position, so
cycles coexist with independent diagnostics in stable order. The 13-code
public issue union is unchanged; no codes were renumbered or repurposed.
Evidence: `packages/kernel/test/compile.test.ts` "reports cycles alongside
other independent diagnostics in deterministic order" (both issues present,
stable order across repeated compilations).

---

## 4. Files changed

**New package — `packages/store-sqlite/`**
- `src/driver.ts` (safe node:sqlite wrapper, transactions, pragmas)
- `src/migrations.ts` (forward-only versioned migrations)
- `src/adapter.ts` (ActivationCatalog + ExecutionStore adapters, validation)
- `src/index.ts`, `tsconfig.json`, `package.json`
- `test/migrations.test.ts`, `test/corruption.test.ts`,
  `test/transaction.test.ts`, `test/restart.test.ts`,
  `test/helpers/retry-rm.ts`
- `test/fixtures/shared.ts`, `fixtures/restart-basic.ts`,
  `fixtures/restart-interrupt.ts`, `fixtures/restart-mismatch.ts`

**`packages/runtime/`**
- New: `src/store-types.ts`, `src/store-errors.ts`, `src/serialization.ts`,
  `src/in-memory-stores.ts`, `src/durable-run.ts`, `src/store-conformance.ts`,
  `src/testing.ts`
- Rewritten: `src/runtime.ts` (async durable activation/run lifecycle,
  restoration, recovery, captured contracts); `src/types.ts`; `src/index.ts`;
  `src/errors.ts` (new codes)
- Removed: `src/repository.ts` (replaced by semantic ports)
- Updated: `package.json` (`./testing` subpath)
- Tests updated: `runtime`, `effects`, `error-sanitization`,
  `payload-retention`, `snapshot`, `bench-semantics` (async APIs)
- Tests new: `contract-immutability`, `durable-lifecycle`,
  `store-conformance` (shared suite driving both adapters)

**`packages/contracts/`** — frozen Zod-adapter contract; frozen-contract test.
**`packages/kernel/`** — `run.blocked` code field; independent cycle
diagnostics; coexistence test.
**`packages/sdk/`** — facade re-exports for the new store surface.
**`examples/ara-proof/`** — async activation; unchanged semantics (13 events).
**Scripts** — `benchmark.ts` (Stage 02 labeled benchmarks);
`isolated-consumer-check.mjs` (five packed packages + SQLite
close/reopen consumer); `verify-stage2.mjs` (new aggregate runner).
**Tooling** — root `package.json` (engines `>=22.13.0`, `verify:stage2`,
5-package build), `vitest.config.ts` + `tsconfig.json` (new aliases),
`.gitignore` (DB files), `package-lock.json`.

**Documentation** — `README.md` (durable quick start);
`docs/architecture/STAGE-02-STORES.md` (new);
`docs/architecture/NIGHT-01-FOUNDATION.md` (retention warning, store note);
`docs/VICT-SYSTEM-REFERENCE.md` (status deltas, §9 below).

---

## 5. Verification evidence

All commands executed in this repository on Windows 11, Node v22.13.1,
npm 10.9.2. Every command exited 0.

| Command | Exit | Observed result |
|---|---|---|
| `npm ci` | 0 | clean install from lockfile, 0 vulnerabilities |
| `npm run format:check` | 0 | "All matched files use Prettier code style!" |
| `npm run lint` | 0 | no ESLint errors |
| `npm run typecheck` | 0 | strict `tsc --noEmit`, no errors (skipLibCheck true repo-internal; packed consumers verify with `skipLibCheck: false`) |
| `npx vitest run --project unit` | 0 | **20 files / 173 tests passed** |
| `npx vitest run --project integration` | 0 | **1 file / 4 tests passed** |
| `npm test` | 0 | **21 files / 177 tests passed** (173 unit + 4 integration) |
| `npm run build` | 0 | all five packages compile (contracts, kernel, runtime, store-sqlite, sdk) |
| `npm run verify:consumer` | 0 | 5 tarballs packed; neutral consumer (no Zod, `@types/node` as consumer dev tooling) type-checks strict with `skipLibCheck: false`, runs SQLite publish/activate/run/close, then a fresh process restores the exact activation and reads back run + events; Zod consumer exercises `@vict/sdk/zod` with frozen-contract check; no Zod references in base declarations |
| `npm run example` | 0 | ARA proof offline; 4 nodes, 3 edges, **13 events**, ordered trace intact |
| `npm run bench` | 0 | labeled in-memory / SQLite-file / SQLite-memory results (§7) |
| `npx vitest run --project unit packages/runtime/test/store-conformance.test.ts` | 0 | shared conformance suite: **32 tests** (16 in-memory + 16 SQLite) |
| `npx vitest run --project unit packages/store-sqlite` | 0 | migrations/corruption/transaction/restart suites: **27 tests** |
| `npm run verify:stage2` | 0 | unit + integration + packed SQLite consumer aggregation |
| `npm test` (final, after all docs/config edits) | 0 | 21 files / 177 tests passed |

Baseline for comparison: 105 tests before Stage 02 → 177 after (72 new tests,
all new behavior; all pre-stage tests preserved or deliberately updated for
the async store API and the documented transaction-count change).

---

## 6. Required verification matrix

| Area | Result | Evidence |
|---|---|---|
| Fresh database | PASS | `migrations.test.ts` "migrates a fresh database to the current version" |
| Reopen | PASS | "reopening an up-to-date database is idempotent" |
| Future schema | PASS | "fails closed on an unsupported newer schema without mutating" |
| Activation publish | PASS | conformance "activation publish/read round-trips immutably" (both adapters) |
| Activation collision | PASS | conformance "same version with different content is rejected" |
| Selection conflict | PASS | conformance "selection uses optimistic concurrency" |
| Exact restore | PASS | restart.test "completed run…survives a real process restart" (identities match in a new process); durable-lifecycle restore test |
| Restore mismatch | PASS | restart.test ×5: missing capability, changed capability revision, changed effect, changed contract revision, changed topology — each fails with the expected code, no execution, active graph unchanged |
| Completed restart | PASS | restart.test scenario 1 (real child processes, run + events identical) |
| Failed restart | PASS | same scenario: failed run + sanitized error survive (`VICT_KERNEL_CONTRACT_REJECTED` / thrown-capability case via errorMatches) |
| Forced interruption | PASS | restart.test "forced interruption" (SIGKILL after durable node-start; recovery to blocked) and "interruption after a pure node completes" (safe prefix) |
| Recovery repeat | PASS | same tests: second recovery in-process and a third process find nothing; event count unchanged |
| Atomic transition | PASS | conformance fault-injection cases (both adapters) + sqlite `transaction.test.ts` afterRunUpdate / beforeCommit faults |
| Writer conflict | PASS | transaction.test "two transitions from the same expected revision" (one winner, one `VICT_STORE_RUN_CONFLICT`); conformance stale-revision cases |
| Event order | PASS | conformance "dense, append-only, explicitly ordered"; corruption "gapped sequence fails validation" |
| Default retention | PASS | conformance retention shapes; canary scans: records, events, and raw DB bytes contain no input/output/thrown/cause/schema canaries (default mode) |
| Full retention | PASS | restart.test "explicit full retention stores the complete output by choice and never inputs or raw errors" |
| Error safety | PASS | conformance safe-error round-trip; SQL text/values absent from messages (corruption test); raw driver detail only on `driverCause` |
| Contract mutation | PASS | contract-immutability tests (§3.1) |
| Zod adapter | PASS | contracts zod-adapter test "returns a frozen contract"; consumer check freeze assertion |
| Record isolation | PASS | conformance + contract-immutability encapsulation cases |
| In-memory parity | PASS | shared suite `[in-memory]` 16/16 |
| SQLite parity | PASS | shared suite `[sqlite]` 16/16 |
| Package isolation | PASS | verify:consumer — five packed tarballs, no workspace hoisting, strict TS (`skipLibCheck: false`), SQLite close/reopen in separate processes |
| ARA | PASS | `npm run example`: offline, 4 nodes / 3 edges / 13 events, deterministic |
| Regression | PASS | all 105 pre-stage behaviors preserved (updated only for async APIs / documented transaction count) |
| Scope | PASS | §11 of this report |

---

## 7. Restart evidence

**Process topology.** Parent = vitest worker. Children = real Node processes
spawned via `spawnSync`/`spawn` with `node --import tsx` (tsx resolves from
the repository root). Every scenario crosses at least one real process
boundary; interruption scenarios terminate a live child with SIGKILL
(TerminateProcess on Windows) after the parent observes, via an independent
connection, that the durable transition has committed.

**Scenario "completed run survives restart" (15.1).**
Process A: creates a SQLite file database via the packed-style adapter API,
registers code, publishes + selects an activation, completes a run, runs a
capability that throws (sanitized error path), closes the database
(`dispose()`), writes a report. Process B (fresh process, same database):
restores the exact activation from current code, reads the run record and
events, and compares — activationVersion/graphVersion/capabilitySetVersion/
steps identical, event sequence identical (type + seq), output summary
identical (canonical compare), durable output absent (default `summary`
retention), failed run and sanitized error intact. Parent asserts both
reports agree.

**Scenario "forced interruption" (15.2).**
Graph: `fx.start` → `fx.second`; `fx.second` blocks on a barrier file that
only the parent controls. Process A runs the graph. Parent waits until the
`node.started` event for `second` is durable (independent DB connection),
then SIGKILLs the child. Process B: restores the exact activation, calls
`recoverInterruptedRuns()` twice. Observed: exactly one run transitioned to
`blocked`; exactly one `run.blocked` event appended with code
`VICT_RUN_INTERRUPTED_BY_RESTART`; activation identity unchanged; the second
capability never performed its work (marker file proves the barrier was never
passed); second recovery scanned 0; a third process also scanned 0.

**Scenario "interrupted after a pure node completes" (15.2).**
Same fixture; the parent kills after `node.completed` for the first node is
durable. Recovery: run blocked; durable history is a prefix of the expected
sequence containing the first node's completion; exactly one interruption
event; second capability never executed; recovery idempotent.

**Database lifecycle.** Every scenario uses a fresh temporary directory
outside the repository; databases are created by the child/adapters, never
committed; cleanup retries briefly for Windows file-lock release.

**No-replay proof.** Capability bodies record their observable work in a
marker file that only they can write; after interruption the marker contains
only the pre-barrier node's entry; no `node.completed` for the second node
exists in storage; recovery itself never invokes capabilities (it only
transitions state and appends the interruption event).

---

## 8. Performance (Section 17)

Environment: Windows 11 Pro, win32-x64, Node v22.13.1, local NTFS SSD.
Driver: built-in `node:sqlite` (SQLite 3.47.2). Graph: 3 nodes / 2 edges
(3-node pure benchmark shape), 10 events per completed run, 7 durable
transactions per run. Warm-up and iteration counts stated per row.

| Measurement | Database mode | Durability | n (warmup) | median | p95 | mean |
|---|---|---|---|---|---|---|
| Sequential run, in-memory runtime | in-memory store | none (process memory) | 5000 (1000) | **0.219 ms** | 0.386 ms | 0.250 ms |
| Sequential run, SQLite runtime | file-backed, WAL | `synchronous=FULL` — real fsync per commit | 500 (50) | **16.6 ms** | 27.4 ms | 18.0 ms |
| Sequential run, SQLite runtime | `:memory:` | none (API-parity only — labeled, not comparable) | 2000 (200) | **1.78 ms** | 2.83 ms | 2.00 ms |
| Activation publish+select | file-backed, WAL | fsync per commit | 50 (0) | **2.0 ms** | 5.4 ms | 2.7 ms |
| Activation exact restore (compile + manifest compare, no execution) | file-backed, WAL | read-only path | 200 (0) | **0.23 ms** | 0.27 ms | 0.25 ms |
| Completed-run read (record + 10 events, re-validated) | file-backed, WAL | read-only path | 500 (0) | **0.32 ms** | 0.57 ms | 0.35 ms |

Honesty notes: file-backed and `:memory:` rows are labeled separately and
must not be compared unlabeled — the file-backed cost is dominated by one
fsync per durable transaction (`synchronous=FULL`). Compilation is off the
run path (once at activation); restoration recompiles but never executes
capabilities. These numbers are informational envelopes, not correctness
assertions; no wall-clock assertion exists in correctness tests.

---

## 9. Compatibility changes

Intentional, pre-1.0 breaking changes (all call sites updated):

1. `runtime.activate()` is now **async** (`Promise<ActivationResult>`);
   activation durably publishes and selects before the in-memory snapshot is
   replaced.
2. `runtime.getRun`/`listRuns` are now **async** and assemble runs from the
   store; `RunRecord.status` gained `'running'` (nonterminal in-flight or
   interrupted runs) and `recordRevision`/`currentNodeId` fields.
3. The sync `RunRepository` / `createInMemoryRunRepository` were **removed**;
   use `stores: VictStores` (default remains a private in-memory store) —
   `createInMemoryStores()` is public for tests/embedding.
4. New public surface: store ports/records/commands, `VictStoreError` +
   codes, `restoreActivation`, `recoverInterruptedRuns`, `@vict/runtime/testing`.
5. Engines floor raised **explicitly** to `>=22.13.0` (built-in `node:sqlite`;
   rationale in §2.3). No other Node-version constraint changed.
6. Durable write count per completed run changed (1 → 7 for the three-node
   shape) by design; benchmark semantics updated.
7. `run.blocked` events gained an optional `code` field (additive).

Migration implication for existing consumers: `await` activation and run
record reads; replace repository injection with store injection. No data
migration is needed (Stage 02 introduces the first persistent schema).

---

## 10. Remaining risks

**Blocking:** none known.

**Non-blocking:**
- A storage failure mid-run fail-fasts at the next event boundary; at most
  the capability currently in flight executes beyond the last durable
  record. This is the same ambiguity a process crash mid-invocation would
  produce; recovery treats the run as blocked at the last durable state.
- Windows/`node:sqlite` finalizers release file locks lazily (GC). Tests
  retry cleanup; the benchmark notes if a temp directory could not be fully
  removed (disposable, outside the repository).
- Multi-process concurrent ownership of one database is unsupported
  (documented); `busy_timeout` only softens brief contention.
- `listRuns()` assembles full traces for every run; fine at local scale, may
  need query/limit support later.

**Accepted trust boundaries (unchanged, documented):**
- Capturing the parse callable cannot detect mutated closure state; explicit
  revision discipline remains the author/build boundary (CONT-008 note).
- Effect classes and revisions are author-supplied.
- Trace key-name redaction is best-effort; values are structurally omitted.

**Future-stage work (not implemented here):** waits/signals/timers, retries
and idempotency, branching/fan-out, resumable node execution, distributed
workers/leases, Postgres adapter, control plane, Studio, run-history query
APIs.

---

## 11. Scope confirmation

Each handoff §5.2 exclusion remained untouched: no waits or external signals;
no timers or scheduling queues; no branch/fan-out/join/loop primitives; no
automatic retries or backoff; no resumable node execution; no idempotency
orchestration; no distributed workers/leases/leader election; no Postgres or
cloud databases; no HTTP/WebSocket/SSE/MCP/server transport; no ChangeSets,
roles, or approvals; no CLI or Studio; no Builder Agent runtime integration;
no capability packs/registry/playbooks/marketplace; no SDK dependency-direction
refactor (Stage 04); no ARA application-domain persistence; no multi-process
concurrent execution against one database; no automatic replay of interrupted
capabilities. Recovery blocks instead of replaying — exactly the handoff's
boundary.

---

## 12. Repository state

| Item | Value |
|---|---|
| Final commit | `<(this commit)>` — "Stage 02: durable identity and stores (SQLite adapter, semantic store ports, restart-safe sequential runs)" |
| Push | Pushed to `origin/main` only if the existing workflow permits and credentials are configured; no push was required by the handoff |
| Final git status | clean except intentional deliverables (this report included) |
| Temporary artifacts | none in the repository: no databases, tarballs, coverage output, debug scripts, or fixture residue (`.gitignore` also excludes `*.db`/`*.sqlite*` patterns for the future) |

---

## 13. Independent verification readiness

Shortest clean-room sequence for a separate auditor:

```bash
cd C:/Users/RZ1/Desktop/RZ/260831-VCT-02
npm ci
npm run format:check
npm run lint
npm run typecheck
npx vitest run --project unit          # 173 tests incl. shared store conformance
npx vitest run --project integration   # 4 tests (ARA public surface)
npm test                               # 177 tests total
npm run build
npm run verify:consumer                # 5 packed tarballs; SQLite close/reopen
npm run example                        # ARA: 4 nodes, 3 edges, 13 events
npm run bench                          # labeled performance envelopes
```

Targeted adversarial re-runs:

```bash
npx vitest run --project unit packages/store-sqlite   # migrations, corruption,
                                                      # transaction faults,
                                                      # real-subprocess restart
npx vitest run --project unit packages/runtime/test/store-conformance.test.ts
npx vitest run --project unit packages/runtime/test/contract-immutability.test.ts
```

The auditor should reconcile: the 177-test count, the 7-transactions-per-run
and 10-events-per-run benchmark facts, the 13-event ARA trace, the canary
scans (default vs full retention), the five mismatch scenarios, and the
engines-floor rationale (§2.3).

---

*Prepared by the Stage 02 implementation agent. This report is a claim with
reproducible evidence; per GOV-004 and TEST-005, only an independent audit
can change Stage 2 delivery status to Verified.*
