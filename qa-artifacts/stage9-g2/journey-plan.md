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

## 5. S9-04 REAL-EFFECT + AUDIT PANEL (addendum: the executor is now composed)

> Fixture-scope addendum to §0–§4 (NO G2 semantics change): the demo target
> now composes the receipt-gated executors, so a confirmed consumption
> APPLIES its governed effect for real, and the journey page renders the
> resulting truth read back from the target.

1. **Executor composition** (`apps/studio/scripts/demo-target.mjs`, fixture
   scope only): the `run.cancel` executor is attached through the
   `controlPlane.cancelRun` optional port (the `VictCommandService`
   dispatch's existing run-cancel path); `run.resolve` and `run.signal` are
   composed through the existing `runResolution`/`runSignals` options.
   All three drive the EXISTING durable orchestration store mechanics
   (`requestCancellation`/`applyCancellation`, `resolveBlocked`,
   `signalWait`) with the runtime's own command shapes, idempotency hashes
   (`vict.cancellation-command@1` / `vict.resolution-command@1` /
   `vict.signal-command@1`) and safe events (`run.cancel_requested`,
   `run.cancelled`, `operator.intervened`, `signal.received`, `run.resumed`)
   — nothing invented.

2. **Journey subject**: `run-demo-confirm` is a new fixture seed — a
   'running' run in BOTH stores (durable orchestration run with a ready
   root token + the generic execution read mirror) so a confirmed
   consumption changes durable state for real under a subject the G1
   surface already reflects. The blocked run (`run-demo-blocked`) keeps its
   existing seeds and its durable wait (`demo.resume`).

3. **What reads as truth after a confirm** (panel `4 · After the confirm`):
   each line renders ONLY what the target's own reads returned:
   - run record + revision before→after via `GET /vict/v1/runs/:runId`
     (the generic surface's closed status vocabulary is
     running/completed/failed/blocked; a CANCELLED run is truthfully NOT a
     status it can re-project — see the note below),
   - durable waits before→after via `GET /vict/v1/runs/:runId/waits`
     (identity columns only; the wait's status moves open → resolved or
     cancelled with `resolvedBy` = the confirmed call's idempotency key),
   - the audit trail via `GET /vict/v1/audit?subjectType=confirmation&subjectId=<receiptId>`
     (the target's own rows: `confirmation.prepared` with digest+identity,
     `confirmation.consumed` with `command=… actor=… outcome=consumed`),
   - the executor's own `result` member the confirmed call returned,
     serialized verbatim (e.g. `{status:"accepted",runStatus:"cancelled",…}`
     or `{status:"accepted","waitId":"wait-demo-signal",…}`).
   The reason shown in the panel is the operator-supplied payload member
   itself (`reasonCode` / `resolution` / `signalName`); the target-name is
   the Studio target id of the relay call. Failure reads (missing run,
   denied, unreachable) render explicit unavailable notes — the Studio
   never claims a state it did not read.

4. **Negatives stay on the same page** (refreshed values from live runs on
   the composed stack): unconfirmed legacy → `409 VICT_CONFIRMATION_REQUIRED`;
   unknown/foreign receipt → non-echoing `VICT_CONFIRMATION_UNAVAILABLE`;
   wrong `expectedRevision` → `VICT_CONFIRMATION_STALE`; fresh key on a
   settled receipt → `VICT_CONFIRMATION_SPENT` (no second effect); the
   same-key replay replays the truthful recorded outcome (no new effect).
