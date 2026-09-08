# VICT Stage 06B Implementation Report

Implementer: autonomous implementation increment (Stage 06B).
Authority: `docs/VICT-SYSTEM-REFERENCE.md` v0.3.3. This is an
implementation claim — it is NOT an independent audit, and no Stage 06B
requirement is promoted to Verified.

## Outcome

Stage 06B — control plane and governed remote execution — is implemented,
fully tested, and gated by a meaningful aggregate exit gate
(`verify:stage6b`, all gates passed). The two Stage 06A carry-forwards
were closed first. The complete verification ladder passes on this
machine (see Verification evidence). One previously "environmental"
failure became a real finding under the ladder: the migration
teardown-test flake was masking a legitimately stale assertion (the
fail-closed table list did not include the migration-5 tables); both the
cleanup helper and the stale assertion were fixed, and the full suite is
now green (1893 passed / 0 failed / 3 skipped).

## Starting and final SHAs

- Required starting commit: `b491ededed32a796aa035befe77946e8b107338b`
  (equals `origin/main` at start; ancestry `1ac9c18`, `c1a6a57`, `8a554cb`,
  `b491ede` confirmed).
- Implementation commits (in order): `c85212f` (LOW-06A-1/2 closures),
  `68e11ae` (neutral ports, agent-stream@1 schema, SQLite adapters),
  `d0cf77a` (control plane + actor boundary), `009def8` (chore: test id
  typing), `29655b8` (governed Mastra tool bridge + turn executor),
  `c2e8cf0` (server boundary: HTTP commands, SSE, auth composition,
  remote app data), `14892a4` (chore: verifier formatting, lockfile),
  `8327183` (CLI + route path-param injection + stable 404 mapping),
  `26d7a87` (SIGKILL fixtures + canary matrix), `430b2cb`
  (verify:stage6b), final ladder-hardening commit (conformance-runner
  seam, lint, retry-rm bounding, migration-table assertion, docs).
- Final SHA: recorded at push time (fast-forward only).

## Architecture delivered

See `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` for
the full contract record: final `vict.agent-stream@1` schema (OPEN-015
decided), ChangeSet/approval state machines, actor trust boundary,
HTTP/SSE contracts, tool-bridge execution order, cancellation/reconciliation
semantics, data ownership/retention, compatibility decisions.

## Package and dependency graph

```text
@vict/contracts (neutral; agent-stream@1)
  └─ @vict/sdk ─ @vict/kernel ─ @vict/runtime (ports, hub, in-memory)
        ├─ @vict/store-sqlite (durable adapters; migration 5)
        ├─ @vict/control (services; neutral, transport-free)
        ├─ @vict/mastra (pinned @mastra/core 1.64.0, memory 1.28.2,
        │                libsql 1.22.3, observability 1.17.5)
        └─ @vict/server (composes runtime+control+application contracts)
             └─ @vict/cli (typed commands over the HTTP surface only)
```

Verified properties: acyclic; no neutral package imports Mastra, SQLite,
or the server; server is agent-framework-free and provider-free; CLI has
no store access; `@vict/client` was not needed (the CLI consumes the
HTTP surface directly through a thin typed client with a stable tested
contract inside `@vict/cli`).

## Stage 06A carry-forward closure

- **LOW-06A-1**: SQLite receipt-step rejection now validates at the
  boundary (`assertDeletionReceiptStep`) with the same stable,
  non-echoing error as the in-memory adapter; invalid input mutates
  nothing; duplicate-valid receipts stay idempotent (including
  concurrent); close/reopen parity proven; shared conformance tests for
  both adapters plus plain-JS invalid input. Commit `c85212f`.
- **LOW-06A-2**: `verify:stage6a` directly gates the driver-cause suite,
  migration regression tests, and the governance receipt/migration
  suites. Commit `c85212f`; later evolved legitimately for Stage 06B
  (declared `@vict/control` dependency, Mastra-freedom pattern match that
  tolerates neutral correlation identifiers, packed `@vict/control` in
  the adapter consumer).

## Control-plane model

