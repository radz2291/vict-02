# Stage 06B — Control Plane and Governed Remote Execution

Status: Verified with non-blocking issues — formally closed as part of
Stage 06 (2026-09-09).
Parent reference: `docs/VICT-SYSTEM-REFERENCE.md` (v0.3.4; §0.10, §5, §23,
§24.3). Companion reports: `docs/report/VICT-STAGE-06B-REPORT.md`
(original implementation claim, preserved byte-for-byte),
`docs/report/VICT-STAGE-06B-CORRECTIVE-FINALIZATION-REPORT.md`
(defect reproduction and corrections on top of it),
`docs/report/VICT-STAGE-06B-FINAL-BOUNDARY-CORRECTION-REPORT.md`
(final invocation and control-boundary correction), and
`docs/report/VICT-STAGE-06-H1-INDEPENDENT-CLOSURE-VERIFICATION.md`
(final independent closure verification; authoritative Stage 06
disposition). The independent closure record is §11.

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
@victframework/contracts   (neutral)      final vict.agent-stream@1 schema
@victframework/runtime     (neutral)      actor/role/scope model, control-plane ports,
                                 in-memory stores, AgentStreamHub, conformance
@victframework/control     (neutral)      ChangeSet lifecycle, approvals, release
                                 governance, agent-turn governance, audit
@victframework/store-sqlite               durable SQLite adapters (migration 5:
                                 agent-control-plane tables)
@victframework/mastra      (pinned)       governed capability tool bridge + turn executor
@victframework/server      (transport)    versioned HTTP commands, resumable SSE,
                                 authenticated actor composition, remote
                                 Application data adapter
@victframework/cli         (operator)     typed commands over the shared command surface
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

Defined in `@victframework/contracts` (`packages/contracts/src/agent-stream.ts`),
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
- Correlation identities on the envelope where applicable:
  `activationVersion`, `mastraRunId`, `victInvocationId`,
  `victAttemptId` (optional, ID-only, never payload copies).
- `content.completed` carries `contentRef` — a closed-pattern reference
  into the actor-authorized conversation domain
  (`conversation:vict-actor-<actorId>/<threadId>/<turnId>`) — never the
  full assistant text; the operational ledger retains the reference only.
- One closed exported wire-envelope validator
  (`validateAgentStreamWireEnvelope` / `assertAgentStreamWireEnvelope`)
  strips the accepted `schema` marker field and validates the remaining
  event against the schema; every server-emitted SSE frame conforms to
  it, including writes from plain JavaScript (runtime validation on the
  durable write path).
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

Tool-state truthfulness (Stage 06B correction): `tool.completed` means the
tool — the durable capability invocation — FINISHED, and it is normalized
ONLY for a durably confirmed completion (the owner's own confirmed
settlement, or a replay bound to an already-`completed` invocation).
The governed capability bridge's results are normalized through ONE closed
mapping at the adapter boundary (`normalizeCapabilityToolResultEvent`):

- `victCapabilityReplay.disposition: 'completed'` → `tool.completed`;
- `'failed'` / `'declined'` / `'cancelled'` / `'outcome_unknown'` →
  `tool.failed` with `VICT_CAPABILITY_INVOCATION_FAILED` /
  `VICT_CAPABILITY_DECLINED` / `VICT_CAPABILITY_CANCELLED` /
  `VICT_CAPABILITY_OUTCOME_UNKNOWN` respectively;
- `'in_progress'` → NONTERMINAL: no terminal event is emitted. A running,
  unresolved, or ambiguous invocation NEVER produces a terminal milestone;
  the occurrence's milestone stays open for the owner's truthful
  settlement (zero `tool.completed` while the durable status is running);
- unknown, malformed, unsupported, or contradictory replay envelopes (and
  failure markers that are not well-formed) → `tool.failed`
  (`VICT_CAPABILITY_OUTCOME_UNKNOWN`) — fail closed, never completion,
  and no envelope content is forwarded (events carry stable codes only).

