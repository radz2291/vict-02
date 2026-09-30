# VICT Stage 09 — G3 Decision-Ready Proposal (PROPOSED, 2026-09-29 — no implementation authorized)

# VICT Stage 09 — G3 Decision-Ready Proposal (AMENDED by owner decision 2026-09-29; contract-freeze pending)

> **STATUS (as amended).** The owner RECORDED the G3 decisions on
> 2026-09-29 (§0 below) and directed this proposal to be amended, an
> independent reviewer challenge to be run against the amended FINAL
> CONTRACT BYTES, and — after documentation findings are repaired and
> re-reviewed — the G3 entry contract FROZEN. Implementation begins only
> after the freeze. Nothing here authorizes publication, product
> activation, or any edit to the unfinished greenfield Quellight project.
> The G0–G2 frozen records and the original G3 review lineage are
> preserved; superseded text below is marked, not deleted.

## 0. Owner decision record (2026-09-29, recorded verbatim in relevant part)

The owner changed the Stage 9 G3 product-test decision: use the
**existing, Stage 07-closed Quellight on VICT 0.3.1** as Studio's real
product test now; the unfinished greenfield Quellight project is **out of
this execution**. Studio must be designed so the greenfield product can be
tested later through the same product-facing interface, but that later
pairing must NOT be claimed as verified.

- **OD-R1:** the proposal's "greenfield adoption first" recommendation is
  REPLACED by an existing-Quellight-first proof. A **narrow, explicit,
  version-aware Studio transport** is permitted for the declared,
  read-only same-turn inspection surface on Quellight 0.3.1. The Studio
  product-view interface stays reusable; no Quellight-specific UI
  behavior; no silent claim that 0.3.1 supports the newer G1 `run.*`
  operator reads.
- **OD-R2:** no Quellight 0.4 prerelease adoption or stable repin is
  required for this G3 proof. The greenfield pairing is recorded as a
  LATER, separately verified task. No publication is authorized.
- **OD-R3:** FT-1 belongs inside G3 as separately gated **G3-A**; its
  navigation proof must precede the S9-02 G3-B drill-down claim.
- **OD-R4:** the Quellight test stays the SMALLEST same-turn inspection
  proof, preferring existing governed surfaces WITHOUT changing that
  repo. If a second actor, actor-derived grant, or endpoint change is
  NECESSARY, define and execute a **separately governed, minimal
  increment in the existing Quellight repo** with its own entry contract
  and independent verification. Do not touch the unfinished greenfield
  project; do not fold unrelated low findings into this increment.
- **OD-R5:** a publication-planning annex is allowed; package publication
  remains a separate owner decision.
- **OD-R6:** frozen entry contract, integrated candidate, fresh
  independent verifier, bounded repair and re-verification **for each G3
  gate**, then a separate Stage 9 exit audit.

## 0.1 What the 0.3.1 pairing can prove — and what stays unproven

