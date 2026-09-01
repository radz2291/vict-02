# VICT Stage 02 — Corrective Finalization Report

> **Repository:** github.com/radz2291/vict-02 (branch `main`)
> **Authority:** docs/handoff/VICT-STAGE-02-CORRECTIVE-FINALIZATION-HANDOFF.md over VICT-SYSTEM-REFERENCE.md v0.1.1
> **Report date:** 2026-09-01

---

## Final disposition

**READY FOR INDEPENDENT AUDIT** (implementation claim; not Verified — only an
independent audit can change delivery status).

All ten completion gates from the handoff are met; no Stage 03 capability was
implemented.

| Commit | SHA | Content |
|---|---|---|
| Starting (audited baseline) | `b2e2ee5d4ad28486026abdbbf902d538671e8f4d` | Stage 02 implementation as audited |
| Correction commit | `a1ccea144add05e4a92303d13392510b16fa311a` | `fix(stage-02): enforce durable execution and store invariants` — all corrections and tests |
| Report delivery | the commit carrying this file (immediate child of the correction commit; SHA recorded in the push confirmation and final response) | this report |

Push: fast-forward push of `main` to `origin` with already-configured
credentials; no force-push, no history rewrite.

Environment of record: Windows 11 Pro, win32-x64, Node v22.13.1,
npm 10.9.2, built-in `node:sqlite` (SQLite 3.47.2), local NTFS SSD.
**Only this operating system was tested**; POSIX behavior is addressed by
unambiguous code paths and deterministic path handling, not by a claim of
cross-platform execution (see Known limitations).

---

## 1. Findings, root causes, corrections

### 1.1 Blocking — capability invocation could precede durable intent

**Root cause.** The kernel's `emit()` calls the synchronous `onEvent` port;
`DurableRunTracker.onEvent` placed the store work on a FIFO promise queue and
returned immediately. `executeGraph` then invoked the capability without ever
awaiting the queued write. With a delayed store, the observed order was
capability-started → run-created → `node.started`-committed. The Stage 02
documentation claimed "committed before the capability is invoked", but that
ordering was never enforced — the report and architecture prose described
intent, not behavior.

**Correction.** A general, kernel-level port now expresses the boundary:

- `KernelPorts.beforeInvoke?: (boundary: InvocationBoundary) => Promise<void>`
  (kernel/types.ts). `executeGraph` awaits it after emitting `node.started`
  for a node and before invoking that node's capability — at every
  invocation, sequentially. A rejection is an infrastructure failure: the
  capability is not invoked and the error propagates out of `executeGraph`
  unchanged (never converted into a domain event or routed along an error
  edge — hiding or downgrading a durability failure would misrepresent what
  is durably known).
- `DurableRunTracker.awaitDurableBoundary()` implements the port: it awaits
  the FIFO write queue (which settles only when every write enqueued so far
  has settled) and then rethrows the recorded structured store failure.
- `VictRuntime.run()` wires `beforeInvoke: () => tracker.awaitDurableBoundary()`.
  `runNode()` (isolated, non-durable) installs no guard, matching its
  documented no-persistence semantics.

**Why this proves the invariant.** The queue order is exactly the emission
order: `[createRun, node-start₁, result-batch₁, node-start₂, …, terminal]`.
Because the guard awaits the whole queue at each boundary, the causal chain
holds per invocation: run creation and `node.started`₁ commit before the
first capability runs; result-batchₙ₋₁ and `node.started`ₙ commit before
capability ₙ begins. It is causal (queue-settlement ordering), not a timing
assumption, and no end-of-run drain is involved. The kernel stays storage-
agnostic: the boundary is a general port; SQLite is not referenced.

**Evidence.** New adapter-neutral `runDurableBoundarySuite`
(`packages/runtime/src/boundary-conformance.ts`, exported from
`@vict/runtime/testing`) runs the REAL production wiring — kernel events →
`DurableRunTracker` → store under test — with every store write held open by
an explicit FIFO gate:

