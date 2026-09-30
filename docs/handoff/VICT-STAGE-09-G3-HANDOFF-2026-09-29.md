# VICT Stage 09 — G3 Handoff (AMENDED by owner decision 2026-09-29; contract-freeze pending)

> **Authority.** This handoff implements the owner's G3 decisions recorded
> in `docs/governance/VICT-STAGE-09-G3-PROPOSAL-2026-09-29.md` §0
> (OD-R1..R6). It is a PROPOSED contract: nothing here authorizes
> implementation until the G3 entry contract is frozen after the
> independent reviewer challenge on the final contract bytes. It follows
> the frozen architecture (`STAGE-09-STUDIO-AND-RECOVERY.md`), the frozen
> G0 decisions (D-1..D-10), and the G2 closure record. Baseline:
> `origin/main` = `510ef7ef668ebd9aea09378b05f221574c4d2ea6`; working
> branch `codex/stage9-g3-proposal` (proposal amended at the parent of
> this handoff commit). Quellight live ref at recording: `main`
> `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6` (Stage 07 closed;
> `@victframework/*@0.3.1`) — re-verify before any Quellight-adjacent
> work; never assume the SHA.

## 0. Program rules (OD-R6 + AGENTS.md)

- Each G3 gate runs the full loop: frozen contract (this document set) →
  builder candidate(s) on exclusive paths → integration by the single
  integrator (stage manager) → fresh-context independent verifier in a
  separate checkout → bounded repair → re-verification → gate report.
- A builder report is a candidate, never a verdict. Verifiers never
  repair. No force-push, ever. Commit+push+remote-verify every gate.
- Non-overlapping builders own exclusive paths (§2). Cross-lane touches
  are recorded and reconciled at integration.
- Stop conditions (owner-directed, per gate): a material change to the
  accepted product or security contract; an unavailable external right;
  a non-remediable required failure; or a necessary Quellight change that
  cannot pass its own governance. Otherwise the program stops only at the
  final G3 boundary report.
- Standing prohibitions: no package publication, no product activation,
  no edit to the unfinished greenfield Quellight project, no silent claim
  that the 0.3.1 target supports newer operator features, no Quellight
  fork or vendoring (the pairing runs against Quellight's own tree at its
  live ref).

## 1. Work packages

### WP-G3-A — FT-1: definition-driven row navigation (gate G3-A)