A replay envelope is validated structurally at the adapter boundary before
it can influence any milestone (closed field set, bounded safe
`invocationId`, bounded string `resultSummary`, plain-object shape).
One logical occurrence `(turnId, toolCallId)` can never acquire
contradictory terminal milestones: the FIRST terminal milestone for an
occurrence is final, and later results for the same occurrence never add a
contradicting (`tool.failed` after `tool.completed` or the reverse) or
duplicate terminal event. Bridge control markers (`victCapabilityReplay`,
`victCapabilityFailure`, `victHelperFailure`) are RESERVED: a capability
or helper output impersonating a control envelope is fenced as the
truthful `outcome_unknown`/execution failure and never returned as data,
so fabricated dispositions can neither suppress nor forge terminal
milestones.

Post-audit envelope hardening (remediation after the independent exit
audit): every result/output inspection at this boundary is TOTAL and runs
through ONE shared control-envelope capture — guarded `Array.isArray`,
`Object.getPrototypeOf`, `Reflect.ownKeys`, and per-key descriptor reads
only. Direct member reads, `in` (except guarded marker-membership honesty
probes AFTER safe capture), iteration, and `Object.keys` are never used
before safe capture; getters, setters, proxy `get` traps, and user
iterators are never invoked. Values are read only from own enumerable
data-property descriptors; accessor, non-enumerable, and symbol-keyed
fields, inherited marker membership, arrays/exotic prototypes where plain
records are required, and hostile or revoked proxies all produce STABLE
fail-closed classifications (`VICT_CAPABILITY_OUTCOME_UNKNOWN` / the
corresponding stable helper or invalid verdicts) — no raw exception or
canary can escape an inspection, and rejected content is never echoed.
The failure-code vocabulary at this boundary is CLOSED: a failure marker
normalizes into an event code ONLY through the exact
`CAPABILITY_TOOL_FAILURE_CODES` allowlist; arbitrary strings become the
safe `VICT_CAPABILITY_OUTCOME_UNKNOWN`.

> **Stage 07A N-1 correction note (2026-09-09, v0.4.1).** The accepted
> audit Low N-1 — an own `__proto__` delivery-snapshot data key silently
> dropped (scalar) or promoted to the delivered container's prototype
> (object) — was corrected in Stage 07A at the
> `captureDeliverySafeSnapshot` boundary: own `__proto__` keys in any
> own form, at any depth, are rejected with the dedicated closed reason
> `proto-field` BEFORE durable completion, surfaced through the existing
> durable code `VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE` (model code
> `VICT_CAPABILITY_OUTCOME_UNKNOWN`). Null-prototype containers without
> a prohibited key remain accepted; `constructor`/`prototype` string
> keys remain plain own data; all other accepted delivery-domain
> behavior is unchanged. Negative control reproduced at `e0e65b7`;
> permanent suites `tool-bridge.proto-field.test.ts` + emitted probe
> `verify:n1`. The historical §2 body above is preserved unchanged;
> item closure awaits the independent Stage 07A verification.

POST-INVOCATION SETTLEMENT GUARANTEE: once a capability invocation has
begun, EVERY later failure — output-contract parsing, reserved-marker
inspection, result summarization, hostile-output arbitration, Standard
Schema adaptation, and completion persistence — is contained by the
FENCED settlement path: the record settles to the truthful non-replayable
`outcome_unknown` (effect count one; a retry never re-executes), the
model receives the stable non-echoing failure, and a raw trap exception
or canary can never cross the tool boundary. When the settlement store
itself is unavailable, the model still receives the safe outcome-unknown
failure and persistence is never falsely claimed to have succeeded.

