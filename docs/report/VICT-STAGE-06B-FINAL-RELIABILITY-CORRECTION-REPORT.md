# VICT Stage 06B — Final Reliability Correction Report

Status: **Stage 06B — In Progress, awaiting fresh independent audit.**
Stage 06 remains **In Progress**. Stage 07 is **Not begun**.

This report documents a bounded corrective pass performed on top of the
Stage 06B corrective finalization. It does NOT rewrite, replace, or
re-evaluate any earlier report; earlier reports, audit evidence, and owner
files are preserved unchanged. The defects below were found by an
independent source review and emitted-boundary probes AFTER the official
Stage 06B verifier had already passed at the starting SHA.

## 1. Exact SHAs

| Marker | SHA |
| --- | --- |
| Required starting SHA (= `origin/main` at start) | `d1bf385eb0e0c8052a05f8af195600565bf2c86b` |
| Implementation SHA (last code/test commit) | `944bcdc1190a6c0c826fb27019bfef681c62f39a` |
| Final remote SHA (after the report commit; fast-forward) | `1e8f2ec8178c5f812d00acf547305e71f93ec006` |

Commit chain (fast-forward only, no rewrites):

```text
5ab24be fix(runtime,store-sqlite): R6 closed ChangeSet structural validation; R3 fenced
         idempotency receipts; durable turn tool slots; activation selection operation identity
35d54e3 fix(control): activation selection CAS with explicit absence and operation identity;
         validation/simulation verify the declared base (R4 + governance-run truthfulness)
18b6f1c fix(mastra): terminal invocation replay policy and durable turn-execution slot
         identity (R1 + R2)
cde210b fix(server): fenced settlement through the command service and the closed
         vict.command@1 request envelope (R3 + R5)
944bcdc test(stage-06b): permanent reliability suites for R1–R6; verifier executes them
         directly; base guard captured before the status CAS
```

## 2. Negative-control results (reproduced at `d1bf385` before any edit)

Temporary adversarial probes were executed at the starting SHA; every
defect reproduced exactly as reported by the independent review, and every
probe was converted into a PERMANENT test (§7) and removed before commit.

| Probe (at `d1bf385`) | Observed result |
| --- | --- |
| BLOCKER-06B-R1: same turn ID + explicit `toolCallId` + capability id/revision + canonical arguments, executed twice | first result `completed`; second result `completed`; capability invoked **2×**; durable invocation rows: **1** (the bridge retrieved the terminal record, treated the backward transition as harmless, and invoked again) |
| BLOCKER-06B-R2: two executions without a valid framework `toolCallId` | identities `turn-replay-t1` then `turn-replay-t2` (fallback derived from the current number of durable invocation rows — drifts once an intent exists) |
| BLOCKER-06B-R3: lease takeover then stale-owner settlement | stale owner A's `completeReceipt` accepted; separately stale A's `releaseReceipt` deleted owner B's live claim (no fence token carried or compared) |
| HIGH-06B-R4: two ChangeSets with `base: {kind:'activation', subjectId:'graph-race', expectedVersion:'none'}` committed concurrently | both fulfilled; selection revisions 1 and 2 (`undefined` guarded nothing: it meant both "expect absence" and "no guard") |
| §3 governance-run truthfulness: actual selected release `release-2`, ChangeSet declared base `release-1` | `executeChangeSetCheck(kind:'validation')` returned **passed** (it checked operation targets only, never the declared base) |
| MEDIUM-06B-R5: `dispatch()` with a throwing getter on top-level `command`; request with an unknown top-level field | raw getter executed and the raw error/secret marker propagated; the unknown-field request was **accepted** |
| MEDIUM-06B-R6: `{kind:'select-activation'}`, `{kind:'rollback-activation', graphId:42}`, `{kind:'select-release', releaseVersion:'release-a'}`, `{kind:'rollback-release', applicationId:'app-a'}` | all four malformed operations **accepted** (missing/non-string fields skipped, then cast to `string`) and hashed |

