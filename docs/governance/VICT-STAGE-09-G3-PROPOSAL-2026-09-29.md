# VICT Stage 09 — G3 Decision-Ready Proposal (PROPOSED, 2026-09-29 — no implementation authorized)

> **STATUS.** This is a decision-ready PROPOSAL for the owner's G3 planning
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

From the G0 ratification record and the frozen architecture (D-8 /
S9-05 / G3-119 row):

- "Quellight `main` observed at `5f709a5…` declares
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

This observation was made in the G0 era, **against the pre-Stage-7
Quellight** (proposed off the old VICT `88032bc…` surface).

### 3.2 Current truth (re-derived today, read-only, at Quellight `main` `5f709a5…`)

The live Quellight tip is **the same commit** `5f709a5` the old observation
was taken at — but its meaning has completely changed inside Quellight's
own governance:

1. **Quellight Stage 07 is FORMALLY CLOSED** (07A–07E; exit audit "STAGE 07
   VERIFIED WITH NON-BLOCKING ISSUES — FORMAL CLOSURE PERMITTED", closure
   commit `5f709a5`). No numbered successor stage exists; Quellight's own
   record says the next product-roadmap increment requires a fresh owner
   planning decision. **This proposal is that planning decision for the
   Studio-pairing slice.**
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

### 3.3 Reconciliation — the surface question is the primary G3 decision

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
Cheapest to reach a proof, but the proof would demonstrate a
Studio-side compatibility bridge, not the real greenfield pairing; it
also introduces a hand-maintained cross-surface shim inside Studio
(governance-hostile, and the old surface lacks the operator-read
vocabulary G1 certified).

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
  Cost: real Quellight-side work (its own governance cycle: freeze →
  implement → independent verification), plus a decision about whether
  the greenfield set must first be stabilized (`0.4.0-rc.1` → stable)
  or the pairing may run on the prerelease set locally. Publication of
  anything remains separately gated (OD-5).

**Option 3 — hold the Quellight slice.** The architecture explicitly
permits this: "if unavailable, S9-05 remains held rather than silently
dropped." G3 could close Stage 9 with a generic-example S9-05 plus a
held Quellight claim, deferring the pairing. Cost: the owner's D-8
selection ("the real product test that shows Studio works") is
postponed, and the Stage 9 exit claim is materially weaker.

**Recommended: Option 2**, with Option 3 as the recorded fallback if the
Quellight increment cannot be scheduled. This recommendation is a
recommendation; the surface decision is OD-1 and belongs to the owner.

## 4. Proposed G3 gate structure (for the owner's planning decision)

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

## 5. Open owner decisions (decision-ready; the reviewer will challenge these)

- **OD-1 — Surface reconciliation (primary):** Option 1 (bridge down to
  0.3.1) vs Option 2 (Quellight greenfield adoption increment first,
  recommended) vs Option 3 (hold the Quellight slice). What would you
  give up for each: O1 spends governance integrity for speed; O2 spends
  schedule on the real proof; O3 spends the D-8 claim itself.
- **OD-2 — FT-1 authority shape:** authorized inside G3 as gate G3-A (this
  proposal's shape), or as a standalone pre-G3 platform gate? Both use the
  same scope; the question is governance packaging and whether S9-02 must
  wait for a separate owner gate between them.
- **OD-3 — Quellight increment scope (Option 2 only):** minimal
  proof-only scope (adoption pin + second operator actor + inspection
  grants + stable target endpoint) vs also carrying the two carried 07E
  Low findings. Recommend minimal; the carried findings are unrelated to
  the pairing.
- **OD-4 — S9-05 fallback:** confirm that if the pairing is unavailable at
  G3 exit, S9-05 closes with the Quellight claim HELD (never silently
  dropped), per the frozen architecture.
- **OD-5 — Publication posture:** the FT-1 platform change and (if Option
  2) a stable greenfield set raise the publication question. Keep the
  standing posture — publication is a separate, explicitly gated owner
  decision, never a by-product of a proof — vs authorizing a
  publication-planning annex now (planning only, no publish).
- **OD-6 — Evidence and verifier pattern:** reuse the established
  freeze→builder(s)→integrate→fresh-verifier→closure pattern for every
  G3 gate (recommended), with the Stage 8 G4-audit style for the final
  exit audit.

## 6. Prohibitions honored by this proposal

This proposal itself: no FT-1 implementation, no G3 gate work, no Quellight
edit (its §3 evidence was gathered read-only at the live Quellight tip),
no package publication, no product activation. Every scope item begins
only under the owner's recorded G3 contract ratification, following the
established entry-contract pattern.