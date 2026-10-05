# UI foundation — current state

**2026-10-06 — U0 CONTRACT FROZEN at candidate `54490a861fcd9992bfc8bfac14178fdb7921ecf0`; freeze-record committed; independent freeze-byte checker pending.** Two independent fresh-context review rounds completed (round 1 at `f7767b2…`: HELD, F-1..F-7 repaired; round 2 at `6a2f7b9…`: HELD pre-freeze by design, ready-to-freeze YES, N-1/N-2 repaired pre-freeze, N-3 delegated to checker reproduction). `FREEZE.json` pins 19 contract files (UTF-8 git-blob sha256) at the candidate SHA; mutable STATE, reviews/**, the record itself and shared root files are excluded with rationale. Baseline checks at the candidate (stage-manager run, 2026-10-06): `npm run typecheck` clean, `npm run format:check` clean, `npm run check:ui` 0 errors/0 warnings — the freeze checker independently reproduces all three after `npm ci`. Next: fresh checker reproduces pins + lineage + checks at the freeze-record SHA; then final STATE SHAs, push, remote verification and owner report. U1 remains unauthorized until a separate accepted handoff.

Round history (same day): the pack was installed verbatim into `docs/ui-foundation/` at base `4d2df037d8a82d36c60bf1bff16919650643ce22` (all installed digests matched the pack `HASHES.json` inventory; see [decisions](DECISIONS-AND-EVIDENCE.md) §U0 installation record). Local reconciliation is recorded in [RECONCILIATION](RECONCILIATION.md); exact schema/API/diagnostic drafts and the module/export plan in [API-SPEC](API-SPEC.md); fictional domain, proof walkthroughs, visual criteria and the named performance environment in [PROOF-DESIGN](PROOF-DESIGN.md); representative fixtures under `fixtures/`. The root `AGENTS.md` routing block is appended per `AGENTS.addendum.md`. No production source, manifests, lockfiles, `apps/studio`, other tracks or Stage 9 bytes were modified.

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
| U0 repository establishment/freeze | CONTRACT FROZEN — candidate `54490a8…` pinned in FREEZE.json; checker reproduction pending | Base `4d2df037d8a82d36c60bf1bff16919650643ce22`; round-1 review `456e910a…` at `f7767b2…`; round-2 review `1a5fc648…` at `6a2f7b9…`; freeze record at (this commit) | Fresh checker reproduces pins + lineage + baseline checks; then final SHAs recorded, push, remote verify |
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
- System reference describes capability simulation doubles; exact callable composition APIs still require local U0 reconciliation.

## Missing proof and limits

No git worktree/branch inspection, local dependency install, builds, tests, browser use, schema fixture execution, implementation verification, package publication or live Studio integration has been performed in this pack-authoring environment.

The passed document review establishes only the pack's adequacy. U0 is not closed until the local environment is reconciled and the final repository contract is independently frozen. Review-result metadata folded after candidate 02 is not part of that snapshot; its exact final delivery hashes are in the pack inventory. See [decisions/evidence](DECISIONS-AND-EVIDENCE.md) and the preserved review reports.

## Update discipline

After each candidate/review/repair, update this opening state and ledger rather than append contradictory “current” statuses. Historical decisions/evidence remain in DECISIONS-AND-EVIDENCE. Include full tested candidate/verifier SHAs and the next authorized action. Do not copy mutable status into AGENTS.
