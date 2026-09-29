# VICT Stage 9 — G0 Correction Review (2026-09-29)

> **Document type:** independent re-review of the corrected PROPOSED Stage 9
> G0 entry pack, following the first independent review at
> `review/stage9-g0-20260929` @ `bf8db58dce512824c8c74b6f8daa03b4a4c005a3`.
> **This is NOT a ratification.** G0 remains HELD for owner decision. This
> review changes no candidate file, no implementation, and no Quellight file;
> merges nothing; publishes nothing; activates nothing.
> **Reviewed corrected candidate:** `codex/stage9-g0-candidate` @
> `a500e0b65ff2f93608d26f14fc14712818028505` (one documentation-only commit
> over the previously reviewed tip `c85af58…`; base unchanged:
> `516948ac8bc55bbae8624bb91b3b35de34b3146c` == live `origin/main`).
> Prior review branch verified unchanged on the remote at `bf8db58…`.

## 1. Identity verification (all PASS)

| Item | Expected | Verified |
| --- | --- | --- |
| Corrected tip | `a500e0b65ff2f93608d26f14fc14712818028505` | YES (live fetch; commit "address independent G0 review findings", 2026-09-29) |
| Correction scope | docs-only: architecture (61 lines), STATE (8), handoff (14); AGENTS.md untouched | YES |
| Base | `516948ac…` == live `origin/main` | YES |
| Prior review cited | `bf8db58…` on `review/stage9-g0-20260929` | YES (remote re-checked; STATE/handoff citations accurate) |
| PR #2 | head at corrected tip, still draft, unmerged | YES (branch tip moved; no merge occurred) |

All code facts from the first review carry over unchanged (same base SHA):
26-command closed registry; 25-entry CLI table; `/vict/v1/app/actions` POST →
`app.data.mutate` only (`app.data.action` unreachable via transport and CLI);
`listenVictHttpServer` hardcodes `listen(0,'127.0.0.1')`; zero anchors in
`List`/`RecordsTable`/`Detail`; host-supplied `ActionDispatcher` and
`ApplicationDataAdapter` ports (VictStores separation rule); `ACTOR_SCOPES`
pre-reserving `activation.read`/`audit.read`/`operator.resolve`;
`VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` + lease takeover in
`#dispatchIdempotent`; CLI `deriveCliIdempotencyKey` (path+payload digest);
stores' `getRun`/`listRuns`/`listEvents`; Quellight `qlt.inspection` +
`getTurn` + agent-refusal + single actor + hard-coded inspection grant +
`'quellight-local-1'` with no release select/publish.

## 2. The four focus areas

### 2.1 S9-02 run-list navigation — gated solution, honest release dependency

Resolved in the proposal. §1 now carries a "Known navigation wall (review
B-1)" paragraph naming List/RecordsTable/Detail as link-less, S9-02's
drill-down as impossible definition-only, and Stage 8's FT-1 as the same
limitation. The recommended disposition (owner-selectable) is the
definition-driven FT-1 navigation addition as a **separately gated
UI-platform prerequisite**, with the release and external-consumer claims
kept separately gated and local integrated proof allowed on pinned local
artifacts first — matching the register's rule that FT-1 needs its own owner
decision and the repo's precedent that local proof precedes any publication
decision. G1 may scaffold and prove a different ordinary read/action path but
"may not claim the S9-02 journey until FT-1 lands"; WP-5 and the S9-02 row
carry the same dependency; alternatives (named navigation-only island,
deliberately menu-only UX) are recorded with their limits, and "no unnamed
island or silent hand-built navigation is allowed." §2 also adds the honest
scoping note that FT-2 chart windowing is not required by the walkthroughs
(accurate — no S9-0x step needs a chart window).

### 2.2 All four existing commands — complete compatibility and no-bypass proposal

