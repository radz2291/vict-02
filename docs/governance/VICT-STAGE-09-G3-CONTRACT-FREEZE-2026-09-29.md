# VICT Stage 09 — G3 Entry Contract FROZEN (2026-09-29)

> **FREEZE RECORD.** The G3 entry contract is frozen by the stage manager
> under the owner's recorded decisions (OD-R1..R6, 2026-09-29) after the
> directed independent review cycle on the final contract bytes: three
> fresh-context review rounds, the last returning **FREEZE-READY** with
> one non-blocking editorial note (fixed in this freeze). Implementation
> of G3-A → G3-B → G3-C is authorized per the handoff's per-gate loops.
> Still prohibited: package publication, product activation, any edit to
> the unfinished greenfield Quellight project, and any claim that the
> later greenfield pairing has been verified.

## 1. Frozen contract bytes (SHA-256, at this commit)

| Document | Path | SHA-256 (working-tree bytes) |
| --- | --- | --- |
| Amended proposal (owner decisions §0/§0.1; superseded lineage marked) | `docs/governance/VICT-STAGE-09-G3-PROPOSAL-2026-09-29.md` | `dc5540e78ec90481fddb946ae407c5010fe1fb285b3625f4d3d1b6f2e3ebef4e` |
| G3 handoff (work packages, ownership, evaluation criteria, oracles) | `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md` | `287dd3a17ee3cf5b27896d8128be02ebcfc226a54b94b31fde990ac5d38c3ce2` |
| STATE (G3 section + gate row as frozen) | `docs/governance/VICT-STAGE-09-STATE.md` | `d94f8273aa417dbdb906cac9c661f6feb19caa37540f55c4c81456b1ce0c8025` |

Frozen baselines live-verified at freeze time: `origin/main`
`510ef7ef668ebd9aea09378b05f221574c4d2ea6` (ancestor of the freeze head);
Quellight `main` `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6` (Stage 07
closed; `@victframework/*@0.3.1`). Any Quellight-side movement re-verified
before G3-C evidence is recorded; the contract's oracle is behavioral and
survives ref movement (a moved Quellight ref with the same behavioral
surface is re-pinned by provenance evidence, truthfully recorded).

## 2. Review lineage (all pushed and remote-verified; reports byte-preserved)

| Round | Branch @ SHA | Verdict |
| --- | --- | --- |
| 1 — contract-bytes challenge | `review/stage9-g3-contract-20260929` @ `8d020c93cb799e43eacb7c14dfd011a0106fb2a4` | REVISION REQUIRED (0 blockers, 5 majors, 4 notes) |
| 2 — repair verification | `review/stage9-g3-contract-rereview-20260929` @ `48bd11dd2c63bde150e94e70944b591f81b51b67` | REVISION REQUIRED (blocker B-1: the M-1 pin oracle was factually impossible — inspect `commandSchema` is the opaque `vict.command@1` marker) |
| 3 — B-1 re-repair verification | `review/stage9-g3-contract-rereview2-20260929` @ `38c1d2f04e885ff913a5e7e16a9970aa16a079e3` | **FREEZE-READY** (one editorial MINOR, fixed in this freeze) |

Key contract clarifications won through review, binding on all builders:
the version-pin oracle is **behavioral-plus-provenance** (positive reads
execute; a G1 `run.get` probe MUST be refused with fail-closed-on-success
— the true 0.3.1-vs-greenfield discriminator; full inspect answer-record
equality recorded with its honest version-invariance caveat; Quellight
ref + declared release identity recorded as labeled provenance); identity
evidence via two distinct server-held credentials with per-credential
`actor.whoami` records; the OD-R4 Quellight-increment trigger is decided
ONLY by the fresh independent verifier from attempt logs + its own
reproduction; same-turn alignment uses the target's own turnId
correlation (absent → truthful NOT DEMONSTRATED).

## 3. Authorization and next action

The stage manager is authorized to run G3 to its final boundary without
returning to the owner between gate reports (stop conditions per the
handoff §0). Per-gate loop: builder candidate on exclusive paths →
integrator merge → fresh-context verifier in a separate checkout →
bounded repair → re-verification. The final G3 boundary report carries
pushed candidate + verifier SHAs, browser evidence, criterion-by-criterion
verdicts, retained findings, and the proposed Stage 9 exit action. The
separate Stage 9 exit audit remains a further owner-gated step (OD-R6).
