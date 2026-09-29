# VICT Stage 09 — Independent Review of the G2 Controlled-Recovery Contract PROPOSAL (2026-09-29)

> **Document type:** independent review record — documentation audit only.
> **Audited:** `docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md` at
> `codex/stage9-g2-proposal` head `038991ec20ef15164d511845d9df45dc968de7a1`
> (remote-verified byte-exact via `git ls-remote`).
> **Reviewer:** independent reviewer; did not build the proposal; repaired nothing.
> **Code facts re-verified** against VICT `main` at
> `c3f9663cadf80206645a62322e5933ff19c108e9` (grep/checkout directly).
> **Ratified-reference bytes read live:** frozen architecture §4/§7.1 at
> `codex/stage9-g2-proposal` (frozen-byte digests unchanged per
> `VICT-STAGE-09-G0-RATIFICATION-2026-09-29.md`, freeze commit `5c680d51…`) and
> the G0 ratification record §2 D-4/D-10.

## Verdict

**FAIL — one BLOCKING fidelity finding (R-1), repairable by amendment; all code-fact
pins in §3 verified correct; no overclaim of ratified/implemented status found.**

The proposal is a genuine, well-pinned decision draft with a faithful
reconstruction of D-4/D-10 and a fully accurate §3 observation table. It is NOT
decision-ready solely because §5's check-order pinning conflicts with the frozen
B-3 wording on the expired/spent-receipt replay path (see R-1). One repair
releases this to a clean owner decision; findings R-2..R-8 are non-blocking
gaps and questions the owner may answer during acceptance.

## Findings

### R-1 — BLOCKING — §5 check-order and prose rewording can change B-3's ratified outcome on the expired/spent-receipt replay path

**Evidence.** Frozen bytes (architecture §4, `codex/stage9-g2-proposal` tree,
frozen digest `1ebb85b0…`): "The existing command idempotency claim, namespaced
by actor+command+key and bound to the digest of the complete confirmation
request (including receipt ID), is checked **first**. If that exact request was
settled under the same key, **replay its recorded result with no new effect**;
the same key with another request digest retains the existing
`VICT_COMMAND_IDEMPOTENCY_CONFLICT`. **Otherwise**, verify the receipt and
expected state revision; durably claim and fence receipt consumption, execute,
and settle."

The proposal §5 pins "checked in this exact order" to its case table and adds
prose: "The consume step **then** executes through the EXISTING
`#dispatchIdempotent` machinery (claim → fence → domain effect → settle)."
Read as operational pinning (which §1/§11 claim it is — "pinned design"), this
places receipt verification BEFORE the idempotency-digest check. That changes
meaning: per the frozen wording, a same actor+command+key+digest replay of an
already-settled request replays the recorded result with NO second effect even
if the receipt has since expired or been consumed; under the proposal's
ordering, such a caller can instead receive `VICT_CONFIRMATION_EXPIRED` /
`VICT_CONFIRMATION_SPENT` and (because it cannot distinguish) retry with a
fresh key — exactly the path B-3 forbids. The frozen §4 case-table row order is
otherwise reproduced EXACTLY (row-for-row, code-for-code), and §5's row 8 text
matches. The defect is confined to the ordering/precedence prose, but the
proposal presents the ordering as the pinned contract, and D-4/D-10 adopt B-3
"as worded."

**Suggested amendment (informational):** state in §5 that the idempotency
claim + digest check (and settled-replay/no-new-effect) precede all receipt
verification, exactly as the frozen B-3 prose words it, and reconcile table
row 7/8 as case classifications rather than precedence; then the table and
prose agree with the frozen bytes on every path.

### R-2 — NON-BLOCKING — consume-route pinning is internally inconsistent (§4.1 vs §4.3)

§4.1 offers "explicit `POST /vict/v1/confirmations/:receiptId/consume`
(equivalent; single canonical server path is the legacy-command shape in
4.2)" while §4.3's "complete G2 delta" NEW-route list contains only
prepare/status and the two new intervention routes — the explicit consume
route appears nowhere in the route delta or CLI parity row. If an equivalent
secondary consume path exists but is unaccounted, the three-surface inventory
(D-6) will be open; if it does not exist, §4.1 overstates. Note also that any
receipt-in-path design must preserve the non-enumerable/unavailable behavior
claimed in §4.1.

