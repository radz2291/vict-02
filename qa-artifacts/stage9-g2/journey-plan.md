# S9-04 Confirmation Journey — manual browser script (Stage 9, G2)

> Scope: Studio-side S9-04 `prepare → human review → confirm` journey
> (proposal §6, browser journeys row; §6.2 Studio UX note). This is a
> MANUAL journey script, not an automation claim. The G2 command/transport
> semantics are owned by the core/transport builders; this script only
> drives their HTTP surface through the Studio server relay
> (`apps/studio/src/lib/server/confirmation-transport.ts`) and the
> dedicated journey route `apps/studio/src/routes/confirmations/`.
> Nothing here implements or amends G2 command semantics.

## 0. Truthfulness rules for the journey (hard)

- The Studio never fabricates connection or receipt state: a summary is
  rendered only from a server-issued prepare response; a status line only
  from a status read; a failure only as the truthful banner text of the
  stable code the target issued.
- Failed views use the per-view partial/failure banner convention; the
  target's stable codes (`VICT_CONFIRMATION_REQUIRED`, `_UNAVAILABLE`,
  `_MISMATCH`, `_EXPIRED`, `_STALE`, `_SPENT`,
  `VICT_COMMAND_IDEMPOTENCY_*`) surface verbatim in the banner.
- The prepare step NEVER auto-confirms; confirm is an explicit,
  operator-driven second action with the receipt id.

## 1. Start the demo stack

1. Start the demo target (fixture-only script:

   ```bash
   node apps/studio/scripts/demo-target.mjs
   ```

   prints only port/target/endpoint JSON (no tokens).

2. Provision the Studio server with the target credential carrying the
   mutation scopes (the additive S9-04 fixture actor
   `vict-studio-demo-mutator` → `actor-studio-mutator` is seeded by the
   demo target; the Studio reads credentials from env only, per
   `targets.ts`):

   ```bash
   VICT_STUDIO_TARGETS='[{"id":"local","label":"Local VICT target","endpoint":"http://127.0.0.1:4310","credentialRef":"studio-mutator"}]' \
   VICT_STUDIO_CREDENTIALS='{"studio-mutator":{"token":"vict-studio-demo-mutator","actorLabel":"studio-mutator","scopes":["run.read","activation.read","audit.read","agent.stream.read","run.detail","changeset.read","run.cancel","run.resolve","run.signal"]}}' \
   npm run dev -w vict-studio
   ```

3. Open `http://localhost:5173/confirmations` (the dedicated journey page;
   the G1 read-only plan at `/` and `/runs` etc. is unchanged).

## 2. Positive path (prepare → review → confirm → effect visible)

1. Prepare: choose `run.cancel`, `runId = run-demo-blocked`, a
   `reasonCode`, `expectedRevision` read from the G1 surface
   (`run.detail` / run record revision on the target; the value shown on
   the /runs/:runId read), and a fresh bounded Idempotency-Key. Submit.
   Expect step 2 to display the server-issued summary verbatim:
   command, receipt id, payloadDigest, expectedRevision, expiryAt
   (prepare TTL default 10 minutes).
2. Human review: read the summary; verify the subject and revision match
   the target read. No action is taken yet.
3. Confirm: enter the same command payload, the receipt id, and the SAME
   Idempotency-Key. Expect truthful acceptance (HTTP 200/accepted shape)
   or, if the key already settled, the recorded outcome replay.
4. Effect visible: re-read the run on the G1 surface (`/runs/run-demo-blocked`)
   — status shows `cancelled` truthfully; audit view (`audit.search`,
   subjectId = the run, subjectType includes confirmation rows) shows
   actor/target/reason/before-after identity plus
   `confirmation.prepared` and `confirmation.consumed` events.

## 3. Negatives (all MUST show NO effect)

1. Missing receipt: call confirm with no receipt id → the target answers
   `409 VICT_CONFIRMATION_REQUIRED` (every actor class, including
   administrator); the page shows the truthful banner; the run is unchanged.
2. Expired receipt: prepare, then wait past `expiryAt` (10-minute TTL from
   prepare — for expedience verify with the status read showing
   `expired`, or provision a TTL-past fixture) → confirm answers
   `VICT_CONFIRMATION_EXPIRED`; nothing changed; the expired receipt stays
   auditable (status read still answers from the receipt record).
3. Replay after settle (fresh attempt): after a successful confirm, prepare
   nothing new — call confirm again with a FRESH key against the consumed
   receipt → `VICT_CONFIRMATION_SPENT`, no second effect; the status read
   truthfully answers `spent` / records the consuming key.
4. Same-key semantics (Phase 1 precedence, P-15/P-17/P-23): retry the
   confirm with the SAME key and same payload → the recorded result
   replays (no new effect, no `_CONFLICT`); with the same key but a
   different digest → `VICT_COMMAND_IDEMPOTENCY_CONFLICT` (a new intent
   requires a fresh key).
5. Stale revision (if the demo driver supports a changed target between
   prepare and confirm): after prepare, change the subject revision on the
   target (e.g. resolve the blocked run through another channel), then
   confirm → `VICT_CONFIRMATION_STALE`, no effect; re-prepare is required.
6. Unavailable receipt: attempt a status read with an id that belongs to
   another actor (or bogus id) → truthful non-echo
   (`VICT_CONFIRMATION_UNAVAILABLE` / `unavailable`); nothing is echoed.

## 4. Environment note

At the G2 candidate cut of this branch, the composed target's G2 routes
(prepare/status/confirm consumption) come from the parallel command/
transport slices; the journey page and its server relay are shape-locked
to the frozen proposal and assert nothing about an unready target beyond
truthful banners. The Studio-side automated evidence for the components is
in `apps/studio/tests/ui/confirmation.test.ts` (5 cases) and
`apps/studio/tests/confirmation-contract.test.ts` (6 cases; contract
shapes, no server probes).
---

# S9-03 — Changeset browser journey (Builder D lane)

Machinery relied on (verified live against the composed loopback control
plane in this worktree):

- propose/revise/decide/commit ride the closed command envelope
  `vict.command@1` on the fixed routes `POST /vict/v1/changesets(+/revise|`
  `/decide` | `/commit`), list/get on `GET /vict/v1/changesets(+:id)`
  (`packages/server/src/http.ts:336,352-357,795-806`).
