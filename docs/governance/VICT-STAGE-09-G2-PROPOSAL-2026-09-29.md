# VICT Stage 09 — G2 Controlled Recovery Contract (decision-ready proposal, 2026-09-29)

> **Status: PROPOSAL for owner decision — nothing in this document is
> implemented, ratified, or authorized by its existence.** Ratified G0
> decisions (D-4, D-10) are RECONSTRUCTED below as contract statements; the
> operationalization pins (route shapes, endpoint names, store names, TTLs,
> proof matrices) are this document's design candidates, decision-ready for
> owner acceptance. G1 closed PASS WITH NON-BLOCKING FINDINGS and is
> integrated into `main` at `c3f9663cadf80206645a62322e5933ff19c108e9`
> (verified candidate `f68c2bb…`, closure record
> `VICT-STAGE-09-G1-CLOSURE-2026-09-29.md`). Written against VICT `main` at
> that SHA; all code facts re-verified at recording time.

## 1. Purpose

G2 delivers the **controlled recovery surface**: server-issued confirmation
receipts for the two new interventions (`run.resolve`, `run.signal`) and the
**one coordinated versioned migration** of the four existing mutation
commands (`run.cancel`, `activation.select`, `release.select`,
`release.rollback`), with legacy unconfirmed routes rejected for every actor
class including administrator, the CLI prepare → human review → confirm
two-step, ChangeSet and recovery browser journeys, and the full
direct-API/crash/race/restart proof matrix. **Before any G2 implementation,
the owner must accept (or amend + accept) this proposal, and the caller and
release migration plan it pins must then be FROZEN as contract** (ratified
D-4: "caller and release migration plan frozen before G2").

## 2. Reconstructed ratified decisions (statements, not new choices)

- **D-4 (B-2 chosen):** ONE coordinated versioned command-contract migration
  for all four existing commands, including a documented migration of their
  HTTP routes, CLI entries, target compositions and consumers. A Stage
  9-capable target exposes the receipt-gated version and rejects the four
  unconfirmed legacy mutation routes for **every actor class, including
  administrator**. Intentionally breaking for existing mutation callers;
  Quellight cannot claim Studio support until its separate increment adopts
  the new target contract. Other legacy reads may continue.
- **D-10 (B-3 as worded, R-1/R-2 folds included):** server-issued,
  short-lived, durable intent receipts for `run.resolve`, `run.signal`, and
  the four existing commands; separate receipt and effect stores; the
  issuing target is bound implicitly by its server-local receipt (no
  multi-target parameter added to command payloads); the exact outcome
  table, bound fields, check order, durable claim/fence, domain idempotency
  semantics, and the CLI two-step are adopted **as worded** at the G0
  freeze.
- Carried context: D-5 mechanics are live from G1; D-6 parity and the
  three-surface inventory apply to everything G2 adds; the follow-ups must
  not silently re-open frozen G0 bytes.

## 3. Observed code facts at `main` `c3f9663` (pinned; the draft reconciles against THESE)

