# VICT Stage 9 — FORMAL CLOSURE (owner declaration recorded 2026-09-30)

**Status: CLOSED AS PASS WITH NON-BLOCKING FINDINGS.** The owner declared VICT Stage 9
formally closed on 2026-09-30, accepting the independent exit-audit verdict and retaining
every stated finding and limit. This record preserves the declaration, the evidence
lineage it rests on, the retained findings, and the exact pairing limit. It authorizes
**nothing further**: no package publication, no product activation, and no claim about the
unfinished greenfield Quellight pairing.

## 1. The owner declaration (verbatim)

> I accept the Stage 9 exit-audit verdict and declare **VICT Stage 9 formally closed as
> PASS WITH NON-BLOCKING FINDINGS**, retaining the findings and limits stated in the
> independent audit. This declaration does not authorize package publication, product
> activation, or a claim about the unfinished greenfield Quellight pairing.

The owner further directed: live verification of the three refs before writing; the M-1
lineage made independently checkable (with a focused fresh-context reproduction if no
reviewable record existed, preserving the original red M-1 evidence); this dated closure
record citing the original exit audit, the focused M-1 addendum, both merged repository
SHAs, all retained findings, and the exact pairing limit; a fresh independent checker over
the final closure claims; a normal checked (non-forced) push with remote verification; and
a follow-up register. Nothing beyond formal closure was authorized.

## 2. Live ref verification before recording (2026-09-30, stage manager)

All three refs matched expectations exactly; nothing had moved, so no reconciliation was
needed:

| Ref | Expected | Live (`git ls-remote`) | Match |
|---|---|---|---|
| VICT `main` | `164176abe6451742beb24aa2e83420c52a885d78` | `164176abe6451742beb24aa2e83420c52a885d78` | ✓ |
| Quellight `main` | `40b6c35cfb74588b8aee835f92a6214f55cc6621` | `40b6c35cfb74588b8aee835f92a6214f55cc6621` | ✓ |
| Exit audit `review/stage9-exit-audit-20260930` | `b240932dcefb1b0f08edf00c07d24b2fafbecccb` | `b240932dcefb1b0f08edf00c07d24b2fafbecccb` | ✓ |

## 3. The original exit audit (OD-R6)

- **Report:** `docs/audit/VICT-STAGE-09-EXIT-AUDIT-2026-09-30.md` on
  `review/stage9-exit-audit-20260930` @ `b240932dcefb1b0f08edf00c07d24b2fafbecccb`
  (pushed, remote-verified), by a fresh-context auditor with no Stage 9 role.
- **Verdict: PASS WITH NON-BLOCKING FINDINGS — formal Stage 9 closure PERMITTED**, with
  M-1 required to be repaired before any production-serving/activation claim.
- **Pinned heads audited:** VICT `main` `2e65bab5812b6ea0107d248e40b3e2e602ef6a84`;
  Quellight `main` `40b6c35cfb74588b8aee835f92a6214f55cc6621` (both ls-remote-verified
  live by the auditor before auditing; fresh clones of the integrated trees).
- **Criterion outcomes (all VERIFIED):** (A) governance lineage G0–G3 with recomputed
  freeze pins (G0 tree digests byte-exact; G3 pins `dc5540e7…/287dd3a1…/d94f8273…` under
  the documented CRLF/EOF normalization); (B) real Studio use — live stack, HttpOnly
  operator session, zero target tokens in page HTML, genuine FT-1 `/runs/…` links with a
  real click, cross-target version-pin refusals live; (C) confirmed recovery —
  prepare→review→confirm with executor-verbatim effect panel and audit rows, all negatives
  live (REQUIRED/STALE/SPENT/FIELD_INVALID, idempotent replay; changesets with
  self-approval 403 / NOT_APPROVED / duplicate replay / BASE_STALE); (D) run-detail
  journey — redacted default, live reveal under the `-detail` credential,
  `run.detail.accessed` audit rows; (E) same-turn Quellight proof on the integrated
  Quellight main — refusal and denial live, pin probe refused, capability banner, Quellight
  tree byte-pure; (F) evidence lineage — verifier-branch artifacts spot-opened; (G) every
  retained finding present in STATE, pairing limits stated precisely; (H) suites at the
  integrated heads — studio 97/97, check/lint/format clean, INVENTORY OK G1-unamended, the
  6-failure fresh-checkout set reproduced identically at baseline `510ef7e` (classified
  environmental).