**Scope.** In `packages/ui` and `packages/ui-svelte`: add the
definition-declared row→detail navigation mechanism to the shipped List /
RecordsTable roles (a real link affordance driven by the Application
Definition — e.g. a role/navigation binding declaring how a row resolves
to a detail target — rendered as genuine navigation, not a dispatch-only
button). Navigation-only: no data surface change, no new command, no read
scope, no style-system change beyond the link affordance. In
`apps/studio`: consume the mechanism in the Studio Application Definition
so run-list rows navigate to the run-detail route (WP-G3-B's target).

**Boundary.** Alternatives rejected at G0 stand (no unnamed island, no
silent hand-built navigation). The platform release and any
external-consumer claim remain out of scope (OD-R5: planning annex
allowed, publication separate).

**Done when.** Platform mechanism + Studio consumption land with unit
tests on both sides (platform: definition-driven link rendering incl.
its absence = no link; Studio: definition declares the run-detail
binding), full existing suites stay green, and the integrated candidate
renders navigable rows in the real Studio.

### WP-G3-B — S9-02: run-list → run-detail drill-down journey (gate G3-B; after G3-A)

**Scope.** In `apps/studio`: the run-detail route + server reads via the
existing G1 read client (`run.get`, `run.events`, `run.waits`, and the
protected `run.detail` where authorized); provenance, ordered events,
current node, safe error and waits, version compare, bounded options
rendered from reads only. The D-5 protected-detail surface: one
authorized positive retrieval, retention behavior, per-access audit
(`run.detail.accessed`), and the redaction/denial/leakage canaries. The
S9-02 negative set: empty lists, redacted generic detail, pagination,
stale revision, actor denial.

**Boundary.** Uses FT-1 navigation only (no custom island). Runs against
the local demo target fixture (the G2-era composed fixture, reused; no
new target semantics). No confirmation-surface changes.

**Done when.** Real browser journey (list → detail via row navigation)
with screenshots at the integrated candidate; direct-API negatives green;
protected-detail audit rows visible; all reads verbatim from the target.

### WP-G3-C — the existing-Quellight same-turn proof (gate G3-C)

**Scope.** In `apps/studio` ONLY (plus fixture composition outside the
Quellight repo): a **narrow, explicit, version-aware Studio transport**
for Quellight's declared read-only same-turn inspection surface on
`@victframework/*0.3.1`:

1. A target-registry entry for the local Quellight target that declares
   the expected target release identity (0.3.1) and the pilot binding
   (D-3: existing declared query action/resource —
   `act.queryInspection`/`qlt.inspection`).

   **Identity-pin oracle (re-repair of contract-review B-1; supersedes
   the M-1 repair text):** the inspect surfaces cannot serve as a
   command-list oracle — the 0.3.1 `compatibility.inspect`/
   `health.inspect` answers carry `commandSchema: 'vict.command@1'` (an
   opaque envelope marker, version-invariant across 0.3.1 and
   0.4.0-rc.1), and the contract PROHIBITS pretending otherwise. The
   pin is therefore verified by a BEHAVIORAL ORACLE plus recorded
   PROVENANCE, each element required:
   (i) POSITIVE BEHAVIORAL: the target executes `agent.turn.get` and
   the `app.data.query` read of `qlt.inspection` (both succeed).
   (ii) NEGATIVE BEHAVIORAL (the anti-newer prong): the transport
   probes ONE G1 operator read (`run.get` against any bounded id) and
   requires a REFUSAL (unknown-command/unsupported outcome). On a
   greenfield target that read would SUCCEED — any success of the
   probe FAILS CLOSED the connection with a truthful version error.
   (iii) INSPECT ANSWER-RECORD EQUALITY: the full
   `compatibility.inspect` + `health.inspect` answers are recorded
   verbatim at journey time and must equal the pinned expected record
   (stream/changeset/turn schema ids, commandSchema marker, healthy,
   turnExecutorComposed); any deviation fails closed. The contract
   HONESTLY records that (iii) alone cannot distinguish 0.3.1 from a
   newer set — that distinction is carried by (ii) and (iv).
   (iv) PROVENANCE: the fixture records the exact Quellight git ref it
   started and that ref's own declared release identity from the
   Quellight tree (its release-set identity and `@victframework/*@0.3.1`
   pins) — provenance evidence, labeled as such, never claimed to be a
   runtime oracle. Registry self-echo alone is never sufficient
   evidence. Falsifiers (both retained): pointing the transport at the
   demo target (a newer-schemad surface) must refuse via probe (ii);
   tampering any recorded oracle answer must fail the journey evidence
   check.
2. The transport issues exactly two declared reads for the proof —
   `agent.turn.get` and the `qlt.inspection` `getTurn` query via the
   target's own `app.data.query` — through the target's own
   authorization (its application-server/auth as-is). No mutation verb,
   no bypass, no invented data, no fallback that fabricates.

   **Identity evidence (repair of contract-review M-2 — which
   server-held identity executes each read is specified and provable):**
   the target entry carries TWO distinct server-held credentials: the
   OPERATOR credential (executes BOTH proof reads) and a distinct
   AGENT-CONTEXT credential (used ONLY for the refusal demonstration in the
   required-demonstrations list below). For each credential the transport records the target's own
   `actor.whoami` answer (`actorId`/`roles`/`scopes`) as evidence —
   distinct identities are demonstrated by the whoami DIFF, not assumed.
   If the target resolves both credentials to the same actor (the
   single-actor tree), the whoami evidence PROVES that fact and the
   refusal criterion falls to the OD-R4 path (truthfully NOT
   DEMONSTRATED on the existing tree) — never simulated client-side.
3. Version honesty: the transport and UI label the target's actual
   identity/version; when a newer operator capability (the G1 `run.*`
   reads) is not available on the target, the UI says so truthfully (a
   capability banner), never silently degrades or pretends.
4. The same-turn panel: for one selected turn, render BOTH sides of the
   pairing (the `agent.turn.get` record and the Quellight inspection
   projection) with target/version evidence, using ONLY returned
   projections; absent/failed reads render truthful banners.
5. Credentials: server-held only (the Studio target registry pattern,
   D-2/D-7). The browser never holds a target credential. CSRF/Origin
   checks unchanged.
6. Product-view reusability: the rendering consumes Quellight's DECLARED
   surfaces generically (definition-driven); no Quellight-specific UI
   behavior or branching beyond the declared binding.
7. Target isolation: the Quellight target is separate from the demo
   target; cross-target requests fail closed; a target mismatch is
   refused, not re-routed.

**G3-C required demonstrations (owner-directed):**

- Real browser: the SAME-TURN relationship between the selected turn and
  Quellight's declared inspection view (one turn, two aligned reads).
- Operator allow: the operator's authorized read succeeds.
- Agent-identity refusal: presenting agent identity to the operator
  surface is refused — preserved, not bypassed.
- Underprivileged denial: an actor WITHOUT the inspection permission is
  denied by Quellight's own authorization. If the existing tree (single
  local actor, hard-coded grant) cannot demonstrate this, the OD-R4
  path runs: a separately governed MINIMAL increment in the EXISTING
  Quellight repo (second actor + actor-derived inspection grant; its own
  entry contract, its own fresh independent verification, nothing else
  folded in) before the criterion may be claimed. Record which path was
  taken; never simulate denial client-side.