| # | Required test | Result (both adapters) |
|---|---|---|
| 1 | `createRun` unresolved → capability call count 0 | PASS (in-memory, SQLite) |
| 2 | run created, `node.started` commit unresolved → count 0 | PASS (both) |
| 3 | node-start commit resolved → invoked exactly once | PASS (both) |
| 4 | `createRun` rejected → never invoked; structured error | PASS (both, `VICT_STORE_UNAVAILABLE`) |
| 5 | node-start transition rejected → never invoked | PASS (both, `VICT_STORE_BUSY`) |
| 6 | Synchronous side-effecting capability (invocation recorded as the FIRST statement of the capability body — no in-capability barrier can fake a pass) | PASS (both) |
| 7 | Two-node graph: second capability cannot begin until the first result batch AND the second `node.started` are durable (commit-journal ordering asserted) | PASS (both) |
| 8 | Real subprocess hard-kill/restart retained | PASS — the SIGKILL scenarios now document exactly what they prove: the parent observes the second node's `node.started` durable via an independent reader before killing; the marker file proves the second capability never completed work; recovery blocks without replay |

The gates are deferred promises; every await targets observable state (a
write arriving at the gate, an invocation being recorded). No sleeps, no
polling, no timing assumptions.

Kernel-level tests additionally cover: guard awaits before every invocation
in node order, guard rejection propagates unchanged with zero invocations,
and a deferred-write guard orders invocation causally
(`packages/kernel/test/execute.test.ts`).

### 1.2 Gating — event sequence checked only against caller input

**Root cause.** Both adapters verified `event.seq` against the caller-supplied
`expectedNextEventSeq` but never verified the expectation against the ACTUAL
stored next sequence. A transition with `expectedNextEventSeq: 5` and
`event.seq: 5` was accepted immediately after stored event 0.

**Correction.** In the same atomic transition (and inside the SQLite
transaction):

- the actual next sequence is computed from stored history — 0 for an empty
  run, otherwise preceding sequence + 1 (in-memory walks the stored events;
  SQLite uses `COUNT(*)`/`MAX(seq)`);
- `expectedNextEventSeq ≠ actual` → `VICT_STORE_EVENT_SEQUENCE_CONFLICT`,
  nothing mutated (rollback asserted in shared tests);
- a gapped stored history (count ≠ max+1) → `VICT_STORE_INVALID_RECORD`
  (structured corruption), never extended;
- `createRun` accepts only a dense initial batch beginning at sequence zero
  (previously only enforced by the in-memory adapter — the SQLite
  `createRun` loop inserted events without density checks; both now enforce
  and are covered by one shared test).

Shared conformance coverage: "expectedNextEventSeq must equal the actual
stored next sequence" (advanced + stale expectations, rollback proofs, then
the correct expectation succeeds) and "createRun accepts only a dense
initial batch beginning at zero" (start-at-1 rejected, mid-batch gap
rejected, no partial runs left behind, dense batch accepted) — each run
against both adapters.

### 1.3 Gating — activation, run, selection, and event identity not cross-validated

**Root cause.** Stores treated the identity columns as caller-owned labels.
A run referencing an existing activation version could supply unrelated
`graphId`/`graphVersion`/`capabilitySetVersion` values; selection ignored
graph ownership; publish did not verify that the canonical string was the
canonical form of the manifest nor that identities recompute from content.

**Correction** (shared validators in `packages/runtime/src/store-validation.ts`,
used by both adapters so semantics cannot drift):

- **Publish** (fresh creations; same-version republish remains
  collision/idempotent-checked first): `canonicalManifest` must equal
  `canonicalJson(manifest)`; `manifest.graph` must be the canonical semantic
  form; `graphVersion`, `capabilitySetVersion`, `activationVersion` are
  recomputed with the kernel's canonical identity functions
  (`computeGraphVersion`, `computeCapabilitySetVersion`,
  `computeActivationVersion` — now exported from `@vict/kernel`) and must
  match exactly (`VICT_STORE_ACTIVATION_MISMATCH`). This catches the
  hand-off's decisive case: valid-looking top-level identifiers over altered
  binding or graph content.
- **Selection**: the activation must belong to the selected graph
  (`VICT_STORE_ACTIVATION_MISMATCH`).
- **createRun**: the run's graph/graphVersion/capabilitySetVersion/
  activationVersion must describe exactly the referenced published
  activation (foreign keys alone cannot prove coherence).