ChangeSets (`vict.changeset@1`): forward-only
draft→approved→committed, with declined/expired terminal states; exact
expected base; closed typed operations (`select-activation`,
`rollback-activation`, `publish-and-select-release`, `select-release`,
`rollback-release`); rationale; validation/simulation evidence; risk
class; required approver count; expiry; immutable `contentHash`.
Stale-base proposals fail without mutation; revision invalidates evidence
and approvals; approval binds the exact content hash; commit is
idempotent with one-winner competing semantics; rollback selects a prior
immutable version without rewriting history or repinning in-flight runs.
Application Releases are immutable with select/rollback selection
records; activation selection is audited; every transition is
attributable and evented. In-memory and SQLite adapters pass the same
conformance suite (23 tests) including close/reopen.

## Actor and authorization boundary

Authentication (deterministic local test authenticator) and
authorization (scope assertions below transport) are distinct. The
authoritative context derives actor, roles, scopes, and the Mastra
`resourceId` (`vict-actor-<actorId>`) server-side; client-supplied
identity/authority is never trusted; unknown/disabled/malformed fail
closed; default policy is denial (`ROLE_SCOPES`; administrator is a
superset). Spoofing, cross-actor reads, cross-actor approval/cancel, and
credential echoes are adversarially tested.

## HTTP command surface

`vict.command@1` over real `node:http`: closed command list (health,
compatibility, whoami, changeset lifecycle, release/activation
governance, run cancel, turn start/cancel/get, tool approve/decline,
stream inspect, app data query/mutate), bounded bodies (256 KiB) and
payloads (≤64 fields), strict content-type handling, stable status
mapping, mutation idempotency keys, authoritative path-parameter
injection, no privileged Mastra route (probe-tested), no raw exception or
secret echo.

## vict.agent-stream@1 schema

Closed 13-kind vocabulary; envelope
`streamId/turnId/threadId/actorId/agentProfileVersion/(traceId|victRunId)/seq`;
bounded namespace IDs; strictly monotonic per-stream sequences; unknown
kinds/fields fail closed with non-echoing issues; `text.delta` the only
transient kind; durable milestones persisted; at-least-once delivery with
client dedupe by `(streamId, seq)`; compatibility rules for frozen `@1`.
OPEN-015 decided.

## SSE and reconnect semantics

`text/event-stream` with IDs from the stream sequence; `Last-Event-ID`
and `?cursor=`; duplicate-safe replay (durable rows + in-buffer
transient deltas); coalescing of consecutive `text.delta` only under
backpressure (non-delta events never dropped or reordered); clean
completion/cancellation; malformed cursor 400, future cursor 409,
cross-actor 403; `cursor-older-than-buffer` disclosure; replay verified
before/during/after completion, after restart, and across real process
death (SIGKILL).

## Mastra tool bridge

Nine-step enforced order (envelope → capability ID/revision → actor/authority
→ VICT input contract → effect/approval policy → durable intent →
invocation → output contract → sanitized result). Only activation-envelope
capabilities become tools; injection cannot add authority; wrong-revision
and out-of-envelope tools fail closed; VICT validation remains
authoritative; deterministic idempotency key over
`(turnId, toolCallId, capabilityId, capabilityRevision, argDigest)`;
agent-framework suspension is a waiting mechanism, never authorization.

## Approval lifecycle

Durable pending records bind requester, activation/profile, capability
ID+revision, turn/tool-call/invocation, canonical arg digest, effect,
environment, expiry, policy, approver. Self-approval denied
(`VICT_APPROVAL_SELF_DENIED`); decline never invokes; exact-binding
consumption (wrong actor/digest/revision/turn denied); duplicate
identical decisions idempotent; approve/decline race has one winner;
restart while pending and after approval reconciles without loss or
duplicate effect (SIGKILL-proven).

## Cancellation and restart reconciliation

Durable intent first; actor-authorized; idempotent; one honest terminal
event; late results fenced; no reversal claims. `reconcileAfterRestart`
gives every open turn one terminal state (cancelled with a durable cancel
intent; otherwise `failed`/`VICT_TURN_INTERRUPTED`) and preserves pending
approvals. Real child-process SIGKILL fixtures over one SQLite control
store prove: no lost approval, crash-after-approval-before-resume,
exactly-once protected effect with skipped replay, cancellation surviving
restart without resurrection, and durable-only SSE replay. No cross-store
atomic transaction is claimed.

## Remote Application Layer and CLI

Remote data adapter preserves resource/revision/release identities; VICT
actions share the server authorization boundary; local actions never
cross (`VICT_APPDATA_LOCAL_ACTION_DENIED`); stale releases fail closed;
hostile filter containers produce structured non-echoing errors. The CLI
(`@vict/cli`, `vict` binary) speaks the same versioned command surface
over HTTP — never stores — with typed commands, stable exit codes
(0/1/2/3), non-echoing diagnostics, and a full ChangeSet lifecycle driven
end-to-end against a real fresh-process SQLite server.

