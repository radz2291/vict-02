# VICT Stage 9 — G0 Owner Ratification and Contract Freeze (2026-09-29)

> **Document type:** dated owner decision record — the formal G0
> ratification of the Stage 9 entry contract under reference §23 (Stage 9)
> and §27, following the independent G0 candidate review
> (`review/stage9-g0-20260929` @ `bf8db58dce512824c8c74b6f8daa03b4a4c005a3`)
> and the independent correction re-review
> (`review/stage9-g0-correction-20260929` @ `f0d595b0b76eb68c61e256e30a8d403b5cf3ec2d`).
> **These are CONTRACT DECISIONS, recorded as such. Nothing in this record is
> implementation evidence.** No Studio, command, route, session, target
> registry, receipt, or Quellight increment exists by virtue of this record.
> Implementation authority begins exactly at the G1 boundary in §4 below and
> nowhere else.

## 1. Decision basis and lineage

The owner issued the G0 decisions in a dated directive (2026-09-29) after
reading the proposed entry pack, the Stage 8 closure, and both independent
reviews. Decision basis, all verified live on 2026-09-29:

- **Base:** VICT `origin/main` `516948ac8bc55bbae8624bb91b3b35de34b3146c`
  (Stage 8 owner closure, PASS WITH ISSUES).
- **Candidate branch:** `codex/stage9-g0-candidate`, re-verified at head
  `739860d4f4565aa0177e5915bf86f5ce605ecec6` = draft PR #2 head; exactly four
  files against the base; documentation-only.
- **First pack:** `c85af58dca04fa9e61ae77bf06bd933481609f15`; its independent
  review at `bf8db58…` (B-1–B-3 blocking, N-1–N-8 informational).
- **Corrected candidate:** `a500e0b65ff2f93608d26f14fc14712818028505`; its
  independent re-review at `f0d595b…` (B-1–B-3 and N-1–N-7 resolved in the
  proposal; wording folds R-1/R-2 and cost disclosure R-3 required to survive
  into frozen bytes; pin of the reviewed tip deferred to ratification, R-4).
- **Post-re-review wording folds** (already pushed on the candidate branch):
  `3e7bec0` — receipt fencing reworded to the claim/fence + domain-idempotency
  architecture with the receipt and effect stores explicitly SEPARATE (R-1
  folded; no single cross-store transaction is claimed), and the issuing
  target bound implicitly by its server-local receipt rather than a new
  command parameter (R-2 folded); `3e0aa4e` — re-review recorded; D-8 owner
  selection recorded through `08d6a31`, `a89ec3e`, `ce92a59`, `772c451`,
  `739860d`. These corrections are ADOPTED as part of the frozen contract.
- **Quellight observation:** `main` `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`
  (read-only; declares `act.queryInspection`/`qlt.inspection`; single actor;
  hard-coded inspection grant; no VICT Release selected). Recheck before any
  Quellight-dependent claim.

## 2. Owner decisions D-1–D-10 (2026-09-29)

Each item below is the owner's decision. Each decision accepts the reviewed
recommendation in `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md` §7 as
amended by the independent reviews, or states the chosen alternative. The
independent reviews' verification of the underlying facts is retained as
review context; the decisions themselves are the owner's.

### D-1 — Studio embodiment: private `apps/studio`; FT-1 navigation gated separately (CHOSEN: B-1 recommended path)

Studio is a **private `apps/studio` workspace** hosted by SvelteKit, built as
a genuine VICT consumer: a real Application Definition/Plan rendered through
`@victframework/ui` → `@victframework/ui-svelte` for every ordinary surface,
with purpose-built Svelte operator components only where named and justified.
**The S9-02 run-list drill-down is gated on the FT-1 definition-driven
row-navigation improvement, which is authorized as a SEPARATELY GATED
UI-platform prerequisite.** Studio/G1 must not claim the S9-02 journey until
FT-1 has landed and been independently gated on its own authority; the FT-1
platform release and any external-consumer claim remain separately gated.
The alternatives (a named navigation-only island; menu/breadcrumb-only UX)
are REJECTED. The root `AGENTS.md` introduced by the candidate is CONSCIOUSLY
ADOPTED as standing agent-entry guidance for the repository, exactly as
pushed at `739860d`.

### D-2 + D-7 — Connection, session, and operator composition (ADOPTED AS PROPOSED)

A **deployment-provisioned target registry** holds an exact stable loopback
endpoint (`127.0.0.1` + explicitly configured port) and a **server-side-held
target credential reference** per target; the target composition deliberately
binds that port (the configurable-port binding platform addition and the
administrator provisioning step are accepted costs, per re-review R-3). The
target's operator actor is a **distinct, administrator-provisioned,
least-privilege actor** provisioned outside Studio; there is **no
identity-provisioning UI** in Stage 9, and Studio never uses the product
agent's token. The Studio human session is a locally provisioned credential
establishing a short-lived server-side session protected by an **HttpOnly,
SameSite cookie, a session-bound CSRF token, and explicit Origin/Host checks
on state-changing JSON requests**; the target token is never sent to the
browser. Exact credential storage and session lifetime are G1 design items
under this decision, reviewed at the G1 gate.

### D-3 + D-9 — Product-view designation: explicit pilot binding; ABI deferred (ADOPTED)

The Quellight product view uses an **explicit, server-side configured pilot
binding to the already-declared `act.queryInspection`/`qlt.inspection`**
resource/action, recorded as one product integration. **General
product-view discovery is deferred**, as is any new Application/Release ABI
(no `vict.application@3`, no Release-record/operator declaration expansion).
The configured binding grants nothing by itself; the target's Application
Layer still decides every query.

### D-4 + D-10 — Command compatibility and confirmation semantics (CHOSEN: coordinated versioned migration; B-3 adopted)