DELIVERY-SAFE SNAPSHOT (H-1 remediation — the model-facing Mastra delivery
boundary): a durably `completed` invocation must never be delivered in a
state that can contradict it. The exact value returned to Mastra is
therefore proven safe BEFORE the fenced `completed` settlement: after
output-contract validation and reserved-marker rejection, the bridge
recursively captures the result into a fresh VICT-owned snapshot
(`captureDeliverySafeSnapshot`) and settles `completed` only on success,
deriving the durable `resultSummary` FROM that snapshot and returning ONLY
that snapshot. The accepted delivery domain is exactly: `null`, booleans,
bounded strings, finite numbers, dense bounded arrays, and plain objects
(Object.prototype or null prototype) whose fields are all own enumerable
string-keyed DATA properties — with the documented bounds: container depth
≤ 16, total captured nodes ≤ 4096, array length ≤ 1024, object field count
≤ 128, string length ≤ 8192. The capture is passive (guarded descriptor
reads only — no getter, setter, iterator, `toJSON`, proxy `get`/`has`, or
thenable hook is ever invoked) and rejects, BEFORE durable completion, with
the stable non-echoing durable code `VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE`
(model code `VICT_CAPABILITY_OUTCOME_UNKNOWN`; no new event codes): nested
hostile or revoked proxies (any reflection trap that throws or lies), class
instances and every non-plain instance (Date, Map, Set, RegExp, …),
null-prototype objects EXCEPTED (accepted), own `then` in any form at any
depth, inherited exotic prototypes (including inherited `then`), functions,
BigInts, Symbols, `undefined`, non-finite numbers, accessor fields (never
read), non-enumerable and symbol-keyed fields, extra array properties,
sparse arrays (an array whose length exceeds its contiguous data is
delivered as its dense prefix), cycles, and every bound above. A nested
proxy that is fully transparent to descriptor reflection contributes its
descriptor DATA only: the delivered value is a trap-free plain rebuild and
no caller code can run against it after delivery. Rejection follows the
effectful-ambiguity rule: the capability may already have acted → fenced
`outcome_unknown` → stable safe failure → no normal output → no
`tool.completed` → a retry performs no second effect. Post-return mutation
of the capability's original output can never change the delivered value,
the summary, the events, or the durable record (zero aliasing at any
nesting level). This boundary governs the model-facing tool-result delivery
path only; richer values inside unrelated local VICT capability use are
unaffected.

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
- Authorization is additionally enforced in the shared command dispatcher
  below the HTTP transport: every public command is mapped to a closed
  scope (`COMMAND_SCOPES`; `health.inspect`, `compatibility.inspect` and
  `actor.whoami` require only authentication), so a route-handler bug
  cannot widen authority.
- Reads are actor-scoped: `stream.inspect`, `changeset.get`/`list`,
  `agent.turn.get`, and selected-release reads return only records the
  actor owns or is explicitly privileged to see; cross-actor reads fail
  closed (403/404, never a data leak).
- `activation.select` attributes the authenticated actor as the selecting
  actor; the synthetic `"system"` attribution no longer exists.
- SSE subscription and replay are authorized: the stream's turn must
  exist, be owned by the actor (or the actor holds the privileged
  inspection scope), otherwise the endpoint answers 404/403 — durable
  stream rows without a valid turn owner are never treated as public.
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
- Evidence is authoritative: validation/simulation evidence is attached
  only as a reference to a durable control run that the trusted boundary
  itself executed (`executeChangeSetCheck` under the
  `vict.control-plane@1` runner profile); the service derives outcome,
  run identity, content hash, base identity and timestamps from the
  stored run record — a caller cannot fabricate `passed`, `runId`,
  timestamps or outcomes. Revising a ChangeSet invalidates prior runs
  with the evidence. Commit requires the evidence mandated by the
  risk/effect policy (low risk: validation; medium/high: validation AND
  simulation); missing, failed, stale or mismatched evidence blocks
  commit with structured diagnostics. Fabricated and replayed evidence
  cannot authorize a commit (permanent negative controls).
- Commit is a durable saga with the TWO-STATE operation protocol: the full
  operation set is prevalidated, the status moves
  `approved → applying → committed` under a compare-and-set (exactly one
  concurrent winner), and EACH operation commits a durable PREPARED intent
  (operation identity = changeset + index + kind + canonical operation
  digest + guard, including the expected base version) BEFORE its fenced
  effect executes AT MOST ONCE under that identity, then settles an APPLIED
  receipt. A conflicting operation under the same identity (different
  digest or guard) fails closed; an already-applied identity is never
  re-executed (recovery VERIFIES the recorded target state instead of
  re-running the effect); release selection is additionally fenced on the
  SUBJECT-level base revision (subject-level CAS: exactly one concurrent
  winner; a loser receives the stable `VICT_CONTROL_RELEASE_BASE_CHANGED`
  conflict with no effect). Recovery (`recoverChangeSetCommits`) replays
  from receipts after a crash — already-applied operations are never
  repeated, and no failure leaves a falsely final state (a half-applied
  ChangeSet stays `applying`, externally visible as not-final). Release
  publication and selection are one `publish-and-select-release` operation,
  never an untracked two-step partial update. Audit records agree with the
  actually-committed state.