Gate confirmation: the five permanent reliability suites run by
`npm run verify:stage6b` were executed against a fresh checkout of
`d1bf385` — **25 of 33 tests FAIL** at the starting SHA and all PASS after
correction, so the gate is red at `d1bf385` and green after correction.

## 3. BLOCKER-06B-R1 — completed tool invocation executes again

Root cause: after `recordInvocationIntentIdempotent`, the bridge handled
only `outcome_unknown` and `running`. A `completed` record fell through to
the full governed order; the store rejected the backward transition, the
bridge treated the terminal/regression rejection as harmless, and the
capability was invoked a second time.

Correction (`packages/mastra/src/tool-bridge.ts`):

- An existing terminal invocation NEVER passes through capability
  invocation again. Explicit replay behavior per terminal state:
  - `completed` → returns the structured terminal-replay envelope
    `{ victCapabilityReplay: { disposition: 'completed', invocationId,
    resultSummary? } }` — a stable safe result reconstructed from the
    durable record without repeating the effect. Actual output is NOT
    retained or returned as an unrestricted operational payload: the
    durable record retains only the pre-existing SAFE shape-only result
    summary through the established actor-authorized result-summary
    boundary.
  - `failed` / `declined` / `cancelled` → replay their stable safe
    disposition (`VICT_CAPABILITY_INVOCATION_FAILED`,
    `VICT_CAPABILITY_DECLINED`, `VICT_CAPABILITY_CANCELLED`) without
    invoking.
  - `outcome_unknown` → stays fenced and non-replayable
    (`VICT_CAPABILITY_OUTCOME_UNKNOWN`).
  - `running` → reconciles to the fenced `outcome_unknown`
    (`VICT_CAPABILITY_FENCED_RUNNING_RETRY`), never replayed.
- A capability that THREW, or whose output violated its contract, may
  already have performed its effect: the durable disposition is now the
  truthful fenced `outcome_unknown` — never an ordinarily retriable
  `failed`.
- If terminal completion persistence fails and the fallback transition
  also fails, the model still receives only the structured
  `VICT_CAPABILITY_OUTCOME_UNKNOWN` failure; the bridge never reports a
  normal completion for a record whose durable settlement is unproven.
- The output-schema passthrough accepts the replay envelope explicitly
  (fixed non-echoing structure, never capability content).

Permanent tests: `packages/mastra/test/tool-bridge-reliability.test.ts`
covers pure/read (no approval), write and irreversible (approval flow,
including an approved write whose same logical request is submitted twice —
effect count stays exactly ONE), plus failed/declined/cancelled/
outcome_unknown replay and throw fencing.

## 4. BLOCKER-06B-R2 — missing tool-call identity drifts

Root cause: the fallback derived the tool-call identity from the CURRENT
number of durable invocation rows (`turn-<id>-t<ordinal+1>`). Once an
intent existed, a retry derived a different identity.

Correction:

- The count-based fallback is REMOVED (the `getTurnInvocationOrdinal` port
  was deleted entirely).
- New durable port `AgentToolInvocationStore.allocateTurnToolSlot`:
  a separately persisted turn-execution slot keyed by
  `(turnId, toolName, argDigest)`. The FIRST allocation takes the next
  monotonic slot for the turn and persists it BEFORE the invocation; every
  later call with the same key — including after a restart — returns the
  SAME slot and the SAME stable `slot-<n>-<digest>` toolCallId. Time,
  process counters, and "number of rows currently present" are never used.
  (SQLite table `vict_agent_turn_tool_slot`, migration 8; in-memory
  reference implementation with identical semantics.)
- If no durable slot allocation is available AND no valid framework
  `toolCallId` is supplied, the bridge fails CLOSED with
  `VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED`.
- Restart and retry tests prove ONE identity and ONE effect, including the
  exact drift scenario (retry AFTER an intent exists) and a SQLite
  close/reopen restart.