- **Event append**: every event must carry its stored run's `runId`,
  `graphId`, `graphVersion`, `capabilitySetVersion`, `activationVersion`.
- **Reads** recompute identities from persisted canonical content and reject
  corrupt rows (`VICT_STORE_INVALID_RECORD`) instead of silently normalizing.
- All failures leave no partial mutation (asserted per case).

Shared conformance coverage: canonical-content mismatch (two variants,
including a different manifest's canonical string), content/identity
recompute mismatch (forged graph capability; forged binding revision — both
with self-consistent canonical strings), selection belongs-to-graph, run
identity mismatch (graphId / graphVersion / capabilitySetVersion
individually), event-vs-run identity mismatch (all four fields
individually) — each with rollback/no-partial-state assertions.

Consequence for fixtures: hand-made identities no longer pass; the
conformance, corruption, and transaction fixtures now build GENUINE
activations through the kernel identity functions, and corruption is
injected directly at the database level.

### 1.4 Gating — in-memory `publishAndSelect` not transactionally atomic

**Root cause.** The in-memory adapter published first and selected second; a
failed selection (e.g. stale `expectedSelectionRevision`) left the new
activation published. The SQLite variant performed the compound operation in
one transaction but IGNORED `expectedSelectionRevision` entirely — a stale
writer could win.

**Correction.** Both adapters now: (a) check same-version collision,
content-identity (fresh creations), belongs-to-graph, and the selection
revision guard against the PRE-call state; (b) only then apply publish +
select — in one synchronous section in memory, in one transaction in
SQLite. A failed selection leaves catalog and selection exactly as before,
including when the activation was never published before
(`VICT_STORE_SELECTION_CONFLICT`; idempotency and collision semantics
preserved).

Shared conformance coverage: "publishAndSelect failure leaves catalog and
selection untouched" (previously-absent activation + stale revision →
rejection, catalog still empty, no selection) and "publishAndSelect honors
the selection revision guard" (stale 0 rejected with state unchanged;
current guard succeeds; equivalent republish stays idempotent).

### 1.5 Persisted-value serialization was not honest within its domain

**Root cause.** The serializer documentation claimed unsupported JSON values
were rejected, but `undefined` passed validation and was silently dropped by
canonicalization (or nulled in arrays); `Map`/`Set`/class instances
collapsed to `{}` or their enumerable fields. Unsafe for full-retention
output and identity material.

**Correction.** One explicit persisted-value domain, enforced identically by
both adapters (`packages/runtime/src/serialization.ts`):

- accepted: JSON primitives, finite numbers, arrays, plain string-keyed
  objects (including null-prototype), `null`, and `Date` as the single
  documented extension (ISO-8601 UTC);
- rejected everywhere: `undefined` (top level, in objects, in arrays),
  `NaN`/`±Infinity`, functions, symbols, bigints, cyclic values, `Map`,
  `Set`, class instances, invalid Dates;
- nothing caller-supplied is ever silently dropped, replaced, or collapsed;
- both adapters behave equivalently: the in-memory adapter now validates AND
  canonicalizes stored `output`/`outputSummary`/`error` exactly as SQLite
  persists and reads them back (`canonicalPersistedValue`), so read-back
  shapes match across adapters;
- the contract issue mapper omits absent optional fields
  (`expected`, `safeMessage`) instead of carrying explicit `undefined`;
- failures are structured `VICT_STORE_INVALID_COMMAND` errors with
  no partial mutation (rollback asserted).

Coverage: nine focused serializer tests
(`packages/runtime/test/serialization.test.ts`) plus the shared store-level
full-retention test "strict persisted-value domain: full-retention output
cannot be silently altered" (Map output, `{x: undefined}`, `[undefined]`,
`Set`, `Symbol` rejected with the run untouched; a plain in-domain output —
including a `Date` — round-trips canonically) against both adapters.

### 1.6 Cross-platform packed-consumer verification

**Root cause.** `npm pack packages/contracts` passes a slash-containing
argument that is not recognized as a local path reference on POSIX; npm
interprets it as GitHub shorthand (`github.com/packages/contracts`).