- **The original red M-1 evidence** (preserved in the report and its
  `docs/audit/evidence/` artifacts): under production serving, the Studio's act-ingress
  POST omitted `content-type: application/json`; SvelteKit's production CSRF protection
  returned 403, so same-turn Read 2 failed (`HTTP_CONNECTION_UNAVAILABLE`) while dev-mode
  (no CSRF check) masked the failure — all then-accepted same-turn evidence was dev-mode.

## 4. The M-1 repair and its independently checkable lineage

- **Repair:** `a7c8d6c9d4712fc087908649270746dafa606a55` on
  `codex/stage9-g3-m1-repair` (vs parent exactly 2 files:
  `apps/studio/src/lib/server/quellight-transport.ts` +7 — every POST with a payload now
  declares `content-type: application/json`; `apps/studio/tests/quellight-transport.test.ts`
  +63 — the 'M-1 REPAIR' unit test). Merged into `main` by checked fast-forward
  (`2e65bab → a7c8d6c`); studio 98/98 (97 + 1) at the repair head.
- **Focused fresh-context re-verification (the closure prerequisite):** because the first
  focused check's RESOLVED ruling existed only as a message (no reviewable record), the
  owner required an independent reproduction with a preserved record. Executed at the
  repaired code SHA `a7c8d6c…`:
  **`docs/audit/VICT-STAGE-09-M1-REVERIFICATION-2026-09-30.md` on
  `review/stage9-g3-m1-reverification-20260930` @
  `6d389c83ebffdef1bfa15c199b70178b13778212`** (pushed, remote-verified), with evidence
  artifacts (`m1-reverification-2026-09-30-*.png` screenshots +
  `m1-reverification-2026-09-30-read2-curl-proof.log`).
  - **Verdict: M-1 RESOLVED.** Studio 98/98 at the repaired head. Live production
    reproduction against Quellight main `40b6c35` (byte-pure tree): real turn via product
    admission (thread `qlt-c9b5b0afd115302c87bc41e4`, turn
    `turn-6b6b5e46-b557-41eb-a7d1-6de5ef4f7d2c`, completed); Studio PRODUCTION
    (adapter-node, `ORIGIN` set) + real headless browser: same-turn panel rendered BOTH
    reads aligned on the target's own turnId; Read 2 (the act-ingress POST) = **200**
    (server-side curl proof of the identical POST against production-served Quellight).
  - **Negative control reproducing the original red mechanism:** the same POST with the
    header-less fetch default (`content-type: text/plain;charset=UTF-8`) returns **403**
    against production Quellight and 200 in dev-mode — the audit's masking matrix,
    independently reproduced.
  - **Regressions intact:** agent-identity refusal `VICT_TURN_ACTOR_MISMATCH` rendered
    with whoami DIFF evidence (`actor-quellight-local` vs
    `agent-quellight-agent-context`); anti-newer version probe (`run.get`) refused
    fail-closed (`VICT_HTTP_ROUTE_UNKNOWN`) with the capability-honesty banner.
  - **Deployment notes recorded (not defects):** adapter-node production requires the
    standard `ORIGIN` env var (without it the login form POST is CSRF-rejected);
    Quellight's dev server binds `[::1]` (app-origin provisioning must use `localhost`);
    the vict boundary is lazy-composed (port discoverable only after the first app
    request).

## 5. Merged repository state at closure

- **VICT `main`:** `164176abe6451742beb24aa2e83420c52a885d78` at the moment of recording
  (= exit-boundary STATE on top of the merged M-1 repair `a7c8d6c…` on top of the
  owner-accepted G3 closure `2e65bab…`; full ff lineage from `510ef7e…` through the G3
  gates to the accepted candidate `2c6d52e…`). The closure commits that carry THIS record
  sit directly on top; the checker verifies the final SHA (see §7).