## 5. BLOCKER-06B-R3 — command idempotency leases are not fenced

Root cause: `completeReceipt`, `failReceipt` and `releaseReceipt` carried
no owner/generation and mutated any `pending` row in the namespace.

Correction (runtime port + in-memory + SQLite adapters + service):

- `CommandIdempotencyReceipt` now carries an immutable settlement FENCE
  token per claim generation, derived deterministically by
  `commandIdempotencyFenceToken` (namespace + owner + attempt generation).
- `claimReceipt` persists the caller's token; `takeOverExpiredLease` issues
  and returns a NEW token on `taken` (`{outcome:'taken', fenceToken}`).
- `completeReceipt`, `failReceipt` and `releaseReceipt` require the exact
  token and compare+mutate in ONE transaction (SQLite `inTransaction`).
  A stale owner receives the stable non-echoing
  `VICT_IDEMPOTENCY_FENCE_CONFLICT` and the receipt is left byte-identical
  (asserted byte-for-byte in tests). Settled receipts can never be
  re-settled.
- `VictCommandService` tracks the token from claim/takeover through
  settlement; a fence conflict is never recorded as the command's own
  disposition and never touches the current owner's live claim.
- Duplicate completed-result replay and expired-lease takeover recovery
  are preserved (shared conformance suite + service tests).
- Barrier-controlled concurrency coverage: a parked mid-flight winner
  (injected barrier) with a concurrent duplicate dispatcher — the duplicate
  deterministically observes `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS`, one
  effect, one settled receipt. Both adapters are covered through the shared
  conformance suite.

## 6. HIGH-06B-R4 — activation ChangeSet base race

Root cause: `expectedSelectionRevision: undefined` meant BOTH "explicitly
expect no current selection" and "no guard supplied", so an absent base
guarded nothing; activation selection also had no stable operation
identity, so recovery could not distinguish this operation's effect from a
coincidentally equal selection.

Correction:

- Absence is represented EXPLICITLY as the literal `'none'`
  (`SelectActivationCommand.expectedSelectionRevision?: number | 'none'`,
  `OperationGuard.expectedSelectionRevision`); `undefined` always means
  "no guard". The catalogs enforce the absence guard atomically inside the
  selection mutation (in-memory and SQLite).
- Activation selections now carry a stable operation identity
  (`operationId`, column added by migration 8 with a unique partial
  index). Re-application under the SAME identity returns the ORIGINAL
  selection revision without adding a revision; a different operation
  identity goes through the guard normally.
- `ControlPlaneService.commit` captures the base-subject guard from the
  SAME observed state as the stale-base check BEFORE the status CAS, and
  `#resumeCommit` uses it for the first base-subject operation (the
  absent-selection race window between evidence and mutation is closed).
  A prepared intent's receipt guard is re-used verbatim on recovery.
- Recovery verifies the EXACT operation identity on the selection —
  `#operationEffectExists` requires `selection.operationId === digest`;
  an operator-path selection of the same target is NOT proof.
- Losses surface as the stable `VICT_CONTROL_BASE_STALE` control error
  with no effects.
- Coverage: in-memory and SQLite catalogs, close/reopen durability,
  concurrent commits (exactly one winner), effect-before-receipt
  interruption (receipt identity binding), and stale-base re-commit
  rejection.

## 7. MEDIUM-06B-R5 — shared command envelope is not closed

Root cause: `dispatch()` read `request.command` (and `request.payload`)
directly, executing caller accessors, and validated only `payload`'s
fields, accepting unknown top-level members.

Correction (`packages/server/src/commands.ts`):

- The COMPLETE request envelope is validated and captured BEFORE any
  individual field is read: only OWN, ENUMERABLE, STRING-KEYED data
  properties cross the boundary; accessors (getters never invoked —
  proven with invocation counters), inherited members, non-enumerable
  fields, symbol keys, exotic prototypes, and hostile/throwing proxies
  are rejected; enumeration/descriptor reads that throw fail with the
  stable structured `VICT_COMMAND_REQUEST_INVALID` (never a raw exception,
  never echoing values).
