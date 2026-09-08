# VICT Stage 06 — Post-Audit Independent Closure Re-Audit

> **Audit class:** focused, independent post-audit closure re-audit of the Stage 06 post-audit hostile-envelope remediation. This is NOT a remediation, NOT formal closure, and NOT Stage 07 work.
> **Re-audit target:** `46a1ab7283364f0a3def6b03c374c3c190e0e3dc` (branch `main` at clone time; HEAD == origin/main).
> **Remediation audited:** implementation `735cc9a19d3d8253f792e10d605967142b2ad052`, documentation `46a1ab7283364f0a3def6b03c374c3c190e0e3dc`.
> **Negative control:** temporary worktree at the previously audited implementation `712752a3ebe8053d1a846e840925d87f98e4f0c3` (removed after use).
> **Status of this document:** independent audit record. It does NOT close Stage 06 and does NOT begin Stage 07.

---

## 1. Verdict

```text
NOT VERIFIED — STAGE 07 BLOCKED
```

One **High** defect was independently reproduced through the real pinned Mastra path (Section 7 adjudication). The remediation's structural-capture boundary, closed-code vocabulary, and post-invocation settlement machinery are real and hold under every probe this re-audit ran against them (37/37 envelope matrix, 8/8 durability, 10/10 non-plain boundary probes, 45/45 permanent containment tests, full ladder green). However, the remediation-report limitation quoted below is **not acceptable** under this re-audit's mandatory rule, and the defect it describes was confirmed end-to-end — including the effectful-contradiction case:

> A hostile non-plain delivered result could cause a downstream Mastra tool error after the durable invocation was recorded as completed.

The mandatory rule states: *a durable completed invocation must not subsequently normalize as `tool.failed` merely because the returned value is unsafe to deliver*, and a limitation is acceptable **only if** the value is clearly outside the supported output domain **and is rejected before durable completion** with stable `outcome_unknown`. The re-audit demonstrated a contract-valid output (plain object with a delivery-hostile nested value) that is **not rejected**, is settled durably `completed`, and subsequently normalizes as `tool.failed` in the real stream — with zero `tool.completed`. For an approved `write` capability the same shape executes its effect exactly once, settles `completed`, and is delivered in a state that provably fails downstream delivery: an effectful result becomes contradictory. Per the charter this is at least Medium and is classified **High**.

Stage 06 formal closure is therefore **not permitted**. No Critical findings; one High; no new Medium/Low findings.

## 2. Audited SHAs and ancestry

| Role | SHA | Subject |
| --- | --- | --- |
| Re-audit tip / remediation docs | `46a1ab7283364f0a3def6b03c374c3c190e0e3dc` | docs(stage-06): record post-audit envelope remediation |
| Remediation implementation | `735cc9a19d3d8253f792e10d605967142b2ad052` (resolved from `735cc9a`) | fix(stage-06): contain hostile tool result envelopes |
| Original independent exit audit | `eb8d458a3718562f61e60d844dfa31ffb9cbf356` | docs(stage-06): add independent exit audit |
| Previously audited implementation | `712752a3ebe8053d1a846e840925d87f98e4f0c3` | docs(stage-06b): record tool-state correction |
| Stage 06A closure | `b491ededed32a796aa035befe77946e8b107338b` | chore(stage-06a): record verified closure |

- Fresh clone at `/root/vict-closure-reaudit`; `git rev-parse HEAD origin/main` → `46a1ab7… == 46a1ab7…` at clone time and re-verified immediately before this report's commit (remote did not advance during the audit).
- Linear ancestry verified with `git merge-base --is-ancestor`: `735cc9a`, `b491ede`, `712752a`, and `eb8d458` are all ancestors of HEAD; `eb8d458~1..HEAD` contains 2 commits, 0 merges (linear).
- **Byte-identity of prior evidence:** `git diff --stat eb8d458 HEAD -- docs/report docs/architecture docs/VICT-SYSTEM-REFERENCE.md` shows exactly two changes, both from the audited remediation commits and both additive: the new remediation report (+158, new file) and an additive +30-line section in `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md`. Zero modified/deleted/renamed historical audit or report files. `docs/VICT-SYSTEM-REFERENCE.md` untouched.
- **Remediation scope:** `735cc9a` touches exactly its declared 9 files — 5 `@vict/mastra` sources (`control-envelope.ts` new [222 lines], `tool-bridge.ts`, `helper-tools.ts`, `adapter.ts`, `index.ts`), 3 new test suites (542 + 599 + 540 lines), and `scripts/verify-stage6b.mjs` (+11 lines, registering the three suites as an aggregate gate). `46a1ab7` touches only the architecture doc and its own report. No production code outside `@vict/mastra` changed.
- Clone hygiene: `git status --short` → 0 entries; `find . -type d -name dist -not -path "./.git/*"` → **0 before installation** (173 after `npm ci`, all under `node_modules` — shipped by dependencies).