Resolved in the proposal. §4 now proposes receipts for new `run.resolve`/
`run.signal` **and** the four existing `run.cancel`, `activation.select`,
`release.select`, `release.rollback`, with an explicit, owner-selectable
compatibility choice: recommended is ONE coordinated versioned
command-contract migration with documented migration of HTTP routes, CLI
entries, target compositions and consumers; a Stage 9-capable target exposes
the receipt-gated version and **rejects the four unconfirmed legacy mutation
routes for every actor class including administrator** (a route-level fence —
mechanically sound, since scope checks alone cannot fence an administrator).
Alternatives (additive prepare/consume; receipt-gated variants) are allowed
only with "an equally strong scope/policy fence… specified and tested," and
an optional payload field without such a fence explicitly fails the gate.
The breakage is stated as intentional, G2 is frozen out until the choice,
impacted callers and release/version plan are fixed, and Quellight cannot
claim Studio support until its own increment adopts the new target contract.
Cost fact verified: Quellight calls none of the four (its only cancel is
`agent.turn.cancel`), so the break lands on CLI operators/scripts, not the
product.

### 2.3 Receipt binding, outcomes, retry/spent, two-step CLI — coherent with existing code

Resolved in the proposal, with two wording challenges (§4 below, R-1/R-2).
The B-3 composition maps exactly onto the shipped idempotency engine:
preparation binds opaque receipt ID + actor + exact command + target +
canonical payload digest (excluding receipt ID) + expected revision + expiry
+ status; confirmation carries receipt ID + a bounded `Idempotency-Key`; the
EXISTING claim (namespaced actor+command+key, digest of the complete
confirmation request including receipt ID) is checked FIRST — same key + same
digest settled → replay recorded result with no new effect; same key +
different digest → the existing `VICT_COMMAND_IDEMPOTENCY_CONFLICT`; fresh
key against a spent receipt → `VICT_CONFIRMATION_SPENT`; concurrent identical
request → the existing in-progress outcome, retry with the same key (matches
`VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS` and the lease-takeover path at
commands.ts:733/790); no receipt ID can produce a second effect under a fresh
key. The eight-row stable-outcome table is coherent, non-echoing where it
must be (`UNAVAILABLE` for unknown or foreign receipts), correctly reuses the
existing conflict code, and correctly labels the new `VICT_CONFIRMATION_*`
names as G0 contract candidates, not shipped codes. The CLI is required to
expose two distinct operator steps (prepare → human review → confirm with the
receipt and an explicit or deterministically derived stable key; no
auto-confirm) — coherent with `deriveCliIdempotencyKey`, since the
confirmation payload includes the receipt ID and so derives a distinct stable
key per receipt, and a retry naturally reuses it.

### 2.4 Inventory check, graph/activation reads, adapter dependency, protected detail, retired facade

All resolved in the proposal and accurate:

- **Three-surface inventory:** §2 names the HTTP transport route table as a
  third surface and cites the real `app.data.action` divergence (registered,
  no transport route, no CLI entry); §6 requires a mechanical
  registry ↔ HTTP ↔ CLI inventory that accounts for every Stage 9 operation
  and classifies pre-existing out-of-scope divergence "without silently
  expanding its scope"; WP-4 becomes "CLI/transport parity" with the same
  inventory. Accurate and correctly scoped (it detects, not auto-fixes).
- **Graph/activation reads:** §4 adds "graph identity/content inspection,
  activation get/list/history and selection identity," with the guard "reuse
  the existing `run.read`, `activation.read` and `audit.read` scope
  vocabulary where appropriate; do not infer a command from a reserved
  scope" — factually grounded (those scopes are pre-reserved and
  command-less) and a good anti-fallacy rule. G1 and WP-1 carry the same
  scope.
- **Studio data-adapter dependency:** §7/G1 and the handoff now state the UI
  shell may scaffold in parallel but a real read cannot be claimed until the
  HTTP-backed adapter and WP-1 commands integrate, and "the adapter may not
  import VictStores" — exactly matching the adapter contract's separation
  rule.
- **Protected-detail positive proof:** §4 and the S9-02 row now require an
  authorized positive retrieval (distinct scope, retention check, per-access
  audit) proved alongside denial/redaction; D-5 and WP-1 carry it.
- **Retired facade:** §1 now states "Studio MUST NOT depend on the retired,
  separately published `@victframework/renderer-svelte` facade"; WP-5
  repeats it. Accurate (facade is out of the workspace and the 14-member
  set; the published npm artifact remains).

## 3. Disposition of the prior review's findings