**Correction.** Each package is passed to `npm pack` as an ABSOLUTE path
resolved from the repository root (`resolve(repoRoot, 'packages', name)`),
which npm always treats as a local directory — independent of the caller's
working directory, path separators, or platform. The temp-directory cleanup
now retries (Windows file locks) and never fails an otherwise green
verification. Packed tarball install paths were already absolute. The
consumer check passes end-to-end (see §3); only Windows was available to
run it on (stated limitation, not a cross-platform claim).

### 1.7 Documentation and report accuracy

- Delivery-status vocabulary normalized: previous decorated values
  (`In Progress (Stage 2 implementation pending audit)`) replaced with the
  exact reference vocabulary value `In Progress` throughout
  docs/VICT-SYSTEM-REFERENCE.md; the corrective report is listed in §23.4.
- docs/architecture/STAGE-02-STORES.md: the "committed before each
  invocation" claim corrected and the enforced write-ahead rule documented,
  plus the extended conformance evidence.
- Code-level documentation corrected in place (durable-run.ts, runtime.ts,
  execute.ts) to describe enforced, not aspirational, ordering.
- The historical Stage 02 report is preserved (relocated by the repository
  owner to docs/report/); its misleading §"run/event transaction model"
  claim ("`node.started` … committed before the capability is invoked") and
  its "forced interruption" evidence framing are hereby CORRECTED by this
  section: before this pass the durable write was enqueued but not awaited,
  so invocation could precede commit; gate-based and kernel-level tests now
  prove the causal ordering the prose always claimed.
- No unresolved placeholders are used in this report.
- Status vocabulary: this report claims implementation, never "Verified".

---

## 2. Files changed (correction commit a1ccea1)

| Area | Files |
|---|---|
| Kernel | `packages/kernel/src/types.ts` (InvocationBoundary, beforeInvoke port), `src/execute.ts` (boundary await), `src/index.ts` (export computeCapabilitySetVersion/computeActivationVersion/CapabilityBindingFingerprint), `test/execute.test.ts` (3 guard tests) |
| Contracts | `packages/contracts/src/issue-mapping.ts` (omit absent optional issue fields) |
| Runtime | `src/boundary-conformance.ts` (new), `src/store-validation.ts` (new), `src/serialization.ts` (strict domain + canonicalPersistedValue), `src/durable-run.ts` (awaitDurableBoundary + docs), `src/runtime.ts` (guard wiring), `src/in-memory-stores.ts` (actual-next-seq, identity validation, atomic publishAndSelect, canonicalized persisted values), `src/store-conformance.ts` (9 new shared cases, genuine-identity fixtures), `src/testing.ts` (export boundary suite), `src/index.ts` (exports), `test/store-conformance.test.ts` (suite drivers), `test/serialization.test.ts` (new) |
| store-sqlite | `src/adapter.ts` (actual-next-seq + gap detection in-transaction, dense initial batches, identity validation on publish/select/publishAndSelect/createRun/event-append, read-time identity recompute, upfront enum validation), `test/corruption.test.ts` + `test/transaction.test.ts` (genuine-identity fixtures), `test/restart.test.ts` (ordering documentation) |
| Scripts | `scripts/isolated-consumer-check.mjs` (absolute pack paths, resilient cleanup) |
| Docs | `docs/VICT-SYSTEM-REFERENCE.md` (status vocabulary normalization, §23.4), `docs/architecture/STAGE-02-STORES.md` (write-ahead rule, conformance evidence) |

---

## 3. Verification evidence

Environment: Windows 11 Pro, win32-x64, Node v22.13.1, npm 10.9.2,
node:sqlite (SQLite 3.47.2), database mode: file-backed WAL with
`synchronous=FULL` (plus labeled in-memory rows in the benchmark).
Every command exited 0.