## 3. Environment

| Component | Value |
| --- | --- |
| OS | Ubuntu 24.04 (WSL2), Linux x86_64 |
| Kernel | 6.6.87.2-microsoft-standard-WSL2 |
| Filesystem | native Linux ext4 (`/dev/sdd`); clone and negative-control worktree under `/root` |
| Node | v24.19.0 |
| npm | 11.17.0 |
| Git | 2.43.0 |
| Mastra | pinned repository versions (`@mastra/core` 1.64.0 et al.) — not updated |
| Credentials | none; no API key and no real provider/model call was used at any point (offline deterministic fixture model `offline-fixture/deterministic-1` only) |

One fresh clone, one `npm ci` (exit 0; only npm `allow-scripts` warnings for the two pinned esbuild versions), one verification pass. No full-suite repeats, no clean-clone ladders, no stage 2–6A verifier re-runs, no timeout increases, no added sleeps, no test edits.

## 4. Negative control at `712752a3` (old defect independently reproduced)

A temporary worktree at `712752a3…` (`/root/vict-reaudit-negctl`, own `npm ci` exit 0, own `npm run build` exit 0) was probed with an independent probe program (`node`, against the worktree's **emitted `dist`**, never repo test fixtures). Result — 13 of 14 probe classes reproduced the historical defects; the 14th matches the remediation report's own characterization:

| Probe (against emitted code of `712752a3`) | Observed |
| --- | --- |
| outer `victCapabilityReplay` getter throwing canary | parser AND normalizer THREW raw `CANARY-…-OUTER-REPLAY` |
| inner `disposition` getter throwing | THREW raw `CANARY-…-INNER-DISPOSITION` |
| revoked Proxy (outer result) | THREW `TypeError: Cannot perform 'IsArray' on a proxy that has been revoked` |
| throwing `has` trap | THREW raw canary |
| `{ victCapabilityFailure: 'CANARY-…-ARBITRARY' }` | normalized as event code `CANARY-…-ARBITRARY` |
| accessor failure marker (getter returns canary code) | getter INVOKED (2 reads), value trusted as event code |
| non-enumerable failure marker | accepted as event code |
| inherited failure marker | accepted as event code |
| `{ victCapabilityReplay: valid, victCapabilityFailure: 42 }` | normalized as **completed** (contradiction accepted) |
| marker-carrying object into output `validate` | BYPASSED the capability contract (`{value}` returned) |
| revoked Proxy into output `validate` | THREW `TypeError: Cannot perform 'get' …` |
| **B1 capability hostile Proxy (`has` trap) output** | execute **THREW raw canary AFTER invocation** (effectCount = 1); durable status left **`running`** — the fenced `outcome_unknown` settlement was bypassed |
| B3 helper hostile Proxy output | THREW raw canary out of the tool boundary |
| B2 capability revoked-Proxy output | NOT reproduced — contained (accidentally, via the invoke-await guard), exactly as the remediation report states ("contained only by accident"); after the fix it is contained by the total inspection (Section 6) |

The negative-control worktree was removed after probing (`git worktree remove` + `prune`, exit 0); the main clone remained clean at `46a1ab7`.

## 5. Structural-capture boundary — independent probe matrix (emitted package boundary)

All probes in this section and the next two ran against the **built `dist`** of `@vict/mastra` (the emitted package boundary), driven by independent `node` programs — not by the repository's test fixtures. Matrix result: **37/37 PASS** (R4b and R9 were re-classified during the audit: initial failures were probe-expectation artifacts, corrected and re-run to green — see notes).

- **R1 getters/setters:** outer replay/failure getters throwing, inner `disposition`/`invocationId` getters throwing, setter-only markers → stable `invalid`/`failed OUTCOME_UNKNOWN`; getter counters read **exactly 0** wherever descriptor rejection applies; canaries never echoed; setters never invoked.
- **R2 revoked proxies:** outer and inner revoked proxies → `invalid` / `failed OUTCOME_UNKNOWN`; never a raw `TypeError`.
- **R3 reflection traps:** throwing `getPrototypeOf`, `ownKeys`, `getOwnPropertyDescriptor`, `has`, `get` traps → contained; `has`-throwing classified **hostile** (never `not-capability`); no canary echoes.
- **R4 honesty probes:** a `has`-lying proxy (membership visible to `in`, invisible to descriptors) → hostile; **inherited markers fail closed** (`invalid` + `OUTCOME_UNKNOWN` — never an event code; note this is stricter than "ignore": membership visible to `in` but absent from own descriptors is hostile by design).
- **R5 accessor/hidden/symbol/unknown fields:** enumerable accessors rejected with **zero getter reads** (even when returning allowlisted codes); non-enumerable, symbol-keyed, and unknown envelope members rejected; `resultSummary` > 512 rejected.
- **R6 closed code vocabulary:** `CAPABILITY_TOOL_FAILURE_CODES` contains exactly the declared ten codes; arbitrary/hostile/non-string markers normalize to `VICT_CAPABILITY_OUTCOME_UNKNOWN`; every allowlisted code round-trips as its own event code; contradictory markers never complete.
- **R7 dispositions:** exactly the six-value set (`completed`, `failed`, `declined`, `cancelled`, `outcome_unknown`, `in_progress`) with the exact mapping; `in_progress` → `nonterminal`; malformed/unsupported → `failed OUTCOME_UNKNOWN`; arrays and exotic-prototype records keep legacy classification; null-prototype records accepted when structurally valid.
- **R8 capture primitives:** `captureControlRecord` total over all hostile shapes; accessor/non-enumerable/symbol fields classified without reading values; `inspectControlField` never reads accessors; `rebuildPlainCapturedObject` delivers trap-free plain rebuilds or refuses.
- **R9 Standard Schema adapter (emitted tool `outputSchema['~standard'].validate`):** `validate` never throws over revoked proxies, throwing `getPrototypeOf`/`ownKeys`/`has` traps, and throwing getters; **only an exact bridge envelope** (single plain own-enumerable-data marker field, allowlisted code or structurally valid replay) bypasses the capability contract; with a value-touching contract, hostile containers are rejected safely inside `validate`.

Probe-expectation notes (audit transparency): R4b's initial expectation ("inherited marker ignored as not-a-replay") was wrong — the implemented and documented behavior is fail-closed `invalid`, which is stronger and correct. R9's initial failure was the probe's own `JSON.stringify` of a verdict that legitimately contained a contract-accepted (per a fully passive contract) hostile value; `validate` itself never threw. Both corrected expectations align with the remediation report and architecture wording.

## 6. Closed-code, envelope validation, and post-invocation durability

Durability probe result: **8/8 PASS**, each hostile scenario exercised over **in-memory AND SQLite** stores (`createInMemoryAgentControlStores` / `createSqliteAgentControlStores`):

- Hostile capability outputs (`has`-trap Proxy; revoked Proxy): raw exception **never** escapes the bridge; the caller receives precisely `{ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' }`; **effect executes exactly once**; durable status = `outcome_unknown` (never `running`, never `completed`); a retry performs **no second effect** and replays the same safe failure; `normalizeCapabilityToolResultEvent` yields `failed` — **no hostile envelope can produce `tool.completed`**; canaries absent from durable rows.
- **Stale fences cannot overwrite:** a later `settleInvocationRun` under a fabricated fence token is refused; status remains `outcome_unknown`.
- **Settlement-store failure:** with `settleInvocationRun` forced to throw, the model still receives the safe outcome-unknown failure; no raw exception; nothing claims success; no second effect on retry.
- **Raw byte scans:** the canary is absent from the SQLite database file **and** any `-wal`/`-shm` bytes.
- Helper containment: hostile helper Proxy output → stable `VICT_HELPER_RESERVED_MARKER_REJECTED`, no raw escape, no canary echo.
- Real pinned Mastra path (real `Agent` loop + offline model + governed bridge + durable ledger), probe M1: hostile output → **zero `tool.completed`**, exactly one honest `tool.failed`, durable `outcome_unknown`, exactly one effect, no canary in ledger rows.

## 7. Mandatory adjudication — non-plain output limitation (**the High defect**)

Supported output domain per public contracts/architecture: capability outputs are validated by author-declared neutral contracts (CONT-001, "any canonical JSON value (null, boolean, finite number, string, array, plain object)"); contracts are the validation authority, so the bridge cannot assume every accepted value is deeply plain. The bridge therefore enforces its own post-invocation arbitration (capture, marker rejection, own-`then` rejection, honesty probes, plain rebuild delivery) — and delivers everything that passes as a normal result after settling durably.

Boundary probes (10/10 PASS) established the correct behavior for: arrays (delivered as-is, completed), null-prototype objects (delivered as trap-free rebuilds, completed), safe class instances (delivered as-is, completed), own **non-callable** `then` (rejected **before** durable completion → `outcome_unknown`, `VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE` durable code), callable thenables (resolved at the capability-author await — capability-author domain, documented), inherited **throwing** `then` getters (contained at the invoke guard → `outcome_unknown` **before** completion — stronger than the report's limitation wording), inherited non-callable `then` (delivered as-is after completed completion; await semantics ignore it), non-marker hostile proxies (captured via descriptors, delivered as trap-free rebuilds, completed), forged reserved markers (fenced `outcome_unknown`, never completed).

**H-1 (High) — a contract-valid output that is unsafe to deliver is settled durably `completed` and then normalizes as `tool.failed` in the real pinned Mastra stream.**

Independent evidence, all through the real pinned Mastra path (real `Agent` loop, offline deterministic model, governed bridge, durable stream ledger) unless stated:

1. **M2 (real path):** capability output `{ saved: true, poisoned: Proxy(get trap → throw) }` — accepted by the capability's own output contract, passes every bridge arbitration check, is settled durably **`completed`** (effect executed exactly once), and the verified-plain rebuild delivers the hostile nested value by reference. The real stream then emits **`tool.failed` with ZERO `tool.completed`** for the occurrence; durable status = `completed`; turn outcome = `completed`.
2. **M5 (real path):** the emitted failure milestone carries code **`VICT_TOOL_FAILED`** while the durable invocation is `completed` with no errorCode. The durable ledger and the model-visible milestone are contradictory: a durably completed invocation normalized as a failure.
3. **M6 (bridge level, effectful):** an approved **`write`** capability returning the same shape executes its effect **exactly once**, settles durably **`completed`**, and delivers the value; `JSON.stringify(delivered)` THROWS (the exact downstream failure M5 shows becomes a `tool.failed` milestone). Delivery is effect-class-agnostic (shared post-invocation path), so an effectful result becomes contradictory: the model is told the write failed when it durably succeeded.
4. **N8 (boundary observation):** same shape at the boundary: durable `completed`; `JSON.stringify(delivered)` THROWS.

This violates the mandatory rule directly, and the acceptance conditions for a limitation are not met: the value is **not rejected before durable completion** (it settles `completed` with stable status and is delivered). The remediation report's limitation #4 claim — "the durable ledger and the model-visible failure stay consistent and truthful" — is disproven by M5/M2. Severity per the charter: at least Medium; **High** because an effectful result becomes contradictory (M6 + shared delivery path).

Remediation direction (non-normative): fail closed BEFORE the fenced `completed` settlement — e.g., bounded-depth capture of plain candidate outputs (nested non-plain/hostile values → fenced `outcome_unknown` with a stable durable code), or deliver only the bounded structural `resultSummary` for any output containing non-JSON-safe values. Any correction must preserve the current one-effect/one-settlement guarantees proven in Section 6.

## 8. Regression preservation

All prior corrections remain intact; no regression evidence was found and Stage 06A was not reopened:

- Affected concurrency/durability suites ran **3× each, exit 0**: `tool-bridge-reliability`, `tool-bridge-ownership`, `tool-bridge.truthfulness`, `tool-state-normalization`, `tool-bridge.faults`, `tool-bridge`, `occurrence-identity-pipeline` (7 files / 50 tests per run) plus `invocation-fencing` (`packages/store-sqlite`, 1 file / 6 tests per run).
- These suites pin: `in_progress` emits no terminal tool event; completed replay emits completion only for confirmed durable completion; first-terminal-wins prevents contradictory milestones; cancelled duplicate leaves the owner untouched; independent-store compositions do not alias liveness; shared-store cross-composition behavior remains as documented; occurrence identity and attempt fencing remain correct.
- Real-path probes M1/M3 confirm truthful terminal normalization and containment through the real pipeline.
- The prior exit-audit Low/informational items (shared-store cross-composition liveness adjudication, cancelled-duplicate open milestone, single-process registry envelope, one child-process suite timeout) were not re-adjudicated (outside this focused re-audit's scope) and remain as historically recorded.

## 9. Lean verification (one pass, exact commands)

| # | Command | Exit | Evidence |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | fresh clone; `allow-scripts` warnings only (pinned esbuild ×2) |
| 2 | `npm run typecheck` | 0 | before build; `dist` count 0 |
| 3 | `npm run format:check` | 0 | Prettier-clean |
| 4 | `npm run lint` | 0 | no errors, no warnings |
| 5 | `npm run build` | 0 | all workspaces |
| 6 | `npm run typecheck` (post-build sanity) | 0 | |
| 7 | `npx vitest run --project mastra` (3 new containment suites) | 0 | 3 files / **45 tests** |
| 8 | independent audit probes (`node`, 4 programs + 3 evidence probes) | as designed | envelope matrix **37/37**; durability **8/8**; non-plain boundary **10/10**; real-path M1 PASS, **M2 DEFECT (H-1)**, M3 PASS; M5/M6 H-1 evidence |
| 9 | affected suites ×3 (`vitest run --project mastra`, 7 files; + `--project unit` fencing) | 0, 0, 0 | 7 files / 50 tests ×3; fencing 1 file / 6 tests ×3 |
| 10 | `npm test` (once) | 0 | 112 files / **2107 tests** passed (the remediation's Windows run had 1 file + 3 tests skipped as POSIX-only; all execute on Linux) |
| 11 | `npm run verify:stage6b` (once) | 0 | **ALL GATES PASSED** |
| 12 | `npm audit --omit=dev` | 0 | found 0 vulnerabilities |
| 13 | `git diff --check` | 0 | no whitespace errors |
| 14 | `git status --short` | clean | 0 entries |

Every command exit was captured; the only non-zero intermediate results were the negative-control probe (expected: defects present at `712752a3`) and probe-expectation corrections during matrix development (Section 5 notes) — all diagnosed as probe artifacts, not product defects.

## 10. Findings by severity

| ID | Severity | Finding |
| --- | --- | --- |
| H-1 | **High** | Durability/result-truthfulness: a contract-valid capability output containing a delivery-hostile nested value is settled durably `completed` (effect executed exactly once) and then normalizes as `tool.failed` (`VICT_TOOL_FAILED`, zero `tool.completed`) in the real pinned Mastra stream; for an approved write capability the delivered value provably fails downstream serialization, making the effectful result contradictory (durable success, model-visible failure). Not rejected before durable completion → not acceptable as a limitation. Evidence: M2, M5, M6, N8 (Section 7). |
| — | Critical | none found |
| — | Medium | none found beyond H-1 |
| — | Low / Informational | none new. Documented limitations #1 (descriptor-invisible `get`-lie proxies for non-marker values — policy boundary; plain containers are delivered as trap-free rebuilds) and #2 (callable thenables resolve at the capability-author await) were re-validated and remain genuine, bounded, and accurately documented. Limitations #3–#5 are superseded by H-1 (delivery-hostile nested values inside plain outputs are NOT contained) or unchanged (#5 prior-exit-audit items). |

## 11. Confirmations

- No API key and no real provider/model was used; all model behavior came from the repository's offline deterministic fixture (`offline-fixture/deterministic-1`).
- No production code, tests, architecture documents, the system reference, or previous reports were modified by this audit; the only artifact is this report file.
- The negative-control worktree at `712752a3` was removed after use; the audit clone was clean at `46a1ab7` before this report's commit; no force-push, rebase, or history rewrite was performed (normal fast-forward only).
- This audit did not perform formal closure and did not begin Stage 07.

## 12. Status

```text
Stage 06 post-audit closure re-audit: NOT VERIFIED — STAGE 07 BLOCKED.
The hostile-envelope remediation is structurally sound and every containment
claim re-verified EXCEPT the delivery boundary for contract-valid but
delivery-hostile non-plain nested values (H-1). A focused correction must
reject such outputs BEFORE durable completion (stable outcome_unknown) or
deliver only the bounded structural summary. Stage 06 formal closure remains
blocked until H-1 is corrected and re-verified.
```
