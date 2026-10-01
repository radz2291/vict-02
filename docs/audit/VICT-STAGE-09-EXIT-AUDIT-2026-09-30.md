# VICT Stage 9 — INDEPENDENT EXIT AUDIT (OD-R6) — 2026-09-30 / executed 2026-10-01

> **Auditor:** OD-R6 independent exit auditor; no role in any Stage 9 work; audit
> only (no repairs). This is the ONLY file committed by this audit besides its
> evidence artifacts under `docs/audit/evidence/`.
>
> **Pinned merged heads (live-verified at audit start):**
> VICT `origin/main` `2e65bab5812b6ea0107d248e40b3e2e602ef6a84` — VERIFIED.
> Quellight `origin/main` `40b6c35cfb74588b8aee835f92a6214f55cc6621` — VERIFIED.
> Both audited from fresh clones of the INTEGRATED trees (not gate branches).

## Verdict

**PASS WITH NON-BLOCKING FINDINGS.** The G0→G3 governance lineage is real,
internally consistent, and matches the integrated trees; the live product
journeys (G1 reads, FT-1 drill-down, G2 confirmations and changesets, G3-B
run detail, G3-C Quellight same-turn/boundary proof) reproduce on the
integrated heads; the retained findings and pairing limits are stated
truthfully. Formal Stage 9 closure is **PERMITTED** (owner decision), with the
findings below RETAINED; **M-1 must be recorded and repaired before any
production-serving or activation claim** — it does not affect the
dev-mode evidence the gates accepted.

## A. Governance lineage — VERIFIED

- **G0:** `VICT-STAGE-09-G0-RATIFICATION-2026-09-29.md` present; freeze commit
  `5c680d51a0622013cac5349853659a74c1584a98` carries the record; all four
  frozen digests recomputed **byte-exact** at the freeze-commit tree
  (`AGENTS.md` `7b79bd43…`, architecture `1ebb85b0…`, STATE `faaaede4…`,
  handoff `50387444…`). D-1–D-10 are recorded as contract decisions, not
  implementation evidence.
- **G1:** closure record matches lineage; base `fd675d9`, verified candidate
  `f68c2bb`, docs-only chain to `3e3b97e`, merged main `b37d4bd` — all SHAs
  exist on the integrated history; verifier branch
  `review/stage9-g1-verification-20260929` @ `3d03d4c` live.
- **G2:** closure record; contract base `737af38` (live on main), first-cycle
  `56bc204`/`c705fe0`, repair verification `review/stage9-g2-verification-repair-20260929`
  @ `95952a1`, accepted `c018b59` — all live; verification branches live.
- **G3 contract freeze:** `VICT-STAGE-09-G3-CONTRACT-FREEZE-2026-09-29.md` at
  freeze commit `57cc938e5fa194e0210d5989138dc9b84416d530`. Pins recomputed at
  the freeze-commit blobs: handoff `287dd3a1…` = LF→CRLF bytes EXACT; STATE
  `d94f8273…` = LF→CRLF bytes EXACT; proposal `dc5540e7…` = LF→CRLF bytes
  **without trailing newline** EXACT. (Normalization note recorded; all three
  pins verify.) Review rounds `8d020c9` → `48bd11d` → `38c1d2f` (FREEZE-READY)
  all live on their pushed branches.
- **G3 execution + closure:** G3-A `1d257f8`, A+C `d014d62`, accepted candidate
  `2c6d52e`, docs boundary `bb8470e` — all live; verifier branches
  `review/stage9-g3-{a,b,c}-verification-20260930` and
  `review/stage9-g3-c-reverification-20260930` live at the recorded SHAs.
- **Quellight:** acceptance record
  `docs/report/QUELLIGHT-STAGE9-G3-C2-OWNER-ACCEPTANCE-2026-09-30.md`,
  register `D-G3-C2-1` + addendum, README/system-reference status surfaces
  reconciled; increment `1f7dcdc` (contract `9ce8c69`, S1 `8b2de8d`, S2
  `11b7367`), verifier `review/stage9-g3-c2-verification-20260930` @ `57ebabb`
  — all live in the Quellight repo.
- **STATE gate table:** one consistent story G0 RATIFIED/FROZEN → G1 CLOSED →
  G2 CLOSED → G3 CLOSED (owner-accepted, PASS WITH NON-BLOCKING), exit audit
  as the next owner-gated step; Stage 9 NOT declared closed by the closure
  record. No overclaim found in the STATE header or gate rows. The closure
  records correctly say "does NOT declare Stage 9 closed".

## B. Real Studio use, authorization + target isolation — VERIFIED (one finding)

Live stack on fresh ports: demo fixture target on **4731**
(`apps/studio/scripts/demo-target-s902.mjs` pattern, `DEMO_PORT=4731`),
Quellight from the INTEGRATED main `40b6c35` via its own composition (offline
deterministic mode, boundary **55126**, app ingress **4734**), Studio
(adapter-node build) on **4733**, login `audit-operator` via the real form
flow.