- Stale-base proposals fail without mutation; approval binds to the exact
  content hash; revising content invalidates evidence and approvals;
  commit is idempotent; competing commits produce one truthful winner;
  rollback selects a prior immutable version for future work without
  rewriting history or repinning in-flight runs; compensation is
  expressed as a distinct operation kind. No executable functions or unrestricted JSON
  patches can be persisted as operations.
- The COMPLETE ChangeSet authoring input is CAPTURED at the validation
  boundary before any member is read: the outer envelope must be a plain
  object with the EXACT closed field set, and the base, the operation
  list, and every operation (including embedded release content) are
  captured through guarded own-property DESCRIPTORS. Caller getters are
  never invoked (a hostile `base.kind` getter runs ZERO times); revoked
  proxies, sparse arrays, accessor or non-enumerable array elements,
  extra string/symbol properties, exotic prototypes, and hostile
  enumeration/descriptor traps are all rejected with ONE stable,
  non-echoing `VictControlError` — no raw `TypeError` or canary ever
  crosses, and a rejected proposal creates NO ChangeSet, hash, run, audit
  event, or store row. Only VICT-owned validated captures are hashed;
  caller objects are never retained, frozen, or aliased (post-call caller
  mutation cannot alter stored content or its hash). The same capture
  discipline applies at the direct `ControlPlaneService` package entry
  points (`propose`, `revise`, `publishRelease`) — the HTTP dispatcher's
  earlier capture does not excuse unsafe direct APIs.
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

`@victframework/server` composes a real `node:http` server (`vict.command@1`):

- Closed command list (`health.inspect`, `compatibility.inspect`,
  `actor.whoami`, `changeset.propose/revise/attach-evidence/decide/
  execute-check/commit/get/list`, `release.publish/select/rollback/
  get-selected`, `activation.select`, `run.cancel`,
  `agent.turn.start/cancel/get`, `agent.tool.approve/decline`,
  `stream.inspect`, `app.data.*`).
- Closed payload schemas: every command declares an exact field set;
  unknown fields and non-object payloads are rejected
  (`VICT_COMMAND_PAYLOAD_INVALID`) instead of being silently coerced to
  `{}`; dynamic route path parameters are injected authoritatively.
- Exact `Content-Type` parsing: only exact JSON content types are
  accepted as JSON (`415` otherwise); malformed input can never cause a
  raw exception or echo hostile values.
- Durable command idempotency for ALL state-changing commands: a
  validated `Idempotency-Key` header (closed bounded format) creates a
  durable receipt NAMESPACED by (actor, command, key) and bound to the
  canonical request digest. Same actor/command/key/digest replays the
  original durable result without repeating effects; the same key reused by
  the same actor for a DIFFERENT command is a stable conflict
  (`VICT_COMMAND_IDEMPOTENCY_CONFLICT`; a different actor's client-generated
  key is an independent namespace); a still-running duplicate answers
  `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` while its lease is live, and an
  EXPIRED pending lease is taken over by the retrying caller (owner +
  attempts recorded); deterministic failures settle `failed` and replay;
  retryable infrastructure failures release the claim. Receipts store SAFE
  per-command result projections only (never full payloads). Receipts
  survive SQLite close/reopen and process restart; concurrent duplicates
  have exactly one winner. `agent.turn.start` retries never create multiple
  turns.
- Bounded request bodies (256 KiB), bounded payloads (≤64 fields),
  stable status mapping (401/403/404/409/400/413/415/500), no raw
  exception or secret echo, no privileged agent-framework route.
- Lifecycle correctness: `port()` returns the real bound port;
  `close()` awaits actual shutdown and terminates open SSE
  connections.
- Resumable SSE (`GET /vict/v1/streams/:id`): `text/event-stream`, SSE
  event IDs derived from the stream sequence, `Last-Event-ID` and explicit
  `?cursor=` reconnect using the closed cursor format
  `v1:<streamId>:<seq>` (cross-stream cursors → 403, malformed → 400,
  future sequences → 409); replay status is exposed through defined
  response headers (`x-vict-replay-bounded`, `x-vict-stream-newest-seq`,
  `x-vict-stream-cursor`), never through undeclared event kinds.
