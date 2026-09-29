# VICT Stage 09 — G2 REPAIR-CYCLE Independent Verification (2026-09-29)

Fresh independent verifier record for the G2 repair-cycle candidate. Verifier did NOT build the
candidate and made NO code repairs. Evidence below is direct: every falsification attempt was run
against the code and screenshots at the exact verified SHA.

## 0. Identity

- Repository: https://github.com/radz2291/vict-02.git
- Live-verified (`git ls-remote`, fresh credential):
  - `refs/heads/codex/stage9-g2-proposal` == `23388a7eb887d0211eeb5b0b6f98155e70709489` (verified HEAD)
  - `refs/heads/main` == `737af3826632d5c0c3b169613238ffc15311b5f7`
  - `codex/stage9-g2-s9-03-changeset` == `8aeb47b7c730b51084f2de36f07e523f056dbb5f` (lane D, byte-exact)
  - `codex/stage9-g2-target-failclosed` == `8196d21f42823b67b50827e6c826192d3ee74111` (lane E, byte-exact)
  - `codex/stage9-g2-s9-04-effect` == `b5b0ba94b19aba270f1355b35f65cb2d25f82fd5` (lane F, byte-exact)
- Lineage verified: `56bc204` (verified first candidate) is an ancestor; graph contains lanes D/E/F
  via merge commits `d797d87` (BUILDER D) and `2140e66` (BUILDER F), integrated `5678f11`,
  repairs `dd1e9ab`, evidence `7091969`, STATE reconcile `23388a7` (HEAD). First-cycle lineage
  `c705fe0` present.

## 1. Verdict: PASS WITH NON-BLOCKING FINDINGS

## 2. Falsification results