**One coordinated versioned command-contract migration** covers all four
existing high-impact commands — `run.cancel`, `activation.select`,
`release.select`, `release.rollback` — plus the new `run.resolve`/`run.signal`
receipt surface. A Stage 9-capable target **rejects the four unconfirmed
legacy mutation routes for every actor class, including administrator**; other
legacy reads may continue. The proposed **receipt outcomes, durable
claim/fence and domain idempotency semantics (B-3), and the separate CLI
prepare → human review → confirm steps are ADOPTED** exactly as worded at the
freeze, including the R-1/R-2 folds: the receipt and effect live in separate
stores (no single cross-store transaction is claimed or required), and the
issuing target is bound implicitly by its server-local receipt. The additive
prepare/consume and receipt-gated-variant alternatives are REJECTED. **The
caller and release/version migration plan must be FROZEN before G2 begins.**
Quellight cannot claim Studio support until its own governed increment adopts
the new target contract.

### D-5 — Protected detail (ADOPTED)

An expressly bounded protected-detail request requires a **distinct
protected-detail scope, a retention check, and per-access audit**, with
default denial. The evidence must prove an **authorized positive retrieval**
as well as denial/redaction, and must include leakage canaries across errors,
logs, browser hydration, and generic list responses.

### D-6 — Parity proof (ADOPTED)

Studio and CLI must produce the same semantic operations on **equivalent
isolated targets** with no duplicate effects. The parity gate includes a
**mechanical registry ↔ HTTP-transport ↔ CLI inventory** that accounts for
every Stage 9 operation and explicitly classifies pre-existing out-of-scope
divergence (including `app.data.action`), with the explicit CLI prepare →
confirm flow.

### D-8 — Quellight product proof: IN (CONFIRMED, previously recorded 2026-09-29)

The owner's earlier selection stands and is confirmed as a G0 decision:
**Quellight is IN — it is the real product test showing Studio works.** Stage
9 exit (S9-05/G3) requires the **narrow same-turn governed inspection proof**
(`agent.turn.get` + `qlt.inspection` `getTurn` via `app.data.query`: operator
allow, underprivileged denial, agent-identity refusal preserved) **after a
separately governed Quellight increment** (second operator actor,
actor-derived inspection grants, configured stable endpoint). A generic
example alone cannot pass that claim. This decision does not amend Quellight
and grants no Quellight write authority.

## 3. What this ratification is not

- It is **not implementation evidence**: no work package below has been
  performed; every §2 decision is a contract statement about future,
  independently verified work.
- It does **not** authorize G2 (receipts/interventions/recovery journeys),
  publication of any package, production activation, any Quellight edit, or
  the S9-02 drill-down claim.
- It does not amend the frozen Stage 8 bytes, the Stage 8 closure, or the
  follow-up register; FT-1's own gate is where the D-1 prerequisite is
  authorized and proven.

## 4. G1 authorization (bounded)

G1 — **operator foundation** — is authorized per the architecture §7 G1 row,
restricted to: (a) safe operator reads including graph/activation identity,
with the D-5 protected-detail positive path; (b) explicit HTTP/CLI mappings
and the three-surface inventory for the G1 read surface; (c) the operator
connection and session boundary (D-2/D-7 mechanics); (d) a real Studio
Application Definition/Plan rendered in `apps/studio` through the real
delivery path, integrated to a working browser read before any such claim.
UI and API scaffolding may proceed in non-overlapping isolated worktrees but
must integrate before a read-through claim. Evidence: pushed candidate SHA,
scope matrix and canaries, allow/deny at browser and direct-API boundaries,
no-token-in-browser proof, truthful connection states, and an independent
verifier at the exact candidate SHA. **No G2 authorization, no receipts, no
product view, no Quellight work, no publication, no S9-02 claim.**

## 5. Frozen contract bytes

The Stage 9 entry contract is FROZEN as the following four files at the
freeze commit (the commit whose tree first carries this record together with
the finalized documents). The SHA-256 digests below are the frozen-byte
identity; the exact freeze commit SHA is reported in the pushed owner report
and PR merge, and is independently re-verified before merge:

| Frozen file | SHA-256 |
| --- | --- |
| `AGENTS.md` | `7b79bd43a7285201deda0412f0f570cdb9844016925ad459b3b92b47085b3e22` |
| `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md` | `1ebb85b06114b3d618d071efaced4f06b7daf26c97294c1f891cb12e5d309b96` |
| `docs/governance/VICT-STAGE-09-STATE.md` | `faaaede40e6a27fd3d5080bcc9bc6e4e285d390dbe3ab646ab806f56f64985e9` |
| `docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md` | `50387444566f6ad1348bd94255faad7d5aadb6822024d4e39bd12f8bc1c438df` |

*(Digests computed over the exact bytes carried by the freeze commit — the
commit whose tree first contains this record together with the finalized
documents. The independent verifier recomputes all four from the freeze-commit
tree and must match byte-for-byte. Any later change requires a dated
amendment record; silent edits are void.)*

## 6. Verification protocol for this ratification

Before PR #2 merges: a **fresh independent verifier**, in a separate context
and checkout, at the exact freeze SHA, must (1) recompute the four frozen
digests; (2) confirm the D-1–D-10 dispositions above are faithfully reflected
in the frozen architecture/handoff/STATE and that decisions are not presented
as implementation evidence; (3) confirm the R-1/R-2 wording folds are present
in the frozen §4 text; (4) confirm no code, publication, activation, or
Quellight change entered the branch; (5) confirm the claims of live remote
state (base, candidate head, PR #2) at verification time. The verifier files
its record on its own review branch. If the verifier finds a material
conflict, the merge is stopped and the owner is returned a concrete option.