- Replay is lossless and ordered: replay and live delivery share ONE
  ordered path (register-first subscription, then the ordered backlog),
  anchored at the cursor, and the full authorized replay is delivered in
  order — Node backpressure is honored (`response.write() === false` means
  the bytes were ACCEPTED; the saturated socket's frames wait in the
  transport's bounded queue and are pumped one by one, in order, after
  `drain`; nothing is discarded and the transport never coalesces).
  Every SSE frame carries `id: v1:<streamId>:<seq>`, so a browser's
  automatic `Last-Event-ID` reconnects without client rewriting. The HUB's
  coalescing applies to consecutive `text.delta` ONLY for a subscriber that
  signaled saturation, only on private copies, and never during the
  registration phase (a connecting client receives every event exactly
  once, with per-event identity); stored/delivered events are frozen or
  copied so no object is shared-and-mutated between queues and the replay
  buffer; durable/control/terminal events are never dropped. A subscriber
  that attaches before a turn becomes terminal still receives the terminal
  event and a clean close. WebSocket/WebRTC are not used.
- Durable ledger writes are validated at the store boundary: BOTH ledger
  adapters (in-memory and SQLite) reject unknown kinds, kind/payload
  mismatches, non-canonical JSON, unknown fields, raw content in
  `content.completed` milestones, and malformed correlation IDs — including
  calls from plain JavaScript — without mutating sequence state or
  persisting any bytes; reads reconstruct events through the same gate.
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
framework's schema validation passed.

Store failures are never silently swallowed: invocation state transitions
are EXACT-BINDING — a settlement is idempotent only when the observed
durable state is the exact state and binding requested; any other store
error propagates. If an external effect occurred but terminal persistence
failed, the invocation enters the truthful `outcome_unknown` state instead
of reporting normal completion: normal success is returned ONLY after the
exact durable `completed` transition is confirmed.

Tool-call occurrence identity is the FRAMEWORK-SUPPLIED `toolCallId`, read
from both surfaces the pinned Mastra Tool wrapper exposes (top level for
direct calls, `agent.toolCallId` for agent-loop executions) and verified
through the real pinned `Agent` execution path. A call with no stable
occurrence identity fails CLOSED (`VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED`)
BEFORE any durable intent, approval request, or capability invocation —
occurrence identity is never inferred from the arguments alone (a
digest-only key cannot distinguish a retry from a second legitimate
identical call), and the former digest-only turn-tool-slot allocation is
no longer used by the bridge (the migration-8 table remains, forward
compatible). Two distinct tool occurrences with identical arguments
therefore carry distinct identities and may execute twice; a retry of the
SAME occurrence identity reuses one identity and executes at most once.

