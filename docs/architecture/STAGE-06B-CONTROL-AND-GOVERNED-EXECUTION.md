# Stage 06B — Control Plane and Governed Remote Execution

Status: implemented, awaiting fresh independent audit (not Verified).
Parent reference: `docs/VICT-SYSTEM-REFERENCE.md` (§0.9, §5, §24.3).
Companion report: `docs/report/VICT-STAGE-06B-REPORT.md`.

Stage 06B turns the Stage 06A product-agent foundation into a governed,
remotely drivable system: an authenticated actor boundary, ChangeSet and
release governance, a versioned HTTP command surface, the final
`vict.agent-stream@1` event schema with resumable SSE, the governed
capability-to-Mastra tool bridge, durable approvals and cancellation,
cross-process restart reconciliation, remote Application Layer bindings,
and a typed operator CLI — all inside the existing local-first,
single-process, non-multi-tenant envelope.

## 1. Packages and dependency direction

New Stage 06B packages (no empty placeholders; each owns real behavior):

```text
@vict/contracts   (neutral)      final vict.agent-stream@1 schema
@vict/runtime     (neutral)      actor/role/scope model, control-plane ports,
                                 in-memory stores, AgentStreamHub, conformance
@vict/control     (neutral)      ChangeSet lifecycle, approvals, release
                                 governance, agent-turn governance, audit
@vict/store-sqlite               durable SQLite adapters (migration 5:
                                 agent-control-plane tables)
@vict/mastra      (pinned)       governed capability tool bridge + turn executor
@vict/server      (transport)    versioned HTTP commands, resumable SSE,
                                 authenticated actor composition, remote
                                 Application data adapter
@vict/cli         (operator)     typed commands over the shared command surface
```

Dependency direction (acyclic; verified by inspection and build):

- neutral packages (`contracts`, `runtime`, `control`) never import Mastra,
  SQLite, Node-only modules, or the server;
- `store-sqlite` implements runtime ports and stays below them;
- `mastra` imports runtime/control/application and the pinned
  `@mastra/*` packages (core `1.64.0`, memory `1.28.2`, libsql `1.22.3`,
  observability `1.17.5` — unchanged);
- `server` composes runtime/control/application contracts and exposes no
  privileged agent-framework route;
- `cli` speaks only the versioned HTTP command surface (never stores).

## 2. `vict.agent-stream@1` — final schema (OPEN-015 decided)

Defined in `@vict/contracts` (`packages/contracts/src/agent-stream.ts`),
Mastra-free, field-level, fail-closed:

- Closed 13-kind vocabulary: `response.started`, `text.delta`,
  `content.completed`, `tool.requested`, `tool.started`,
  `tool.awaiting_approval`, `tool.completed`, `tool.failed`,
  `memory.updated`, `usage.updated`, `response.completed`,
  `response.failed`, `response.cancelled`.
- Common envelope: `streamId`, `turnId`, `threadId`, `actorId`,
  `agentProfileVersion`, optional `traceId`/`victRunId` (correlation by ID,
  never copied payloads), and a strictly monotonic per-stream `seq`.
- Bounded namespace-ID pattern; sequences must be safe integers (1-based,
  monotonic); unknown kinds, unknown fields, invalid IDs/sequences/usage,
  and unsafe codes produce structured issues (`AGENT_STREAM_*`) carrying
  codes and paths only — never values.
- `text.delta` is the only transient kind (safe to coalesce); every other
  kind is durable and persisted by the stream ledger.
- Compatibility and evolution rules for the frozen `@1` marker: new
  optional envelope IDs may be added; no field is removed or re-typed; new
  kinds require a `@2` marker; consumers must ignore nothing — unknown
  input fails closed.

Delivery is at-least-once; consumers deduplicate by `(streamId, seq)`.
Completed assistant content is recovered from authoritative conversation
state, never by replaying provider chunks. Raw agent-framework/provider
chunk types, hidden reasoning, and raw provider/capability errors never
cross the boundary; failures surface as stable sanitized codes
(`tool.failed`, `response.failed`).

## 3. Actors, roles, scopes — the trust boundary