| Fact | Evidence |
| --- | --- |
| Registry mutations today: `run.cancel` (scope `run.cancel`; fields `runId`, `reasonCode`), `activation.select` (scope `activation.select`; `graphId`, `activationVersion`), `release.select` (scope `release.select`; `applicationId`, `releaseVersion`), `release.rollback` (scope `release.select`; `applicationId`, `targetReleaseVersion`) | `packages/server/src/commands.ts` COMMAND_REGISTRY |
| `run.resolve` / `run.signal` DO NOT EXIST anywhere (grep-verified) | same + `packages/cli/src/commands.ts` |
| HTTP: the four legacy POST routes `/vict/v1/runs/cancel`, `/activations/select`, `/releases/select`, `/releases/rollback` | `packages/server/src/http.ts` POST_ROUTES |
| CLI: one-step entries `run cancel`, `activation select`, `release select`, `release rollback` (POST + flags) | `packages/cli/src/commands.ts` |
| Durable command idempotency EXISTS (Stage 06B): `CommandIdempotencyStore` with `claimReceipt`/`getReceipt`/`findReceiptByActorKey`/`completeReceipt`/`failReceipt`/`releaseReceipt`(fenced)/`takeOverExpiredLease`; fence tokens hashed from (actor, command, key, owner, attempts); lease default 60s; stable codes `VICT_COMMAND_IDEMPOTENCY_KEY_INVALID`, `_IN_PROGRESS`, `_CONFLICT`, plus `VICT_IDEMPOTENCY_FENCE_CONFLICT` for fence-generation mismatches; namespace (actorId, command, idempotencyKey); key pattern bounded | `packages/runtime/src/control-types.ts`, `commands.ts #dispatchIdempotent` |
| The receipt store (`commandIdempotency`) is SEPARATE from all effect stores; there is NO confirmation-intent store yet — G2 MUST ADD one | `AgentControlStores` |
| Every state-changing command requires a bounded `Idempotency-Key` today (one-step) | `#dispatchIdempotent`, `vict.command@1` envelope fields `command`, `payload`, `idempotencyKey` |
| ChangeSet approval/commit machinery exists (actor/content-hash/approval evidence to be rechecked at G2 entry if reused for S9-03; the machinery lives in `packages/control/src/control-plane.ts` and its conformance suite) | `packages/control` |
| G1 added reads incl. detail + audit; scope vocabulary is closed in `ACTOR_SCOPES` | `packages/runtime/src/control-types.ts` |

## 4. Versioned command/HTTP/CLI shapes (pinned design)

### 4.1 New confirmation boundary (transport + CLI + direct API)

| Surface | Shape |
| --- | --- |
| **Prepare (server-issued receipt)** | `POST /vict/v1/confirmations` — body `{ command, payload, expectedRevision? }` + bounded `Idempotency-Key` HTTP header. Requires the TARGET command's mutation scope (e.g. preparing a `run.cancel` requires `run.cancel`). Returns `200 {ok:true, data:{ receiptId, command, payloadDigest, expectedRevision, expiryAt, createdBy, createdAt }}` — the HUMAN-REVIEWABLE SUMMARY plus receipt; **the receipt ID is opaque, bounded, and non-enumerable** (unknown/foreign/target-mismatched receipts are non-echoing `VICT_CONFIRMATION_UNAVAILABLE`). Same actor+command+key+digest reprepare replays the SAME receipt (idempotent prepare); a different `payload` under the same key during prepare is `VICT_COMMAND_IDEMPOTENCY_CONFLICT`. |
| **Consume (execute under confirmation)** | `POST` on the SAME command routes as today (the four legacy paths + the two new intervention routes) with body `{ confirmation: { receiptId } }` and the bounded `Idempotency-Key` header. There is exactly ONE canonical consumption shape — no separate consume route exists in this design (reviewer R-2 folded). |
| **Status read** | `GET /vict/v1/confirmations/:receiptId` → prepared / consumed / expired / spent / unavailable (non-echoing for foreign receipts; audited like other reads). |

### 4.2 The four migrated commands (exact shapes)

Command NAMES are retained; the versioned CONTRACT requires a `confirmation`
object and rejects the unconfirmed shape for every actor class:

| Command (unchanged) | Versioned fields (unchanged + REQUIRED confirmation) | Scope (unchanged) |
| --- | --- | --- |
| `run.cancel` | `runId`, `reasonCode`, `confirmation{receiptId}` + `Idempotency-Key` | `run.cancel` |
| `activation.select` | `graphId`, `activationVersion`, `confirmation{receiptId}` + key | `activation.select` |
| `release.select` | `applicationId`, `releaseVersion`, `confirmation{receiptId}` + key | `release.select` |
| `release.rollback` | `applicationId`, `targetReleaseVersion`, `confirmation{receiptId}` + key | `release.select` |