## Data protection and leakage results

Distinct canaries (credential token, request text, tool-argument value,
hostile container) planted and scanned across HTTP responses, SSE frames,
safe errors, durable stream rows, approval records, and raw SQLite
DB/WAL/SHM bytes: zero leakage. Approval records expose digests and safe
summaries only; the approver's own reason is authorized content.
Stage 06A pruning/deletion/export/containment/permission suites re-run in
the ladder.

## Files changed

- Neutral foundations: `packages/contracts/src/agent-stream.ts` (+tests);
  `packages/runtime/src/control-types.ts`, `control-in-memory.ts`,
  `stream-hub.ts`, `control-conformance.ts` (+tests);
  `packages/store-sqlite/src/agent-control-adapter.ts`,
  `migrations.ts` (migration 5), `driver.ts` (+tests: conformance,
  receipt steps, migrations update).
- Control plane: new `packages/control` (control-plane.ts, agent-turns.ts,
  index.ts + 11 tests).
- Mastra bridge: `packages/mastra/src/tool-bridge.ts` (new),
  `adapter.ts`, `turn-executor.ts` (+16 tests across bridge/executor).
- Server: new `packages/server` (auth.ts, commands.ts, http.ts,
  app-remote.ts, index.ts + 8 test files: http, sse, app-remote, cli,
  restart-sigkill, canary, fixtures, sigkill-worker).
- CLI: new `packages/cli` (client.ts, commands.ts, cli.ts, bin/vict.mjs).
- Carry-forwards: `packages/runtime/src/agent-governance.ts`,
  `packages/store-sqlite/src/agent-governance-adapter.ts`,
  `scripts/verify-stage6a.mjs`.
- Verifier: `scripts/verify-stage6b.mjs` (new), `package.json`.
- Docs: `docs/VICT-SYSTEM-REFERENCE.md` (v0.3.3),
  `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` (new),
  `docs/report/VICT-STAGE-06B-REPORT.md` (this file),
  `docs/architecture/MASTRA-ARA-INTEGRATION.md`, `README.md`.

## Verification evidence

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | workspace install (earlier; rebuilt after package additions) |
| `npm run typecheck` | 0 | PASS |
| `npm run format:check` | 0 | PASS (all matched files) |
| `npm run lint` | 1 | 2 pre-existing owner-file errors only (`.pi/skills/mastra/scripts/provider-registry.mjs` — owner change, not modified; identical at `b491ede`) |
| `npm run build` | 0 | PASS (all workspaces incl. control/server/cli) |
| `npm run test:unit` | 0 | 79 files / 1708 passed, 0 failed |
| `npm run test:integration` | 0 | 1 file / 4 passed |
| `npm test` | 0 | 94 files / 1893 passed, 0 failed, 3 skipped |
| `npm run verify:consumer` | 0 | PASS (caught + drove the vitest-leak fix in runtime conformance) |
| `npm run verify:stage2` | 0 | PASSED |
| `npm run verify:stage3` | 0 | PASSED |
| `npm run verify:stage4` | 0 | PASSED |
| `npm run verify:stage5` | 0 | all checks passed |
| `npm run verify:stage6a` | 0 | all checks passed (after legitimate Stage 06B evolution: declared control dep, correlation-identifier-aware Mastra-freedom, packed control in adapter consumer) |
| `npm run verify:stage6b` | 0 | ALL GATES PASSED |
| `npm run example` | 0 | deterministic offline proof |
| `npm run bench` | 0 | 10 events per completed run; 0.220 ms/run median in-memory |
| `npm run example:application` | 0 | 2 files / 17 passed |
| `npm audit --omit=dev` | 0 | found 0 vulnerabilities |
| `git diff --check` | 0 | clean |
| `git status --short` | 0 | clean after final commit |

Repeat runs: `verify:stage6b` passed three times (initial, post-CLI,
post-ladder-fix); `verify:stage6a` passed after evolution; the SIGKILL
suite passed repeatedly during development; the migration suite passed 9/9
after the stale-assertion fix (previously masked by the Windows teardown
timeout).

