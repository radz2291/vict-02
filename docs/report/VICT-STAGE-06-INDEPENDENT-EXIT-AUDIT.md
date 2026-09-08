# VICT Stage 06 — Independent Exit Audit

> **Audit class:** fresh, comprehensive, independent exit audit of the complete Stage 06 gate (Stage 06A + Stage 06B).
> **Audit target:** `712752a3ebe8053d1a846e840925d87f98e4f0c3` (final documentation tip).
> **Repository:** `https://github.com/radz2291/vict-02.git`, branch `main`.
> **Status of this document:** independent audit record. It does NOT close Stage 06 and does NOT promote any stage status. Formal closure remains a separate act.

---

## 1. Verdict

```text
VERIFIED WITH NON-BLOCKING ISSUES — STAGE 07 PERMITTED AFTER FORMAL STAGE 06 CLOSURE
```

- No Critical, High, or Medium findings were produced.
- One **Low** finding (shared-store cross-composition liveness adjudication, classified by actual measured impact) and two **Informational** observations are recorded. None affects the Stage 06 exit gate, safety boundaries, durability truthfulness, or secret safety.
- Stage 06 is ready for formal closure. Stage 07 may begin **only after** that formal closure. This audit does not itself close the stage.

## 2. Audited SHAs and ancestry

| Role | SHA | Subject |
| --- | --- | --- |
| Audit target (final docs tip) | `712752a3ebe8053d1a846e840925d87f98e4f0c3` | docs(stage-06b): record tool-state correction |
| Tool-state correction implementation | `57ca502915d8f4a1a179a5cb38e86d452c2a9c40` | fix(stage-06b): preserve truthful tool terminal states |
| Previous boundary-correction tip | `32b0e8968df3b544c3d86548adacdc67b7509314` | docs(stage-06b): record the completion-time remote head (af4d85a) … |
| Stage 06A formal closure | `b491ededed32a796aa035befe77946e8b107338b` | chore(stage-06a): record verified closure |

Ancestry verification (fresh clone, `git merge-base --is-ancestor`):

```text
b491ede → ancestor of → 32b0e89 : OK
32b0e89 → ancestor of → 57ca502 : OK
57ca502 → ancestor of → 712752a : OK
b491ede → ancestor of → 712752a : OK
```

- `HEAD == origin/main == 712752a3ebe8053d1a846e840925d87f98e4f0c3` at clone time and re-verified immediately before report creation (no remote advance occurred during the audit).
- Commit chain `b491ede..712752a`: **41 commits, 0 merge commits (linear)**.
- All four SHAs exist as commit objects with the expected subjects.
- `57ca502` touches only `@vict/mastra` sources, its tests, `package.json`/lockfile devDependency sync, and `scripts/verify-stage6b.mjs` (10 files, +1745/−73). `712752a` touches only the Stage 06B architecture document and the correction report.
- Historical audits and reports: `git diff --name-status b491ede..HEAD -- docs/report/` shows **additions only**; zero modified/deleted/renamed historical evidence files. `docs/VICT-SYSTEM-REFERENCE.md` changed v0.3.2 → v0.3.3 as a documentation-only implementation record (no requirement row promoted to Verified; Stage 06 remains In Progress; Stage 07 remains blocked).

## 3. Environment matrix (primary environment, as required)

| Component | Value |
| --- | --- |
| OS | Ubuntu 24.04.4 LTS (WSL2), Linux x86_64 |
| Kernel | 6.6.87.2-microsoft-standard-WSL2 |
| Filesystem | native Linux ext4 (`/dev/sdd`, audit clone under `$HOME`) |
| Node | v24.19.0 |
| npm | 11.17.0 |
| Git | 2.43.0 |
| SQLite | `node:sqlite` built-in driver (`DatabaseSync`), engine 3.53.3 |
| Browser/DOM | none required; renderer suites use happy-dom 15.11.7; POSIX permission suites executed on native Linux |
| Mastra | pinned repository versions: `@mastra/core` 1.64.0, `@mastra/libsql` 1.22.3, `@mastra/memory` 1.28.2, `@mastra/observability` 1.17.5 — not updated |
| Credentials | none; no provider credential or external model call used (pinned deterministic offline fixture) |

All commands were executed inside the WSL2 Ubuntu-24.04 environment against a fresh clone on the native ext4 filesystem. The Windows host was used only to drive the WSL shell.

## 4. Verification ladder (one pass, exact order)

Fresh clone, `npm ci` completed with exit 0 before anything else. Zero pre-existing `dist` directories were verified before typecheck.

