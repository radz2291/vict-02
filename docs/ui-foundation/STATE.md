# UI foundation — current state

**2026-10-06 — U0 REOPENED (owner-authorized bounded amendment); original freeze SUPERSEDED; amended candidate `33ae56fef98b0f7c467a42f10cd873d08b1f8209` awaiting fresh independent review.** The owner's follow-up review confirmed all prior refs/hashes but found three contract issues (recorded in [decisions](DECISIONS-AND-EVIDENCE.md) §U0 amendment round): A-01 cycle-detection ambiguity (API-SPEC §2.2 — navigation must not read as expansion cycle; scope now defined on the structural expansion graph, with valid-navigation and invalid-expansion-cycle fixtures), A-02 incomplete rejection→correction→resubmission journey (now complete via `inspection.revise` rejected→draft, decision fields cleared, reason preserved in the activity trail; journey fixture added), A-03 incomplete catalog identity ordering (hashed payload now deduplicated by (documentId, revision) and totally ordered by code-point string comparison; Example D; U1-01 permutation requirement). The amended candidate is an exact commit; pins will be recomputed in a NEW freeze record only after independent review (original pins at `54490a8…` remain historically valid, verified intact at reopening). Supersession: the original “U0 COMPLETE / FREEZE VERIFIED” readiness claim is superseded for the amended bytes; historical verdicts and evidence are preserved unchanged. Next: fresh independent contract review of `33ae56f…` → repairs if needed → new freeze record → separate fresh checker → push. U1 remains unauthorized.

Round history: the pack was installed verbatim into `docs/ui-foundation/` at base `4d2df037d8a82d36c60bf1bff16919650643ce22` (all installed digests matched the pack `HASHES.json` inventory; see [decisions](DECISIONS-AND-EVIDENCE.md) §U0 installation record). Local reconciliation is recorded in [RECONCILIATION](RECONCILIATION.md); exact schema/API/diagnostic drafts and the module/export plan in [API-SPEC](API-SPEC.md); fictional domain, proof walkthroughs, visual criteria and the named performance environment in [PROOF-DESIGN](PROOF-DESIGN.md); representative fixtures under `fixtures/`. The root `AGENTS.md` routing block is appended per `AGENTS.addendum.md`. No production source, manifests, lockfiles, `apps/studio`, other tracks or Stage 9 bytes were modified.

Pre-installation state (5 October 2026): the documentation execution pack and U0 design contract were authored against observed VICT main `4d2df037d8a82d36c60bf1bff16919650643ce22`. Independent documentation review of candidate 02 returned PASS after one minor candidate 01 ambiguity was repaired and rechecked. The owner authorized starting pack preparation. No foundation code, new schema/API, reference application, repository integration or Stage 9 change was implemented at that time.

## Identity and authority

- Source repository: https://github.com/radz2291/vict-02.
- Main was read live on 5 October 2026 and remained at the full SHA above; re-fetched live on 2026-10-06 before branch creation and still at that SHA (see RECONCILIATION §1).
- Local stage branch: codex/ui-foundation-u0 (isolated worktree `vict-02-u0`), created at the base SHA above; normal push destination.
- Delivery location: installed in the user's repository under `docs/ui-foundation/` (verbatim pack bytes plus U0 reconciliation artifacts recorded in decisions).
- Authority: scope clarification endorsed with “Good”; governance/pack preparation then directed with “Ok lets start”. See decisions for verbatim context and precise interpretation.
- Current handoff: U0 only. U1–U4 remain the delivery plan, not an unattended implementation grant.
- Same Studio: Stage 9 records formal closure with non-blocking findings; the separate agent owns its subsequent complete Studio experience/integration. Concurrent Stage 9 G3 freeze-verification branches observed on the remote during U0 baseline verification were left untouched.

## Current gate ledger

| Item | Status | Candidate/verifier | Next action |
| --- | --- | --- | --- |
| Pack drafting | COMPLETE | Candidate 02; final reporting metadata folded afterward | Installed 2026-10-06; see decisions §U0 installation record |
| Pack independent review | PASS — documentation only | Candidate 01: 8d2683a2a1aae7740755326af597eeed16b4a7a44cfdaf4a9d60cd8b76318e6d; candidate 02: db369614c97119762995480d3ad277b92d21e2eb812739d770bc16bf2df6b15a | Reports preserved under reviews/ |
| U0 repository establishment/freeze | **AMENDMENT ROUND — original freeze SUPERSEDED**; amended candidate `33ae56f…` (A-01/A-02/A-03 applied); fresh review pending; new freeze record pending | Base `4d2df037d8a82d36c60bf1bff16919650643ce22` (unmoved at reopening); prior lineage preserved: `f7767b2…` / `6a2f7b9…` / `54490a8…` / `ffbafc0…` / `a664c70…`; original 19 pins re-verified intact at reopening | Fresh independent review of `33ae56f…`; repairs if needed; new freeze record; separate fresh checker; push + remote SHA verification; then owner-authorized U1 handoff (not yet authorized) |
| U1 rendering/editing loop | PLANNED | None | Requires U0 pass and an authorized U1 handoff |
| U2 breadth | PLANNED | None | Requires U1 and its own accepted scope |
| U3 realism | PLANNED | None | Requires U2 and its own accepted scope |
| U4 reuse/handoff | PLANNED | None | Requires U3 and its own accepted scope |

## Baseline observations

- Root AGENTS.md routes existing work through the system reference and Stage 9 pack; preserve it.
- SDK accepts application schema @1/@2; application compile uses closed field sets and versioned canonical identity.
- Application Release binds the compiled applicationVersion and renderer/data-adapter/component identities.
- UI composition is currently closed stack/split plus semantic presets.
- Existing UI and Svelte package manifests declare 0.4.0-rc.1. This is source evidence, not a newly checked npm registry claim.
- Existing ApplicationDataAdapter query/mutate context carries permissions/effect/actor.
- System reference describes capability simulation doubles; the exact callable composition APIs (`registerDouble`/`replaceDouble`/`snapshotDoubles` and the adapter context) were reconciled in [RECONCILIATION](RECONCILIATION.md) §4.

## Missing proof and limits

U0 status (2026-10-06, after freeze verification): local worktree/branch inspection, dependency
install (`npm ci`, 524 packages), and the read-only baseline checks (`typecheck`,
`format:check`, `check:ui` — all clean, reproduced by the independent freeze checker) HAVE been
performed; the freeze-byte pins were reproduced 19/19 by a separate fresh checker. Still NOT
performed anywhere in this workstream: implementation of any contract element, execution of the
design fixtures as code, browser/visual work, performance measurements, adapter/double runtime
execution, package publication, npm-registry verification, U1+ work of any kind, and any
Studio integration. U1 remains unauthorized until a separate accepted handoff.

Pack-review limits remain historical facts: the pack documentation review established the
pack's adequacy only, and its candidate-02 snapshot excludes the folded reporting metadata
(final delivery hashes in the pack inventory). U0 repository freeze evidence is now recorded in
this repository: FREEZE.json, [decisions](DECISIONS-AND-EVIDENCE.md), and the preserved reports
under [reviews](reviews/).

## Update discipline

After each candidate/review/repair, update this opening state and ledger rather than append contradictory “current” statuses. Historical decisions/evidence remain in DECISIONS-AND-EVIDENCE. Include full tested candidate/verifier SHAs and the next authorized action. Do not copy mutable status into AGENTS.