- Direct-API negatives: unauthorized scope, unknown turn, mismatched
  version pin (falsified against a second, differently-schemad local
  target — the pin must refuse), cross-target isolation attempt, and
  the no-credential case — each refused/truthful with no state change.

  **Underprivileged denial and agent-identity refusal are each subject
  to the OD-R4 trigger with a named decider (repair of contract-review
  M-4):** the G3-C fresh INDEPENDENT VERIFIER decides — from the
  builder's attempt logs plus its own live reproduction — whether the
  existing single-actor tree can demonstrate denial (an actor without
  the inspection permission) or refusal (a distinct agent identity
  denied the operator surface). Only a verifier-confirmed, logged
  impossibility authorizes the OD-R4 Quellight increment, which then
  runs under QUELLIGHT'S OWN governance: its own entry contract, its
  own fresh independent verification, minimal scope (second actor +
  actor-derived inspection grants), nothing else folded in. The stage
  manager never edits Quellight to force a criterion.
- Evidence of the actual target/version used (logs/panels/screenshots
  carrying the declared identity the transport verified).

**Fixture rule.** Quellight runs from ITS OWN repo at its live ref
(clone; read-only usage; run its own composition/scripts). The Studio
fixture composes the target config; it MUST NOT patch, vendor, or modify
any Quellight file. If a Quellight change becomes necessary, that is the
OD-R4 increment with its own governance — never a fixture-side hack.

**Done when.** The full G3-C demonstration set passes in a real browser
against the live local Quellight (or against the post-increment tree if
OD-R4 executes), with screenshots, direct-API negative logs, and the
target/version evidence, all at the integrated candidate SHA.

## 2. Builder ownership (exclusive paths)