- Every state-changing command requires a bounded Idempotency-Key and is
  durably idempotent (`packages/server/src/commands.ts:1039-1058`); the
  changeset commands are NOT in `CONFIRMATION_REQUIRED_COMMANDS`
  (`commands.ts:347-354`) — governance comes from the control plane.
- Content hash derives from validated content; approvals bind the CURRENT
  hash; promotion to `approved` requires DISTINCT approvers on the current
  hash (`packages/control/src/control-plane.ts:413-493`).
- Commit: stale-base guard, evidence policy by risk class, prevalidation,
  CAS `approved → applying`, durable per-operation receipts, idempotent on
  `committed` (same receipts) (`control-plane.ts:867-1000`).
- Scope denial surfaces as `VICT_ACTOR_SCOPE_DENIED` → HTTP 403
  (`commands.ts:3023-3026`, `http.ts:176-177`).

## Fixture grants (demo target; `apps/studio/scripts/demo-target.mjs`, S9-03 block)

- author `vict-studio-demo-author` → `actor-studio-author`: read scopes +
  `changeset.read` + `changeset.propose` + `changeset.revise` (NO
  `changeset.approve`).
- approver-a `vict-studio-demo-approver-a` → `actor-studio-approver-a`:
  `changeset.read` + `changeset.approve` + `changeset.commit`.
- approver-b `vict-studio-demo-approver-b` → `actor-studio-approver-b`:
  `changeset.read` + `changeset.approve`.
- Studio server-side credential refs (additive defaults in
  `apps/studio/src/lib/server/targets.ts`): `studio-changeset-author`,
  `studio-changeset-approver-a`, `studio-changeset-approver-b`.

## Positive scripted paths

1. Single-approver happy path: author proposes (`requiredApproverCount 1`)
   → author executes the validation evidence run (check + attach) →
   approver-a decides `approved` (promoted on the current hash) →
   approver-a commits → `committed`, N receipts, exactly-once banner.
2. Two-approver quorum path: author proposes with
   `requiredApproverCount 2` → approver-a approves (still draft — one of
   two is NOT promoted) → approver-b approves (DISTINCT second approver →
   promoted) → approver-a commits.

## Negatives (all show a truthful banner and NO state change)

1. SELF-APPROVAL: the author credential attempts decide → the target
   refuses `VICT_ACTOR_SCOPE_DENIED` (403); no decision is recorded.
2. CHANGED CONTENT: author revises an APPROVED changeset (changed
   rationale → NEW content hash; revise() demotes the proposal to draft,
   `control-plane.ts:324`) → follow-up commit fails
   `VICT_CONTROL_CHANGESET_NOT_APPROVED` (status gate precedes the
   approvals-binding double-check, `control-plane.ts:884` before
   `:905`). NOTE (truthfulness): `VICT_CONTROL_APPROVALS_INVALIDATED` is
   the target's defense-in-depth guard; it is not reachable through the
   current public command surface via revision — recorded as a
   STOP-candidate on the scripted banner, not hacked around.
3. MISSING APPROVAL: approver-a commits a never-approved DRAFT →
   `VICT_CONTROL_CHANGESET_NOT_APPROVED`; nothing applied.
4. DUPLICATE EFFECT: commit the committed changeset again — with a fresh
   key the control-plane committed-status replay returns the SAME receipt
   list; with the SAME key the command-receipt replay replays the recorded
   outcome. Every success banner states exactly-once; never a second
   effect.

## Studio-side contract evidence

`apps/studio/tests/changeset-contract.test.ts` (closed propose/revise/
decide/commit/evidence body shapes, bounded-id and Idempotency-Key
validation, truthful banner mapping incl. the four negatives and the
commit replay banner, truthful parsers, server-side actor/target
resolution fail-closed) and `apps/studio/tests/app-definition.test.ts`
(additive `/changesets` route + form-free screen).