| # | Command | Exit | Evidence |
| --- | --- | --- | --- |
| 1 | `npm run typecheck` | 0 | before build; `dist` count = 0 |
| 2 | `npm run format:check` | 0 | all files Prettier-clean |
| 3 | `npm run lint` | 0 | no errors, no warnings |
| 4 | `npm run build` | 0 | all workspaces |
| 5 | `npm run test:unit` | 0 | 88 files / **1837 tests passed** |
| 6 | `npm run test:integration` | 0 | 1 file / **4 tests passed** |
| 7 | `npm test` | 0 | 109 files / **2062 tests passed** |
| 8 | `npm run verify:consumer` | 0 | packed consumers resolve declared dependencies only |
| 9 | `npm run verify:stage6b` | 0 | **ALL GATES PASSED** (aggregate gate; stage 2–6A verifiers intentionally not re-run per audit rules) |
| 10 | `npm run example` | 0 | offline deterministic walking proof (13 events) |
| 11 | `npm run bench` | 0 | benchmark report produced |
| 12 | `npm run example:application` | 0 | 2 files / **17 tests passed** |
| 13 | `npm audit --omit=dev` | 0 | **found 0 vulnerabilities** |
| 14 | `git diff --check` | 0 | no whitespace errors |
| 15 | `git status --short` | 0 entries | tree clean (only gitignored artifacts) |
| 16 | `npm run typecheck` (post-build sanity) | 0 | |

**Targeted 3× repeats (concurrency, fencing, crash/restart, backpressure only — full suite and aggregate verifier NOT repeated five times):** `control-plane-reliability`, `tool-bridge-reliability`, `tool-bridge-ownership`, `tool-bridge.faults`, `tool-bridge.truthfulness`, `tool-state-normalization`, `invocation-fencing`, `reliability-restart`, `restart-sigkill`, `idempotency`, `sse` — **exit 0 in all three runs (11 files / 75 tests each)**. No timeouts were increased, no sleeps added, no assertions weakened. Every non-zero intermediate result observed during setup was diagnosed: two probe-harness fixture bugs (missing turn seeding; a stale idempotency-key format in the probe itself) were proven to be probe defects, not product defects — the store correctly failed closed (`FK constraint`, `VICT_STORE_UNAVAILABLE`) in both cases.

## 5. Independent adversarial evidence

Beyond the repository's own 2062-test suite, this audit executed **four independent probe programs (109 assertions total)** written for this audit and run against **built artifacts** (`dist`) via `tsx`, independent of the repo's test fixtures.

### Probe 1 — occurrence identity & tool-state truthfulness (Areas C/D): **56/56 PASS ×3 runs**