| Lane | Owns (may touch ONLY these) |
| --- | --- |
| G3-A builder | `packages/ui/**`, `packages/ui-svelte/**` (navigation affordance + tests), the Studio Application Definition navigation binding (`apps/studio/src/lib/application/definition.ts` + its test) |
| G3-B builder | `apps/studio/src/routes/runs/**` (new run-detail route), run-detail server reads, S9-02 journey tests + screenshots (own `qa-artifacts/stage9-g3/` names) |
| G3-C builder | `apps/studio/src/lib/server/quellight-transport.ts` (new), target-registry entry, product-view/same-turn page (`apps/studio/src/routes/product/**` or declared equivalent), G3-C tests + screenshots |
| Integrator (stage manager) | merges, seam repairs, fixture stack helper, cross-lane reconciliations, evidence commits, STATE |
| Verifiers | read-only separate checkouts; their own report branches only |

Conflicts (e.g. two lanes needing a shared transport helper) are NOT
resolved by builders touching each other's paths; they are recorded and
reconciled at integration.

## 3. Evaluation criteria (verdict vocabulary: PASS / FAIL / NOT DEMONSTRATED)

**G3-A:** (a) definition-driven row navigation exists in the shipped
platform roles and renders a genuine link; (b) absence of the binding
renders no link (negative); (c) Studio run-list rows navigate to the
run-detail route via the binding; (d) navigation-only scope holds (diff
audit: no data/command/scope change); (e) platform + studio suites green.

**G3-B:** (a) list→detail browser journey via FT-1 navigation;
(b) provenance/ordered events/current node/safe error/waits verbatim from
reads; (c) version compare renders; (d) bounded options; (e) protected
detail positive + retention + per-access audit + canaries; (f) S9-02
negatives (empty/redacted/pagination/stale/actor-denial); (g) direct-API
negatives; (h) screenshots at the candidate.

**G3-C:** (a) version-aware transport with fail-closed identity pin;
(b) same-turn browser pairing (agent.turn.get + qlt.inspection getTurn
aligned on one turn — the alignment oracle is the target's OWN
correlation identity: the turnId must appear in BOTH answers and be
rendered in the panel; if the inspection projection carries no turn
correlation field, the criterion is truthfully NOT DEMONSTRATED and
reported, never approximated); (c) operator allow; (d) agent-identity refusal
preserved; (e) underprivileged denial via Quellight's own authorization
(or the recorded OD-R4 increment path); (f) safe projections only — no
invented data (falsifier: mutated/absent reads must render truthful
banners); (g) no browser-held target credential (falsifier: inspect
browser storage/network for target tokens); (h) no Quellight-specific UI
branching (falsifier: the verifier diff-scans the product-view page for
any Quellight-name/target-name branch outside the declared binding);
(i) direct-API negative set; (j) target isolation; (k) target/version
evidence (the recorded compatibility/health/whoami oracle answers at
journey time); (l) Quellight repo byte-untouched at its live ref
(verifier re-checks `git -C <quellight> status`/diff against the live
ref); (m) capability honesty banner for unavailable newer features
(falsifier: the banner must DIFFER between the demo target — reads
present — and the Quellight target — reads absent; identical
banners fail the criterion).

**Exit (final G3 boundary):** criterion matrix for all three gates,
pushed candidate + verifier SHAs, browser evidence, retained findings
(carry G2's F-2/F-3 + load-sensitive timeout as standing), and the
proposed Stage 9 exit action. The separate Stage 9 exit audit is a
further owner-gated step (OD-R6), not part of any G3 gate.

## 4. Verification pattern per gate

Fresh-context verifier, separate checkout, no shared caches with
builders: re-derive every criterion from the integrated candidate;
re-run suites (unit, studio, matrix, inventory, tsc, lint, format);
execute the browser journeys themselves where the criterion is a journey;
attempt falsifications (the §3 falsifiers); return criterion-by-criterion
verdicts + findings (severity-tagged) + a gate recommendation. Repairs
are stage-manager-owned, then re-verified. No gate self-certifies.