- Authentication and authorization are distinct: a deterministic local
  test authenticator maps a bearer token to an actor ID; the
  authoritative `ServerActorContext` (actor, roles, scopes, Mastra
  `resourceId` = `vict-actor-<actorId>`) is derived server-side from the
  actor directory. Unknown, disabled, malformed, or mismatched actors fail
  closed.
- Client-supplied actor IDs, roles, scopes, `resourceId`, activation IDs,
  and approval authority are never authoritative.
- Default policy is denial: every service method asserts the required
  scope below the HTTP/CLI layers (`ROLE_SCOPES`; administrator is a
  superset, not a special case).
- Errors use stable codes and never echo credentials, tokens, or hostile
  values.

## 4. ChangeSets, approvals, and release governance

ChangeSet state machine (forward-only):

```text
draft ──approve──▶ approved ──commit──▶ committed
  │  ▲                │
  └──┴─ revise ───────┘ (any approve/revise from draft/approved back to
  │                      draft invalidates evidence AND approvals)
  ├──decline──▶ declined
  └──expiry───▶ expired
```

- A ChangeSet carries: stable ID + `vict.changeset@1` schema marker,
  author actor, exact expected base (`activation`/`release` with
  subject/expected version), closed typed operations (`select-activation`,
  `rollback-activation`, `publish-and-select-release`, `link-capability`),
  bounded rationale, validation/simulation evidence, risk class, required
  approver count, expiry, and an immutable `contentHash`.
- Stale-base proposals fail without mutation; approval binds to the exact
  content hash; revising content invalidates evidence and approvals;
  commit is idempotent; competing commits produce one truthful winner;
  rollback selects a prior immutable version for future work without
  rewriting history or repinning in-flight runs; compensation is
  expressed as a distinct operation kind. No executable functions or unrestricted JSON
  patches can be persisted as operations.
- Application Releases are immutable published records
  (exact identity, content hash, renderer/component/data-adapter identities, activation binding) with select/rollback
  selection records; activation selection is audited.
- Every transition is attributable (actor, action, subject, summary) and
  evented to the durable audit log.

Approval records (both control-plane and protected tool operations) bind:
requesting actor, activation/agent profile, capability ID + revision,
turn/tool-call/invocation identity, canonical argument digest, effect
class, environment, expiry, status, required approver role, and approver
identity. The product agent cannot approve itself; a requester without
approval authority cannot approve; decline never invokes; duplicate
identical decisions are idempotent; competing approve/decline has one
winner; restart between VICT approval and Mastra resume reconciles safely.

## 5. Versioned HTTP commands and resumable SSE

`@vict/server` composes a real `node:http` server (`vict.command@1`):

- Closed command list (`health.inspect`, `compatibility.inspect`,
  `actor.whoami`, `changeset.propose/revise/attach-evidence/decide/commit/
  get/list`, `release.publish/select/rollback/get-selected`,
  `activation.select`, `run.cancel`, `agent.turn.start/cancel/get`,
  `agent.tool.approve/decline`, `stream.inspect`, `app.data.*`).
- Bounded request bodies (256 KiB), bounded payloads (≤64 fields), strict
  content-type handling, stable status mapping (401/403/404/409/400/413/
  415/500), mutation idempotency keys, dynamic route path parameters
  injected authoritatively into payloads, no raw exception or secret echo,
  no privileged agent-framework route.
- Resumable SSE (`GET /vict/v1/streams/:id`): `text/event-stream`, SSE
  event IDs derived from the stream sequence, `Last-Event-ID` and explicit
  `?cursor=` reconnect, duplicate-safe replay of durable rows plus
  in-buffer transient deltas, coalescing of consecutive `text.delta` only
  (non-delta events are never dropped or reordered), bounded buffering
  with slow-subscriber backpressure, clean completion, rejection of
  malformed/future/cross-actor cursors, and a
  `cursor-older-than-buffer` disclosure that points clients at
  authoritative durable state. WebSocket/WebRTC are not used.
- Remote Application data adapter: queries/mutations preserve declared
  resource/revision/release identities; actions stay client-local and
  cannot be dispatched remotely (`VICT_APPDATA_LOCAL_ACTION_DENIED`);
  stale releases fail closed; hostile filter containers produce
  structured non-echoing errors.