**PROVABLE on the existing Quellight `main` `5f709a5` (Stage 07 closed,
`@victframework/*@0.3.1`), read-only, no Quellight edit:** the D-8
same-turn pairing exactly as the frozen architecture words it — one real
read-only pairing for the same turn: `agent.turn.get` plus Quellight's
`qlt.inspection` `getTurn` via `app.data.query`; only declared, safe
diagnostic projections rendered; operator allow; **preservation of the
agent-identity refusal**; no write authority anywhere; evidence of the
actual target and version used (the transport's explicit version pin);
truthful behavior when newer operator features (the G1 `run.*` reads) are
unavailable on the old target; direct-API negatives; target isolation; and
Studio's server-held-credential boundary (no browser-held target
credential). The frozen D-3 record ("Quellight's existing declared query
action/resource with an explicit pilot binding; no general discovery
claim") is the governing precedent this decision returns to.

**CONDITIONAL (only if the existing tree cannot demonstrate it):**
underprivileged denial needs an actor WITHOUT the inspection permission;
the existing tree has a single local actor whose inspection grant is
hard-coded. If no existing governed surface can demonstrate denial, the
OD-R4 minimal Quellight increment (second actor + actor-derived grants)
runs under its own governance BEFORE the denial criterion can be claimed.
**The same conditional applies symmetrically to the agent-identity
refusal (repair of contract-review M-3):** demonstrating refusal requires
the target to represent a distinct agent identity and deny it the
operator surface; on a single-actor tree that is impossible without the
OD-R4 increment, so refusal would be truthfully recorded as NOT
DEMONSTRATED on the existing tree and routed through the same governed
increment — never simulated client-side. The G3-C gate reports which
path was taken for EACH of the two criteria, truthfully, with the
verifier-confirmed evidence (the target's own `actor.whoami` answers
distinguish the single-actor fact from a demonstrated refusal).

**UNPROVEN by this execution (recorded, not claimed):** the greenfield
Quellight pairing (greenfield platform + G1 `run.*` operator reads native
on the target); any claim that 0.3.1 supports newer operator features; any
publication or registry claim; anything about the unfinished greenfield
Quellight project. The later pairing is a separately verified task under a
future owner decision.

 This is a decision-ready PROPOSAL for the owner's G3 planning
> decision. Nothing in it authorizes implementation, any Quellight edit,
> package publication, or product activation. It is written under the
> owner's explicit no-implementation instruction following the G2 closure,
> and it must survive an independent reviewer challenge before it can be
> presented for the owner's decision. Every claim about Quellight in §3 was
> re-derived today, read-only, at the live Quellight `main` tip.

---

## 1. Purpose and boundary

G2 is closed (owner acceptance, PASS WITH NON-BLOCKING, at
`c018b597e5fa10c3f45b279e05f2fa684bf4baa4`). Two items remain before the
Stage 9 exit gate G3 can execute:

- **(A) FT-1 run-list navigation** — the separately gated UI-platform
  prerequisite that unblocks S9-02 (run list → run detail drill-down).
- **(B) The real Quellight Studio proof** — the owner-selected S9-05/G3
  exit proof (D-8 IN).

This proposal defines the decision space and open decisions for both. It
does NOT implement, does NOT edit Quellight, does NOT publish, and does
NOT authorize any G3 work — all of that requires the owner's recorded
ratification of this proposal (or its amended outcome).

## 2. Item A — FT-1 run-list navigation (S9-02 dependency)

**Known wall (B-1, from the Stage 9 review):** the shipped `ui`/`ui-svelte`
List, RecordsTable and Detail roles have **no row link**. S9-02's
run-list → detail drill-down cannot be definition-only today. Stage 8's
G4 audit recorded the same limitation and it is retained on the Stage 8
follow-up register (`VICT-STAGE-08-FOLLOW-UP-REGISTER-2026-09-29.md`) as
the accepted D-6 clause-B FAIL (navigation-only edit-link island).

**Frozen G0 disposition (D-1):** authorize and independently gate the
definition-driven FT-1 navigation addition as a **separate UI-platform
prerequisite** to the S9-02 proof. Alternatives considered and recorded at
G0: a specifically bounded navigation-only island, or a menu/breadcrumb-only
journey. No unnamed island or silent hand-built navigation is allowed.

**What FT-1 must be (proposed scope, for the owner's confirmation):**
definition-driven row navigation in `packages/ui` + `packages/ui-svelte`
(the shipped platform components), released and consumed by Studio's
definition so S9-02's drill-down is exactly the documented generic
mechanism. Navigation-only: no data surface change, no new command, no
read-scope expansion — G1's reads already provide `run.get`/`run.events`/
`run.waits` detail; the navigation work is purely the platform's
**definition-declared row→detail link**. The platform release and any
external-consumer claim remain separately gated (local pinned artifacts
first, exactly as G0 recorded); **this proposal deliberately does not
resolve publication** (decision OD-5).

**G3 structural consequence:** with FT-1 landed and gated, S9-02 becomes
provable as a browser journey (run list → detail: provenance, ordered
events, current node, safe error and waits, version compare, bounded
options, protected-detail retention + per-access audit — all existing G1
machinery). FT-1 should therefore be a **named, separately gated
increment inside the G3 program**, with its own builder/verifier cycle,
rather than silently absorbed into the S9-02 journey work.

## 3. Item B — the Quellight proof: reconciling the old pilot reference with the current greenfield direction

### 3.1 The old pilot reference (what the frozen Stage 9 contract records)

From the frozen architecture (D-8 / S9-05 / G3-119 row) and the G0-era
observation. Two sources, honestly labelled: the FIRST bullet below is a
**composite paraphrase** of the G0 observation bullet (which reads, in
full: "...5f709a5... declares act.queryInspection/qlt.inspection; single
actor; hard-coded inspection grant; **no VICT Release selected. Recheck
before any Quellight-dependent claim.**" - note "no VICT Release selected"
is now FALSIFIED: Quellight holds the stable `vict-release-set@1/0.3.1`
release identity; and the bullet's own recheck instruction is exactly what
this proposal performs), while the SECOND bullet is the verbatim frozen
architecture text (reviewer N5 confirms its fidelity):

- "*Quellight `main` observed at `5f709a5...` declares
  `act.queryInspection`/`qlt.inspection`, but currently lacks a second
  operator actor, actor-derived inspection grants, and a configured
  stable target endpoint."
- "to say 'Studio supports Quellight,' prove one real read-only pairing
  for the same turn: `agent.turn.get` plus Quellight's `qlt.inspection`
  `getTurn` via `app.data.query`. Show only declared, safe diagnostic
  strings. Prove operator allow, underprivileged denial, and preservation
  of the agent-identity refusal. … It requires Quellight's separately
  governed configured endpoint, second operator actor/credential, and
  actor-derived inspection permission grants. No Stage 9 VICT handoff
  grants Quellight write authority. … if unavailable, S9-05 remains held
  rather than silently dropped."

Chronology correction (reviewer M1): the observation was **not** taken
against a pre-Stage-7 Quellight. Quellight's Stage 07 formal closure landed
2026-09-24 (closure `189210c` 05:59 +0800, status re-key `5f709a5` 06:16),
while the Stage 9 draft era began at the old-surface VICT reference
`88032bc…` (2026-09-24 15:03) and the G0 observation is dated 2026-09-29 -
both AFTER closure. The observation was taken against the **already-closed
governed tree at the same tip**. What makes it stale is therefore exactly
two layers: it predates the greenfield surface split, and its operator-side
gap statements are configuration facts to be re-derived at decision time
(the gaps still literally exist in the tree: a single local actor
`LOCAL_ACTOR_ID` at `src/lib/server/runtime.ts:190`; a hard-coded
inspection grant at `src/lib/server/composition.ts:1099`).

### 3.2 Current truth (re-derived today, read-only, at Quellight `main` `5f709a5…`)

The live Quellight tip is **the same commit** `5f709a5` the old observation
was taken at — but its meaning has completely changed inside Quellight's
own governance:

1. **Quellight Stage 07 is FORMALLY CLOSED** (07A–07E; exit audit "STAGE 07
   VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED", closure
   commit `5f709a5`). No numbered successor stage exists; Quellight's own
   record says the next product-roadmap increment requires a fresh owner
   planning decision. **This proposal is the VICT-side input to that
   Quellight planning decision, not the decision itself** (reviewer M4):
   any Quellight increment must originate and be recorded under Quellight's
   own governance.
2. The declared inspection view **persists and is governed**:
   `act.queryInspection`/`qlt.inspection` (`definition.ts:294`) with the
   `qlt.inspection.read` permission (`inspection-contract.ts:158`), plus
   the whole governed Q5 inspection/memory-mode surface, Q3/Q6
   confirmation ceremony, and 07D retention surfaces.
3. Quellight's VICT boundary is **already real and governed**: operator
   environment validation, a **server-side actor credential** (the browser
   never holds a secret; `operator-credential.ts`), and a **live HTTP
   ceremony proof that already passed exactly once** (Q6 recovery
   ceremony: six turns, eight HTTP requests, zero findings).
4. **The version delta (the real reconciliation decision):** Quellight
   consumes `@victframework/*@0.3.1` — the **old** surface. Stage 9's
   greenfield set is `vict-release-set@1/0.4.0-rc.1` (published under the
   prerelease dist-tag `vict-0.4.0-rc`; registry `latest` remains 0.3.1),
   which is what Studio and this repository's Stage 9 work run on. The
   `agent.turn.get` read command **does exist on the greenfield surface**
   (`packages/server/src/commands.ts:110`), so the same-turn proof is
   expressible there — but pairing a greenfield Studio against a 0.3.1
   Quellight would be a **cross-surface bridge**, and silent hand-built
   bridges are exactly what Stage 9 governance prohibits.

### 3.3 Reconciliation — SUPERSEDED by the owner decision (OD-R1: existing-Quellight-first; retained for lineage)

> **SUPERSEDED.** The recommendation below ("Option 2 ... recommended")
> was replaced by the owner's OD-R1 before implementation. The text is
> preserved unmodified as the reviewed lineage.

The old pilot reference is **evidence-stale in three ways**: it predates
Quellight's own closed Product governance (it describes Quellight as a
gap list, not a closed governed product); it predates the greenfield
surface split; and its "lacks X" items are operator-side configuration
facts that must be re-derived at decision time, not carried forward. What
survives unchanged is the **narrowness discipline**: one declared read-only
view, operator allow / underprivileged deny / agent-identity refusal, no
write authority — and Quellight still requires its own governed increment
for anything that changes its tree.

**Option 1 — bridge Studio down to Quellight's 0.3.1 (pair as-is).**
Cheapest to reach a proof, but a poor deal once stated precisely
(reviewer M2): `@victframework/server@0.3.1` **does** carry the D-8 proof
pair (`agent.turn.get` and `app.data.query` both verified in the 0.3.1
published artifact), so what blocks a native pairing is NOT the same-turn
commands - it is that greenfield Studio (0.4.0-rc.1 platform + the G1
certified operator reads `run.get`/`run.list`/`run.detail`/
`run.events`/`run.waits`, of which only `run.cancel` exists
pre-greenfield) cannot natively speak a 0.3.1 server. A bridge would have
to be a hand-maintained cross-surface shim inside Studio: a
governance-hostile custom integration, exactly the pattern Stage 9
prohibits, and it would prove a bridge rather than the real greenfield
pairing.

**Option 2 — Quellight governed adoption increment FIRST (recommended —
this is the same precedent twice):**
  a. Quellight runs a **controlled adoption increment** pinning
     `@victframework/*@0.4.0-rc.1` (precedent: Q1's controlled 0.2.0
     adoption; the 0.3.1-rc.2→0.3.1 mechanical repin — both used exactly
     this pattern), re-deriving its own identity literals per its
     `vict-release-set@1` discipline.
  b. On the greenfield pin, Quellight adds **only what the proof needs**
     (OD-3 scope): its second operator actor/credential split,
     actor-derived inspection grants, and a configured stable local
     target endpoint declaration.
  c. The Studio→Quellight same-turn proof then runs **native**: greenfield
     Studio against a greenfield-pinned Quellight proving
     `agent.turn.get` + `qlt.inspection` read-through — operator allow,
     underprivileged denial, agent-identity refusal, and the G2-era
     confirmation/read semantics on one surface.
  Cost: real Quellight-side work (its own governance cycle: freeze ->
  implement -> independent verification), plus the prerelease-sequencing
  question now extracted as its own decision (**OD-R2**):
  Quellight's own precedent is that every rc consumption was transitory
  and ended in a stable repin after fresh independent re-verification
  (0.3.0-rc.1 M-1 remediation repin; `0.3.1-rc.2` -> stable 0.3.1) - so
  pairing on `0.4.0-rc.1` is tolerable only as a transitory verification
  candidate, stabilization is the default path, and permanent rc
  consumption would be a deliberate recorded deviation, not an option
  clause. Publication of anything remains separately gated (OD-R5).

**Option 3 — hold the Quellight slice.** The architecture explicitly
permits this: "if unavailable, S9-05 remains held rather than silently
dropped." G3 could close Stage 9 with a generic-example S9-05 plus a
held Quellight claim, deferring the pairing. Cost: the owner's D-8
selection ("the real product test that shows Studio works") is
postponed, and the Stage 9 exit claim is materially weaker.

~~**Recommended: Option 2**~~ — **SUPERSEDED by OD-R1: Option 1 (pair the existing 0.3.1 Quellight through a narrow, explicit, version-aware transport) is the owner's decision**, with the OD-R4 conditional minimal Quellight increment reserved for the denial criterion and Option 3's held-fallback remaining frozen text. The original recommendation is preserved above as reviewed lineage.

## 4. Proposed G3 gate structure — SUPERSEDED by the owner decision (OD-R3/OD-R6; retained for lineage)

> **SUPERSEDED.** The table below predates the owner decisions; the
> AUTHORITATIVE gate structure, scopes, criteria and verification pattern
> are `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md` (G3-A → G3-B
> → G3-C, per-gate loops, evaluation criteria with falsifiers). The row
> note "(only if Option 2)" is void — OD-R1 selected the existing-0.3.1
> pairing. Preserved unmodified as reviewed lineage.

| Gate | Scope | Exit evidence |
| --- | --- | --- |
| G3-A (FT-1 platform increment) | Definition-driven row navigation in `packages/ui`/`packages/ui-svelte`, consumed by Studio's definition; navigation-only scope | Own frozen entry contract; builder + fresh verifier cycle (the G2 pattern); local-artifact proof first; S9-02 unlock recorded |
| G3-B (S9-02 drill-down journey) | Run list → run detail browser journey using FT-1 navigation: provenance, ordered events, current node, safe error and waits, bounded options; protected-detail retention + per-access audit negative | Journey screenshots at the pushed candidate; direct-API matrix extension |
| G3-C (Quellight same-turn proof — only if Option 2) | Quellight governed adoption increment + operator-actor/grant/endpoint config (under Quellight's own governance); then Studio→Quellight browser proof: operator allow, underprivileged denial, agent-identity refusal; safe projections only | Quellight side closure record; Studio-side journey + screenshots; no write authority anywhere |
| G3 exit | Integrated journeys, independent usability/security audit, owner closure with exact claims + retained findings | Closure record per the established pattern; **publication only by a later explicit owner decision** |

Proposed sequencing: G3-A → G3-B in the VICT repository (one branch
family, the established builder/verifier pattern); G3-C runs in parallel
in the Quellight repository under its own governance once OD-1/OD-3 are
decided. Publication, product activation, and any Quellight edit remain
prohibited until the owner's separate recorded authorization.

## 5. Open owner decisions — RESOLVED by the owner 2026-09-29 (OD-R1..R6, see §0; retained for lineage)

> **SUPERSEDED/RESOLVED.** Every decision below was made by the owner on
> 2026-09-29 and is recorded verbatim-faithful in §0. Nothing here is
> open anymore; this section is retained because the independent contract
> review (review/stage9-g3-contract-20260929) verified against it, and
> superseded text is marked, not deleted.

The independent reviewer challenge (REVISION REQUIRED verdict, executed
2026-09-29) verified the old-pilot quote fidelity, re-derived every
Quellight/registry/FT-1 fact at the live tip, and restated the decision
list; this section is that restated list with the reviewer's corrections
already applied (M1-M4/N5-N7 folded). The proposal text above carries the
same corrections.

- **OD-R1 - Surface reconciliation (primary; = OD-1 with corrected
  trade-offs):** bridge Studio down to 0.3.1 / Quellight greenfield
  adoption increment first (recommended) / hold the slice. Corrected
  trade-offs: the D-8 same-turn command pair exists on BOTH surfaces
  (0.3.1 does carry `agent.turn.get` + `app.data.query`); the
  non-negotiable gap is the greenfield platform plus G1's certified
  `run.*` operator reads, which no bridge cheaply restores. Option 1 buys
  speed at the cost of a governance-hostile custom integration; Option 2
  buys the real proof at real schedule cost (a Quellight governance cycle
  under Quellight's own authority); Option 3 spends the D-8 claim itself.
- **OD-R2 - Prerelease set stabilization sequencing (new decision
  extracted by the reviewer):** stabilize `0.4.0-rc.1` -> stable before
  Quellight adoption (the default path by Quellight's own precedent);
  or pair on rc locally as an explicitly transitory verification
  candidate; or record a deliberate permanent-rc deviation. Note:
  `vict-release-set` is a set identity, not an npm package name; the
  registry surface is the `@victframework/*` packages under the
  `vict-0.4.0-rc` dist-tag.
- **OD-R3 - FT-1 authority shape (= OD-2):** authorized inside G3 as gate
  G3-A (this proposal's shape), or as a standalone pre-G3 platform gate.
  Same scope either way; the question is governance packaging only.
- **OD-R4 - Quellight increment scope (= OD-3, authority restated):**
  minimal proof-only scope (adoption pin + second operator actor +
  actor-derived inspection grants + configured stable target endpoint) vs
  also carrying the two 07E Low product findings; recommend minimal. The
  Quellight increment must originate and be recorded under Quellight's
  own governance (the VICT side records only the pairing requirement).
- **OD-R5 - Publication posture (= OD-5, half-open by frozen text):**
  the standing posture - publication only by a later explicit owner
  decision - is already frozen in the architecture's G3 row and is NOT
  reopened; the genuinely new sub-decision is whether to authorize a
  publication-PLANNING annex now (planning only, no publish).
- **OD-R6 - Evidence/verifier pattern (= OD-6):** reuse the established
  freeze -> builder(s) -> integrate -> fresh-verifier -> closure pattern
  per gate, with the Stage 8 G4-audit style for the final exit audit
  (recommended, genuinely open process choice).

Removed from the open list by frozen records (reviewer N7): the
held-not-dropped S9-05 fallback (frozen D-8 architecture text - recorded
as CONFIRMED, not reopened) and the "publication withheld by default"
posture (frozen G3-row text).

## 6. Prohibitions honored by this proposal

This proposal itself: no FT-1 implementation, no G3 gate work, no Quellight
edit (its §3 evidence was gathered read-only at the live Quellight tip),
no package publication, no product activation. Every scope item begins
only under the owner's recorded G3 contract ratification, following the
established entry-contract pattern.