### 2.1 Refs and lineage — PASS
Live byte-exact heads listed above; `git log 56bc204..23388a7` contains both merge commits and all
lane evidence commits (direct evidence in this record's commit list).

### 2.2 Frozen contract + STATE — PASS
- `git diff 737af38..23388a7 -- docs/governance/VICT-STAGE-09-G2-ENTRY-2026-09-29.md
  docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md`
  → EMPTY (all three files byte-unchanged from `main`).
- Proposal CRLF-normalized SHA-256 recomputed from the blob at 23388a7:
  `f270b17cfd97c5a7be60a4bbfff31a4619f1d3ac3e4f03b45f58d72bed16f7c1` — MATCHES the pinned digest.
- `docs/governance/VICT-STAGE-09-STATE.md` G2 section reads truthfully: it claims execution under the
  frozen contract, the owner-directed repair cycle integrated, and a pending fresh independent
  verifier — it explicitly does NOT claim a gate decision ("this record does NOT claim an owner gate
  decision"), does NOT claim a merge (G2 "NOT MERGED to main"), and still lists FT-1/Quellight/
  publication/activation/G3 as prohibited. Consistent.

### 2.3 Suites run at 23388a7 — PASS (one tool-gate deviation, F-1)
Commands and counts:
- `npm ci` — installed clean.
- Full workspace build (`npm run build`, contracts→…→cli dependency order): all dist present. Note:
  building only runtime+control+sdk out of order fails on un-built workspace deps; the FULL ordered
  build is the valid gate.
- `npx vitest run --project unit` — **2404/2404, 120 files** (no failures; the "rerun twice on any
  failure" rerun not triggered).
- `apps/studio npx vitest run` — **74/74, 9 files**.
- Integration project — 4/4; explicit proof-matrix file `packages/server/test/confirmation-matrix.test.ts`
  — **29/29** (matches the STATE "matrix 29/29" claim).
- `node scripts/verify-stage9-inventory.mjs` — **INVENTORY OK**; G1 reads on all three surfaces
  UNAMENDED; G2 confirmation surface accounted (counts: pre-existing 20, legacy-mutation 4,
  stage9-g1-read 11, shared 1, g2 6).
- `npx tsc --noEmit` — **0 errors**.
- `npm run format:check` — **clean**.
- `npm run lint` — **1 ERROR**: `scripts/stage9-g2-stack.mjs:157:15  no-empty  Empty block statement`
  (an bare `catch {}` in the fixture lifecycle helper). This falsifies the recorded "check/lint/format
  clean" gate sentence as to lint. It is a scripts-only empty swallow with no runtime effect on the
  governed surface; classified NON-BLOCKING but the State claim must be corrected. → **F-1**.

### 2.4 S9-03 changeset journey — PASS
Files read: `apps/studio/src/routes/changesets/+page.server.ts`, `+page.svelte`,
`src/lib/changesets/changesets.ts`, `src/lib/server/changeset-transport.ts`,
`apps/studio/tests/changeset-contract.test.ts` (9+ `it(` cases, count 13).

- Body closure: `buildProposeBody` validates every member (bounded ids via `ID_PATTERN`, closed
  risk class, approver count 1–8, epoch-ms, rationale 1–2000); `buildReviseBody` = closed revise
  field set WITHOUT an authorable base; `buildDecideBody` closed approved|declined; `buildCommitBody`
  = exactly `{changesetId}`; `buildCheckBody`/`buildAttachEvidenceBody` closed; unknown members →
  null → no fetch, fail closed. Bounded Idempotency-Key pattern enforced before any fetch.
- Transport: `resolveChangesetCredential` fails closed (unknown/absent/malformed target, unknown
  actor, missing credential → `unreachable`, no fallback, no echo); the ONLY fetch path; selector
  and credentials never forwarded into the response. Banner mapping: truthful restatement of
  `VICT_ACTOR_SCOPE_DENIED` (403), `NOT_APPROVED`, `APPROVALS_INVALIDATED`, evidence-*, idempotency
  codes; failed views show banner ONLY (matches screenshots).
- Machinery facts (all direct, in-file):
  - `packages/control/src/control-plane.ts` revise path (`reviseChangeSetContent`, ~:287–330):
    a change set that is `draft` OR `approved` may be revised by the author, and revision returns
    `status:'draft'` with the NEW contentHash — an approved proposal is DEMOTED to draft.
  - `commit()` throws `VICT_CONTROL_CHANGESET_NOT_APPROVED` when `status !== 'approved'`
    (control-plane.ts:882–889), BEFORE the approvals-binding check
    (`listChangeSetApprovals` / contentHash binding, :900–910, error `VICT_CONTROL_APPROVALS_INVALIDATED`).
  - Reachability falsification for `APPROVALS_INVALIDATED`: the ONLY public command that changes a
    content hash is revise, and revise always yields status `draft`; decide() runs only on `draft`
    (:428) and binds the CURRENT hash. Therefore no payload through the public command
    propose/revise/decide/commit surface can reach the binding check with a mismatched approval hash
    while status is `approved`; the committed/applying resume paths return before it. The claim
    "APPROVALS_INVALIDATED is defense-in-depth, NOT reachable through the current public command
    surface" is CORRECT; the scripted (b) negative's truthful result is `NOT_APPROVED`, and the
    journey shows exactly that. Falsification attempt REJECTED.
- Four negatives demonstrated with live screenshots + code paths:
  - (a) self-approval: author credential relays decide → target 403 `VICT_ACTOR_SCOPE_DENIED`;
    board still shows the draft (s903-self-approval-denied.png, s903-self-approval-denied-final.png).
  - (b) changed content: commit after revise of an approved proposal → `NOT_APPROVED` banner;
    board shows the demoted/revised record (s903-changed-content-denied.png).
  - (c) missing approval: committing a draft → `NOT_APPROVED` banner, no effect
    (s903-missing-approval-denied.png).
  - (d) duplicate effect: second commit idempotent — same receipts, one outcome (commitBannerText
    + control-plane.ts:874–877 committed-status branch returning listOperationReceipts; the two
    truthful shapes — fresh-key committed replay and same-key command-replay (`data.changeset`) —
    are both recognized by the parsers) (s903-duplicate-idempotent-replay.png).
- Fixture grants hygiene (apps/studio/scripts/demo-target.mjs:115–125): author = read +
  changeset.propose/revise, NO changeset.approve; approver-a = approve+commit; approver-b = approve.
  Correct roles/scope hygiene; commit scope on approver-a only. VERIFIED.

### 2.5 Target-selection fail-closed (lane E) — PASS
- `src/lib/server/confirmation-transport.ts` `boundedFetch` (:46–70): unknown/absent/invalid target
  → `{kind:'unreachable'}` with NO fetch and no echo; removed the earlier local fallback.
- `tests/target-selection.test.ts` (6 cases): the direct unknown-target-while-local-exists test
  asserts `getTarget('unknown-target-x')` undefined while `getTarget('local')` defined, a fetch spy
  installed and asserted NEVER called for prepare/status/confirm on the unknown id, result exactly
  `{kind:'unreachable'}`, banner JSON not containing the requested id, absent targetId also failing
  closed, and a control case proving the explicitly-provisioned local target resolves and fetches
  exactly one call to its own endpoint. VERIFIED — direct test present and passing (in the 74/74).
- Other studio fetch-path sweep: only five fetch sites exist (`changeset-transport.ts:141`,
  `confirmation-transport.ts:96`, `targets.ts:275/304` probe, `vict-client.ts:118` `callTarget`).
  The `[ ...vict]` host route and login do their own structured 404 (no proxy fetch). The G1 read
  client (`vict-client.ts` `callTarget`) and the probe path take a REGISTRY entry (not a
  client-supplied id) and are READ-ONLY GET surfaces with bounded timeouts, allowlisted query keys,
  and truthful unreachable/rejected states — classified read surface; targetId is server-side, not
  client-selected. `confirmation-transport` reads (`readTargetRunRecord/Waits/searchTargetAudit`)
  go through `boundedFetch` (fail closed). No mutation path lacks the discipline. One cosmetic note:
  `+page.server.ts:310` renders `effectiveTargetId ?? 'local'` as a DISPLAY label inside the ok
  branch; unreachable there (confirmCommand with an undefined/unknown target returns
  `unreachable` before ok), so it cannot mislabel — noted as F-2 (cosmetic, no action required).

### 2.6 S9-04 real-effect journey (lanes F + integrator repairs) — PASS
- Fixture composition (`apps/studio/scripts/demo-target.mjs`): `controlPlane.cancelRun` Proxy port
  (:516–518) → the runtime's own `requestCancellation`/`applyCancellation` mechanics with the
  runtime's own hash/event shapes (`vict.cancellation-command@1`, `run.cancel_requested`,
  `run.cancelled`); `runResolution:{resolveBlocked:...}` and `runSignals:{signalWait:...}` options
  (:533–534) → the existing `resolveBlocked`/`signalWait` store mechanics with
  `vict.resolution-command@1`/`vict.signal-command@1` and the runtime's own events. NO invented
  semantics found (direct read of the composed commands + hashes/events above).
- `resolve` executor failed_to_apply stable path (:405–431): a run blocked on a DURABLE SIGNAL WAIT
  has no blocked token; the store's raw error is caught and the executor returns the stable truth
  `{status:'failed_to_apply', errorCode, runStatus, runRecordRevision}` — no thrown 500, no fake
  success; audit view remains the verifier. VERIFIED.
- `asExecutorResult` (`src/lib/confirmation/confirmation.ts:447–472`): nested `result` wins;
  otherwise the whole response data is the verbatim confirmed-call answer, gated on identity members
  (runId/changesetId + status) — so top-level run-intervention answers render verbatim, and anything
  without identity is absent, never invented. Covered in tests (confirmation-contract.test.ts, green).
- Effect/audit panel render truthfulness: the page renders before→after run record + revision via
  `GET /vict/v1/runs/:runId`, waits before→after with `resolvedBy` = the confirm key, the target's
  own audit rows (`confirmation.prepared` with digest+identity, `confirmation.consumed`), and the
  executor's verbatim result (s904-real-effect-signal.png: run blocked→blocked, revision 2→2, wait
  `wait-demo-signal` resolvedBy `s904-final4-signal-confirm-1`; s904-real-effect-audit.png full panel;
  s904-real-effect-cancel.png run.cancel HTTP 200). Truthful, no fabricated state.
- S9-04 negatives still demonstrable: s904-stale-denied.png (wrong expectedRevision pin →
  `VICT_CONFIRMATION_STALE`, nothing changed), s904-spent-denied.png (fresh key on settled receipt →
  `VICT_CONFIRMATION_SPENT`, no second effect), s904-same-key-replay.png (same key → truthful replay
  of the recorded outcome). Backed by the 29/29 confirmation-matrix suite. VERIFIED.
- Journey plan addendum (qa-artifacts/stage9-g2/journey-plan.md §5): matches the implemented fixture
  composition, command shapes, panel fields and negative list. VERIFIED.

### 2.7 Screenshots added after 56bc204 (owner-requested explicit check) — PASS visual check
`git log 56bc204..23388a7 --name-only` images (17 s9xx plus journey-plan.md):
s903-propose-draft-board, s903-self-approval-denied, s903-self-approval-denied-final,
s903-missing-approval-denied, s903-approved-promoted, s903-decide-approved,
s903-committed-exactly-once, s903-committed-final, s903-duplicate-idempotent-replay,
s903-changed-content-denied, s904-real-effect-signal, s904-real-effect-audit,
s904-real-effect-cancel, s904-stale-denied, s904-spent-denied, s904-same-key-replay,
s904-confirmations-review-populated (+ pre-existing s904-confirmations-journey, s904-status-prepared).
Each was OPENED and READ. Findings:

- ALL pass the truthful-journey-UI check: recognizable journey headers, readable banners/restating
  stable codes, real record content, no fabricated state, no wrong/stale/empty panels.
- Banner-only (truthful failure views — banner + the truthful unchanged board) — that is the
  DOCUMENTED design ("a failed view shows a truthful banner ONLY"): self-approval-denied(-final),
  missing-approval-denied, changed-content-denied, s904-stale-denied, s904-spent-denied,
  s904-same-key-replay (ok-batch replay banner).
- Real record/panel content: propose-draft-board (draft row + full content-hash board),
  approved-promoted, decide-approved, committed-exactly-once (committed row + receipt banner),
  committed-final, duplicate-idempotent-replay, s904-real-effect-signal/-audit/-cancel, and
  s904-confirmations-review-populated (real receipt id/digest/expected revision/expiry).
- No screenshot shows a wrong, stale, or empty panel where content is claimed.

### 2.8 Scope audit — PASS
- Quellight paths in `git diff 56bc204..23388a7 --name-only`: ZERO.
- `git diff 56bc204..23388a7 -- packages/` → **EMPTY** (no production-code edits).
- FT-1: no run-detail navigation added; only prose mentions in the STATE prohibition list.
- Publication/activation: no publication or activation claims in code; prose only where prohibited
  lists restate them.
- No gate-table tampering: the G2 gate row honestly reads "fresh verifier pending at the final
  repair-cycle SHA → owner G2 gate decision" (updated to reflect this record).

## 3. Findings

- **F-1 (non-blocking, tool-gate integrity):** `scripts/stage9-g2-stack.mjs:157` empty `catch {}`
  fails `npm run lint` (`no-empty`, 1 error) while the 23388a7 STATE section claims "lint clean".
  The claim as written is false at this SHA. Repair is trivial (add a comment or `catch { /* ... */ } `)
  and touches scripts only — but the State sentence must be corrected in the same commit that repairs it,
  or an addendum must record the discrepancy before the owner reads the gate.
- **F-2 (cosmetic, no action required):** `apps/studio/src/routes/confirmations/+page.server.ts:310`
  display label `effectiveTargetId ?? 'local'` — unreachable in the mislabel case (the transport
  fails closed first) but reads as a fallback; an explicit resolved-target name would be cleaner.
- **F-3 (note):** building only `runtime+control+sdk` standalone fails before the full ordered
  workspace build populates `@victframework/contracts`/`ui` dist — verification procedure item, no
  code issue.

## 4. Criterion matrix (owner-directed repair items)

| Owner-directed item | Result | Evidence |
| --- | --- | --- |
| S9-03 governed-machinery journey + 4 negatives | PASS | §2.4 + screenshots + suites (74/74, changeset-contract tests green); transport/contract modules byte-read |
| Target-selection FAIL-CLOSED + direct unknown-target test | PASS | §2.5: confirmation-transport.ts:46–70; tests/target-selection.test.ts (spy never called, no echo) |
| S9-04 REAL-EFFECT journey + STALE/SPENT/same-key negatives | PASS | §2.6 + screenshots (real effect panel, resolvedBy, audit rows; negatives truthful) |
| Evidence reconcile (screenshots after 56bc204) | PASS | §2.7 (all 17 opened; all truthful) |
| STATE reconcile | PASS | §2.2 (truthful execution+repair claims; no gate decision, no merge) — subject to F-1 wording fix |

## 5. Gate recommendation

**PASS WITH NON-BLOCKING FINDINGS.** F-1 should be repaired lint-wise plus the State's
"clean" wording corrected (or addendum-recorded) before the owner signs the G2 gate; it does not
block on govern-surface integrity grounds (scripts-only empty catch; zero governed-surface effect).
G2 remains NOT MERGED and NOT a passed gate until the owner decides on this record.

— Independent verifier record, 2026-09-29, at candidate `23388a7eb887d0211eeb5b0b6f98155e70709489`.