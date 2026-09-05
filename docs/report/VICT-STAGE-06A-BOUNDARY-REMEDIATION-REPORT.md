# VICT Stage 06A Boundary Remediation Report

## Outcome

**STAGE 06A BOUNDARY REMEDIATION COMPLETE — READY FOR FRESH INDEPENDENT
AUDIT.** An independent review reproduced defects in the corrective-
finalization implementation at `53c3eb7acdf0dfff573673a4fafadf4122f7977f`.
Every reproduced defect was root-caused, corrected at its boundary, and
covered by permanent public-boundary regressions. Each substantive defect
has a negative control that FAILS at the reviewed SHA (defect reproduced)
and PASSES after correction. All verification-ladder commands pass. Stage
06A remains **implemented and awaiting its fresh independent audit** —
nothing in this increment is marked Verified; **Stage 06B and Stage 07 have
not begun**.

## Starting, implementation, and documentation SHAs

| | SHA |
| --- | --- |
| Reviewed starting SHA (verified in ancestry of `origin/main`; `origin/main` had NOT advanced — no intervening owner work) | `53c3eb7acdf0dfff573673a4fafadf4122f7977f` |
| Implementation SHA | the `fix(stage-06a)` series committed on top of the starting SHA (see the commit list at the end of this report) |
| Documentation SHA | the `docs(stage-06a): record boundary remediation` commit |
| Final remote SHA | pushed to `origin/main` via normal fast-forward; ancestry re-checked immediately before push |

Historical reports and audits are preserved byte-for-byte; no force-push, no
history rewrite, no unrelated files staged.

## Environment matrix (honest)

