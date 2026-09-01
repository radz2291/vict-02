# Stage 02 — Durable Identity and Stores

Status: implemented, evidence in `VICT-STAGE-02-REPORT.md`, delivery status
**awaiting independent audit** (not Verified). Everything below describes
running code in this repository.

## Objective

> Vict's activation identity, run state, and operational event history can
> survive a real process restart without changing Stage 01's sequential
> execution meaning or silently replaying work.

Stage 02 is a persistence stage, not an orchestration expansion. No waits,
timers, branching, retries, or distributed workers were added.

## Package and dependency map

```text
@vict/contracts  ←  @vict/kernel  ←  @vict/runtime  ←  @vict/store-sqlite
       ↑                 ↑                ↑
       └─────────────────┴──── @vict/sdk ──┘   (public authoring facade;
                                                never imports the adapter)
```

- **@vict/runtime** owns the semantic store ports (`ActivationCatalog`,
  `ExecutionStore`), the public persistence records (`StoredRun`,
  `StoredEvent`, `StoredActivation`, `ActivationManifest`), the in-memory
  conforming store, the durable run lifecycle, and restart policy. It never
  imports SQLite.
- **@vict/store-sqlite** owns schema, migrations, transactions, and
  serialization for SQLite. It depends on `@vict/runtime` ports only — not on
  `@vict/sdk` — and contains no graph compilation or application logic.
- **@vict/kernel** remains pure: no filesystem, database, clock, or process
  access.

## SQLite driver decision

**Chosen: the built-in `node:sqlite` module** (SQLite 3.47.x bundled with
Node 22.13.x).

Evidence:

- `better-sqlite3@13` segfaults on the supported runtime (Node 22.13.1,
  win32-x64, ABI 127) — verified by installation and execution in this
  repository's environment. `better-sqlite3@12` works today, but every Node
  major upgrade would couple to a native prebuild that may not exist yet;
  a native prebuild that silently mismatches the ABI is the worst failure
  mode for a durable store.