**Suggested amendment:** delete the explicit consume route from §4.1 or add it
to §4.3 with its scope/audit/parity classification.

### R-3 — NON-BLOCKING — D-OPEN-2's "default-deny: held by NO default role" is contradicted by the current default-role mechanism, and the existing `operator.resolve` scope is unclassified

Evidence at `main` c3f9663, `packages/runtime/src/control-types.ts`: `ACTOR_SCOPES`
is a closed array (lines 108–133) and the default role table grants
`administrator: [...ACTOR_SCOPES]` (line 179) — adding `run.signal` (or
`run.resolve`) to `ACTOR_SCOPES` therefore automatically places it in the
default administrator role's scope set; "default-deny: held by NO default
role until deployment grants" needs a different mechanism than the one the
proposal assumes (or an explicit owner statement that the default
administrator role holding it is acceptable). Separately, `'operator.resolve'`
already exists in `ACTOR_SCOPES` (line 122, operator-role line 160) and an
`operator.resolveBlocked` runtime capability exists (used by
orchestration conformance suites); §4.2's "no legacy shape exists to migrate"
and D-OPEN-2's scope-name decision must classify whether `run.resolve`
coexists with, reuses, or retires `operator.resolve` — currently unaddressed
(§4.3 even says run.resolve "goes through the runtime's existing blocked-run
resolution path").

**Suggested amendment:** restate D-OPEN-2 against the actual
default-role-scope mechanism; add an explicit disposition for the existing
`operator.resolve` scope and `resolveBlocked` path.

### R-4 — NON-BLOCKING (completeness) — the crash/race matrix misses the expiry TOCTOU window and prepare-side expiry/replay semantics

§6's 16 rows cover the ratified windows well (P-5 second-actor fence; P-16
cross-store; P-4 lease takeover). Missing, for this design specifically:
(i) receipt expires between §5 receipt verification and the durable consume
claim — no proof pins that expiry is re-checked atomically with (or inside)
the consume claim/le fence (TOCTOU); (ii) prepare-side: semantics of
re-preparing the same actor+command+key+payload AFTER the earlier receipt
expired (fresh receipt? settled-replay? conflict) is unpinned; (iii) reverse
crash order — effect settled, receipt store not yet marked consumed — must be
shown to converge to consumed with "no second effect" (P-16 only states one
ordering parenthetically, "receipt consumed only after domain settlement," which
if taken literally leaves the reverse crash as a stuck `prepared` receipt
after a successful effect; that behavior needs an explicit proof or an explicit
idempotent convergence rule).
Also, P-2's loser outcome (`VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS`) presumes the
loser holds the same prepare/consume key; two concurrent consumes with
DIFFERENT keys on one receipt are unpinned (one should win; the other must
observe `VICT_CONFIRMATION_SPENT` — not stated).

**Suggested amendment:** add P-17 (expiry TOCTOU at claim), P-18 (consume with
a different key while first consume in flight), and an explicit reverse-crash
convergence clause; fix the prepare-after-expiry replay outcome in §4.4.

### R-5 — NON-BLOCKING (completeness) — audit/retention and status-read scoping are named but unspecifiable as pinned

§4.4 says expired receipts "remain auditable per retention" and §4.1/§6 say
the status read is "audited like other reads," but the proposal pins no: who
audits prepare/expire/spend events (which events enter `appendAuditEvent` at
`control-types.ts:1256` today, at what granularity, before/after effect);
retention duration or the D-5 retention-check interplay for the NEW receipt
store; and NO scope entry authorizes `GET /vict/v1/confirmations/:receiptId` —
`ACTOR_SCOPES` has no confirmation-read scope, so the G1 read/auth-matrix
integration is undefined (which actor classes may read receipt status; the
prepares actor obviously; an approver reviewing? unpinned). This matters for
the owner decision because the status read is a new G1-adjacent read surface
created after G1's surface closed PASS.

**Suggested amendment:** pin the confirmation-audit event set, a retention
bounded (or a D-OPEN), and a scope decision for the status read (e.g. reuse
the prepare actor's own receipt only, no cross-actor read — which the
non-echoing rule already implies, but the scope check must still be stated).

### R-6 — NON-BLOCKING (completeness) — `expectedRevision` semantics per command are undefined