| Environment | Availability | Evidence |
| --- | --- | --- |
| Windows 11, win32-x64, Node v22.13.1, npm 10.9.2 (supported baseline) | Available — ALL ladder commands executed | full ladder below |
| Linux, Node v24.19.0, npm 11.9.0 (reviewer's environment) | NOT available: WSL is installed but "WSL1 is not supported with your current machine configuration" and no distribution is installed; no Linux host | **The Linux/Node 24 rerun remains for the independent auditor. No cross-platform verification is claimed.** The corrected code contains no platform-specific behavior that differs from the Windows evidence except where explicitly covered by per-platform tests (POSIX symlink tests run only on POSIX; Windows junction tests run only on Windows), exactly as the reviewer expects them to. |

Negative-control worktree and fresh-clone work used isolated `npm ci`
installs. No `node_modules` was shared between checkouts by junction or any
other means.

## Findings, root causes, corrections, and regression evidence

### Finding 1 — Deletion receipts not enforced at the store boundaries

**Reproduction.** Both public store APIs accepted: record `pending` with
zero receipts → advance to `application-domain-deleted` → advance to
`completed` → read back `completed` with zero receipts. The transition
helper checked state ORDERING only; receipts were never consulted.

**Root cause.** `assertDeletionStateTransition` (shared by the in-memory
and SQLite stores) enforced forward-only, stepwise transitions but nothing
tied state entry to the durable receipts; each store's
`updateDeletionIntentState` called it directly.

**Correction.**
- New shared helper `assertDeletionStateTransitionWithReceipts`: entering
  `application-domain-deleted` REQUIRES the durable `application-domain`
  receipt; entering `completed` REQUIRES BOTH durable receipts; skips,
  regressions, and same-state idempotency unchanged.
- In-memory store: check-and-update is one synchronous critical section.
- SQLite store: the receipts are read and the transition validated INSIDE
  the same transaction that performs the update (atomic; no interleaving
  write possible), and invariant rejections surface as the same stable,
  non-echoing `VICT_AGENT_DELETION_RECEIPT_REQUIRED` message as the
  in-memory store (adapter parity). Cross-store atomicity is NOT claimed —
  each adapter proves the atomicity of its own store only.
- Crash-recovery paths preserved: receipts still exist before the state
  advance in every coordinator path, so recovery re-advances legally.

**Negative control (reviewed SHA).** Bypass probe: `pending →
application-domain-deleted → completed` with zero receipts — accepted on
BOTH stores (state reached `completed`, receipts `[]`); after close/reopen
still accepted. **Reproduced.**

**After correction.** Shared conformance suite
(`packages/runtime/test/agent-governance-receipts.test.ts`) runs the SAME
probes against BOTH adapters: bypass rejected at the FIRST transition, state
unchanged (`pending`, receipts `[]`), still rejected and unchanged after
SQLite close/reopen; valid receipt-backed completion succeeds and is
idempotent; crash recovery (`recoverPending`) completes exactly the missing
steps and re-executes nothing. Permanent.

### Finding 2 — Deletion fencing optional in supported composition

**Reproduction.** Constructing the agent and the deletion port with
accepted public defaults (no `threadCoordinator`) and racing a barrier-held
in-flight turn against governed deletion: the deletion completed while the
turn was in flight; after release, the turn completed and persisted two
messages AFTER the completed deletion.

**Root cause.** `threadCoordinator` was OPTIONAL on both
`MastraProductAgentConfig` and `MastraMemoryLifecycleOptions`; when absent,
the deletion port silently skipped fencing and the turn never held its
thread.

**Correction.**
- The coordinator is REQUIRED on both sides. Construction without it throws
  `VictMastraCompositionError` (`VICT_MASTRA_UNFENCED_COMPOSITION`) BEFORE
  any factory call, store interaction, or execution — an unfenced
  configuration can no longer be silently accepted.
- New supported-composition helper `createGovernedMemoryDeletionPort`
  creates the coordinator and the deletion port together; the SAME instance
  is handed to `MastraProductAgent.create`, so the supported composition
  shares turn/deletion coordination automatically.
- Coordination remains keyed by the correct actor/thread identity
  (`vict-conv-<conversationId>` thread, `vict-actor-<actorId>` resource).
- Turn completion now depends on ACTUAL persistence acknowledgement: the
  turn baselines the durable message count at start and its completion
  barrier waits until at least one NEW message beyond that baseline is
  durably present — never an arbitrary delay, never the presence of any
  historical message. If durability cannot be proven (bounded barrier), the
  turn FAILS with `VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED` instead of
  emitting misleading success milestones.
- Post-deletion behavior is explicit and enforced: deleted threads refuse
  new turns in the fencing process (`VICT_AGENT_THREAD_FENCED`); the new
  one-shot `fenceCompletedDeletions({coordinator, governance})` re-fences
  every completed deletion intent after reopen/recovery, so deleted
  conversations stay deleted (conversation recreation is intentionally NOT
  supported in a process that has performed its recovery; it is only
  possible in a fresh process that has NOT yet recovered, which is exactly
  what the recovery step closes).
- Forward-only deletion reconciliation preserved; no scheduler; no Stage
  06B transport work.

**Negative control (reviewed SHA).** Two probes: (a) adapter creation
without a coordinator — accepted, factory invoked; (b) deletion port
without a coordinator — accepted. **Reproduced.** (The data-level
consequence — message recreation after completed deletion — was the
reviewer's own reproduction and is now covered permanently by the
barrier-controlled tests below.)

**After correction.** `packages/mastra/test/adapter.boundary.test.ts`
(barrier-controlled, promise gates, no causality-by-sleep): unfenced
adapter and deletion port rejected with no factory call; deletion during an
in-flight turn waits for the turn to fully settle then completes with zero
residual messages and post-deletion turns refused; delayed-persistence turn
completes only after new durable content lands (milestone ordering proven);
historical messages plus a new pending turn — completion requires the NEW
message beyond the historical baseline and the deletion removes everything
without resurrection; deletion failure propagates truthfully, retry
completes the missing step only (no step re-executed); reopen/recovery
after partial deletion completes the intent and the recovered conversation
refuses recreation; actor isolation holds through the supported
composition. Permanent.

### Finding 3 — Storage containment checked only AFTER creation

**Reproduction.** A symlink redirecting `dataDir/mastra` to an outside
directory: `createDedicatedMastraStore` created the OUTSIDE database,
initialized it (44 Mastra tables), and only then threw
`VICT_MASTRA_STORAGE_PATH_ESCAPE`. The existing POSIX file-symlink test
also reached the symlink target (sentinel text) and failed with
`SQLITE_NOTADB` before any containment check.

**Root cause.** `assertDatabaseContained` ran after `store.init()`;
nothing validated containment before the database file was opened.

**Correction.** Containment is now proven BEFORE any mutation:
1. file name and retention bounds are validated before ANY filesystem
   change (invalid compositions create nothing);
2. after `mkdir`, the dedicated store directory's REAL path is proven
   inside the composition data dir (rejects a directory symlink/junction
   planted at `<dataDir>/mastra` before the database exists);
3. an EXISTING database target is rejected if it is a symlink/junction
   (file redirection) or a non-file, and an existing regular file must
   real-path inside the store directory — all BEFORE the database is
   opened;
4. the post-open real-path proof remains as defense in depth.
Documented trust boundary: this protects against redirection planted
before composition, within the declared local single-process envelope; a
concurrent local process racing the composition is outside the envelope
and no protection is claimed against it.

**Negative control (reviewed SHA).** Two probes: (a) junction-planted store
dir — the OUTSIDE database file existed after the rejected composition
(`existsSync` true); (b) symlink planted at the database path over an
existing external SQLite database — the old tree attempted to open the
redirected target and surfaced a raw `ConnectionFailed(...: 14)` instead of
a stable containment rejection. **Reproduced.**

**After correction.** `packages/mastra/test/storage.path.test.ts` proves:
an absent external target remains absent; an existing external sentinel
file remains byte-identical; an existing external SQLite database gains NO
schema or data changes (byte-comparison plus `sqlite_master` and sentinel
row checks); directory redirection and file redirection are both rejected
(POSIX symlinks and Windows junctions, each platform proving its own case);
valid contained paths still create, REOPEN, and persist correctly; errors
are stable, carry the `VICT_MASTRA_STORAGE_PATH_ESCAPE` code, and never
echo target paths or payload text. `SQLITE_NOTADB` is not accepted as a
containment result anywhere. Permanent.

### Finding 4 — Activation manifest content not validated before persistence

**Reproduction.** Both stores accepted a record with fabricated
`v1_<64-hex>` hashes, an arbitrary `canonicalManifest` string, and
contradictory activation content; only non-empty-string was checked.

**Root cause.** `validateAgentActivationRecord` was structural only; the
manifest bytes, schema, and identity relationship were never validated at
the persistence boundary.

**Correction.** The shared gate (used by BOTH store adapters before
persistence AND by restoration) now performs content validation:
- the canonical manifest is PARSED and validated against its closed schema
  (`schema`, `agentProfileVersion`, `adapter`, `artifacts`, `subagents`);
  unknown manifest fields rejected;
- the manifest is recomputed into canonical form and compared
  BYTE-FOR-BYTE with the stored text (canonical input domain enforced);
- the activation identity is RECOMPUTED (`v1_` + SHA-256 of the manifest
  bytes) and cross-checked against the record's `activationVersion`;
- the manifest's profile version and artifact list are cross-checked
  against the record's own fields (exact correspondence, canonical order);
- hostile getters/proxies and unknown field names are handled without raw
  exceptions and without echoing payload-derived text (stable reasons
  only);
- the distinction between structural/hash validation (persistence) and
  executable artifact resolution (restoration only) is preserved and
  documented; function bodies are never hashed.

**Negative control (reviewed SHA).** Fabricated record accepted and
persisted by BOTH stores (readable back under the fabricated version).
**Reproduced.**

**After correction.** `agent-governance.test.ts` /
`agent-governance-adapter.test.ts` /
`agent-governance-corrective.test.ts` prove on BOTH stores that fabricated
records are rejected before storage (nothing readable under the fabricated
version) while real records round-trip; the SQLite conformance proves the
rejection survives reopen, and the fresh-process worker test writes/reads a
REAL registry-produced record across process boundaries. Permanent.

### Finding 5 — Resolved subagent identity absent from the activation binding; createdAt not preserved

**Reproduction.** Activate a parent referencing a child profile; persist
the parent activation; in a fresh registry register the same child
id/revision with changed temperature (the child's computed
`agentProfileVersion` changes); restoring the parent ACCEPTED the changed
child while retaining the original parent `activationVersion`. Separately,
a stored `createdAt=100` returned as `999` after restoration through a
changed clock.

**Root cause.** The snapshot recorded each child's resolved profile hash,
but the authoritative activation manifest recorded only the child's
id/revision — the resolved identity was not part of the binding. And
`restoreActivation` returned the re-activated snapshot with the CURRENT
clock's `createdAt`.

**Correction.**
- The canonical activation manifest moves normatively to
  `vict.agent-activation@3`: it now carries `subagents:
  [{id, revision, agentProfileVersion}]` (canonically sorted). This is
  already-computed DECLARATIVE identity — executable bodies are never
  hashed. Restoration recomputes the manifest (including resolved child
  identities) and compares bytes and versions, so a different resolved
  child identity is REJECTED. `@2` records cannot be accepted under `@3`
  and fail closed deterministically. Profile identity vectors
  (`agentProfileVersion`) and all Stage 01–05 identity vectors are
  byte-for-byte unchanged; set-order determinism preserved.
- `restoreActivation` preserves the stored `createdAt`: the restored
  snapshot carries the PERSISTED creation time, never the restoring
  process's clock. Historical identity is never reconstructed from the
  current registry and presented as exact restoration — a mismatch fails
  closed instead.

**Negative control (reviewed SHA).** Two probes: (a) changed resolved child
identity — restoration returned `ok: true` under the original parent
activationVersion; (b) createdAt — restoration returned `999` (the fresh
clock) instead of the stored `100`. **Reproduced.**

**After correction.**
`packages/runtime/test/agent-subagent-identity.test.ts`: manifest carries
the resolved child identity; exact restoration across registries and
persisted reopen succeeds and preserves `createdAt`; changed resolved child
identity rejected (`AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH`); parent
activation identity proven SENSITIVE to the resolved child identity while
parent profile identity vectors stay equal. Permanent.

### Finding 6 — Tool-budget failure depended on the tool output contract

**Reproduction.** Profile with `maxToolCalls: 0` and fail-closed policy; a
helper with a legitimate strict output contract requiring exactly
`{ok: true}`; the helper ran zero times, but the budget-denial envelope
(`{victHelperFailure: ...}`) failed that output contract, Mastra emitted
`tool-error` (not the marker-bearing `tool-result`), the adapter's marker
flag never fired, and VICT returned `completed` with no error code.

**Root cause.** The denial was only ever expressed through the envelope
returned to Mastra; the authoritative per-turn state never recorded the
denial.

**Correction.** The budget gate records every denial in the AUTHORITATIVE
per-turn scope (`budgetDenied`) at the gate itself, and the turn evaluates
that flag after the stream: a denied turn fails with the stable
`VICT_AGENT_TOOL_LIMIT_EXCEEDED` code regardless of whether the envelope
survives the helper's application output contract. Zero execution after
denial, exact accounting (allowed calls consume; denials do not), and
per-turn scoping under concurrency are preserved. Legitimate helper
contracts were not weakened.

**Negative control (reviewed SHA).** The probe turn returned
`completed` with no error code (envelope lost to the output contract).
**Reproduced.**

**After correction.** `adapter.boundary.test.ts`: zero budget + strict
output contract → failed with the limit code, zero executions, correct
terminal events (`response.failed` carrying the code; no completion
milestones); budget exhausted after permitted calls (exact accounting);
denial before subsequent model text (text cannot rescue the turn);
concurrent turns isolated. Input/output contract rejection behavior
remains covered by the existing corrective suite. Permanent.

### Finding 7 — Sanitization gaps at untrusted result boundaries

**Reproductions (four probes).**
- A. A throwing getter in the tracing configuration escaped `create()` as a
  raw Error.
- B. A guardrail callback returned a verdict object whose `ok` getter
  threw; `runTurn` REJECTED with the raw canary.
- C. A model-supplied unknown tool name containing a canary appeared
  verbatim in normalized tool events.
- D. `protectCredentialPort` accepted a value-like name
  (`PROVIDER_KEY=CANARY-CREDENTIAL-VALUE`) and echoed it in its error when
  the provider failed.

**Root cause.** Configuration and callback RESULTS were treated as trusted
data: property access happened outside the protected boundary; model-
supplied stream metadata was stringified into events without validation;
the credential-name policy accepted any printable ASCII (including `=`)
and the name was echoed.

**Correction.**
- Tracing-policy validation is fully contained: any throw (hostile
  getters/proxies) collapses to the stable, non-echoing
  `VICT_AGENT_TRACE_POLICY_UNSAFE` — no factory call occurs.
- Guardrail and structured-output verdict objects are read INSIDE the
  protected boundary: a throwing property access resolves to the stable
  sanitized failure codes (`VICT_GUARDRAIL_REJECTED` /
  `VICT_AGENT_STRUCTURED_OUTPUT_FAILED`); processor results must be
  strings. `runTurn` never rejects with raw author errors.
- Declared trust policy for model-supplied metadata: a tool NAME is trusted
  only when it matches a PINNED helper tool of the activation; a tool-call
  ID must be a bounded safe identifier (`^[A-Za-z0-9._:-]{1,128}$`);
  anything else is normalized to the stable placeholder `unknown` before it
  can appear in normalized events. Neither is ever used for authority
  decisions.
- `assertCredentialName` now enforces the SAME accepted credential-
  reference policy as the profile compiler
  (`^[A-Za-z_][A-Za-z0-9_]*$`, ≤128); value-like inputs are rejected
  BEFORE the provider is reached and are never echoed;
  `requireCredential` validates the name as well. Legitimate assistant
  text and intentionally retained conversation content keep their
  documented policy — no indiscriminate redaction.

**Negative controls (reviewed SHA).** (A) raw `Error` escaped `create()`
(not `VictMastraAdapterError`); (B) `runTurn` rejected with the raw canary;
(C) the canary tool name appeared verbatim in events; (D) the value-like
name was accepted and echoed. **All reproduced.**

**After correction.** `adapter.boundary.test.ts` canary-proves each:
hostile tracing config → structured code, no canary, zero factory calls;
hostile guardrail verdict → resolved sanitized failure, canary absent from
the entire serialized outcome; fabricated tool name/ hostile call id →
normalized to `unknown` in every event, canaries absent; value-like
credential name → rejected before the provider with no echo, while valid
names still resolve. Existing permanent canary-leakage suite
(`adapter.security.test.ts`) remains green. Permanent.

### Finding 8 — POSIX permissions and retention arithmetic

**Observed.** Created database mode `0644`; dedicated directory `0755`;
`restrictPermissions` was manual; the helper applied `0600` to BOTH files
and directories (making the directory non-traversable on POSIX);
`MAX_RETENTION_AGE_MS` was `3_153_600_000_000` — 100 years despite
ten-year documentation.

**Correction.**
- The documented protected-store permission policy is applied AUTOMATICALLY
  during supported composition: dedicated directory `0o700` (owner-only,
  traversal preserved), database file `0o600`, and any ALREADY-EXISTING
  SQLite sidecars (`-wal`, `-shm`, `-journal`) `0o600`;
  `restrictPermissions()` re-applies the same policy idempotently after
  write bursts (later-created sidecars sit inside the `0o700` directory).
- Permission failures surface per the declared platform guarantees: on
  POSIX a failed chmod throws the structured
  `VICT_MASTRA_STORAGE_PERMISSION` error (fail closed, store closed first);
  on Windows the attempt is documented best-effort (ACL limitation,
  honestly stated, never claimed).
- `MAX_RETENTION_AGE_MS` is now `315_360_000_000` (10 × 365 days); the
  boundary value is accepted and just-over is rejected for retention AND
  prune inputs (which share the same validated policy). No different
  retention policy was introduced; unbounded persistence remains
  forbidden.

**Negative controls (reviewed SHA).** The retention-constant probe FAILED
at the reviewed SHA (100-year value). The POSIX permission-mode probe can
only execute on POSIX (this host is Windows) — the reviewed environment's
observation (0644/0755, manual restriction, non-traversable directory
mode) IS the negative-control evidence for the permission half; the
corrected behavior is proven by the POSIX-gated permanent test on POSIX
environments and documented here as platform-gated. **Retention
reproduced; permissions reproduced by the reviewer on Linux and corrected
permanently.**

**After correction.** `storage.path.test.ts`: constant equals ten years
exactly (both arithmetic forms); exact ten-year boundary accepted;
`+1` rejected (retention and prune inputs); automatic permission
application proven with exact modes (POSIX-gated); idempotent re-application
proven. Permanent.

### Finding 9 — Formatting failure

`packages/mastra/test/storage.path.test.ts` failed `format:check` at the
reviewed SHA. The file (and every file touched by this remediation) is now
Prettier-clean; `npm run format:check` passes in a clean clone (the only
remaining reports in THIS owner checkout are the owner's untracked `.pi/`
files, per the documented policy that the clean clone is the authoritative
lint/format environment).

## Deletion and persistence ordering (normative behavior after this remediation)

1. Governed deletion records the durable intent BEFORE any store is touched.
2. The turn HOLDS its thread from start until its completion barrier.
3. Deletion FENCES the thread (refuses new turns) and WAITS until no
   in-flight turn holds it.
4. The turn's completion barrier requires THIS turn's NEW content to be
   durably present (beyond the turn's baseline; not queue-idle, not
   historical presence, not a delay). Unproven durability fails the turn
   (`VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED`) — success milestones are
   never emitted on unproven persistence.
5. The fence is released only after the barrier; the deletion then executes
   its idempotent verify-and-reconcile rounds and records durable receipts.
6. State advances are receipt-enforced and atomic within each store;
   completion requires both receipts; `recoverPending()` resumes exactly
   the missing steps; `fenceCompletedDeletions` re-fences recovered
   completed intents after reopen.

## Activation identity and compatibility decision

- Profile identity (`vict.agent-profile-identity@1`,
  `agentProfileVersion`) is UNCHANGED for valid inputs; Stage 01–05
  identity vectors are unchanged.
- The canonical activation manifest moves normatively from
  `vict.agent-activation@2` to `vict.agent-activation@3`: the manifest now
  binds the RESOLVED identity of every referenced sub-agent profile. This
  is a genuine, documented model correction (the activation must pin what
  its referenced sub-agents resolved to), not a validation dodge. `@1` and
  `@2` records fail closed under `@3`; activationVersion values change
  accordingly; no production data exists (Stage 06A product scope). Both
  store adapters enforce full manifest content validation at the
  persistence boundary through the shared gate.

## Tool-budget and sanitization behavior (normative after this remediation)

- Budget denials are authoritative per-turn state recorded at the gate;
  the documented failed outcome and stable `VICT_AGENT_TOOL_LIMIT_EXCEEDED`
  code do not depend on the denial envelope surviving any application
  output contract.
- Tracing configuration, guardrail verdicts, structured-output verdicts,
  and processor results are untrusted inside the protected boundary;
  hostile getters/proxies collapse to stable non-echoing codes.
- Tool names are trusted metadata only when pinned; tool-call IDs must
  match the declared safe-identifier policy; anything else normalizes to
  `unknown` in normalized events.
- Credential names follow the accepted credential-reference policy
  (`^[A-Za-z_][A-Za-z0-9_]*$`, ≤128); value-like names are rejected before
  the provider and never echoed; raw provider errors never surface.

## Verification ladder (Windows 11, win32-x64, Node v22.13.1, npm 10.9.2)

Run sequentially in the remediated checkout after a clean `npm ci`:

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | clean lockfile install |
| `npm run typecheck` | 0 | strict; run BEFORE build |
| `npm run format:check` | 0 on tracked files | only the owner's untracked `.pi/` file reports in this checkout; clean-clone run below is fully clean |
| `npm run lint` | 0 on tracked files | same `.pi/` note only |
| `npm run build` | 0 | all ten packages build |
| `npm run test:unit` | 0 | 67 files / **1,594 tests** |
| `npm run test:integration` | 0 | 1 file / 4 tests |
| `npm test` | 0 | 79 files / **1,761 tests** |
| `npm run verify:consumer` | 0 | packed neutral consumer |
| `npm run verify:stage2` | 0 | durable stores + packed SQLite consumer |
| `npm run verify:stage3` | 0 | durable orchestration + packed consumer |
| `npm run verify:stage4` | 0 | capability/application gates |
| `npm run verify:stage5` | 0 | reference application + packed scaffolder |
| `npm run verify:stage6a` | 0 | package inspection, packed neutral + adapter consumers (plain Node), fresh-process proofs |
| `npm run example` | 0 | ARA proof, 13 ordered events |
| `npm run bench` | 0 | benchmark |
| `npm run example:application` | 0 | Stage 04 application proof |
| `git diff --check` | 0 | clean |

Test-count delta versus the reviewed SHA: 1,724 → 1,761 passing (+37: the
new permanent boundary regressions), 0 failing. No check was disabled, no
broad ignore added, no contract or test weakened; the tests that changed
(fabricated-record fixtures) had asserted the DEFECTIVE acceptance and now
assert rejection — corrections, not weakening.

## Negative-control evidence (summary)

Method: detached worktree at `53c3eb7acdf0dfff573673a4fafadf4122f7977f`
with its OWN `npm ci` (isolated install; nothing shared), the boundary
probes copied in, `vitest` per project, worktree removed afterwards;
nothing was committed in the worktree. Probes assert the CORRECTED
behavior, so a defect reproduction shows up as a probe FAILURE.

| Probe | Reviewed SHA result | Remediated tree |
| --- | --- | --- |
| Receipt-free two-step bypass (in-memory) | FAIL — bypass accepted, state `completed`, zero receipts | PASS |
| Receipt-free two-step bypass (SQLite) | FAIL — accepted | PASS |
| Bypass rejected after SQLite close/reopen | FAIL — accepted | PASS |
| Valid receipt-backed completion + recovery (control) | PASS (valid behavior) | PASS |
| Fabricated activation record rejected before persistence (both stores) | FAIL — accepted and persisted | PASS |
| Changed resolved subagent identity rejected at restoration | FAIL — accepted under original parent version | PASS |
| createdAt preservation (100 stays 100 through a 999 clock) | FAIL — returned 999 | PASS |
| Unfenced adapter composition rejected before execution | FAIL — accepted, factory invoked | PASS |
| Unfenced deletion port rejected at construction | FAIL — accepted | PASS |
| Junction/symlink store-dir escape creates nothing outside | FAIL — outside database file created | PASS |
| External SQLite database gains no changes (file redirection) | FAIL — open attempted on redirected target; raw `ConnectionFailed(...: 14)` instead of stable rejection | PASS |
| Retention constant is ten years | FAIL — 100-year value | PASS |
| Zero budget + strict output contract → limit-code failure | FAIL — `completed`, no error code | PASS |
| Throwing tracing-config getter contained | FAIL — raw Error escaped `create()` | PASS |
| Guardrail verdict `ok`-getter throw contained | FAIL — `runTurn` rejected with raw canary | PASS |
| Fabricated tool name not exposed as trusted metadata | FAIL — canary name in normalized events | PASS |
| Value-like credential name rejected without echo | FAIL — accepted, echoed | PASS |

**Result: 15 defect reproductions at the reviewed SHA, all passing at the
remediated tree; 1 valid-behavior control green on both trees.**

## Fresh-clone and packed-consumer evidence

A fresh clone of the remediated commit (no pre-existing `dist`,
no `node_modules`) ran: `npm ci` → `npm run typecheck` (BEFORE build) →
`npm run build` → `npm run format:check` → `npm run lint` → `npm test`
(1,761 passed) → `npm run verify:stage6a` — all exit 0, all-clean
format/lint (no `.pi/` in a clone). Packed neutral and adapter consumers
execute built emitted JavaScript outside the workspace via plain Node
(`verify:stage6a`), including the adapter probe composing the governed
adapter with its required coordinator and running a real offline turn
against packed dist.

## Files changed

**Neutral runtime (`packages/runtime`)**
- `src/agent-types.ts` — activation manifest `@3` (resolved subagent
  identities); full content validation of persisted activation records
  (closed manifest schema, canonical bytes, recomputed identity,
  cross-checks, non-echoing hostile-input handling).
- `src/agent-registry.ts` — manifest carries resolved subagent identities;
  restoration preserves the persisted `createdAt`.
- `src/agent-governance.ts` — receipt-enforced shared transition
  validation; `listDeletionIntents`; widened optional `close`;
  credential-name policy aligned with the compiler pattern (never echoes
  invalid names); `requireCredential` validates names.
- `src/index.ts` — new exports.
- `test/agent-governance-receipts.test.ts` (NEW) — shared receipt
  conformance over BOTH stores.
- `test/agent-subagent-identity.test.ts` (NEW) — subagent identity +
  createdAt regressions.
- `test/agent-governance.test.ts`,
  `test/agent-registry-corrective.test.ts`, `test/agent-registry.test.ts`
  — real registry-produced records; corrected-state-machine assertions
  (updated from defective fixtures; none weakened).

**SQLite store (`packages/store-sqlite`)**
- `src/agent-governance-adapter.ts` — receipt-enforced atomic transitions
  inside the update transaction (stable non-echoing rejection, adapter
  parity); `listDeletionIntents`.
- `test/agent-governance-adapter.test.ts`,
  `test/agent-governance-corrective.test.ts` — real records; fabricated-
  record rejection; reopen durability of the rejection; real fresh-process
  record.

**Mastra adapter (`packages/mastra`)**
- `src/adapter.ts` — required coordinator (unfenced rejection before any
  execution); authoritative budget-denial flag at the gate; baseline-based
  durable persistence barrier with
  `VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED` (no swallowed persistence
  failures); pinned-tool-name and safe tool-call-id trust policy;
  contained tracing-config, guardrail-verdict, structured-output-verdict,
  and processor-result handling.
- `src/memory.ts` — required coordinator; `VictMastraCompositionError`;
  `createGovernedMemoryDeletionPort`; `fenceCompletedDeletions`.
- `src/storage.ts` — pre-open containment (dir real-path containment,
  existing-target redirection rejection) before ANY mutation; automatic
  protected-store permissions (`0o700`/`0o600`, sidecars, POSIX failure
  surfacing, honest Windows limitation); ten-year retention constant;
  documented trust boundary.
- `src/index.ts` — new exports.
- `test/adapter.boundary.test.ts` (NEW) — 16 barrier-controlled boundary
  regressions (fencing, persistence, budget, sanitization).
- `test/storage.path.test.ts` — formatting fixed; containment-before-
  mutation, permission-policy, retention-boundary, reopen/persistence, and
  non-echoing-error regressions.
- `test/adapter.actor-fence.test.ts`, `test/adapter.corrective.test.ts`,
  `test/adapter.e2e.test.ts`, `test/adapter.security.test.ts`,
  `test/fixtures/agent-worker.mts` — compositions updated to the REQUIRED
  coordinator; stale debug `console.error` removed.

**Tooling and documentation**
- `scripts/verify-stage6a.mjs` — adapter packed probe composes the
  required coordinator.
- `docs/architecture/STAGE-06A-PRODUCT-AGENT-FOUNDATION.md` — corrected
  behavior documented (manifest `@3` + subagent identity + createdAt;
  receipt-enforced atomic transitions and required fencing; pre-open
  containment and permission policy; budget authority; sanitization and
  tool-metadata trust policy; credential-name policy).
- `docs/VICT-SYSTEM-REFERENCE.md` — delivery evidence links updated;
  status remains "implemented, awaiting fresh independent audit"; nothing
  marked Verified; Stage 06B/07 remain not begun.

## Remaining limitations

- **Environment:** the reviewer's Linux / Node v24 environment was NOT
  available; the Linux rerun of the ladder and negative controls remains
  for the independent auditor. POSIX-only permanent tests (symlink escapes,
  permission modes) are platform-gated and skip on Windows by design;
  Windows-only junction tests run here.
- In THIS owner checkout, `format:check`/`lint` report the owner's
  untracked `.pi/` files; the fresh clone (authoritative) is fully clean.
- The deletion fence and post-deletion fencing are single-process
  mechanisms valid strictly within the declared local-first, single-actor,
  single-process, file-backed envelope (MSTR-012 governs anything beyond).
- Storage containment defends against redirection planted before
  composition; a concurrent local process racing the composition is
  outside the declared trust boundary (documented, not claimed otherwise).
- SQLite sidecars created AFTER composition are covered by the `0o700`
  directory; `restrictPermissions()` re-applies file modes after write
  bursts.
- Stage 06B (control plane, HTTP/SSE, capability tool bridge, approvals)
  has NOT begun. Stage 07 has NOT begun.

## Ready for independent audit?

Stage 06A boundary remediation is complete and ready for a fresh
independent audit. The Verified decision belongs exclusively to that
audit.

---

**Commit list:** `fix(stage-06a)` boundary-remediation series +
`docs(stage-06a): record boundary remediation`; pushed to `origin/main`
via normal fast-forward after ancestry re-check. **No real credential or
provider was used; the offline deterministic fixture served every model
execution. Stage 06B has not begun. Stage 07 has not begun. All historical
reports and audits are untouched.**