- Closed top-level fields are exactly `command`, `payload`,
  `idempotencyKey` (the declared members of `vict.command@1`); unknown
  fields fail.
- The captured VICT-owned request is the ONLY object used for
  authorization, request digesting, and execution; the caller's object is
  never retained.
- The HTTP transport composes the same typed dispatcher over a body it
  already validates as a closed `{payload, schema}` envelope, so the
  semantics hold at the HTTP and direct dispatcher boundaries alike.

## 8. MEDIUM-06B-R6 — malformed ChangeSet operations are accepted

Root cause: `validateChangeSetOperation` skipped every non-string or
missing field and then cast it to a `string`; the base was cast without a
closed-structure check; raw generic `Error`s crossed public boundaries.

Correction (`packages/runtime/src/control-types.ts`):

- A shared `captureClosedControlRecord` discipline: exact required-member
  sets per operation kind (`CHANGESET_OPERATION_FIELDS`), exact runtime
  types, non-empty bounded identifiers (`assertControlId`), and closed
  own-field sets. Accessors, inherited/non-enumerable members, symbols,
  exotic prototypes, sparse arrays, and hostile/revoked proxies are
  rejected WITHOUT invoking getters or echoing values (getters proven
  never invoked).
- `ChangeSetBase` is validated as a closed structure (exactly
  `kind`, `subjectId`, `expectedVersion`, exact string types).
- Hashing uses ONLY the validated VICT-owned canonical capture; caller
  objects are never retained or frozen. Invalid content produces NO
  ChangeSet record, control run, partial plan, or content hash (hash
  computation happens strictly after all validation).
- All structural rejections are stable `VictControlError`s
  (`VICT_CONTROL_OPERATION_INVALID`, `VICT_CONTROL_STRUCTURE_INVALID`,
  `VICT_CONTROL_FIELD_INVALID`, `VICT_CONTROL_RELEASE_INVALID`,
  `VICT_CONTROL_ID_INVALID`, `VICT_CONTROL_TIMESTAMP_INVALID`,
  `VICT_ACTOR_UNAUTHENTICATED`) instead of raw generic exceptions.
- The SQLite `updateInvocationStatus` port was additionally found not to
  accept `outcome_unknown` at all (a latent migration-6 gap); it now
  accepts and orders the fenced state.

## 9. Governance-run truthfulness (declared base vs observed selection)

Root cause: `executeChangeSetCheck(kind:'validation')` prevalidated only
operation targets; the declared base was compared with current state only
at commit time.

Correction:

- Both `validation` and `simulation` runs compare the DECLARED base with
  the CURRENT subject selection, including explicit expected absence
  (`CHANGESET_BASE_NONE` sentinel). A stale base produces `blocked`, never
  `passed` (validation) or a sandbox run (simulation: blocked with an
  empty per-operation detail — the sandbox never starts from an unverified
  base).
- Run records identify the OBSERVED base actually checked
  (`ControlRunRecord.observedBase`, persisted by both adapters), proving
  what was verified rather than what was declared.
- Commit-time CAS remains mandatory; earlier evidence never replaces
  mutation-time fencing (a state change between evidence creation and
  commit still blocks the commit — tested for release and activation
  subjects, with state changes in between).

## 10. Verification evidence

Node `>=22.13.0` (v22.13.1, Windows). Development-loop commands used
repeatedly during implementation: `npm run typecheck`, targeted
`npx vitest run <suites>`.

Final working-tree verification (executed ONCE, in this order):