§4.4 carries `expectedRevision` + `subjectId` as fields but never states what
"the revision" is per command: for `release.select`/`release.rollback` the
natural candidate is `selectionRevision` (`control-types.ts:1231/1286`); for
`run.cancel`, `run.resolve`, `run.signal` the analogous run-level revision
counter must be named or the field scoped to only some commands. Without
this, `VICT_CONFIRMATION_STALE` (row 5) is undecidable per command and P-9 is
unimplementable as pinned. The owner must decide this to accept the contract.

**Suggested amendment:** add a per-command expectedRevision column to §4.2
(or an explicit "expectedRevision is None for command X" row).

### R-7 — NON-BLOCKING — confirmation surface × G1 auth-matrix / pagination integration is asserted, not pinned

§8 adds "confirmation accounting to the inventory" but the proposal does not
state how prepare/consume/status interact with G1's accepted auth matrix and
read surface: no confirmation list endpoint (so no pagination question arises —
good, but say so), the prepare route requires "the TARGET command's mutation
scope" (scope-only, correct per D-4), and no new read commands are added.
State explicitly that no paginated confirmation listing exists and that the
status read passes the same session/CSRF/Origin boundaries G1 pinned, so the
G1 surface is unamended.

**Suggested amendment:** one sentence pinning the above; also fix the §4.1
typo "represation" → "representation" in this normative text.

### R-8 — NON-BLOCKING — minor §3 evidence gaps (no mispinned facts)

Every §3 row re-verified against `main` c3f9663 and confirmed EXACT:
registry scopes/fields for the four commands (`commands.ts:181–228`);
`run.resolve`/`run.signal` absent (repo-wide grep, zero hits); the four
`POST_ROUTES` paths (`http.ts:254–265`); CLI one-step entries
(`cli/src/commands.ts:108/122/129/214`); the `CommandIdempotencyStore` port
surface incl. `releaseReceipt`/`takeOverExpiredLease`/`findReceiptByActorKey`
(`control-types.ts:1824–1893`); lease default 60s (`commands.ts:830`);
no confirmation store today (negative grep); `commandIdempotency` separate in
`AgentControlStores` (`control-types.ts:1896`). Two understatements, not
misstatements: (i) the stable-code list omits `VICT_IDEMPOTENCY_FENCE_CONFLICT`
(`control-types.ts:1780`), which the proposal's own P-5 relies on; (ii) the
ChangeSet row's evidence pointer ("control package") is vague relative to the
table's otherwise exact pinning style.

**Suggested amendment:** add the missing code to the §3 codes row and a file
pin for the ChangeSet row.

## Falsification attempts performed (none breaks the design except R-1)

- **Legacy fence bypass hunt (question 3a):** the fence pinned "in the command
  service, not the transport" covers direct API, HTTP (`POST_ROUTES` is the
  only mutation transport; the four paths all map through it), CLI (one-step
  entries replaced), and SSE (read-only, actor-scoped per `http.ts:29`—no
  mutation path). `app.data.mutate/action` has no transport route today and §8
  keeps it unexposed. The prepare route produces no effect. Administrator
  bypass is explicitly denied in §4.2, P-11/P-12, and matches D-4's frozen
  wording. One residual transport question: `POST_ROUTES` maps every path to a
  single command name, so once the fence is in the command service, no
  transport path reaches the four commands unconfirmed — airtight as designed.
- **B-3 outcome-table fidelity (3b):** the case table matches the frozen table
  row-for-row including row 8 "no second effect" and the fresh-key-on-spent-
  receipt rule; only the precedence prose diverges (R-1).
- **Cross-actor receipt leak (3d):** prepare responses echo only to the
  preparing actor; foreign receipts are non-echoing everywhere including the
  status read; no listing/enumeration route exists. No cross-actor leak found,
  but the status read's authorization scope is unpinned (R-5).
- **Overclaim grep (3g):** the header explicitly disclaims implementation,
  ratification, and authorization; §9 correctly says the G1 amendment "does
  NOT carry into G2 automatically" (matches the amendment's own §2 "At G2 the
  frozen single-builder stop-and-report procedure is in force again").
  No sentence claims anything as ratified/implemented beyond what the frozen
  bytes say. G1 lineage figures (candidate `f68c2bb…`, closure record) match
  the closure record in the same tree.
