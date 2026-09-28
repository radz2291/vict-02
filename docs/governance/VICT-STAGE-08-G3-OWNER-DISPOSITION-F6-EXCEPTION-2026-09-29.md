# Stage 8 G3 — Owner Disposition: Accepted Exception for the Edit-Link Island (2026-09-29)

> **Document type:** dated owner decision record, filed under the Stage 8
> amendment/disposition procedure. The frozen entry contract
> (`docs/architecture/STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md`, bytes
> `ba3fde1b…`) is NOT modified — per its own ratification clause, later
> changes are dated amendments recorded outside the frozen text. This
> record is such an amendment. It registers a bounded G3 owner decision
> in the contract's own disposition vocabulary (§8 decision records; §22.3
> finding classes `gating / corrective / deferred / rejected`). G3 remains
> HELD; Stage 8 closure remains G4 + owner. **No Verified claim is made.**

## D-6. Edit-link island — accepted exception to literal F6 (owner, 2026-09-29)

**Decision (owner):** for the `0.4.0-rc.1` fresh G3 proof, the registered
`cmp.task-edit-link@1` island is accepted as a **known exception** to
literal F6 clause B ("the badge is the only custom island").

**Scope of the exception, as bounded by the owner:**

- The island provides **row navigation only** (a link from a table row to
  the record-edit route).
- It **does not own task data**: it renders no task state and mutates
  nothing; all task data flows through the declared views and forms.
- It **does not own the governed action**: completion remains the
  declared, contract-governed `act.completeTask` with its fail-closed
  effect hook; the island dispatches nothing.

**Literal result preserved:** the F6 clause B result recorded in
`VICT-STAGE-08-G3-P2B-F6-RECONCILIATION-2026-09-29.md` §4 **remains
FAIL under the original wording** and is **not relabeled PASS**. The
accepted exception is a scoping disposition on top of the recorded
failure, not a re-grading. In the §22.3 vocabulary: the finding is
classified **deferred** (to the future formal UI track below), with the
G3 proof proceeding on the owner's accepted exception.

**Future formal UI track (recorded, out of Stage 8 scope):** a
**definition-driven table-cell link** (per the amendment proposal in the
reconciliation record §6: `columns[].link { routeId, paramField }` or
`rowNavigation`) is added to the future formal UI track. **No UI patch
and no new release** is authorized in this Stage 8 workstream to chase
literal clause B.

## D-7. Chart 14-day window — explicit proof limitation (retained)

The brief's dashboard described "tasks completed per day (last 14
days)". The 0.4.0 built-in chart surface has no windowing field, so the
reconciled application charts the whole declared view and the title
drops the window qualifier. **This is retained as an explicit proof
limitation: the brief is NOT described as satisfied on the 14-day
windowing point.** (The demonstrated behavior — a definition-driven,
accessible chart reflecting persisted completions via count-weighted
day buckets — stands as recorded.)

## Preservation statement

The following remain byte-for-byte untouched and authoritative:

- the **first-session result**: builder commits `474a9b2`→`c6bb365` with
  its RESULT document and first-session evaluation;
- the **correction history**: all correction-round, evidence-
  clarification, authority-review, and reconciliation records (including
  every failed observation: the 0.3.1 F5 silent-strip failure, the 0.3.1
  F6 authority-review FAIL, the scaffold host edits, the F6 clause B
  FAIL on `0.4.0-rc.1`, the compile-diagnostic rejection during the
  reconciliation, and the kit regex incompatibility on the pristine
  artifact);
- the **frozen `0.3.1` proof** and D-1′ pin;
- the **frozen entry contract** (`ba3fde1b…`) and frozen handoff
  (`4aa83c15…`).

Nothing in this record rewrites any prior evidence; it only scopes the
owner's acceptance for the G4 audit.