```text
npm run format:check   → All matched files use Prettier code style!
npm run lint           → clean (0 problems)
npm run typecheck      → clean
npm run build          → all 13 production workspaces build
npm test               → 2012 passed | 3 skipped (2015), 0 failed
npm run verify:stage6b → ALL GATES PASSED (all gates, incl. the five new
                         reliability suites, executed directly)
git diff --check       → clean
git status --short     → only the untracked .pi/ agent directory (pre-existing)
```

Repeat counts for non-deterministic classes (exactly three runs, per the
reduced budget):

- Concurrency/crash-recovery/fault-injection suites
  (`packages/server/test/restart-sigkill.test.ts`,
  `packages/store-sqlite/test/reliability-restart.test.ts`,
  `packages/mastra/test/tool-bridge.faults.test.ts`,
  `packages/control/test/control-plane-reliability.test.ts`,
  `packages/server/test/command-reliability.test.ts`): 3 consecutive
  clean runs (one diagnosis-and-fix cycle occurred during the third
  sweep: a stale `@vict/server` dist in the SIGKILL child process
  produced a misleading fence conflict; rebuilt and re-run clean — the
  failure was diagnosed honestly and is recorded here).
- Deterministic suites ran once.

Fresh-clone verification (ONE clone at the implementation SHA):

```text
git clone <repo> && git checkout <implementation SHA>
npm ci                       → ok
npm run typecheck            → ok
npm run build                → ok
targeted Stage 06B reliability suites (5 suites, 33 tests) → all pass
git diff --check             → clean
git status --short           → clean
```

Gate polarity against the starting SHA (temporary worktree at `d1bf385`,
permanent suites copied in, removed afterwards): **25/33 tests FAIL at
`d1bf385`**; the same suites pass after correction. Temporary scripts,
probe files, and worktrees were removed before every commit; no temporary
artifacts are tracked.

## 11. Test counts added by this correction

| Suite | Tests |
| --- | --- |
| `packages/runtime/test/changeset-structure.test.ts` (R6) | 7 |
| `packages/control/test/control-plane-reliability.test.ts` (R4 + §3) | 8 |
| `packages/mastra/test/tool-bridge-reliability.test.ts` (R1 + R2) | 7 |
| `packages/store-sqlite/test/reliability-restart.test.ts` (R2/R3/R4 restart) | 3 |
| `packages/server/test/command-reliability.test.ts` (R5 + R3) | 8 |
| Updated shared suites (fence tokens, takeover conflict, slot port — in `control-conformance.ts`, shared by in-memory and SQLite) | 3 (inside existing tests) |
| **Total new permanent reliability tests** | **33 (+ shared-suite coverage)** |

`npm run verify:stage6b` executes all of them directly (gate 4: "Stage 06B
final reliability suites").

## 12. Remaining genuine limitations

- The terminal-replay result for `completed` invocations reconstructs the
  stable identity + shape summary, not the full capability output. A
  deployment that needs full-output replay must add an explicitly
  actor-authorized content-reference boundary; none exists yet.
- R2's stable identity uses the durable turn-execution slot when Mastra
  does not supply a `toolCallId`. Slots are scoped to
  `(turnId, toolName, argDigest)`; two concurrent identical logical
  requests within one turn share one identity by design (exactly-once).
- The SQLite `vict_agent_turn_tool_slot` allocation takes a per-turn
  `MAX(slot)+1` inside one transaction; serialization relies on SQLite's
  write transaction, which is single-writer on one database file.
- One OS (Windows, Node 22.13.1) was exercised for this correction; the
  independent audit will re-run the ladder on Linux/Node 24.
- Fence tokens bind claim generations, not individual HTTP requests: a
  client whose request lost a lease race receives a structured conflict
  and must retry (the retry replays the winner's settled result).
- Stage 06B remains In Progress: the verifier and suites are green, but
  promotion to Verified requires the fresh comprehensive independent
  Stage 06 audit.

## 13. Status

```text
Stage 06B — In Progress, awaiting fresh independent audit
Stage 06  — In Progress
Stage 07  — Not begun
```