- **No contradiction with G1's accepted surface (3h) beyond R-5/R-7:** the four
  POST routes and their scopes are unchanged; G1 read commands are untouched;
  new scopes extend a closed vocabulary (that is a design action, correctly
  signaled), with the D-OPEN-2 caveat in R-3.

## Completeness summary for the owner (severity-tagged)

Owner-relevant unpinned items, with R-x references: status-read authorization
scope (R-5); confirmation audit/retention policy (R-5); per-command
expectedRevision semantics (R-6); precedence of idempotency-replay vs expired/
spent receipt (R-1, blocking); D-OPEN-2 default-deny vs default-role mechanism
and `operator.resolve` coexistence (R-3). S9-04 Studio-side confirmation UX is
already named (§6); confirmation-read pagination is a non-issue absent a list
route (say so, R-7). No decision-blocking gap besides R-1.

*(Suggestions throughout are informational; the drafter repairs.)*

---

## Addendum — re-review of the REPAIRED proposal (2026-09-29)

> **Audited repair candidate:** `codex/stage9-g2-proposal` at
> `034281d255ae07c5fb6127e25b8e144dbff7fec9` — remote-verified byte-exact via
> `git ls-remote`. **Diff scope confirmed:** `git diff 038991e..034281d` touches
> ONLY `docs/governance/VICT-STAGE-09-G2-PROPOSAL-2026-09-29.md` (108 insertions,
> 23 deletions; documentation-only).
> This addendum covers AFFECTED CLAIMS ONLY; the original sections above are
> unchanged. No code was run beyond git/grep/read; nothing repaired by this
> reviewer.

### Addendum verdict: **PASS WITH NON-BLOCKING FINDINGS**

All eight findings are repaired faithfully against the actual code; R-1's
precedence repair is exactly the frozen B-3 wording. Three small
non-blocking residuals (A-N-1..A-N-3 below) do not block owner acceptance.

### Findings disposition (R-1..R-8 → RR-1..RR-8)

- **R-1 → RESOLVED.** §5 now pins "Phase 1 — existing command idempotency,
  checked FIRST": settled lookup for (actor, command, key) bound to the
  digest of the COMPLETE confirmation request (incl. receipt ID); same
  key+digest → replay with **no new effect, even when the receipt is now
  expired or spent** (P-17/P-18 pin this); different digest →
  `VICT_COMMAND_IDEMPOTENCY_CONFLICT`; table reclassified as the Phase-2
  outcome classification of UNSETTLED claims, rows 7/8 removed from Phase 2.
  Phase 3/4 mirror the frozen claim→fence→execute→settle wording. This now
  matches the frozen B-3 prose exactly on every path; the naive
  expired/spent→fresh-key path the review flagged is explicitly closed.
- **R-2 → RESOLVED.** §4.1 pins "exactly ONE canonical consumption shape — no
  separate consume route exists"; §4.3's route delta now agrees (prepare,
  status, and the confirmed command routes themselves). The "represation"
  typo is fixed.
- **R-3 → RESOLVED (verified against `main` c3f9663).** D-OPEN-2 now states
  `administrator: [...ACTOR_SCOPES]` (`control-types.ts:179`) explicitly —
  new scopes are held by the default administrator role BY POLICY; default-
  deny holds for non-administrator classes; the confirmation fence (not scope
  absence) blocks admin legacy bypass. `operator.resolve` correctly
  classified as the stream-inspection privilege — verified: it gates
  cross-actor stream reads at `packages/server/src/commands.ts:1390` and
  `packages/server/src/http.ts:637`, and the `stream.inspect` command is
  `agent.stream.read`-scoped (`commands.ts:250`). `resolveBlocked` treated as
  the internal executor; `run.resolve` = NEW scope. Accurate against source.
- **R-4 → RESOLVED.** P-17 (settled replay of expired receipt), P-18 (spent,
  same precedence), P-19 (expiry TOCTOU: claim fenced only when the fence
  wins before `expiryAt`; at/after expiry fails closed; no mid-flight expiry
  of a granted claim — testable and sound), P-20 (different-key concurrent
  consume → `SPENT`, consuming key recorded), P-21 (reverse-crash convergence:
  Phase 1 replays recorded result AND receipt converges to `consumed` under
  the same fence — exactly one effect), P-22 (prepare-after-expiry → bounded
  replacement receipt, expired record stays auditable). All sound; see
  A-N-3 for the one loose detail.