- **Session boundary:** login form → HttpOnly `vict_studio_session` cookie;
  unauthenticated `/` → 401; **no target token in any fetched page HTML**
  (grep for `vict-studio-demo*` and live Quellight tokens: zero hits);
  credentials resolved server-side only (`targets.ts`); CSRF/Origin check
  live-enforced (cross-site POST forbidden; verified by a rejected POST).
- **G1 read surface through the UI:** home + runs list render real target
  rows; **genuine FT-1 links** — 50 `href="/runs/run-…"` anchors rendered
  definition-driven; one clicked live (`/runs/run-demo-completed`) and the
  detail page rendered.
- **Target isolation (live):** Quellight boundary refuses G1 run routes
  (`VICT_HTTP_ROUTE_UNKNOWN` on `run.get` probe — the 0.3.1 version-pin
  discriminator, while the demo target answers the same read `ok:true`);
  the demo target refuses a Quellight turn
  (`VICT_TURN_EXECUTOR_UNAVAILABLE`); Quellight transport refuses
  cross-target ids/credential refs by construction (code-verified).
  See N-2 for a UI-level note.

## C. Confirmed recovery (G2) — VERIFIED LIVE

Full S9-04 journey on the demo fixture through the Studio UI: **prepare →
review → confirm** with the resulting-effect panel (executor verbatim
`{"status":"accepted","cancelled":true,"runStatus":"cancelled","runRecordRevision":4}`,
before blocked/rev2 → after cancelled/rev4, wait `wait-demo-signal` resolvedBy,
durable `confirmation.prepared` + `confirmation.consumed` audit rows with
actor + digest). Negatives, all truthfully banner'd LIVE: REQUIRED (missing
Idempotency-Key), STALE (`VICT_CONFIRMATION_STALE`), SPENT
(`VICT_CONFIRMATION_SPENT`), FIELD_INVALID truthfulness banner, and
**idempotent replay** (same key returns the recorded outcome, no second
effect). S9-03 changesets journey: propose → evidence (validation run
attached) → decide → commit (`committed`, exactly-once), plus LIVE negatives:
self-approval (`VICT_ACTOR_SCOPE_DENIED`, 403), missing approval
(`VICT_CONTROL_CHANGESET_NOT_APPROVED`), duplicate commit (replay, no second
effect), and additionally `VICT_CONTROL_BASE_STALE` (commit fails closed
before any mutation). Transcripts: `evidence/exit-audit-confirmations-live.md`,
`evidence/exit-audit-changesets-live.md`.

## D. Run-detail journey (G3-B) — VERIFIED LIVE