## 6. Governed Mastra tool bridge (pinned versions)

For every effectful tool request the bridge enforces, in order:

```text
Mastra tool request
→ closed tool-envelope validation
→ resolve pinned capability ID and revision
→ authenticated actor and authority check
→ authoritative VICT input-contract validation
→ effect and approval policy
→ durable intent where required
→ capability invocation
→ authoritative output-contract validation
→ sanitized result returned to Mastra
```

Only capabilities present in the immutable activation authority envelope
become model-facing tools; tool names/descriptions cannot widen authority;
prompt injection, memory content, and model output cannot add tools,
permissions, roles, or secrets; missing/extra/stale/wrong-revision tools
fail closed; contract validation remains authoritative even if the agent
framework's schema validation passed. The idempotency key is deterministic
over `(turnId, toolCallId, capabilityId, capabilityRevision, argDigest)`,
so retries, resumes, and restarts see ONE logical invocation. Suspension
(agent-framework-level waiting) is a waiting mechanism, never
authorization: the VICT approval record commits before resume.

## 7. Cancellation and restart reconciliation

Cancellation records a durable VICT intent first, is actor-authorized and
idempotent, propagates an abort signal where supported, produces exactly
one honest terminal event, fences late results, never claims reversal of
committed effects, and survives process restart. Restart reconciliation
(`reconcileAfterRestart`) gives every open turn one honest terminal state
(cancelled when a durable cancel intent exists; otherwise `failed` with
`VICT_TURN_INTERRUPTED`) and preserves pending approvals.

Real child-process SIGKILL fixtures (`packages/server/test/
restart-sigkill.test.ts`) prove, across fresh processes over one SQLite
control store:

- crash with a pending approval → approval not lost; approver decides over
  real HTTP; crash again after approval but before resume; resume applies
  the protected effect EXACTLY once; the retried logical invocation is
  skipped as already-completed; final durable state is truthful;
- durable cancellation survives restart and reconciliation never
  resurrects a cancelled turn;
- durable stream milestones replay over real HTTP from a fresh process
  while transient deltas do not survive.

Documented, honest limitation: VICT's durable records are authoritative
and reconciliation is rule-based; no cross-store atomic transaction is
claimed.

## 8. Data protection and leakage results

Distinct canaries (credentials, prompts, tool arguments, hostile filter
values) are planted and every observable surface is scanned: HTTP
responses, SSE frames, safe errors, durable stream rows, approval records,
Application-domain data, and raw SQLite DB/WAL/SHM bytes
(`packages/server/test/canary.test.ts`). Credentials, hostile values, and
protected arguments appear nowhere; authorized conversation content
reaches only its authorized recipient and designated stores. The Stage 06A
pruning, deletion, export, file-containment, and permission suites are
retained and re-run in the ladder.

## 9. Verification

`verify:stage6b` (aggregate exit gate) covers: package inspection (real
behavior, dependency direction, Mastra-freedom of neutral/transport
packages, pinned versions, CLI store-freedom); runtime + SQLite
conformance parity incl. close/reopen; control-plane lifecycle suites;
governed tool-bridge/executor suites; real-HTTP command/SSE/CLI suites;
SIGKILL and canary fixtures; a fresh-process SQLite server driven end-to-end
by the CLI; and the Stage 06A driver-cause/receipt regression suites.
Observed results and the full ladder are recorded in
`docs/report/VICT-STAGE-06B-REPORT.md`.

## 10. Genuine limitations

- Implementation-stage increment: no independent Stage 06B audit yet; the
  full Stage 06 exit gate is open; Stage 07 blocked.
- The deterministic local test authenticator is not a production identity
  provider; single-process, local-first envelope unchanged.
- CLI transport is the versioned HTTP surface; no interactive Studio; no
  WebSocket/WebRTC; no real model provider.
- The Windows-specific migration-teardown test flake (file-lock teardown)
  remains an environmental limitation, documented in the Stage 06A
  closure and re-confirmed during this stage's ladder.