- C1/C2 Missing (`undefined`) and malformed (300-char, hostile-character) `toolCallId` → `VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED`, **zero durable intents recorded, zero effects** — refusal occurs before intent, approval, or effect.
- C3 Two distinct occurrences with **identical arguments** → two durable invocations with distinct `invocationId`s, two effects, both durably `completed` (identical digests confirmed equal; identity comes from the occurrence, not the arguments).
- C4/D1 Retry of the same occurrence identity → **exactly one effect**; replay envelope `disposition: 'completed'`; replay carries **no raw output** (planted canary in the output absent from the model-visible result; no `echo`/`done` fields; `resultSummary` is structural shape only, e.g. `object(1 fields)`).
- C5 Durable intent precedes effect: inside the capability invocation the record already exists with status `running`.
- D2 Output-contract rejection → model receives `VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED`, durable status `outcome_unknown` (non-replayable) — can never become normal completion.
- D3 Capability output forging `{ victCapabilityReplay: { disposition: 'completed', … } }` (passing the capability's own permissive output contract) → durable `outcome_unknown` with `VICT_CAPABILITY_RESERVED_MARKER_REJECTED`; forged identity never reaches the model.
- D4 Effect-before-persistence ambiguity (settlement persistence forced to throw): model receives `VICT_CAPABILITY_OUTCOME_UNKNOWN`; durable status never `completed`; the later retry performs **no second effect** and never claims completion.
- D5 Stale attempt fence cannot settle a newer generation: after `reconcileAbandonedRun` re-fences, the old owner's `settleInvocationRun` is refused (`FENCE_MISMATCH`).
- D6 Cancelled duplicate waiter receives the truthful non-terminal `in_progress` report; **the owner is never mutated or cancelled**; the owner later settles `completed` under its own fence; exactly one effect.
- D7 Totality/fail-closed matrix: unknown envelope field, bad disposition, hostile `invocationId`, `Map`-prototype envelope, array envelope, contradictory double markers, oversized `resultSummary`, numeric `invocationId`, getter-throwing envelope → all fail closed, never completion. Ordinary/helper/string/null results → `not-capability` (legacy handling intact).
- D8 Exact mapping pinned: `completed→completed`; `failed→VICT_CAPABILITY_INVOCATION_FAILED`; `declined→VICT_CAPABILITY_DECLINED`; `cancelled→VICT_CAPABILITY_CANCELLED`; `outcome_unknown→VICT_CAPABILITY_OUTCOME_UNKNOWN`; `in_progress→nonterminal`.

### Probe 2 — liveness-domain adjudication (Area E): **19/19 PASS ×3 runs**

**Case 1 — colliding local `invocationId`s across independent stores/compositions (must not share liveness): PASS.**
- In-memory: composition A's owner barrier-held on `inv-collide`; independent composition B (own store, own registry) with the same local id runs its own live owner; **B's duplicate resolves via B's owner while A is still barrier-held** (bounded 2 s race); A's record remains `running` and untouched; A later settles `completed`; one effect each.
- SQLite: B's seeded `running` record from a dead process life (no live owner in B) is conservatively reconciled **inside B's own domain** to `outcome_unknown` (non-replayable, zero effects) **without awaiting A's live owner**; A untouched and completes afterwards.
- The former module-global registry aliasing is demonstrably gone.

**Case 2 — two compositions intentionally sharing ONE store (measured, not auto-accepted): behavior confirmed, classified Low.**
- Setup: composition A holds a genuinely live owner (barrier-held, outcome known) on a shared store; composition B (separate registry, same store) receives the **same occurrence identity** (same turn, toolCallId, arguments).
- Measured result: B's retry observes `running` with **no live owner in B** and reconciles the record to the fenced, non-replayable `outcome_unknown` (exact-binding). A's live owner is then unable to settle its known outcome (its fence was superseded) and truthfully receives `VICT_CAPABILITY_OUTCOME_UNKNOWN`. Final durable status: `outcome_unknown`. **Exactly one effect; no false completion anywhere; no second effect; no cross-composition await.**
- Reachability: requires two bridge compositions sharing one store domain in one process. `composeMastraTurnExecutor` creates one registry per composition, and the exported composition API makes this wiring possible for an embedder; however, **no shipped flow does it** — `@vict/mastra` is not imported by `@vict/server`, `@vict/cli`, or any example, and the server/CLI operate the shared command surface, not the Mastra composition. The architecture document (STAGE-06B, §"Live invocation attempts are FENCED") documents exactly this conservative behavior, including "an attempt belonging to another composition."
- Classification by actual impact: **Low** — an effect that landed is truthfully recorded as non-replayable `outcome_unknown` and a known-good result is lost (availability/precision cost); no safety, isolation, authorization, identity, durability-falsity, or secret-safety failure. See §9.

### Probe 3 — secret-safety canaries over real SQLite (Area H): **8/8 PASS**

- Canaries planted in: capability arguments (`CANARY-ARGS-*`), capability output (`CANARY-OUTPUT-*`), hostile capability error message (`CANARY-ERRSECRET-*`), a prompt-equivalent input summary channel (`CANARY-PROMPT-*` held out of every durable path by construction), and an approval reason (`CANARY-REASON-*`).
- Raw bytes of `canary.db`, `canary.db-wal`, `canary.db-shm` (757,896 bytes scanned): **zero canaries present**.
- Hostile errors normalize to the stable non-echoing `VICT_CAPABILITY_OUTCOME_UNKNOWN`; no error text or argument content reaches the model result.
- Durable invocation rows carry structural summaries only (`object(1 fields)` shape) and digests.
- Observation: an approval `decisionReason` is **by design** persisted (bounded to 200 chars, control-character-sanitized, declared field of the approval record type). This is operator-entered governance metadata, not a secret-class channel. Recorded as Informational (§9).

### Probe 4 — control-plane governance spot checks (Area B): **14/14 PASS**

- Hostile getter-throwing ChangeSet proposal input → one stable `VICT_CONTROL_*` error; hostile getter content **not echoed**.
- Proposals containing unknown fields, inherited (prototype) members, or symbol-keyed members → fail closed (`VICT_CONTROL_STRUCTURE_INVALID` family).
- Self-approval denied (`VICT_APPROVAL_SELF_DENIED`); scope-less cross-actor decision denied (`VICT_ACTOR_SCOPE_DENIED`); proper scoped approver succeeds.
- `consumeApproval` exact binding: wrong actor, wrong `argDigest` (content), wrong `toolCallId`, wrong revision → each denied with binding-mismatch codes; exact binding consumes; expired approvals can never be consumed (see §9 observation on the throw-vs-denial form).
- Fabricated evidence refused: `attachValidationEvidence` with a non-existent run id → `VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE` (evidence derives only from authoritative executed runs).

### Reliance on the permanent suites (already exercised by the ladder)

The remaining mandated areas are covered by permanent suites that this audit executed via the ladder and repeats, and whose content was inspected: complete ChangeSet lifecycle/stale-base/concurrent-commit/saga-recovery and idempotency fencing (`control-plane.test`, `control-plane-reliability`, `idempotency`, `command-reliability`); closed `vict.agent-stream@1` schema, monotonic sequences, durable ordering, cursor round-trip and cross-stream rejection, restart replay, lossless backpressure, actor ownership on reads, cancellation/late-result fencing (`stream-hub`, `sse`, `adapter.*`, `authorization-matrix`); real child-process SIGKILL between intent/effect/settlement, pending-approval and cancellation restart, `outcome_unknown` truthfulness, migrations through the latest schema, receipt/fence integrity, half-applied-ChangeSet impossibility (`restart-sigkill`, `reliability-restart`, `orchestration-restart`, `migrations`, `agent-governance-*`); canary leakage matrix across HTTP responses, SSE frames, safe errors, events, rows, traces, memory, and raw DB/WAL/SHM (`canary.test`, `e2e-canary`, `storage.permissions.posix` — executed on native Linux). No undeclared transport-only event kinds exist: the `vict.agent-stream@1` vocabulary is a closed 13-kind list (`AGENT_STREAM_EVENT_KINDS`).

## 6. Tool-state truthfulness mapping (mandatory exit-gate focus) — RESULT: **HOLDS**

Both inspection surfaces were verified: **direct bridge results** and **normalized durable stream events** (the repo's real-pinned-Mastra-pipeline suites assert on the durable ledger rows; my probes assert on direct results and the single closed mapping function).

| Result shape | Normalized event | Independent result |
| --- | --- | --- |
| replay `completed` (owner-confirmed or bound to confirmed record) | `tool.completed` | PASS (D1/D8; exactly once per occurrence) |
| replay `failed` | `tool.failed(VICT_CAPABILITY_INVOCATION_FAILED)` | PASS |
| replay `declined` | `tool.failed(VICT_CAPABILITY_DECLINED)` | PASS |
| replay `cancelled` | `tool.failed(VICT_CAPABILITY_CANCELLED)` | PASS |
| replay `outcome_unknown` | `tool.failed(VICT_CAPABILITY_OUTCOME_UNKNOWN)` | PASS |
| replay `in_progress` | **NONTERMINAL — no terminal event** | PASS (D6; zero terminal events while running) |
| structured failure envelope | `tool.failed(<code>)` | PASS |
| malformed/hostile/unsupported/contradictory envelope | `tool.failed(VICT_CAPABILITY_OUTCOME_UNKNOWN)` | PASS (D7 matrix) |
| hostile completion content on failure-marked chunk | `tool.failed(VICT_CAPABILITY_OUTCOME_UNKNOWN)` | PASS (adapter guard) |
| no bridge marker (ordinary/helper) | legacy handling unchanged | PASS |

Invariants proven: `tool.completed` only after durable `completed` confirmation (or bound to an already-`completed` record); first-terminal-wins per occurrence (no contradictory or duplicate terminals — the real-pipeline suite pins exactly one terminal for a duplicate-identity recurrence); abandoned/unresolved attempts normalize `tool.failed(VICT_CAPABILITY_OUTCOME_UNKNOWN)`, never completion; a cancelled duplicate does not mutate or cancel the live owner, which settles truthfully later.

## 7. Negative control (bounded, at `32b0e8968df3b544c3d86548adacdc67b7509314`)

A detached temporary worktree at the previous boundary-correction tip was created, the dependency tree linked, and **only** the two newest truthfulness suites (`tool-bridge.truthfulness.test.ts`, `tool-state-normalization.test.ts`) copied in and executed:

```text
Test Files  2 failed (2)
Tests  13 failed | 1 passed (14)
```

Assertion-level highlights at the old SHA (each maps to a defect claimed fixed by `57ca502`):

- `expected { disposition: 'completed', …(1) } to be undefined` — the old normalization emitted a terminal-shaped envelope for a running invocation.
- `expected 'stuck' to be 'resolved'` (×2) — cross-composition liveness aliasing: a duplicate was stuck awaiting the *other* composition's barrier-held owner through the old module-global registry.
- `expected [ …(8) ] to have a length of 1 but got 8` — duplicate-identity recurrence produced multiple terminal milestones for ONE occurrence.
- `expected 'completed' to be 'outcome_unknown'` — a hostile capability output impersonating a control envelope was settled as durable `completed` (the lie became durable).

At the audit target the same suites pass (ladder + 3× repeats). The worktree was removed (`git worktree remove --force`); `git worktree list` shows only the main working tree. No historical negative controls were re-run, per audit rules.

## 8. Findings

| ID | Severity | Area | Finding | Disposition |
| --- | --- | --- | --- | --- |
| EXIT-1 | **Low** | Area E | Two same-process compositions sharing ONE store do not share live-owner liveness: a cross-composition retry of the same occurrence identity reconciles the record to `outcome_unknown` (exact-binding, non-replayable) and fences out the genuinely live owner, which can no longer settle its known result. Measured: one effect, no false completion, no second effect, truthful failure to both compositions. Documented trade-off in the architecture document; unreachable through any shipped flow (nothing shipped composes `@vict/mastra` executors; server/CLI use the shared command surface); possible only via bespoke embedder wiring of the exported composition API. | Non-blocking. Accepted as the documented domain-scoping trade-off of the single-process envelope. Recommendation (non-gating): a future stage could key liveness by store domain (e.g., registry identity derived from the store) to reconcile live owners across compositions on one store. |
| EXIT-2 | Informational | Area B | `consumeApproval`'s expiry branch calls `expireApproval`, which requires a `pending` record; for an `approved` record past expiry it throws `VICT_CONTROL_APPROVAL_INVALID_STATE` (a stable, non-echoing code) instead of returning the `VICT_APPROVAL_EXPIRED` denial. Unreachable in the normal bridge flow (the decision poll gates consumption), and fail-closed in every path (an expired approval can never be consumed). | Non-blocking observation; stable-code vs throw form could be unified in a future hygiene pass. |
| EXIT-3 | Informational | Area H | Approval `decisionReason` (approver-entered) is persisted verbatim, bounded to 200 chars with control-character sanitization, as a declared field of the approval record. By-design governance metadata, not a secret-class channel; all secret-class canaries (prompts, arguments, outputs, hostile error text) were absent from every store and diagnostic surface. | Non-blocking observation; no action required. |

No Critical, High, or Medium findings. No reopen of Stage 06A: all Stage 06A regression gates inside `verify:stage6b` pass, `b491ede` remains in ancestry, and all Stage 06A evidence is byte-identical.

## 9. Remaining limitations

1. **EXIT-1 (Low)** as above: same-process, shared-store, multi-composition liveness is conservatively fail-closed rather than reconciled; a live invocation encountered through a foreign composition becomes non-replayable `outcome_unknown` and the owner's known result is discarded.
2. A cancelled duplicate waiter's milestone stays intentionally OPEN (non-terminal) in its own stream; consumers observe a started-but-not-terminated tool milestone for that occurrence — the truthful representation of "no terminal outcome is known to this occurrence" (documented policy, verified by Probe 1 D6).
3. The in-process live-owner registry is valid only within the documented single-process/local deployment envelope; cross-process liveness relies on the durable fence and conservative `outcome_unknown` reconciliation (verified by the SIGKILL fixtures).
4. One child-process SQLite suite uses the 5 s vitest default; on slow filesystems (WSL 9p) cold starts can exceed it. Not observed on the native-ext4 audit environment (all runs passed); pre-existing suite infrastructure, unchanged by the correction.

## 10. Confirmations

- **Stage 06A remains intact.** `b491ededed32a796aa035befe77946e8b107338b` is in the verified linear ancestry; all Stage 06A regression gates pass at the audit target; every historical audit/report is byte-identical (additions only since closure). Stage 06A was not reopened — no regression evidence was found.
- **No real provider or API key was used.** All agent executions used the pinned deterministic offline Mastra model fixture (`offline-fixture/deterministic-1`); no network egress occurred; `npm audit` was the only registry-touching command (metadata only).
- **No production code, tests, architecture documents, system reference, or historical reports were modified.** The audit began from a fresh, clean clone at the audit target; the working tree contains only the additions of this report file (and gitignored build artifacts); the negative-control worktree was temporary and removed. No force-push, rebase, or history rewrite occurred; the remote did not advance during the audit (re-verified immediately before report commit).

## 11. Verdict restated

```text
VERIFIED WITH NON-BLOCKING ISSUES — STAGE 07 PERMITTED AFTER FORMAL STAGE 06 CLOSURE
```

Stage 06 is ready for formal closure. Stage 07 has not begun and remains blocked until that formal closure is performed as a separate, explicit act.
