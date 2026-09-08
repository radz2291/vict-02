# VICT Stage 06B — Corrective Finalization Report

Status: implementer corrective-finalization claim, awaiting fresh comprehensive
independent Stage 06 audit (NOT independently verified; no Stage 06 requirement
row is promoted to Verified; Stage 06 remains In Progress; Stage 07 remains
blocked).

- Starting SHA: `7ba8cb897388b91041eaea6a03084db5e7ffcb95` (confirmed equal to
  `origin/main` before work began; the Stage 06A closure commit `b491ede`
  remains in ancestry; no history rewrite, no force-push).
- Parent implementation claim: `docs/report/VICT-STAGE-06B-REPORT.md`
  (preserved byte-for-byte; superseded in content, not modified).
- Defect-probe evidence at the starting SHA:
  `docs/report/evidence/probe-06b-defects-at-7ba8cb8.log`.
- SECOND-PASS defect evidence at `27cc57df7b6dae9f207cdac6ca29b5d9da9bef87`
  (the previously pushed corrective-finalization HEAD): a fresh independent
  defect reproduction round found and fixed TWELVE further defect areas
  (P1–P12) that survived the first pass; full probe output preserved at
  `docs/report/evidence/probe-06b-final-defects-at-27cc57d.log`.
  P10 (tracked executable mode) was REPRODUCED ON LINUX (Node 24): `npm ci`
  chmods `packages/cli/bin/vict.mjs` `100644 → 100755` and dirties the tree
  (negative control at `a87a37b`); the fix tracks the mode (`d40f417`) and
  the tree stays byte-clean through `npm ci → build → verify`.

This report documents the independent reproduction of the Stage 06B defects at
the starting SHA and the corrections applied on top of the implementer claim.
Implementation and documentation SHAs: `ffadb7f` (build integrity),
`db92a8d` (contracts/runtime), `62ec397` (SQLite), `18bd631` (control),
`1523de7` (Mastra bridge), `a1b8dd8` (server/CLI), `8d8c46a` (docs) — pushed
to `origin/main` as a single fast-forward `7ba8cb8..8d8c46a`. It is an
implementer claim only: every statement below is falsifiable by the
fresh independent audit, which remains the authoritative gate.

## 1. Outcome

All eleven Stage 06B defect areas were reproduced at the starting SHA with
deterministic probes (19 probe assertions, all failing as predicted against
`7ba8cb8`; full output preserved in the evidence log) and corrected in place.
A SECOND independent defect-reproduction round against the corrected HEAD
(`27cc57df`) found and fixed twelve further defect areas (P1–P12 below). The
full verification ladder passes, including a genuine clean-clone regression
(`verify:clean-clone`) that proves the required
`npm ci → typecheck → build → verify:stage6b` sequence from a zero-artifact
clone of the committed state — and now also proves that build and verification
leave NO tracked changes, generated artifacts, or altered executable modes.

## 2. Root cause and correction per finding