`/runs/[runId]`: default **REDACTED** projection; reveal (real form POST)
returns the protected bytes under the distinct `run.detail` credential and
renders the target's own `run.detail.accessed` per-access audit row; ordered
events, waits, provenance/version pins, and bounded options ("terminal;
accepts no operator mutation") rendered from G1 reads; empty/missing/pagination
seeds present in the fixture (55 page runs) and negative journeys covered by
the G3-B verifier's own live journey (branch evidence spot-checked).

## E. Same-turn Quellight proof (G3-C) on the integrated heads — VERIFIED (one finding)

- Identity pin: health/compat inspect answers pinned, distinct whoami for the
  two server-held credentials (`actor-quellight-local` vs
  `agent-quellight-agent-context`, `singleActor:false`) — LIVE.
- Operator allow + same-turn: Read 1 (`agent.turn.get`) live-completed for the
  provisioned turn; Read 2 via the declared act ingress — **succeeds in dev
  mode, FAILS in production serving mode (finding M-1)**. The verifier
  screenshot `qa-artifacts/stage9-g3/s905-same-turn-panel.png` (byte-identical
  on `review/stage9-g3-c-reverification-20260930` and main) shows the ALIGNED
  panel (turnId in both reads) from a dev-mode run.
- Agent-identity refusal: **LIVE `VICT_TURN_ACTOR_MISMATCH`** on the turn
  surface under the agent-context credential.
- Underprivileged denial: **LIVE `DATA_UNAUTHORIZED`** on the inspection
  surface, reproduced by running the integrated Quellight tree's own
  `scripts/demo-g3c2-boundary-actors.mjs` (offline deterministic, tokens
  redacted) — `evidence/exit-audit-g3c2-demo-live.log`.
- Capability-honesty banner rendered live, target-specific; version-pin
  `run.get` refusal live (above); labeled provenance surfaces present.
- **Quellight tree byte-pure before and after ALL live audit work:**
  `git status --porcelain` empty and HEAD `40b6c35` unchanged (the retained
  L-1 reproduced: `npm ci` refuses; `npm install` was used for the live run
  and the lockfile restored byte-exact afterwards).

## F. Evidence lineage — VERIFIED (spot-checks)

QA artifacts exist on the branches that claim them, including sets added
after the G2 first cycle: `review/stage9-g2-verification-20260929` and
`-repair-` branches carry the stage9-g2 screenshot set (330+ PNGs incl.
journey evidence post-`56bc204`); the g3-a/b/c and c2-verification and
c-reverification branches carry the `s902-*` and `s905-*` sets plus their own
agent-workspace captures; `s905-same-turn-panel.png` spot-opened (valid PNG,
content matches the claim); `s902-journey-results.json` /
`s905-oracle-answers.json` present. All verifier SHAs recorded in the closure
records resolve on their recorded remote branches (A §).

## G. Retained findings + pairing limits — VERIFIED

Every finding listed in the G1/G2/G3 records is retained in the STATE header
(FT-4 load-sensitive class; G2 F-2/F-3; G3 LOWs: actor-denial code-label
precision, Quellight lockfile desync, read-denials carry no durable receipt,
turn-vs-inspection refusal code wording; Windows fresh-checkout environmental
class). Pairing limits stated precisely and consistently across STATE, the G3
closure, and the Quellight acceptance record: verified = the OLD product
(Stage-07-closed Quellight on VICT 0.3.1); greenfield pairing UNPROVEN and
never claimed; no publication, no activation anywhere in the records. L-1
(lockfile desync) reproduced live at the integrated head.

## H. Suites at the integrated heads — VERIFIED with a classification

- Root unit at fresh checkout: **6 failures / 2828 passed / 5 skipped**; the
  byte-identical failure set reproduces at the pre-G3 baseline `510ef7e`
  after clean `npm ci` — the documented Windows fresh-checkout environmental
  class CONFIRMED (all six are dist/build-order or real-child-process
  tests). After `npm run build` (exit 0) the build-dependent surfaces pass.
- Studio suite **97/97 exit 0**; `apps/studio` `check` **exit 0**; root
  `lint` **exit 0**; `prettier --check` **clean**;
  `verify:stage9-inventory`: **INVENTORY OK — G1 reads UNAMENDED, G2
  confirmation surface accounted** (counts: 20 pre-existing, 4
  legacy-mutation, 11 stage9-g1-read, 1 shared, 6 g2).
- N-3: the records' "2414/2414" root-unit count was not reproducible
  verbatim on this machine (2834 executed); the pass/fail STATE after build
  matches the claims; classify as record-precision note, not an overclaim.

## Findings

- **M-1 (Major, non-blocking for the accepted dev-mode evidence; MUST be
  repaired before any production-serving/activation claim):** the Studio
  Quellight transport's act-ingress POST
  (`apps/studio/src/lib/server/quellight-transport.ts`, `callTargetCommand` →
  `/api/act`) sends **no `content-type` header**. SvelteKit's production
  CSRF guard rejects it with **403**, so the same-turn panel's Read 2 fails
  (`HTTP_CONNECTION_UNAVAILABLE`) whenever the Quellight app is served in
  production mode (`vite preview` / adapter-node). Empirically: no-ct=403,
  with-ct=200, no-ct+matching-Origin=200, dev server no-ct=200. All accepted
  G3-C Studio-side evidence was captured in dev mode. The auditor did NOT
  repair. Retain and fix in a bounded, separately verified increment.
- **N-1:** six-failure fresh-checkout unit class confirmed at both
  `2e65bab` and baseline `510ef7e`; classification honest.
- **N-2:** the `/runs` list page ignores `?target=` and always renders the
  default (local) target's rows; cross-target isolation is enforced at the
  transport/boundary level (verified live) but is not selectable through the
  runs-list UI. Honest limitation, no false claim found.
- **N-3:** record-precision note on the root-unit test count (H).
- **N-4:** Quellight `QUELLIGHT_PORT` is resolved by the environment but not
  used by `composition.listen()` (boundary always binds an ephemeral port);
  deployment provisioning of a stable boundary endpoint therefore relies on
  out-of-band port discovery. No claim in the records depends on a stable
  port; recorded for completeness.

## Criterion table

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| A Governance lineage | VERIFIED | §A; all pins recomputed byte-exact; all SHAs/branches live |
| B Real Studio use + isolation | VERIFIED | §B; live ports 4731/55126/4734/4733; no token in browser |
| C Confirmed recovery (G2) | VERIFIED | §C; full journeys + all negatives live |
| D Run-detail journey (G3-B) | VERIFIED | §D; redacted default + reveal + audit row live |
| E Same-turn Quellight (G3-C) | VERIFIED with M-1 | §E; refusal + denial + pin live; Read 2 dev-mode only |
| F Evidence lineage | VERIFIED | §F; artifacts on claiming branches, spot-opened |
| G Retained findings + pairing limits | VERIFIED | §G |
| H Suites at integrated main | VERIFIED (classified) | §H |

## Formal closure

**Formal Stage 9 closure is PERMITTED** on this verdict — PASS WITH
NON-BLOCKING FINDINGS — with all findings retained and M-1 scheduled for a
bounded repair before any production-serving, publication, or activation
step (those remain prohibited until separately decided).