**Legacy fence:** calls to the four routes WITHOUT a confirmation object
fail closed with `409 VICT_CONFIRMATION_REQUIRED` FOR EVERY ACTOR CLASS
INCLUDING ADMINISTRATOR (admin's all-scopes policy grants authority, not
bypass). Unconfirmed calls with a receipt-shaped-but-invalid confirmation →
`VICT_CONFIRMATION_*` per §6. No optional flag softens this: the fence is in
the command service, not the transport.

New commands land with receipts from day one (no legacy shape exists to
migrate):

| New command | Fields | New scope (candidate) | Receipt |
| --- | --- | --- | --- |
| `run.resolve` | `runId`, `resolution` ∈ {retry, confirm_applied, fail, cancel}, `confirmation{receiptId}` + key | `run.resolve` (added to `ACTOR_SCOPES`, default-deny) | required |
| `run.signal` | `runId`, `signalName`, `confirmation{receiptId}` + key | `run.signal` (candidate name; see D-OPEN-2) | required |

### 4.3 HTTP routes (complete G2 delta, three-surface accounting)

- **NEW:** `POST /vict/v1/confirmations` (prepare; the only route that issues receipts); `GET /vict/v1/confirmations/:receiptId` (status; SINGLE-receipt read, no list endpoint in G2; authorization = the SAME mutation scope as the receipt's command, non-echoing for other actors' receipts — reviewer R-5). No consume route exists: consumption is the confirmed shape of each command route itself.
- **CHANGED CONSUMPTION:** the four legacy POST routes now REQUIRE `confirmation.receiptId` + `Idempotency-Key`; unconfirmed → 409 `VICT_CONFIRMATION_REQUIRED` for every actor. (`run.resolve` execution goes through the runtime's existing blocked-run resolution path; `run.signal` through the existing durable-signal driver — no arbitrary timer-fire command is invented.)
- **NEW:** `POST /vict/v1/runs/:runId/resolve`, `POST /vict/v1/runs/:runId/signal` (receipt-gated).
- **CLI:** `run cancel|activation select|release select|release rollback|run resolve|run signal` each gain `--prepare` (prints server-issued summary + receipt; **never auto-confirms**) and `--confirm <receiptId> --key <Idempotency-Key>`; invoking WITHOUT either flag returns usage guidance naming the two steps (the old one-step entries are REPLACED — a breaking CLI migration, documented). `GET /vict/v1/confirmations/:receiptId` mirrors as `confirmation get` CLI read.

### 4.4 Receipt records (separate store; fields as ratified)

New `CommandConfirmationReceiptStore` port (**separate store** in
`AgentControlStores`; conformance suite added next to the idempotency one):
opaque `receiptId`; `actorId`; `command`; canonical payload digest
(**excluding** the receipt ID); `expectedRevision` + `subjectId`;
`expiryAt` (prepare TTL, default 10 minutes — D-OPEN-1); `status` ∈
prepared/consumed/expired/spent; `createdAt`, `consumedAt`, `consumedByKey`;
issuing target bound implicitly (server-local store, no target parameter).
Prepared-but-unconsumed receipts expire **without effect** and remain
auditable per retention. Prepare is itself idempotency-keyed and durable
(prepare claims live in the SAME `CommandIdempotencyStore` under the
namespace command `confirmation.prepare:<command>`; a settled prepare
replays the same receipt, and after that receipt EXPIRES a fresh prepare
with the same key+digest issues a REPLACEMENT receipt — the expired one
stays expired and auditable; reviewer R-4 row).

**`expectedRevision` semantics per command (pinned; reviewer R-6):** the
prepare payload MUST carry the subject's CURRENT revision, read through the
G1 read surface, and the consume step re-checks it (Phase 2 `STALE`):

| Command | `expectedRevision` at prepare | Read-through |
| --- | --- | --- |
| `run.cancel`, `run.resolve`, `run.signal` | the run's `recordRevision` | `run.get` |
| `activation.select` | the graph's CURRENT selection's `selectionRevision`; `null` when truthfully none is selected (consume then requires it is STILL unselected) | `activation.selected` |
| `release.select`, `release.rollback` | the application's current selection's `selectionRevision` | `release.selections` |

Omitting `expectedRevision` at prepare is rejected (`VICT_CONFIRMATION_FIELD_REQUIRED` candidate name, non-echoing) — no "no-guard" shape exists.

### 4.5 Confirmation audit and retention (pinned; reviewer R-5)

- New closed audit actions added to `CONTROL_AUDIT_ACTIONS`:
  `confirmation.prepared` (actor, command, subject, receipt digest — NEVER a
  payload byte) and `confirmation.consumed` (actor, command, key, outcome
  class). Receipt lifecycle transitions that occur without a consume
  (expiry, spend) are captured on the DURABLE RECEIPT RECORD itself
  (`status`, timestamps, consumedByKey) and surface through the status read
  and audit search (`audit.search` subjectType `confirmation`). Retention:
  receipts carry digests and identities only — never payload bytes — so the
  control retention policy applies unchanged; expired/spent receipts remain
  auditable per the ratified retention wording.
- The confirmation status read requires the receipt's command mutation scope
  and is added to the permanent authorization matrix (both directions:
  wrong-scope denial; same-scope allowance). It is NOT added to any default
  role beyond what that scope mechanism already yields (see 4.6).

### 4.6 Confirmation retention window (pinned default; D-OPEN-4)

Receipts retain their full record (identities, digest, status, timestamps,
consuming key) for a minimum of **90 days** before purge eligibility
(D-OPEN-4: accept 90 days, or set another explicit bounded window). Receipts
carry NO payload bytes — only the canonical digest — so even after purge the
`confirmation.prepared`/`confirmation.consumed` audit events and the
`audit.search` ledger remain the durable audit trail under the standard
retention policy; summary retention never removes the digest-level audit
trail.

## 5. Authoritative check precedence and outcome table (B-3 as worded; the RATIFIED contract)

The frozen B-3 prose fixes the ORDER of mechanisms, and this section pins it
exactly (the reviewer's R-1 was correct that a naive table-priority reading
would push settled replays of expired/spent receipts onto a fresh key — the
forbidden path):

**Phase 1 — existing command idempotency, checked FIRST.** The existing
`CommandIdempotencyStore` settled lookup for (actorId, command,
Idempotency-Key), bound to the digest of the COMPLETE confirmation request
(including the receipt ID):
- the same key was settled with the SAME digest → **replay the recorded
  result with NO new effect** — this PRECEDES every receipt-state check, and
  therefore applies even when the referenced receipt is now expired or
  spent (table rows EXPIRED/SPENT apply only when the claim is NOT
  already settled for that exact key+digest);
- the same key was settled with a DIFFERENT digest →
  `VICT_COMMAND_IDEMPOTENCY_CONFLICT`;
- nothing settled under the key → Phase 2.

**Phase 2 — receipt verification chain (the ratified outcome table as the
classification of Phase-2 outcomes)**, all non-echoing, effect = None:

| Direct-API case | Stable outcome |
| --- | --- |
| Receipt omitted | `VICT_CONFIRMATION_REQUIRED` |
| Unknown receipt, another actor's receipt, or receipt issued by another target | `VICT_CONFIRMATION_UNAVAILABLE` (non-echoing) |
| Wrong command or canonical parameters | `VICT_CONFIRMATION_MISMATCH` |
| Receipt expired | `VICT_CONFIRMATION_EXPIRED` |
| Target revision changed after preparation | `VICT_CONFIRMATION_STALE` (re-review, prepare again) |
| Receipt consumed by a different request/key | `VICT_CONFIRMATION_SPENT` |

**Phase 3 — durable claims, FENCED on both stores.** The receipt is claimed
and fenced in the NEW confirmation store (exact-generation fencing, mirroring
the existing idempotency fence semantics), and the command proceeds through
the EXISTING `#dispatchIdempotent` claim (including cross-command
`findReceiptByActorKey` checks) — the confirmation idempotency is keyed by
actor+command+key and bound to the digest of the COMPLETE confirmation
request (including receipt ID), as ratified. The two stores are separate
stores with distinct fence generations; the reconciliation of a crash window
between them is proven by P-16/P-21.

**Phase 4 — execute and settle.** Execute under the domain's own
idempotency fence; settle BOTH stores (idempotency result first, receipt
converges to consumed under the same fence, P-21). A fresh key against a
spent receipt fails; no receipt ID can create a second effect under a fresh
key. Any infrastructure-failure release uses the existing FENCED
`releaseReceipt` semantics (retryable, never confused with a deterministic
failure).

## 6. Crash / race / restart + direct-API proof matrix (each = a named automated test)

| # | Path | Required proof |
| --- | --- | --- |
| P-1 | Prepare concurrency | Two identical prepares under one key race → same receipt returned; different payload under same prepare key → `_CONFLICT` |
| P-2 | Claim winner | Two concurrent consumes of one receipt: exactly one executes (claim `claimed`/`exists`); loser truthfully `VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` (retry with same key) |
| P-3 | Crash: claim, effect, crash before settlement | Effect applied once; restart + same key/digest replays recorded outcome; receipt settles consumed |
| P-4 | Crash: claim, crash before effect | Lease takeover (`takeOverExpiredLease`) after expiry; effect on retry; no duplicate |
| P-5 | Crash: between receipt-claim and effect on a SECOND actor | Fence token mismatch → stable conflict; live claim byte-identical |
| P-6 | Fresh key on spent receipt | `VICT_CONFIRMATION_SPENT`, no effect |
| P-7 | Same key, changed confirmation digest (new receipt or altered field) | `VICT_COMMAND_IDEMPOTENCY_CONFLICT` |
| P-8 | Cross-command key reuse | `findReceiptByActorKey` → `_CONFLICT` without per-command ambiguity |
| P-9 | Stale revision | `VICT_CONFIRMATION_STALE`, no effect, re-prepare required |
| P-10 | Expiry | `VICT_CONFIRMATION_EXPIRED`, no effect, receipt stays auditable |
| P-11 | Unconfirmed legacy call (all four commands) | 409 `VICT_CONFIRMATION_REQUIRED` **for actor classes operator+developer** and **administrator** (explicit two-actor negative) |
| P-12 | Admin all-scopes bypass attempt | Same 409 — administrator has NO bypass |
| P-13 | Prepare of a command the actor cannot scope | `VICT_SCOPE_DENIED`, no receipt |
| P-14 | Receipt of another target | `VICT_CONFIRMATION_UNAVAILABLE`, non-echoing |
| P-15 | Replay of same committed confirmation (key+digest) | Prior recorded result, no second effect |
| P-16 | Receipt store vs effect store split | Restart BETWEEN consume-claim and effect leaves no half-applied B-3 state (receipt consumed only after domain settlement, or claim released fenced) |
| P-17 | Settled replay of an EXPIRED receipt | Same actor+command+key+digest on a receipt that has since expired → **recorded result replays, no new effect** (Phase 1 precedence; EXPIRED applies only to unsettled claims) |
| P-18 | Settled replay of a SPENT receipt | Same precedence proof as P-17 for a receipt consumed by another key |
| P-19 | Expiry TOCTOU at the durable claim | Receipt valid at Phase-2 check but expiring before/during the Phase-3 claim: the claim executes only when the fence wins BEFORE `expiryAt`; a fence that arrives at/after `expiryAt` fails closed `VICT_CONFIRMATION_EXPIRED`; once claimed and fenced, in-flight processing completes under the fence (no mid-flight expiry of a granted claim) |
| P-20 | Different-key concurrent consume of one receipt | First key settles and receipts `consumed`; second key (fresh idempotency key) truthfully `VICT_CONFIRMATION_SPENT`, no effect, receipt records the consuming key |
| P-21 | Reverse-crash convergence | Crash AFTER the domain effect settles in the idempotency store but BEFORE the receipt record updates: on retry with the same key+digest, Phase 1 replays the recorded result AND the receipt converges to `consumed` under the same fence — exactly one effect, both stores eventually consistent |
| P-22 | Prepare-after-expiry replacement | Fresh prepare, same actor+command+key+digest, referencing an EXPIRED receipt's shape issues a REPLACEMENT receipt (at most FIVE replacement receipts per actor+command+key; further prepares fail closed `VICT_COMMAND_IDEMPOTENCY_CONFLICT`); the expired receipt stays expired and auditable; no state carried over except audit |

Browser journeys (G2 exit): S9-03 ChangeSet inspection/approval/commit with its negative set (self-approval, changed content, missing approval, duplicate effect fail closed); S9-04 prepare→review→confirm in Studio with missing/mismatched/expired/replayed receipt + stale state producing NO unintended effect, audit showing actor/target/reason/before-after identity.

### 6.1 Inventory pin for the confirmation surface (reviewer R-7)

`scripts/verify-stage9-inventory.mjs` gains the G2 surface explicitly:
`confirmation.prepare`-equivalent `POST /vict/v1/confirmations`, the
single-receipt status read, the two new intervention commands with their
routes and CLI entries, and the reshaped CLI two-step entries — classified
as G2 surface; the G1 READ surface is asserted UNAMENDED byte-for-byte at
the command/registry level (G1 read commands, routes and CLI entries change
NOWHERE in G2; only the inventory ACCOUNTING gains rows). The proposed
legacy-shape rejection rows (P-11/P-12) are added to the permanent
authorization matrix.

### 6.2 Studio-side confirmation UX note for S9-04 (non-implementation note)

Studio presents the server-issued prepare summary (command, subject,
payload digest, expected revision, expiry) for human review and posts the
confirmed shape with the session-bound CSRF boundary already proven at G1;
the dialog/marker surfaces are implementation work gated on owner-accepted
G2 scope.

## 7. Caller and release migration plan (to be FROZEN, then G2 implementation)

1. **Caller inventory (verification task at G2 entry):** enumerate every
   writer of the four legacy shapes — repository tests, CLI consumers, any
   demo/target fixtures, and the Quellight consumer repo (read-only
   observation of its `main`; NO Quellight edits) — recorded in the G2
   candidate with exact file/SHA. The inventory is re-derived, not copied.
2. **In-repo migration:** CLI entries re-shaped (§4.3); server tests
   updated to prepare→confirm; HTTP `http.test.ts` legacy-negative rows
   added per P-11/P-12; inventory script gains the confirmation surface
   (prepare/consume/status + the two new commands) and re-classifies nothing
   silently.
3. **Quellight impact statement (documentation only):** Quellight's target
   composition must adopt the new contract before it can claim Studio
   support; its own increment (D-8) is a prerequisite for the S9-05
   same-turn proof, unchanged.
4. **Release plan:** the G2 command surface is a coordinated versioned
   command-contract migration recorded as a candidate release note against
   the next coordinated set (today `vict-release-set@1/0.4.0-rc.1`, 14
   members). **Publication is NOT a G2 implementation prerequisite and
   stays a separate explicit owner decision** (G0/§3 authority boundary);
   local integrated evidence precedes any publication decision.
5. **Compatibility window:** because legacy routes are rejected for every
   actor class on a Stage 9-capable target, the migration is atomic per
   target composition; no dual-running window is offered (that is the
   ratified D-4 meaning; an alternative would need a NEW owner decision —
   not requested).

## 8. Scope boundaries for G2 (exclusions)

No FT-1 work; no S9-02 drill-down claim; no publication; no production
activation; no Quellight edits; no changes to frozen G0 bytes; no changes to
G1's read surface beyond adding the confirmation accounting to the inventory;
product-domain `app.data.mutate/action` remain unexposed in Studio's
diagnostic pane. Timers are diagnosed/governed through the existing driver.

## 9. G2 stage-manager handoff (to be exercised ONLY after owner acceptance)

The G1 process amendment (`VICT-STAGE-09-G1-PROCESS-AMENDMENT-2026-09-29.md`)
lapses at G1 closure and does NOT carry into G2 automatically. If the owner
accepts this proposal and authorizes G2 implementation, the recorded G2
working agreement (subject to owner amendment) is: the G1-pattern stage
manager may coordinate genuinely separate non-overlapping builder worktrees
(e.g. receipt store/command service vs CLI/HTTP/CLI parity vs
journey/audit evidence), commission fresh-context verifiers who did not
build the audited candidate, triage and direct repairs across candidate
SHAs, and report to the owner at the G2 boundary or a real stop condition —
with an independent verifier at every exact pushed candidate SHA before any
gate claim, verdict vocabulary PASS / PASS WITH NON-BLOCKING FINDINGS / HELD
/ FAIL / BLOCKED, preserved failed evidence and lineage, and the frozen
single-builder stop-and-report procedure remaining the default for any
future gate without its own amendment.

## 10. Proposed G2 gates

| Gate | Content | Evidence and stop |
| --- | --- | --- |
| G2 entry | Owner accepts this proposal (or amends + accepts); caller inventory frozen; release plan frozen | Owner decision recorded; freeze commit with digests |
| G2 candidate(s) | Receipt store + conformance suite; command-service confirmation layer incl. legacy fence; `run.resolve`/`run.signal`; HTTP + CLI shapes; test migrations; direct-API matrix §6; Studio/CLI journeys S9-03/S9-04; three-surface inventory + audits + retention | Independent verifier at exact pushed SHA; stop on: any unconfirmed legacy bypass, cross-store lost update, any receipt replay creating a second effect, actor confusion, or protected-data leakage |
| G2 exit | Same-semantic CLI/Studio/HTTP on equivalent isolated targets, no duplicate effects; negative matrix complete; verifier verdict; owner report | Owner acceptance; then G3 remains NOT AUTHORIZED |

## 11. Open decision requests for the owner (decision-ready; defaults stated)

- **D-OPEN-1 receipt TTL:** default expiry 10 minutes for prepare (short,
  human-review scaled; configurable per deployment). Accept, or set another
  bounded default.
- **D-OPEN-2 `run.signal` scope name:** `run.signal` (new closed scope) — accept the name, or amend. CORRECTED role semantics (reviewer R-3): by the closed role policy `administrator: [...ACTOR_SCOPES]`, the administrator role AUTOMATICALLY holds every scope the vocabulary ever gains — so `run.resolve`/`run.signal` are held by administrators BY POLICY, while every other actor receives them ONLY via explicit deployment scope grants. Scope default-deny therefore holds for all NON-administrator classes, and it is the confirmation fence — never scope absence — that blocks administrator legacy-shape bypass. The EXISTING `operator.resolve` scope is classified and UNCHANGED: it is the stream-inspection privilege (other-actor stream identifiers in `stream.inspect`) and the runtime-level blocked-run resolution path (`resolveBlocked` in the orchestration layer) is NOT itself the G2 command surface — G2 adds the receipt-gated `run.resolve` COMMAND requiring the NEW scope `run.resolve`; holders of `operator.resolve` gain no run-resolution authority unless the deployment grants `run.resolve` (administrators hold it by policy). The runtime `resolveBlocked` path remains the internal executor the `run.resolve` command binds to.
- **D-OPEN-4 receipt retention window:** minimum **90 days** before purge
  eligibility (digest-level audit trail survives any purge) — accept the
  number or set another explicit window. Also resolves A-N-2 with one
  number instead of "as before".
- **D-OPEN-3 prepare route shape:** single `POST /vict/v1/confirmations`
  (this draft) vs per-command `/prepare` routes. The single route keeps the
  three-surface inventory closed; per-command routes add six routes for
  identical semantics.

*(Everything above §11 is pinned design reconciled to the ratified D-4/D-10
contract; the open items are bounded operational pins, not scope changes.)*