| Finding | Disposition |
| --- | --- |
| B-1 S9-02 drill-down wall unassigned | **Resolved in the proposal** — named, gated, honest FT-1 release dependency, alternatives recorded. Final path (FT-1 prerequisite vs named island vs menu-only) **requires owner choice** (D-1). |
| B-2 receipt scope on four existing commands | **Resolved in the proposal** — complete compatibility treatment for all four with a no-bypass fence requirement and a G2 freeze gate. Route (versioned migration vs additive/variant with tested fence) **requires owner choice** (D-4/D-10). |
| B-3 retry-vs-spent not normative | **Resolved in the proposal** — bound fields, check order, stable outcome table, CLI two-step, all coherent with `#dispatchIdempotent`. Adoption **requires owner choice** (D-10); two wording folds before freeze (R-1, R-2). |
| N-1 three-surface divergence | **Resolved in the proposal.** |
| N-2 adapter depends on WP-1 | **Resolved in the proposal.** |
| N-3 graph/activation reads missing | **Resolved in the proposal.** |
| N-4 renderer-svelte wording | **Resolved in the proposal.** |
| N-5 new root AGENTS.md | **Resolved in the proposal** — routed into D-1/G0 as a conscious adopt-or-remove choice; **requires owner choice**. |
| N-6 no positive protected-detail path | **Resolved in the proposal.** |
| N-7 STATE identity refresh | **Resolved in the proposal** — STATE now cites the first pack, the review, and explicitly defers the corrected-tip pin ("reported after push"); the final pin happens at ratification (see R-4). |
| N-8 Quellight grant status | No action needed (was informational; unchanged and accurate). |

**No finding remains un-addressed. No new documentation blocker was found.**
What remains between this candidate and G0 ratification is owner decision
space plus the two wording folds below — not gaps in the proposal.

## 4. Challenges to newly introduced complexity / claims

- **R-1 (fold before contract freeze — wording, not a gap):** "verify the
  receipt and state revision, then consume the receipt and effect in one
  atomic transaction" overstates today's architecture. Receipts and command
  effects live in different stores; the shipped mechanism is claim → execute
  → settle with settlement fence tokens plus the domain's own idempotency
  fencing re-execution (applying-saga receipts, activation-selection CAS) —
  there is no cross-store single transaction to inherit. Either reword to
  "atomically consume the receipt under the effect's durable claim/fence,
  with domain idempotency fencing re-execution," or explicitly scope a new
  single-transaction boundary as an ABI item with its own proof. The pack
  already mandates ABI reconciliation before freezing — this must not
  survive into frozen bytes as-is.
- **R-2 (minor wording):** "target" as a receipt binding field is
  Studio-display-meaningful but redundant at the command boundary — the
  target server issues its own receipts and binds itself implicitly. Clarify
  so the field is not read as a multi-target command parameter (the current
  command payloads carry no target field).
- **R-3 (cost disclosure, properly framed):** D-2's recommended mechanics
  introduce new target-side capability: a configurable stable loopback port
  (`listenVictHttpServer` hardcodes port 0 today — an additive platform
  change), a deployment-provisioned target-registry format, and an
  administrator provisioning step outside Studio. The text correctly labels
  these as proposed mechanics for G0 confirmation; the owner should adopt
  them knowing this cost.
- **R-4 (residual, expected):** the STATE gate-history cell defers pinning
  the corrected tip; the owner ratification record (or a tiny docs commit)
  should pin `a500e0b…` as the reviewed candidate identity at freeze.
- Proportionality challenge, for the record: the recommended B-2 route is a
  deliberately breaking migration of four commands whose only current
  callers are CLI operators/scripts (Quellight verified unaffected). The
  honest statement of that breakage, the administrator-inclusive fence, and
  the G2 freeze gate make the recommendation defensible, but it is the
  highest-cost option on the table and the owner, not the pack, should own
  that choice — which the candidate correctly leaves open.

## 5. Plain-language owner decision sheet

Recommendations below are the reviewer's, not owner acceptance. Each decision
can be taken independently; the gating set for G0 ratification is decisions
1–4 plus 6.

