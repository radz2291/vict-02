# Stage 8 G3 — Scoring Correction for the First P2 Attempt (2026-09-26)

> **Document type:** owner-directed dated correction to the evaluator
> scoring in `VICT-STAGE-08-G3-P2-EVIDENCE-2026-09-26.md` (that file and
> all earlier governance files remain untouched; this correction is filed
> BEFORE the owner-directed P2 reattempt begins).

## What is corrected

The first P2 evidence record's section 9 summarized the outcome as
"**7 of 8 PASS (one with caveat); F3 FAIL**". The owner has directed that
this characterization overstates the result, and it does: it folds a
not-demonstrated visible behavior and an unavailable interaction surface
into "pass", which a real-browser failure does not earn. The corrected
scoring is:

| ID | Corrected score | Basis (observed, unchanged) |
| --- | --- | --- |
| F1 | PASS | builds and runs from the empty project via scaffolder + renderer |
| F2 | PASS | create/edit validation against the declared contract observed live |
| F3 | **FAIL** | the table island never mounts in a real browser (`PriorityBadge is not defined`, 5/5 loads); no rows, no search, no sort, no pagination as delivered |
| F4 | PASS | dashboard chart + count reflected the persisted completion live |
| F5 | **PASS at the governed action boundary only** | `CONTRACT_REJECTED` / `TASK_NOT_FOUND` / `ALREADY_COMPLETE` and the durable activation-pinned run (4-event ledger) were all observed — but through the declared `/api/act` boundary, not the UI: the row-level Complete button was unavailable because the table island never mounted |
| F6 | **NOT DEMONSTRATED** | the badge island's declaration and registry wiring are correct in code, but its visible behavior — colored per-priority badges shown on mounted rows — was never observed, because the table never mounted in a real browser |
| F7 | PASS | hard kill + restart preserved task state byte-identically and the run ledger |
| F8 | PASS | `applicationVersion` stable across a content-identical rebuild |

## Corrected summary

**Clean passes: F1, F2, F4, F7, F8 (5). Boundary-only pass: F5 (row
interaction unavailable). Not demonstrated: F6 (visible badge behavior).
Fail: F3 (real-browser table).** The first attempt is not described
anywhere as "7/8 fully passing".

## What stands unchanged

The defect and all red evidence remain fully visible and on record:
P2-DEFECT-1 (missing `PriorityBadge` import; built route chunk contains
the call site with no definition; client hydration ReferenceError on
every observed load), the narrow-width sort-control gap (≤640px), the
builder's claim-vs-observation discrepancy ("rendered rows in the built
pages" was SSR/curl-based), the environment deviations (external process
killer; npm arborist workaround), and all negative-control results. No
governance file, commit, bundle, or the file-once implementation report
of the first attempt is modified by this correction.

## Consequence

Per the owner's same-day direction, one clean P2 reattempt is conducted
under the original byte-pinned inputs (brief `046558c9…`, kit artifact
`c3df869f…`, frozen release set `vict-release-set@1/0.3.1`,
`v1_1c695280…`), with a fresh empty external project, a genuinely fresh
isolated builder session, and independent evaluation against the pinned
rubric (`b7531d5b…`) — including real-browser exercise of mounted rows,
search, sort, pagination, visible colored badges, and the row Complete
action. A separate dated record will compare both attempts and propose a
G3 disposition. No gate satisfaction is declared by this correction.