| # | Finding (root cause at `7ba8cb8`) | Correction |
| --- | --- | --- |
| F1 | Zero-artifact checkout failed typecheck: the root `tsconfig.json` had no project/path resolution for `@vict/control`, `@vict/server`, `@vict/cli`, and the root build skipped those workspaces | Root tsconfig paths/projects added for all three; root build includes every production workspace in dependency order; `verify:stage6b` now builds what it consumes (typecheck before AND after build); new `verify:clean-clone` regression proves the exact required sequence from a fresh clone |
| F2 | Authorization enforced only in HTTP route handlers; `activation.select` attributed a synthetic `system` actor; `stream.inspect`/`changeset.get`/`list` unscoped; SSE public without turn ownership | Authorization matrix enforced in the shared command dispatcher BELOW the transport (`COMMAND_SCOPES`); `activation.select` attributes the authenticated actor; reads actor-scoped; SSE subscription/replay requires a valid turn owned by the actor (or privileged scope) and answers 404/403 otherwise; permanent 36-case matrix over real HTTP (no-scope / wrong-scope / correct-scope / cross-actor / privileged) |
| F3 | HTTP `Idempotency-Key` reached the envelope but never governed execution | New durable `CommandIdempotencyStore` port (in-memory + SQLite `vict_command_idempotency`); receipts bound to (actor, command, canonical request digest); replay returns the original result without repeating effects; same key + different digest/command → stable conflict; in-progress duplicates → structured in-progress code; survives close/reopen and restart; one winner under concurrency; applied to every state-changing command incl. `agent.turn.start` (retries never create multiple turns); CLI derives durable keys for POSTs |
| F4 | ChangeSet validation/simulation evidence accepted from caller-supplied objects claiming success | Evidence is attached only as a reference to a durable control run executed by the trusted boundary (`executeChangeSetCheck`, runner profile `vict.control-plane@1`); outcome/run identity/content hash/base identity/timestamps are derived from the stored run; fabricating `passed`/`runId`/timestamps is impossible; risk-policy gating (low → validation; medium/high → validation AND simulation); negative controls prove fabricated and replayed evidence cannot authorize commit |
| F5 | Partial application left a falsely-final `approved` state with half-applied external effects | Durable `applying` saga: prevalidate the complete operation set → CAS `approved → applying` (exactly one winner) → immutable per-operation receipts (`vict_changeset_operation_receipt`) → CAS `applying → committed`; deterministic recovery (`recoverChangeSetCommits`) replays from receipts without repeating applied effects; no failure leaves a falsely final state; publication+selection is ONE `publish-and-select-release` operation; audit agrees with committed state |
| F6 | `vict.agent-stream@1` mismatch: server emitted `schema` which the validator rejected; undeclared `replay.bounded` frames; validator not exported; JS callers could write invalid events | One closed exported wire-envelope validator (`validateAgentStreamWireEnvelope`/`assertAgentStreamWireEnvelope`); the accepted `schema` marker is stripped then validated; `replay.bounded` removed — replay status exposed via defined response headers (`x-vict-replay-bounded`, `x-vict-stream-newest-seq`, `x-vict-stream-cursor`); correlation IDs (`activationVersion`, `mastraRunId`, `victInvocationId`, `victAttemptId`) added; `content.completed` carries `contentRef` (never full text); runtime validation on the durable write path (including plain-JS callers); declarations remain neutral/complete for packed consumers; NO `@2` marker — v1 finalized in place |
| F7 | Hub mutated event objects shared between subscriber queues and the replay buffer; replay discarded under backpressure; cursor lacked stream identity; `close()` did not await; `port()` returned 0 | Stored events frozen, per-subscriber copies; coalescing only on private pending copies; replay written BEFORE live subscription anchored at the cursor and delivered in order — `write() === false` awaits `drain` (nothing discarded); closed cursor format `v1:<streamId>:<seq>` (cross-stream → 403, malformed → 400, future → 409); `close()` awaits actual shutdown and terminates open SSE; `port()` returns the real bound port; terminal events close the stream; real-socket forced-backpressure test proves 203/203 ordered delivery under zero-window conditions |
| F8 | Operational records retained raw prompt prefixes, serialized tool arguments, and full assistant content | Prompt summaries are metadata-only (`user-input:length=N`); argument summaries are shape-only (no values, key names, or credential names); full assistant content lives only in the actor-authorized conversation domain; stream milestones carry `contentRef`; approval `reason` retained only in the approval record; true end-to-end canary (HTTP → offline Mastra model → tool bridge → capability → SQLite → SSE) with planted canaries in prompt text, model output, argument keys/values, capability error + nested cause, credential name/value, approval metadata — all scans clean; intentionally authorized surfaces explicitly identified (conversation domain record; approval record's own reason; live user-visible output) |
| F9 | Tool bridge swallowed ALL store errors; terminal-persistence failure after an effect reported normal completion; tool-call identity used the clock; digests used insertion-order `JSON.stringify` | Only explicitly recognized stale/fenced/idempotent outcomes are tolerated; any other store error propagates; effect-then-persistence-failure enters the truthful `outcome_unknown` state; tool-call identity is deterministic from durable turn context + per-turn ordinal (never the clock); digests computed over canonical JSON (key-order invariant; unsupported values rejected, not coerced); the durable idempotency key is propagated into the capability invocation context for external dedupe; milestones awaited/ordered/exactly-once (`VICT_TURN_STREAM_PERSISTENCE_FAILED` on loss); fault injection around every bridge phase |
| F10 | Server wire: unknown payload fields silently coerced to `{}`; loose content-type parsing; raw exceptions echoed | Closed per-command payload field sets; unknown fields and non-object payloads rejected (`VICT_COMMAND_PAYLOAD_INVALID`); exact JSON content-type parsing (415 otherwise); malformed input can never produce a raw exception or echo hostile values; `changeset.execute-check` command added; disconnects, aborted bodies, duplicate requests, and shutdown-with-open-SSE covered |
| F11 | `verify:stage6b` depended on manual build artifacts and did not gate the new suites | Self-contained verifier (typecheck + build first); gates the authorization matrix, durable idempotency, authoritative evidence, commit saga, wire schema, replay/backpressure, canaries, tool-bridge faults, SIGKILL recovery, fresh-process CLI lifecycle, packed consumers, and Stage 06A carry-forwards (28 gates); `verify:clean-clone` added |

## 2b. SECOND-PASS findings (root cause at the first-pass HEAD `27cc57df`) and corrections

A fresh defect-reproduction round against the corrected HEAD found twelve
further defect areas that survived the first pass. Every probe assertion
below FAILS at `27cc57df` (evidence log preserved) and PASSES after this
correction round:

| # | Finding (root cause at `27cc57df`) | Correction |
| --- | --- | --- |
| P1 | Hub restart-gap detection only counted the in-memory transient buffer, so after a process restart the empty buffer produced a FALSE `complete` replay status: a reconnecting client was told it missed nothing while a durable-sequence gap existed | `replayStatus`/`replay` now detect gaps against the AUTHORITATIVE durable ledger high-watermark (bounded paged coverage count, not the buffer); `olderThanBuffer` is only reported when the durable rows genuinely cannot cover the cursor; restart with an empty buffer is restart-safe |
| P2 | Hub replay delivered FROZEN shared rows directly and the transport mutated the coalesced copy (`TypeError: Cannot assign to read only property`) | Replay and delivery paths hand out isolated copies; all coalescing writes target private copies; frozen stored rows are never mutated (deep-clone discipline pinned by conformance) |
| P3 | A subscriber attached before a terminal event never received it when the live-delivery path was saturated (the pending drain pump dropped terminal events) | Register-first subscription + ordered pending queue + drain pump deliver the terminal after everything before it; terminal close happens only after all prior frames are written; pinned by real-socket tests |
| P4 | SSE frames emitted `id: 1` — a bare sequence that the reconnect parser could not decode, so browser automatic `Last-Event-ID` replay was impossible | SSE `id:` is the full closed cursor `v1:<streamId>:<seq>`; the reconnect parser accepts the SAME format round-trip (automatic browser reconnect proven over real HTTP) |
| P5 | The ChangeSet commit saga recorded receipts only AFTER each effect (dual-write): a crash between effect and receipt made recovery repeat the effect or left receipts absent while effects existed | TWO-STATE operation protocol: a durable PREPARED intent (identity + guard) commits BEFORE the fenced effect; the effect is executed AT MOST ONCE under the operation identity (idempotency key); the APPLIED receipt settles it. Recovery VERIFIES target state through the identity instead of re-running effects; conflicting content under the same identity fails closed |
| P6 | Two concurrent commits could both pass the `expectedVersion: none` check and BOTH publish+select (no subject-level CAS on the base) | Subject-level base CAS in BOTH adapters: the selection insert is fenced on the expected base revision (`VICT_CONTROL_RELEASE_BASE_CHANGED` stable conflict, no effect); exactly one winner under concurrency (in-memory, SQLite, and cross-process) |
| P7 | The durable stream ledger accepted ANY payload from runtime/JS callers: unknown kinds, non-canonical JSON, raw text in `content.completed`, malformed identities — hostile bytes reached SQLite | One exported validation gate (`validateStreamLedgerAppend`) enforced INSIDE both ledger adapters (in-memory + SQLite) on EVERY durable append and on every read-side reconstruction: kind must be in the closed vocabulary and match the payload `kind`; payload must be canonical JSON; unknown fields rejected; raw content rejected (`contentRef` only); malformed correlation IDs rejected; a rejected write mutates NO sequence state and persists NO bytes |
| P8a | `isMutationCommand` missed `changeset.execute-check` and `app.data.action`: mutating commands ran without idempotency receipts | One closed command registry (scope + closed fields + mutation classification together); both commands are mutations with receipts; the registry is the single source of truth |
| P8b | The idempotency receipt stored the FULL command result (the whole ChangeSet response, including the rationale secret) in `result_json` | Safe per-command result PROJECTIONS only (identity fields; never payloads); a replayed result is re-derived from the authoritative domain under the CURRENT actor's authorization; canary scans prove no payload-derived content reaches receipts |
| P9 | A crash between claim and settlement left a `pending` receipt WITHOUT a lease: every retry answered `IN_PROGRESS` forever — the key was permanently stuck | Durable leases: `pending` receipts carry owner + expiry + attempts; an EXPIRED lease is taken over by a retrying caller (attempt counter incremented); a LIVE lease answers the in-progress conflict; RETRYABLE infrastructure failures RELEASE the claim (never confused with deterministic failures, which settle `failed` and replay) |
| P10 | Build/verification altered tracked executable modes on Linux: `npm ci` chmods the workspace bin `packages/cli/bin/vict.mjs` `100644 → 100755` (REPRODUCED on Linux/Node 24 — the tree went dirty after `npm ci`) | The bin is tracked as executable (`100755`), so npm's linking chmod becomes a no-op; `verify:clean-clone` now gates git-status cleanliness AND `ls-files -s` mode stability after build and after verification |
| P11 | The tool-bridge fallback tool-call identity derived from the CURRENT recorded-intent count, which drifts after a restart (same model call → NEW logical identity) | Documented deterministic identity from DURABLE turn context + durable ordinal (never current time, never a process counter); the framework `toolCallId` is used when the framework provides one; missing/malformed identity never produces a drifting identity |
| P12a | Hostile payloads with GETTER-THROWING properties escaped the dispatcher as raw exceptions (`TypeError: hostile getter fired`) before any stable code | The dispatcher validates the envelope through the closed canonical plain-data validator FIRST: non-plain payloads (getters/proxies/traps/symbol fields) produce ONE stable, non-echoing rejection for BOTH the digest and the execution — a raw exception can no longer escape |
| P12b | Unknown top-level body fields were accepted (HTTP 200, `ok: true`) — the envelope was not schema-closed | Full envelope validation: unknown top-level fields, non-object bodies, and malformed content types are rejected with stable codes before any effect |

Additionally corrected in this pass (found by inspection, verified by
conformance): ledger reads are validated at the store boundary too;
`listEventsFrom` gained bounded paging; stream-hub registration buffers the
backlog EXACTLY (per-event identity, no coalescing during registration — a
reconnecting client receives every event exactly once) and `pull()` cannot
steal events during the registration phase; an expired RUNNING tool attempt
reconciles to a fenced non-replay state before any retry; the SQLite adapter
persists and returns `operation_id` on release selections.

## 3. Decisions

- **Authorization matrix** (below-transport, closed scope vocabulary):
  `health.inspect`, `compatibility.inspect`, `actor.whoami` → authenticated
  any; `changeset.get/list`, `agent.turn.get`, `stream.inspect`, reads →
  actor-scoped (owner or explicit privilege); mutations
  (`changeset.propose/revise/attach-evidence/execute-check/commit`,
  `release.publish/select/rollback`, `activation.select`, `run.cancel`,
  `agent.turn.start/cancel`, `app.data.*`) → `developer`+; approvals
  (`agent.tool.approve/decline`, `changeset.decide`) → `approver`+ (never
  self); cross-actor access fails closed (403/404, never leak-by-listing).
- **Idempotency model**: closed key format (1..128 bounded charset);
  receipts are NAMESPACED by (actor, command, key) and bound to the canonical
  request digest; the same actor reusing one key across DIFFERENT commands is
  a stable conflict (cross-command lookup); a different actor's client-generated
  key is an independent namespace; claim → execute → settle; `pending` claims
  carry durable leases (owner + expiry + attempts) with takeover after expiry;
  settled receipts are immutable; deterministic failures settle `failed` and
  replay; retryable infrastructure failures release the claim; conflicts are
  stable and non-echoing.
- **ChangeSet commit**: durable `applying` saga with the TWO-STATE operation
  protocol and deterministic recovery (option 2 of the allowed models) —
  chosen because external effects (release publication) cannot participate in
  a single local transaction, and a durable PREPARED intent + fenced effect +
  APPLIED receipt make retry safe, recovery verifiable, and audit truthful.
  Publication+selection is ONE `publish-and-select-release` operation;
  selection effects are fenced on the operation identity AND on the
  subject-level base revision (subject-level CAS, exactly one concurrent
  winner).
- **Stream**: at-least-once delivery, `(streamId, seq)` dedupe, ledger-assigned
  monotonic sequences, frozen/copy discipline, lossless ordered replay,
  drain-driven pump, headers (not events) for replay status.
- **Retention**: operational surfaces keep metadata and content REFERENCES
  only; full conversation content is confined to the actor-authorized
  conversation domain under its retention/deletion/export policy.
- **Tool-bridge recovery**: fenced-only error tolerance; `outcome_unknown`
  after effect-before-persistence failure; expired RUNNING attempts reconcile
  to a fenced non-replay state before any retry; documented deterministic
  identities (durable turn context + durable ordinal); canonical digests;
  idempotency key propagation.
- **Tool-call identity fallback** (documented): when the Mastra invocation
  path provides no framework `toolCallId` (measured in this composition), the
  identity is `${turnId}-t<ordinal+1>` with the ordinal read from the DURABLE
  invocation store — never current time, never a process counter; a hostile
  turn id falls back to a bounded hash of the turn id.

## 4. Negative controls (all pass on corrected tree; fail on starting SHA)

1. 19-probe defect reproduction at `7ba8cb8` (evidence log retained).
2. Fabricated evidence cannot authorize a commit; replayed evidence cannot
   authorize a second commit (control-plane suite).
3. Two-operation ChangeSet: operation 1 succeeds, operation 2 fails → state
   remains `applying` (never falsely final); recovery completes without
   repeating operation 1 (receipt-driven).
4. Concurrent commits: exactly one winner (CAS); loser receives a structured
   conflict.
5. Idempotent replay: same key+digest returns the original result with NO new
   effects (in-memory AND SQLite across close/reopen AND real HTTP);
   conflicting digest → stable conflict; missing/invalid key → stable codes.
6. Authorization matrix: 36 cases — no-scope, wrong-scope, correct-scope,
   cross-actor, privileged, dispatcher-level (below transport).
7. SSE: foreign cursor → 403; malformed cursor → 400; future cursor → 409;
   no turn ownership → 404; real-socket forced backpressure → 203/203 in
   order; terminal-event close for a subscriber attached pre-terminal.
8. Tool-bridge fault injection: store failures propagate except
   fenced/stale/idempotent outcomes; effect+lost-persistence →
   `outcome_unknown` (never normal completion); late tool completion after
   cancellation is fenced without claiming reversal.
9. End-to-end canary: 6 canary classes absent from HTTP errors, SSE metadata,
   operational rows, and raw SQLite DB/WAL/SHM bytes.
10. SIGKILL recovery: pending approval survives; decide over real HTTP; crash
    before resume; effect EXACTLY once on retry; replayed invocation skipped;
    truthful terminal state (3 child-process fixtures).

SECOND-PASS negative controls (at `27cc57df` / `a87a37b`):
11. Ledger store-boundary: hostile direct writes (unknown kind, kind/payload
    mismatch, non-canonical JSON, raw text milestone, malformed identity)
    rejected by BOTH adapters with NO sequence mutation and NO secret bytes
    in the SQLite database (probe P7 in the evidence log).
12. Two concurrent commits on one base: BOTH fulfilled and BOTH selections
    applied at `27cc57df` (P6); after correction exactly one winner and the
    loser receives `VICT_CONTROL_RELEASE_BASE_CHANGED` with no effect.
13. Idempotency: crashed `pending` receipt left the key permanently stuck
    (P9); after correction an expired lease is taken over, a live lease is
    protected, retryable failures release.
14. Mutation classification: `changeset.execute-check`/`app.data.action`
    unclassified (P8a) and full payloads in receipts (P8b); after correction
    both classified, projections only.
15. P10 mode drift: negative control at `a87a37b` (tree dirty after
    `npm ci`), fixed at `d40f417` (tree clean through the whole ladder).

## 5. Files changed

Production: root `package.json` + `tsconfig.json`; `@vict/contracts`
(agent-stream schema + wire-envelope validator); `@vict/runtime` (control
ports, in-memory stores, conformance suite, stream hub); `@vict/store-sqlite`
(migration 6 + adapter methods); `@vict/control` (control plane, agent turns);
`@vict/mastra` (tool bridge, turn executor, adapter); `@vict/server` (http,
commands); `@vict/cli` (client, commands).
Tests: new `authorization-matrix` (36), `idempotency` (8+), `e2e-canary` (1),
`tool-bridge.faults` (6); extended `sse` (13), `http` (11), `control-plane`
(16), schema (29), migrations, conformance (runtime + SQLite, 31 incl.
close/reopen + new ports), `restart-sigkill`, `cli`, `canary`.
Scripts: `scripts/verify-stage6b.mjs` (rewritten, self-contained),
`scripts/verify-clean-clone.mjs` (new). Temporary probe scripts were removed
from the tree after evidence capture (the evidence log remains).
Docs: this report; `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md`
(corrected behavior; historical reports untouched);
`docs/VICT-SYSTEM-REFERENCE.md` document index entry only.

## 6. Exact verification evidence

### 6a. Windows dev machine (Node v22.13.1, win32)

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 (before build AND after build) |
| `npm run format:check` / `npm run lint` | exit 0 / exit 0 (`.pi/` owner-local tooling excluded from lint scoping; the owner file itself is untouched) |
| `npm run build` | exit 0 (0 TS errors; server/cli/control dist produced) |
| `npm run test:unit` | exit 0 — 82 files / 1786 tests (final second-pass state) |
| `npm run test:integration` | exit 0 — 4 tests |
| `npm test` (full) | exit 0 — 98 files, 1978 passed + 3 skipped (POSIX-only suite skipped on Windows) |
| `npm run verify:consumer` | exit 0 (isolated packed consumer) |
| `npm run verify:stage2` … `verify:stage6a` | exit 0 each |
| `npm run verify:stage6b` | exit 0 — ALL GATES PASSED |
| Stage 06B targeted suites ×5 | exit 0 ×5 — 198 tests per run |
| Concurrency/restart/fault-injection suites ×3 | exit 0 ×3 |
| `npm run example` / `bench` / `example:application` | exit 0 / 0 / 0 (13 events; 10 events/run; 13 events) |
| `npm audit --omit=dev` | exit 0 — found 0 vulnerabilities |
| `git diff --check` | exit 0 — no whitespace errors |
| `npm run verify:clean-clone` | exit 0 — 38 gates (incl. artifact + mode stability) |

One transient failure occurred in one early `test:unit` run (1 failed /
1777 passed) whose per-test output was not captured; the identical suite then
passed 4 full-suite runs + 5 unit runs in a row. The subsequently identified
cause is the F7 SIGKILL test-side race documented above (reproduced,
instrumented, root-caused via worker-phase tracing, fixed, and re-verified
with 12 consecutive clean dedicated runs); no production defect was involved.

## 6b. Linux authoritative run (WSL2 Ubuntu 24.04, x86_64, Node v24.19.0)

The full ladder was executed on a clean clone of the COMMITTED tree (git
clone of the Windows repository into the Linux filesystem), from `npm ci`
with zero artifacts, at the final implementation commit:

| Command | Result |
| --- | --- |
| `npm ci` | exit 0 |
| `npm run typecheck` (zero artifacts, before any build) | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `npm run typecheck` (after build) | exit 0 |
| `npm run test:unit` | exit 0 — 82 files / 1786 tests (12+ consecutive clean dedicated runs) |
| `npm run test:integration` | exit 0 — 4 tests |
| `npm test` (full, FINAL STATE) | exit 0 — 98 files / 1981 tests (the POSIX permissions suite EXECUTES on Linux; not skipped) |
| `npm run verify:consumer` | exit 0 |
| `npm run verify:stage2..stage4, stage6a` | exit 0 each |
| `npm run verify:stage5` | exit 0 (headless Chrome-for-Testing provisioned via `VICT_BROWSER_PATH`; the first run failed ONLY because no browser was installed in that environment — a documented environment dependency of the reference-app browser scenario) |
| `npm run verify:stage6b` (final state) | exit 0 — ALL GATES PASSED |
| Targeted deterministic suites ×1 (final state) | exit 0 — 195 tests |
| Concurrency/restart/fault-injection suites ×3 (final state) | exit 0 ×3 |
| `npm run example` / `bench` / `example:application` | exit 0 / 0 / 0 |
| `npm audit --omit=dev` | exit 0 — found 0 vulnerabilities (two earlier runs failed with `audit endpoint returned an error` — a TRANSIENT WSL network failure reaching the audit endpoint BEFORE any vulnerability evaluation; the subsequent identical run passed) |
| `git diff --check` | exit 0 |
| `git status --short` (after the FULL ladder) | EMPTY — no tracked changes, no generated artifacts, no mode drift (P10 fixed) |
| `npm run verify:clean-clone` (Linux) | exit 0 — 38 gates |
| `npm test` full ×3 (pre-final intermediate state `a87a37b`) | exit 0, 0, 1 — the third run's single failure was HIGH-3 (orchestration remediation, real-time polling suite) exceeding vitest's 5s default under full-suite worker load; CORRECTED at `3546aba` (explicit 20s harness budget; assertion content unchanged; the same test failed identically at the Windows baseline BEFORE this correction round, and passed 4/4 dedicated Linux runs) |

Diagnostic note (preserved per the no-silent-rerun rule): the ONE
un-reproduced `test:unit` failure on the very first Linux run (1 failed /
1785 passed) — its per-test output was lost because the WSL VM restarted
between sessions and `/tmp` is volatile; the identical suite then passed
22+ consecutive dedicated Linux runs and every subsequent full-suite run.
It is recorded as an unreproduced single occurrence, NOT dismissed as
environmental without evidence; the fresh independent audit should observe
the suites directly.

## 7. Fresh-clone and packed-consumer evidence

- `npm run verify:clean-clone` clones the COMMITTED repository state into a
  temp dir, asserts zero artifacts (no `dist`, no `node_modules`), then runs
  `npm ci` → `npm run typecheck` (before any build) → `npm run build` →
  git-cleanliness checks → `npm run verify:stage6b` → git-cleanliness +
  executable-mode-stability checks. At `7ba8cb8` this sequence failed exactly
  as the F1 probes predicted; on the corrected committed tree it PASSED in
  full on BOTH Windows (Node 22) and Linux (Node 24) — 38 gates, exit 0.
- P10 negative control on Linux: at `a87a37b` (pre-fix) `npm ci` left the
  tree DIRTY (packages/cli/bin/vict.mjs, mode 100644 → 100755); at the fix
  `d40f417` the identical sequence leaves the tree byte-clean.
- `verify:consumer` proves a packed external consumer resolves the built
  package graph; `verify:stage6b` additionally asserts server/cli/control
  dist artifacts exist after build.

## 8. Remaining genuine limitations

- This is an implementer claim. The fresh independent Stage 06 audit has NOT
  run; the full Stage 06 exit gate is open; Stage 07 remains blocked.
- The authoritative ladder ran on BOTH Windows (Node 22.13.1) AND Linux
  x86_64 (WSL2 Ubuntu 24.04, Node v24.19.0), including the POSIX-only
  permissions suite (executes on Linux only).
- The stage5 reference-app browser scenario requires a Chrome/Edge
  executable; in the WSL environment it was provisioned through
  `VICT_BROWSER_PATH` (Chrome-for-Testing headless shell). This is a
  documented environment dependency of that example, not a product defect.
- The `.pi/` owner-local directory is preserved untouched and excluded from
  lint scoping only (no delivered code, not committed).
- The deterministic local test authenticator is not a production identity
  provider; the single-process, local-first envelope is unchanged; no real
  model provider, no real LLM API key, no WebSocket/WebRTC transport.
- Recovery is rule-based over durable records (no cross-store atomic
  transaction is claimed).
- CLI transport is the versioned HTTP surface; no interactive Studio.

## 9. Independent-audit readiness

The corrective finalization is complete on the committed tree: clean-clone
sequence proven, all gates green, negative controls in place, evidence
preserved. The repository is ready for the fresh comprehensive independent
Stage 06 audit, which remains the sole authority for promoting any Stage 06
requirement to Verified.

Stage 06B corrective finalization is complete and ready for a fresh
comprehensive independent Stage 06 audit.