| Command | Result |
|---|---|
| `npm ci` | PASS (clean install from committed lockfile, 0 vulnerabilities) |
| `npm run format:check` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS (strict, monorepo) |
| `npm run build` | PASS (all five packages; declarations exercised by verify:consumer with `skipLibCheck: false`) |
| `npm run test:unit` | PASS — 21 files, **217 tests** |
| `npm run test:integration` | PASS — 1 file, **4 tests** |
| `npm test` | PASS — 22 files, **221 tests** (177 before this pass; 44 added) |
| `npm run verify:consumer` | PASS — 5 packed tarballs; neutral consumer (no Zod) strict type-check (`skipLibCheck: false`), SQLite publish/activate/run/close, then a fresh process restores the exact activation and reads run + events back; Zod consumer exercises the frozen adapter subpath; no Zod references in base declarations |
| `npm run verify:stage2` | PASS (unit + integration + packed SQLite consumer) |
| `npm run example` | PASS — ARA proof offline: 4 nodes, 3 edges, **13 events**, ordered trace intact |
| `npm run bench` | PASS — labeled envelopes: in-memory 0.227 ms/run median (n=5000); SQLite file WAL `synchronous=FULL` 18.2 ms/run median (n=500, one fsync per durable transaction); SQLite `:memory:` 2.14 ms/run median (n=2000, labeled, not comparable to file mode) |

Focused adversarial runs (names and results verified in verbose output):

- Durable boundary suite — 6 tests × [in-memory] and [sqlite]: all PASS.
- `expectedNextEventSeq must equal the actual stored next sequence` × 2, and
  `createRun accepts only a dense initial batch beginning at zero` × 2: PASS.
- `publish rejects canonical content that is not the manifest's canonical
  form` × 2, `publish rejects identities that do not recompute from content`
  × 2, `selection requires the activation to belong to the graph` × 2,
  `createRun requires a coherent published activation identity` × 2,
  `appended events must carry the stored run's identity` × 2,
  `publishAndSelect failure leaves catalog and selection untouched` × 2,
  `publishAndSelect honors the selection revision guard` × 2,
  `strict persisted-value domain: full-retention output cannot be silently
  altered` × 2: PASS.
- `packages/runtime/test/serialization.test.ts`: 9/9 PASS.
- Kernel `beforeInvoke` tests: 3/3 PASS.
- Real subprocess suites (restart, interruption, mismatch, canary): PASS
  within the 27-test store-sqlite suite.

---

## 4. What was tested vs. what was inferred

**Tested on Windows 11 (win32-x64), Node v22.13.1:** every command and test
listed above, including real subprocess hard-kill/restart scenarios and
packed-tarball consumer verification.

**Inferred (not executed here):** POSIX/Linux behavior. The GitHub-shorthand
pack failure is documented as observed on Linux by the reviewer; the fix
(absolute paths) removes the ambiguity by construction and is covered by
deterministic path handling, but the consumer check was NOT re-executed on
Linux in this pass. No claim of cross-platform verification is made.

---

## 5. Known limitations / residual notes

- Single-OS verification (Windows); POSIX execution of the consumer check
  remains for the independent audit's environment.
- The gate-based boundary suite covers the sequential execution path of the
  tracker; recovery (`recoverInterruptedRuns`) is exercised separately
  (shared suite + real subprocess tests), not through injected write gates.
- `output: undefined` at the transition port means "no output" (the record
  field is optional); the strict domain rejects `undefined` only where it
  would be silently altered (inside objects/arrays or as a bare value of a
  required field). This distinction is documented and tested.
- Identity recompute on read adds a SHA-256 pass per activation read
  (negligible at local scale; restore benchmarks remain sub-millisecond).

---

## 6. Gate checklist

1. Capability invocation causally blocked until durable intent commits — **met** (§1.1).
2. Store failure before invocation proves zero invocation count — **met** (§1.1 tests 4–5).
3. Both adapters reject event gaps based on actual stored history — **met** (§1.2).
4. Activation, selection, run, and event identities cross-validated — **met** (§1.3).
5. `publishAndSelect` shares atomic failure semantics across adapters — **met** (§1.4).
6. Persisted values cannot be silently changed by serialization — **met** (§1.5).
7. Isolated packed consumer passes with unambiguous local package paths — **met** (§1.6, Windows).
8. All required verification commands pass — **met** (§3).
9. Correction report contains evidence and no unsupported claims — **this document**.
10. Implementation committed and pushed without force — **met** (`a1ccea1` + this report's commit, fast-forward push).

---

*Prepared by the corrective implementation agent. Per GOV-004 and TEST-005,
only an independent audit can change Stage 2 delivery status to Verified.*