- **R-5 → RESOLVED.** §4.3 pins the status read's authorization = the
  receipt's command's mutation scope, non-echoing for other actors, added to
  the permanent authorization matrix both directions; single-receipt read,
  no list endpoint. §4.5 pins closed audit actions `confirmation.prepared`/
  `confirmation.consumed` (digests/identities only, NEVER payload bytes —
  this is the correct shape for the D-5 leakage standard); expiry/spend
  surfaced via the durable record + `audit.search` subjectType.
  Retention: justified as the unchanged control retention policy since no
  payload bytes enter the store — acceptable rationale; see A-N-2.
- **R-6 → RESOLVED (verified).** §4.4's table: `run.cancel`/`run.resolve`/
  `run.signal` → `recordRevision` read via `run.get` (verified: the run
  projection carries `recordRevision` at `packages/server/src/commands.ts:472`;
  type at `packages/kernel/src/orchestration-state.ts:144`);
  `activation.select` → current selection's `selectionRevision` via
  `activation.selected`, or truthful `null` (consume then requires still-
  unselected — sound); `release.select`/`release.rollback` →
  `selectionRevision` via `release.selections` (verified:
  `commands.ts:1136/1664`). Omission rejected (`VICT_CONFIRMATION_FIELD_
  REQUIRED`, candidate name) — no no-guard shape. Complete.
- **R-7 → RESOLVED.** §6.1 pins the inventory gains (prepare, status read,
  two new commands + CLI two-step) and asserts the G1 READ surface UNAMENDED
  at the command/registry level (accounting rows only); §4.3 pins the
  single-receipt read (no pagination surface).
- **R-8 → RESOLVED.** §3 codes row now includes `VICT_IDEMPOTENCY_FENCE_
  CONFLICT`; the ChangeSet row pins `packages/control/src/control-plane.ts`
  and its conformance suite (path verified to exist at c3f9663).

### New defects introduced by the repair — none blocking

- **A-N-1 — NON-BLOCKING:** §4.5 ends "…beyond what that scope mechanism
  already yields (see §4.6)" but the document contains NO §4.6. The intended
  content (role/scope interaction) is covered by the corrected D-OPEN-2
  text; the dangling cross-reference is a documentation defect only.
- **A-N-2 — NON-BLOCKING:** retention duration is not literally stated — the
  §4.5 rationale (digests/identities only ⇒ control retention policy applies
  unchanged) is sound but the owner may want the explicit retention window
  named when D-OPEN-1's TTL is decided.
- **A-N-2b/structure — NON-BLOCKING (cosmetic):** §4.4's expectedRevision
  table and §4.5 sit physically AFTER §11 at end-of-file rather than in
  document order; P-22's "bounded attempts" limit is unnamed. Content is
  sound; ordering/precision only.

### Overclaim re-check on the repair

No new overclaims: the header disclaimers are unchanged; each new section is
labeled as pinned design reconciled to ratified bytes with reviewer-fold
attribution; D-OPEN-2's corrected role semantics now matches the actual
source mechanism; nothing is asserted as ratified or implemented beyond the
frozen G0 bytes and the G1/G2 boundary statements (G1 amendment lapse
wording retained unchanged and correct).

### Residual items for the owner

1. Fix A-N-1 (dangling §4.6 reference) in the next doc touch — cosmetic, do
   not block acceptance.
2. Decide D-OPEN-1 (TTL) together with an explicit receipt retention window
   (A-N-2) so the retention answer is one number, not "as before".
3. Note D-OPEN-2's corrected consequence: adding `run.resolve`/`run.signal`
   to `ACTOR_SCOPES` places both in the default administrator role BY POLICY
   (non-administrators only via explicit grants); if the owner wants even
   administrators to need explicit grants, that is a NEW mechanism decision,
   not an amendment freebie.

**Addendum verdict restated: PASS WITH NON-BLOCKING FINDINGS.** The repaired
proposal at `034281d` is decision-ready for owner acceptance of D-4/D-10
operationalization with D-OPEN-1..3, subject only to the cosmetic residuals
above.