Live invocation attempts are FENCED (single-process/local envelope).
Claiming the attempt (`intent`/`approved → running`) stamps a durable
fence token, owner identity, and monotonic attempt generation; exactly one
claim per generation wins. The in-process live-owner registry is scoped
PER COMPOSITION (store domain) — never a module-global map keyed only by
`invocationId`: two independent compositions with independent stores
running in one process can produce colliding local invocation ids, and a
shared key would alias their liveness (one composition awaiting — or
fence-sharing with — the other composition's owner). A duplicate that
observes a live-owned `running` record NEVER mutates it: with a
same-composition live owner it awaits the owner's settlement and replays
the truthful terminal disposition; with no live owner in its own
composition (owner loss across a process life, or an attempt belonging to
another composition) the attempt is reconciled CONSERVATIVELY to the
fenced, NON-replayable `outcome_unknown` through an exact-binding
reconciliation command — the effect is never re-executed, and the dead
owner's later settlement is refused by its stale fence. The documented
duplicate-cancellation policy: when a duplicate waiter is CANCELLED while
the owner remains live, the owner is not mutated or cancelled, no false
terminal disposition is produced, and the waiter receives the truthful
NON-terminal `in_progress` replay report — normalized by the adapter as an
open milestone (no terminal tool event), so the occurrence's terminal
milestone stays reserved for the owner's truthful settlement. Terminal
replay of a `completed` record returns the explicit replay envelope only:
a bounded structural result summary that is visibly a replay/recovery
disposition, carries no raw output, and can never satisfy the capability's
output contract as a new execution result.

Argument digests
are computed over a canonical JSON form (key-order invariant; unsupported
values are rejected, not silently coerced). The durable idempotency key is
propagated into the capability invocation context so external adapters can
deduplicate after restart. Durable milestones are awaited, ordered and
exactly-once; a lost milestone fails the turn with
`VICT_TURN_STREAM_PERSISTENCE_FAILED`. Suspension (agent-framework-level
waiting) is a waiting mechanism, never authorization: the VICT approval
record commits before resume.

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

Retention is enforced at the source:

- prompt summaries are metadata-only (event kind + length, e.g.
  `user-input:length=N`) — never prompt text, samples, or payload-derived
  key names;
- tool-argument summaries are shape-only metadata — never argument
  values, key names, or serialized payload fragments (keys/secret names
  included);
- the operational stream ledger never stores full assistant content;
  `content.completed` milestones carry a `contentRef` into the
  actor-authorized conversation domain, which owns full content under
  its retention/deletion/export policy;
- approval `reason` is retained only inside the approval record itself,
  not copied into stream events or HTTP errors.

A true end-to-end canary test (`packages/server/test/e2e-canary.test.ts`)
drives authenticated HTTP turn → deterministic offline Mastra model →
real governed tool bridge → VICT capability → SQLite stores → SSE, plants
unique canaries in prompt text, model output, tool argument keys/values,
the capability-thrown error and nested cause, the credential name/value,
and approval metadata, then scans serialized HTTP errors, unauthorized
responses, SSE metadata and events, operational rows, history, traces and
every SQLite DB/WAL/SHM byte. Intentionally authorized surfaces (the
conversation domain record, the approval record's own reason field, and
the live/user-visible application output) are explicitly identified in
the test.

## 9. Verification

`verify:stage6b` (aggregate exit gate) is self-contained: it first runs
`npm run typecheck` and `npm run build` (so it is valid from a
zero-artifact clean clone and builds every workspace it consumes,
including `@victframework/server` and `@victframework/cli`), then gates: package inspection
(real behavior, dependency direction, Mastra-freedom of neutral/transport
packages, pinned versions, CLI store-freedom); runtime + SQLite
conformance parity incl. close/reopen and the corrective-finalization
stores (control runs, operation receipts, CAS status transitions, command
idempotency); control-plane lifecycle suites incl. the commit saga and
authoritative evidence; the public-API authorization matrix over real
HTTP; durable command idempotency (in-memory + SQLite + HTTP); governed
tool-bridge/executor suites incl. phase fault injection; real-HTTP
command/SSE/CLI suites incl. real-socket forced-backpressure replay;
SIGKILL, canary and end-to-end canary fixtures; a fresh-process SQLite
server driven end-to-end by the CLI; and the Stage 06A
driver-cause/receipt regression suites.

A clean-clone regression (`npm run verify:clean-clone`) proves the exact
required sequence from a genuine fresh clone of the committed state:
`npm ci` → `npm run typecheck` (before any build, no `dist`) →
`npm run build` → `npm run verify:stage6b`. Observed results and the full
ladder are recorded in
`docs/report/VICT-STAGE-06B-CORRECTIVE-FINALIZATION-REPORT.md`.

## 10. Genuine limitations

- Audit history: the increment was audited by the fresh independent
  Stage 06 exit audit, corrected post-audit (hostile tool-result
  containment, then the H-1 delivery-snapshot boundary), re-verified by
  the final independent closure verification, and Stage 06 was formally
  closed on 2026-09-09 (see §11). No finding that remains open blocks
  the stage.
- The deterministic local test authenticator is not a production identity
  provider; single-process, local-first envelope unchanged.
- CLI transport is the versioned HTTP surface; no interactive Studio; no
  WebSocket/WebRTC; no real model provider.
- The Windows-specific migration-teardown test flake (file-lock teardown)
  remains an environmental limitation, documented in the Stage 06A
  closure and re-confirmed during this stage's ladder.

## 11. Independent closure (2026-09-09)

Stage 06B passed the fresh independent **Stage 06 exit audit**
(`eb8d458a3718562f61e60d844dfa31ffb9cbf356`; verdict `VERIFIED WITH
NON-BLOCKING ISSUES — STAGE 07 PERMITTED AFTER FORMAL STAGE 06
CLOSURE`), then the post-audit hostile-envelope remediation
(`735cc9a19d3d8253f792e10d605967142b2ad052`) was verified by the focused
independent re-audit (`d146dae1fd27f665ed9d8c297d40436046a860fb`) — which
also discovered the residual High defect H-1 — and H-1 was corrected by
the delivery-safe snapshot boundary
(`c2ff692e68658fca281f797cd1fe5dd9fa0ddd38`, documented at
`a6675bb8f47c763d99f140dddeab7021a6242df1`). The final independent
**H-1 closure verification** (report committed as
`8c13c28d4d50c53e141b32f05150d4c443a3dba5`) returned the authoritative
verdict `VERIFIED — STAGE 06 READY FOR FORMAL CLOSURE`, and Stage 06 was
formally closed as a separate documentation-only act recorded in
`docs/VICT-SYSTEM-REFERENCE.md` v0.3.4 (§0.10). The historical design
sections above describe the increment as delivered and corrected; they
are preserved unchanged.

- **Final audited implementation SHA:**
  `c2ff692e68658fca281f797cd1fe5dd9fa0ddd38` (H-1-corrected tip; all
  earlier correction commits in linear ancestry).
- **Final audit-report SHA:**
  `8c13c28d4d50c53e141b32f05150d4c443a3dba5`.
- **Authoritative environment:** Ubuntu 24.04 (WSL2 guest), native Linux
  ext4 filesystem, x86_64; Node v24.19.0; npm 11.17.0; Git 2.43.0;
  SQLite via the built-in `node:sqlite` driver (engine 3.53.3); pinned
  `@mastra/core` 1.64.0 (memory 1.28.2, libsql 1.22.3, observability
  1.17.5); no provider credentials and no live model calls — the real
  pinned Mastra Agent loop driven by the deterministic offline model
  fixture. Fresh clone with linear history; `HEAD == origin/main` at
  clone time and re-verified before the report commit.
- **Observed test totals:** full suite 114 files / 2152 tests, all
  passed; `verify:stage6b` ALL GATES PASSED (including the H-1 group
  6c); permanent H-1 suites 45/45; independent snapshot-boundary probe
  68/68 exact-bound checks; real-path truthfulness matrix 8/8
  combinations (read/write × memory/SQLite); concurrency/fencing/restart
  subset green in three consecutive rounds; `npm audit --omit=dev` 0
  vulnerabilities. The exit audit itself had observed 109 files / 2062
  tests plus 109 probe assertions at its target.
- **Verified boundary guarantees:** the nine-step tool-bridge
  authorization order with out-of-envelope tools absent; framework-supplied
  occurrence identity failing closed; fenced exactly-once settlements
  with truthful `outcome_unknown` on ambiguity; the delivery-safe
  snapshot captured BEFORE durable `completed` settlement, with the
  durable summary derived from the snapshot and only the snapshot
  delivered; closed failure-code vocabulary with no raw exception,
  canary, or hostile-value escape; durable namespaced command
  idempotency; lossless ordered SSE replay with cursor round-trip;
  real child-process SIGKILL restart reconciliation without duplicate
  effects or lost approvals; and the adversarial canary matrix over
  HTTP, SSE, safe errors, durable rows, and raw DB/WAL/SHM bytes.
- **Remaining accepted non-blocking issues:** N-1 (Low) — own
  `__proto__` delivery-snapshot key handling, an early Stage 07
  hardening acceptance item; N-2 (Informational) — fully sparse arrays
  delivered as their documented dense prefix and `-0` serializing as
  `0`; EXIT-1 (Low) — shared-store cross-composition liveness
  adjudication, the documented trade-off of the declared
  single-process/local envelope; EXIT-2/EXIT-3 (Informational) —
  approval-expiry error form and the by-design persisted bounded
  approval `decisionReason`.
- **Formal closure disposition:**

```text
STAGE 06 VERIFIED — FORMALLY CLOSED — STAGE 07 PERMITTED
```

Stage 07 is next permitted and has not begun: no real ARA product,
live-provider integration, or real-use data-protection proof (MSTR-012)
exists, and none may be described as delivered or Verified.
