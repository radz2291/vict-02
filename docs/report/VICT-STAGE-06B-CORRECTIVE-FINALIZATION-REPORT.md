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
The full verification ladder passes, including a genuine clean-clone
regression (`verify:clean-clone`) that proves the required
`npm ci → typecheck → build → verify:stage6b` sequence from a zero-artifact
clone of the committed state.

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
  receipt = (actorId, command, requestDigest, status, resultJson/responseCode,
  timestamps); claim → execute → settle; `claimed` wins once; settled receipts
  are immutable; conflicts are stable and non-echoing.
- **ChangeSet commit**: durable `applying` saga with immutable receipts and
  deterministic recovery (option 2 of the allowed models) — chosen because
  external effects (release publication) cannot participate in a single local
  transaction, and receipts make retry safe and audit truthful.
- **Stream**: at-least-once delivery, `(streamId, seq)` dedupe, ledger-assigned
  monotonic sequences, frozen/copy discipline, lossless ordered replay,
  drain-driven pump, headers (not events) for replay status.
- **Retention**: operational surfaces keep metadata and content REFERENCES
  only; full conversation content is confined to the actor-authorized
  conversation domain under its retention/deletion/export policy.
- **Tool-bridge recovery**: fenced-only error tolerance; `outcome_unknown`
  after effect-before-persistence failure; deterministic identities; canonical
  digests; idempotency key propagation.

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

## 6. Exact verification evidence (this machine: Windows, Node v22.x)

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 (0 TS errors; server/cli/control dist produced) |
| `npm run test:unit` | exit 0 — 82 files / 1778 tests; 5 consecutive clean runs |
| `npm run test:integration` | exit 0 — 4 tests |
| `npm test` (full) | exit 0 — 98 files (97 passed, 1 POSIX-only skipped on Windows), 1969 passed + 3 skipped; 3 consecutive clean runs |
| `npm run verify:consumer` | exit 0 (isolated packed consumer) |
| `npm run verify:stage2` … `verify:stage6a` | exit 0 each |
| `npm run verify:stage6b` | exit 0 — ALL 28 GATES PASSED (after two earlier failing runs were diagnosed and fixed: Windows `spawnSync` of npm shims, and a TEST-side race reading the SIGKILL effects log before worker exit — production code unchanged for the latter) |
| Stage 06B targeted suites ×5 | exit 0 ×5 — 17 files / 195 tests per run |
| `npm run example` / `bench` / `example:application` | exit 0 / 0 / 0 (13 events; 10 events/run; 13 events) |
| `npm audit --omit=dev` | exit 0 — found 0 vulnerabilities |
| `git diff --check` | exit 0 — no whitespace errors |
| `npm run lint` | exit 1 — ONLY the 2 pre-existing owner-file errors in `.pi/skills/mastra/scripts/provider-registry.mjs` (byte-identical to `7ba8cb8`; owner file untouched by policy) |
| `npm run format:check` | exit 0 |

One transient failure occurred in one early `test:unit` run (1 failed /
1777 passed) whose per-test output was not captured; the identical suite then
passed 4 full-suite runs + 5 unit runs in a row. The subsequently identified
cause is the F7 SIGKILL test-side race documented above (reproduced,
instrumented, root-caused via worker-phase tracing, fixed, and re-verified
with 12 consecutive clean dedicated runs); no production defect was involved.

## 7. Fresh-clone and packed-consumer evidence

- `npm run verify:clean-clone` clones the COMMITTED repository state into a
  temp dir, asserts zero artifacts (no `dist`, no `node_modules`), then runs
  `npm ci` → `npm run typecheck` (before any build) → `npm run build` →
  `npm run verify:stage6b`. At `7ba8cb8` this sequence failed exactly as the
  F1 probes predicted; on the corrected committed tree (`8d8c46a`) it PASSED
  in full (exit 0, all gates: clone, zero-artifact, ci, typecheck-before-build,
  build, verify:stage6b).
- `verify:consumer` proves a packed external consumer resolves the built
  package graph; `verify:stage6b` additionally asserts server/cli/control
  dist artifacts exist after build.

## 8. Remaining genuine limitations

- This is an implementer claim. The fresh independent Stage 06 audit has NOT
  run; the full Stage 06 exit gate is open; Stage 07 remains blocked.
- The authoritative ladder environment is Linux x86_64 with Node ≥ 22.13
  (Node 24 preferred where available); this run executed on Windows with
  Node 22.x. The POSIX-only permissions suite is skipped on Windows by design
  and must execute on Linux in the independent audit.
- The two pre-existing owner-file lint errors in `.pi/` are preserved
  untouched (owner files are outside this stage's scope).
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