- **Quellight `main`:** `40b6c35cfb74588b8aee835f92a6214f55cc6621` — the
  owner-accepted C2 increment (`1f7dcdc…` accepted; acceptance record, register
  D-G3-C2-1 addendum, and README status reconciliation on main), fast-forwarded from
  `5f709a5…` with no force anywhere. The Quellight tree was verified byte-pure
  (porcelain empty, HEAD unchanged) by the exit auditor and again by the M-1
  re-verification.

## 6. Retained findings and limits (all carried forward — nothing dropped)

**Exit-audit findings**
- ~~M-1~~ — production-serving CSRF failure of the act-ingress POST: **REPAIRED**
  (`a7c8d6c…`) and independently re-verified under production serving (`6d389c8…`); the
  red mechanism is preserved as a negative control in the addendum.
- N-1 — Windows fresh-checkout environmental suite class (6 failures reproduce
  identically at baseline `510ef7e`; build-dependent surfaces pass after package builds).
- N-2 — the `/runs` page does not expose `?target=` selection; target isolation is
  enforced at the transport layer, not UI-selectable.
- N-3 — historical "2414/2414" unit-count phrasing not verbatim reproducible (2834
  observed with the same outcome; count drift, not a coverage claim).
- N-4 — `QUELLIGHT_PORT` is resolved but unused; the boundary port remains ephemeral
  (discovered via netstat by PID; lazy-composed after first app request).

**G2-retained (from the G2 gate, unchanged)**
- FT-4-class load-sensitive timeout risk on the confirmation prepare→confirm path under
  load.
- F-2 / F-3 as recorded in the G2 closure record.

**G3/Quellight-retained (from the G3 gates and C2, unchanged)**
- L-1 — Quellight lockfile desync: `npm ci` fails; `npm install --package-lock=false`
  used; lockfile untouched.
- Read-denials carry no durable receipt (denial is observable in the response but leaves
  no persisted record).
- Actor-denial code labeling LOW (the OD-R4 single-actor structural limitation, resolved
  by the authorized C2 increment; labeling nuance retained).
- Turn-vs-inspection refusal-code wording (G3 closure finding): the two refusal surfaces
  carry differently-worded codes (`VICT_TURN_ACTOR_MISMATCH` on the turn surface vs
  `DATA_UNAUTHORIZED` on the inspection surface); the wording difference is retained as
  recorded — itemized here at the closure checker's request so it is not folded away.
- Deployment notes from the M-1 re-verification (see §4): `ORIGIN` requirement,
  `[::1]` binding, lazy-composed boundary port.

**Pairing limit (exact, per the owner)**
- **Verified:** the same-turn inspection proof and its authorization surface on the
  **existing Stage-07-closed Quellight at VICT release-set 0.3.1** — the real product
  test, with Quellight's own boundary refusing a lacking identity
  (`VICT_TURN_ACTOR_MISMATCH`, `DATA_UNAUTHORIZED`), the version pin refusing the
  anti-newer probe fail-closed, all demonstrated live under production serving.
- **Unverified and unclaimed:** the **unfinished greenfield Quellight** pairing. It was
  never edited, never verified, and no claim about it is made by this closure. Any future
  greenfield pairing is a separate owner-gated decision with its own contract and
  verification.

**Standing non-authorizations** (restated from the declaration): no package publication,
no product activation. Stage 9 closure does not open any new stage.

## 7. Verification of this record

A fresh independent checker reviewed the final closure claims and the documentation SHA
before handover (lineage of every cited SHA, quote fidelity of the declaration and of the
M-1 red evidence, retained-findings completeness against the prior records, pairing-limit
precision, non-forced ancestry of `main`, and the final `main` SHA). **Verdict: GO for
owner handover — no NO-GO conditions.** Its findings: INFO — STATE paraphrases rather
than quotes the owner declaration (semantically faithful, no drift); MINOR — the
turn-vs-inspection refusal-code-wording finding was not itemized verbatim in §6
(remedied in this record's §6 as directed; non-blocking). The owner received the final
VICT `main` SHA and the follow-up register with this record.