**1. S9-02 navigation path (D-1 + B-1).** Recommended: the FT-1 navigation
addition as a separately gated UI-platform prerequisite. Delivers: real
definition-driven row navigation, no bespoke island, S9-02 provable, and the
Stage 8 D-6 exception class retired properly on the formal UI track. Cost: a
new UI-platform increment before S9-02 (local proof can start on pinned
artifacts; a platform release is a later, separate decision), and a slightly
longer path to the full S9-02 journey. Alternatives: a named navigation-only
island (faster, but repeats the D-6 exception pattern) or menu-only UX
(no platform change, weakest walkthrough).

**2. Connection/session mechanics (D-2).** Recommended: adopt as proposed —
deployment-provisioned target registry (fixed loopback host:port +
server-side credential reference), locally provisioned Studio human session
(HttpOnly SameSite cookie, session-bound CSRF token, Origin/Host checks on
JSON mutations), server-side target token, browser never sees it. Delivers:
the four truthful connection states with no token leakage and no arbitrary
proxying. Cost: a small platform addition (configurable port binding), a
registry format, and an admin provisioning step outside Studio; exact
credential storage/lifetime to confirm at G0.

**3. Product-view designation (D-3 + D-9).** Recommended: explicit
server-side pilot binding to Quellight's already-declared
`act.queryInspection`/`qlt.inspection`, recorded as one product integration;
defer any versioned `operator` declaration and Release-record expansion.
Delivers: the product-view pilot with zero Application/Release ABI change
(the declaration exists at Quellight `5f709a5`). Cost: no general discovery —
each future product view needs its own binding or a later contract.

**4. Confirmation compatibility and semantics (D-4 + D-10, B-2 + B-3).**
Recommended: the coordinated versioned migration of all four existing
commands with the legacy routes rejected for every actor class, plus
adoption of the B-3 receipt semantics, outcome table and two-step CLI.
Delivers: one coherent high-impact mutation model with no unconfirmed path by
construction, clean CLI/Studio parity, and a G2 entry that cannot shortcut
the fence. Cost: breaking change for CLI/scripts using `run cancel`,
`activation select`, `release select/rollback` (Quellight unaffected);
release/version planning must be frozen before G2; the exact migration
mechanism (new command names vs envelope version) is pinned at freeze with
R-1/R-2 folded. The additive/variant alternative is viable only with an
equivalently tested fence — expect it to cost nearly as much and read worse.

**5. Quellight claim (D-8).** Owner in/out. Recommended: keep the narrow
same-turn proof gate. Delivers (if in): a real, honest "Studio supports
Quellight for one governed read" claim after Quellight's own increment adds a
second operator actor and actor-derived inspection grants (both absent
today). Cost of in: a separately governed Quellight increment first. Cost of
out: Stage 9 closes saying Quellight support is unproven — acceptable and
honest.

**6. Root AGENTS.md (with D-1).** Recommended: consciously adopt (the text is
bounded, accurate, and disclaims implementation authority). Cost: it becomes
standing agent-entry guidance for the repo at merge.

**7. Accept as updated (no further choice needed beyond acceptance):**
D-5 (protected detail with a positive authorized retrieval), D-6 (three-surface
inventory, equivalent isolated targets, CLI prepare→confirm), D-7
(admin-provisioned actor, no provisioning UI). These now match the code facts
and carry no hidden dependency.

## 6. Disposition and stop

- The correction addresses B-1–B-3 and N-1–N-6 substantively and honestly;
  no material unsupported claim was introduced. Two wording folds (R-1,
  R-2) and one cost disclosure (R-3) must survive into the frozen contract,
  and the corrected tip should be pinned at ratification (R-4).
- **Remaining blockers to G0 ratification are owner decisions, not
  documentation:** the gating set is decisions 1–4 and 6 above (D-1 with
  navigation path, D-2 mechanics, D-3/D-9 pilot binding, D-4/D-10 with B-2
  route and B-3 semantics, AGENTS.md), plus in/out on D-8. Until then:
- **G0 remains NOT RATIFIED — HELD for owner decision.** This review confers
  no implementation authority; the PR is not merged; nothing is published or
  activated; Quellight is untouched.

*Filed 2026-09-29 by the independent G0 reviewer on
`review/stage9-g0-correction-20260929`. Stop.*