Environment: Windows 11 (win32-x64), Node v22.13.1 (meets >=22.13.0).
Linux/Node 24 and a second OS were not available on this machine for the
Stage 06B ladder; the Stage 06A Linux closure (Node 24.19.0, Ubuntu
24.04.4/WSL2) remains the most recent independent Linux evidence.

## Adversarial regression matrix

| Requirement | Result | Evidence |
| --- | --- | --- |
| Identity spoofing rejected | PASS | `http.test.ts` (whoami returns token-derived actor) |
| Cross-actor inspection/approval/cancel denied | PASS | control tests, `http.test.ts`, `restart-sigkill.test.ts` |
| Default deny (no scope, no path) | PASS | `ROLE_SCOPES` assertions in every service method |
| Malformed/oversized/unknown HTTP input | PASS | `http.test.ts` (malformed JSON, 256 KiB cap, unknown route/method) |
| No privileged Mastra endpoint | PASS | `http.test.ts` probe set |
| Mutation idempotency | PASS | control conformance, `http.test.ts` idempotency keys |
| Every stream event variant + strict fields | PASS | `agent-stream-schema.test.ts` |
| Monotonic sequences / dedupe | PASS | `sse.test.ts`, conformance ledger suite |
| Cursor reconnect before/during/after completion; restart | PASS | `sse.test.ts`, `restart-sigkill.test.ts` |
| Slow-client coalescing; non-delta never dropped/reordered | PASS | `sse.test.ts` (backpressure, drain) |
| No chain-of-thought / raw-error propagation | PASS | schema gates + `canary.test.ts` |
| Out-of-envelope/injection cannot add authority | PASS | `tool-bridge.test.ts` |
| Durable-before-invocation; contract rejections | PASS | `tool-bridge.test.ts`, conformance |
| Self-approval denied; decline never invokes | PASS | `control-plane.test.ts`, `tool-bridge.test.ts` |
| Approve/decline race one winner | PASS | `tool-bridge.test.ts` |
| Restart while pending / after approval | PASS | `restart-sigkill.test.ts` (real SIGKILL) |
| SIGKILL at material boundaries: no duplicate effect | PASS | `restart-sigkill.test.ts` (EFFECT exactly once, replay skipped) |
| Canary matrix across surfaces incl. DB/WAL/SHM | PASS | `canary.test.ts` |
| Default history contains no full prompt/payload | PASS | safe summaries only; conformance records |
| Stage 01–06A regressions green | PASS | verify:stage2..6a; full `npm test` 1893/0/3 |
| ARA proof exactly 13 ordered events | PASS | verify:stage2/3 (unchanged) |
| Benchmark exactly 10 events per completed run | PASS | `npm run bench` output |
| Stage 05 proofs + real-browser suite intact | PASS | verify:stage5; `example:application` 17/17 |
| Packed consumers Mastra-free | PASS | `verify:consumer` |
| Pinned Mastra upgrade harness intact | PASS | `verify:stage6a` adapter consumer (exact pins) |

## Compatibility decisions

- `vict.agent-stream@1` frozen: additive optional envelope IDs only; no
  removals/re-types; new kinds require `@2`; consumers fail closed on
  unknown input. OPEN-015 decided.
- `vict.changeset@1` schema marker introduced; release content keeps the
  Stage 05 canonical identity fields.
- HTTP surface versioned at `/vict/v1/*`; envelope `{ ok, data }` /
  `{ ok: false, code }`; stable `VICT_*` codes are public error surface.
- Mastra pins unchanged (Stage 06A exact versions).
- `@vict/client` not extracted (CLI's typed client is internal; no second
  consumer yet).

## Remaining genuine limitations

- Implementation increment only: Stage 06B is NOT independently audited;
  Stage 06 remains In Progress; Stage 07 blocked.
- Local test authenticator only; no production identity provider;
  single-process, local-first, non-multi-tenant envelope unchanged.
- Windows-only historical teardown quirk resolved by bounded-retry +
  detached-sweep cleanup; on Linux the previous behavior was always
  clean. (No test was weakened: the fail-closed assertion was strengthened
  to the current migration-5 table set.)
- No WebSocket/WebRTC, no Studio, no Builder Agent, no real model
  provider; the deterministic offline fixture remains the only model.

## Ready for fresh independent audit?

YES — all mandatory functionality and permanent tests pass on this
machine; the ladder is fully green; the aggregate gate `verify:stage6b`
passes; historical audits and reports were untouched.