- `node:sqlite` requires no installation, no compilation, and no ABI
  coupling. It provides everything the ports need: real transactions
  (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`), foreign-key enforcement,
  `busy_timeout`, and WAL journaling.
- Trade-off: `node:sqlite` exists from Node 22.5 and is exposed without a
  flag from 22.13. The repository engines floor was raised **explicitly**
  (not silently) from `>=22.0.0` to `>=22.13.0`, recorded here, in the root
  `package.json`, in `packages/store-sqlite/package.json`, and in the stage
  report.

## Schema and migrations

Forward-only, versioned schema (see `packages/store-sqlite/src/migrations.ts`):

- `vict_schema_migration` — migration version (PK), name, applied UTC instant.
- `vict_activation` — immutable activation rows: activation version (PK),
  manifest schema, graph id/version, capability-set version, canonical
  manifest JSON, created instant.
- `vict_activation_selection` — per-graph selection with an optimistic
  `selection_revision`.
- `vict_run` — run identity, all three version identities, status
  (`running|completed|failed|blocked`, CHECK-enforced), mode, retention
  (CHECK-enforced), steps, current node, safe output summary JSON, complete
  output JSON (only under `'full'`), sanitized error JSON, record revision,
  created/updated/completed instants. Foreign key to `vict_activation`.
- `vict_run_event` — append-only events: `(run_id, seq)` primary key with
  dense per-run sequences, event schema, type, identities, node/capability,
  canonical safe payload JSON, timestamp. Foreign key to `vict_run`.

Policy:

- schema version starts at 1; migrations are ordered and forward-only;
- each migration plus its version row commits in one transaction, so a
  partially applied migration cannot leave a falsely advanced version;
- reopening an up-to-date database is a no-op;
- a database written by a newer schema fails closed
  (`VICT_STORE_UNSUPPORTED_SCHEMA`) without mutation;
- no production down-migration exists; to discard a disposable local
  development database, delete its file (and `-wal`/`-shm` sidecars).
  Vict never deletes databases automatically.
- the SQLite schema version is independent of the activation-manifest schema
  (`vict.activation-manifest@1`) and the run-event schema (`vict.run-event@1`),
  which are recorded per row.

Operational settings (all documented, all overridable):

- `PRAGMA foreign_keys = ON` (correctness, not optional);
- `PRAGMA busy_timeout = 5000` (default);
- `PRAGMA journal_mode = WAL` (file databases; `:memory:` stays `memory`);
- `PRAGMA synchronous = FULL` — real local durability (fsync per commit).
  `normal` is available as an option for throughput-sensitive local use;
- database path supplied by the caller; `:memory:` supported;
- clean close via `stores.dispose()`;
- one local runtime owner per database; multi-process concurrent ownership is
  out of scope for this stage and is not implemented (no leases).

## Store ports and semantics

- All port operations are Promise-based; reads return deep-frozen immutable
  snapshots (DATA-012).
- `ExecutionStore.createRun` and `commitTransition` are atomic: the run-state
  update and the ordered event batch commit together or not at all (DATA-003).
- Run updates require the expected record revision; event appends require the
  expected dense sequence. Conflicts are structured errors, never overwrites.
- Events have no update or delete path. Activations are immutable.
- The same activation version republished with equivalent canonical content is
  idempotent; the same version with different canonical content is rejected
  (`VICT_STORE_ACTIVATION_COLLISION`).
- JSON read from storage is validated before it becomes a public record;
  malformed or inconsistent rows raise `VICT_STORE_INVALID_RECORD`.
- Errors are structured and safe: raw driver messages, SQL text, and bound
  values never appear in public messages; raw driver detail attaches only to
  the protected `driverCause` field that never enters persisted data.

## Runtime integration

- **Activation** is atomic from the caller's perspective: compile → snapshot
  (capability bindings + captured contract parse callables) → build
  canonical manifest → publish and select in one catalog transaction → then
  replace the in-memory snapshot. A failed compile returns structured issues;
  a failed storage write throws; in both cases the previously active graph
  remains selected and runnable.
- **Runs** persist: create + `run.started`; `node.started` + current-node/step
  context before each invocation; node result batches (`node.completed`/
  `node.failed`/`contract.rejected`/`effect.blocked` plus their
  `signal.routed` follow-ups) atomically; the terminal event + terminal record
  atomically (under `'full'` retention the complete validated output rides the
  terminal transition). A completed three-node run performs **7 durable
  transactions** (1 create + 3 node-start + 2 node-result + 1 terminal); this
  replaces the Stage 01 "one repository write per run" fact.
- The in-memory trace and the durable event sequence agree exactly for
  completed runs.
- Inputs are never stored; the complete output is stored only under explicit
  `'full'` retention (DATA-006); `summary` remains the default (DATA-005).
- A failed storage write fail-fasts the run (the next event boundary throws a
  structured store error); durable state remains at the last good transition.

## Exact-activation restoration (DATA-008, VER-008)

`runtime.restoreActivation(definition)`:

1. loads the stored manifest (selected for the graph, or by explicit
   activation version);
2. recompiles the caller's current definition against the current registry;
3. recomputes graphVersion, capabilitySetVersion, activationVersion;
4. compares the rebuilt canonical manifest with the stored one;
5. activates only on exact equality.

On any mismatch, missing capability/contract, changed revision, changed
effect, or changed topology: structured failure (`ACTIVATION_MISMATCH` /
`ACTIVATION_UNAVAILABLE` / `ACTIVATION_NOT_FOUND`), stored manifest preserved,
active graph unchanged, no capability executed, no "closest" revision.

## Interrupted-process policy

Stage 02 does not resume interrupted execution. `recoverInterruptedRuns()`
is an explicit boot operation (single local owner assumed):

- finds nonterminal `running` runs left by a previous process;
- atomically transitions each to `blocked` and appends one `run.blocked`
  event carrying the stable code `VICT_RUN_INTERRUPTED_BY_RESTART`, a reason,
  and remediation stating that automatic resume is unavailable and that a
  deliberate new run (new run id) is the operator path;
- preserves activation identity and last durable node context;
- never invokes or replays a capability; never infers whether an external
  effect occurred;
- is idempotent — repeated recovery finds nothing.

## Carry-forward corrections closed here

1. **Contract immutability** — `defineZodContract` (and `defineContract`)
   return frozen contracts; activation captures each contract's parse
   callable by value plus immutable metadata, so caller-owned
   `contract.parse = ...` swaps after activation cannot change pinned runs.
   Capturing the callable cannot detect mutated closure state; explicit
   revision discipline remains the accepted author/build trust boundary.
2. **Full-retention responsibility** — explicit warning in
   `PayloadRetention` documentation, `VictRuntimeOptions`, this document, and
   the stage report: selecting `'full'` makes the caller/operator responsible
   for the sensitivity, access control, minimization, and lifecycle of the
   complete persisted output.
3. **Read encapsulation** — in-memory and SQLite reads return deep-frozen
   snapshots; conformance tests mutate returned records and prove canonical
   state is unchanged.
4. **Cycle diagnostics** — kernel cycle detection now runs independently of
   other compile diagnostics and reports in deterministic order; the 13-code
   public issue union is unchanged.

## Conformance and adversarial evidence

One adapter-neutral conformance suite (`@vict/runtime/testing`) runs against
both the in-memory and SQLite stores: publish/read equivalence, idempotent
republish, version collisions, selection optimistic concurrency, atomic
create/transition, stale-revision and sequence conflicts, dense append-only
events, retention shapes, safe errors, record encapsulation, idempotent
recovery, malformed-record rejection, and injected mid-transaction faults
leaving no half-state.

SQLite additionally carries: fresh-migration/reopen/future-schema/partial-
migration tests, corruption tests (malformed JSON, inconsistent identities,
event gaps, dangling selection), real subprocess restart tests (completed run
survival, forced interruption → blocked without replay, idempotent recovery,
five exact-restoration mismatch scenarios), transaction-fault and
writer-conflict tests, and canary leakage scans across records, events, and
raw database bytes (default and full retention).

## Performance semantics

`npm run bench` reports, separately and labeled: in-memory runtime; SQLite
file-backed (WAL + `synchronous=FULL`, real fsync per commit); SQLite
`:memory:` (labeled, not comparable); activation publish/restore; and
completed-run read with events. See the stage report for the measured numbers
and environment.
