# Stage 8 G3 — P2 Reattempt (P2B) Evidence and Comparison Record (2026-09-26)

> **Document type:** P2B evidence record and first-attempt/second-attempt
> comparison (owner-directed clean reattempt; gate G3). Claim record, NOT
> independently authoritative. **No Verified claim and no G3 gate
> satisfaction is declared**; the disposition proposal in §9 is for owner
> ratification. Companion records: the scoring correction filed earlier
> today (first-attempt scoring), which this record assumes.

## 1. Inputs — identities verified before issuance

Identical to the first attempt, re-verified immediately before the
reattempt launch:

| Item | Digest / id | Verification |
| --- | --- | --- |
| P2 brief (same bytes as first attempt) | SHA-256 `046558c9f99a05b6812ab0db10ec51e8fe5873964af03b3bee78e8eb56476a0d` | copied from pinned bytes; digest re-verified; workspace copy identical |
| Builder Kit artifact | SHA-256 `c3df869f54f07da9996274ea114d9ded3f9c2f5003918ed4d6795bed62e78018` (89,438 bytes) | re-hashed from a fresh copy of the recorded tarball |
| Release set | `vict-release-set@1/0.3.1`, content ID `v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583` | all 13 packages re-downloaded from the registry immediately before issuance: every `dist.integrity` matched, every internal pin exact, `latest`=0.3.1, content ID recomputed == recorded (fresh evidence: `eval-p2b-artifacts/registry-evidence.json`, SHA-256 `90c29a06…`) |
| Clean consumer | `C:\Users\RZ1\Desktop\taskledger-p2b-20260926` | created empty: 0 entries, no `package.json`, no git (record `eval-p2b-empty-dir-record.json`, SHA-256 `34f2e37a…`); outside VICT and all worktrees |
| Builder instructions | `builder-operator-note-p2b.md` (SHA-256 `7ee8df5b…`) | byte-diff against the first attempt's note: exactly two changed lines (title P2→P2B, artifact path `eval-p2-artifacts`→`eval-p2b-artifacts`); allowed inputs, scope/isolation rules, authority limits, and deliverable requirements identical |

The builder received ONLY: the empty workspace + `taskledger-brief.txt`,
the kit tarball + SHA-256, the release-set id, and the logistics note. The
first application, defect reports, missing-import diagnosis, evaluator
results, rubric, handoff, and operator instruction were not supplied; no
code from the first attempt was copied (verified transitively: nothing
outside the allowed inputs was read — §4).

## 2. Builder session (genuinely fresh, isolated, uninterrupted)

Separate pi process, fresh context, flags `-p -nc -ns -ne -np`, dedicated
session directory `eval-p2b-builder-session/` (single transcript,
SHA-256 `a1616323…`, ~908 KB — **no external kills this round; no resumes
needed**). The builder: verified the kit hash first, installed the kit
from the local artifact, bootstrapped (`init-app` with the brief as a
content-addressed input), installed all 13 platform packages at exact
`0.3.1` via registry install with lockfile integrity, scaffolded,
authored, tested (16/16), built, and wrote its result document. Four
commits: `e82928b` (bootstrap) → `8ae942a` (application) → `b6fb360`
(server-side route resolution for parameterized paths + durable data-dir
creation) → `76c5727` (result document; HEAD). Repo state clean apart
from untracked runtime logs.

App-local base pack: `packId 434413e141fb14864225e1365f6ace5f6726987e1dad6566…`;
records the release set id, the kit artifact spec + SHA-256, and the
brief with content digest `046558c9…` — identical to the operator pin.

## 3. Isolation incidents (recorded honestly)

1. **Operator-environment leak, self-reported by the builder.** The
   attempt-1 evaluation server (an unrelated-to-P2B process holding port
   4173, left running by the operator after the first attempt's
   evaluation) answered the builder's first production-start curls. The
   builder detected the collision (`EADDRINUSE` + foreign response
   content), stopped immediately per its instructions, kept evidence
   (`server-eaddrinuse-evidence.log`), moved to port 4187, and re-ran all
   exercises against its own server. Bounded impact: a few HTTP JSON
   responses from the **attempt-1 application** (task-row titles such as
   "P2 evaluation record…" and attempt-1's contract id string) entered
   its context. **No rubric, handoff, defect report, evaluator result, or
   attempt-1 source code was exposed** (HTTP JSON only; no filesystem or
   repository access). The operator killed the leftover process
   (PID 14828) during P2B evaluation prep. The transcript-path audit
   below independently confirms zero reads outside allowed inputs.
2. **Transcript isolation audit: clean** — a full scan of the P2B session
   transcript found zero references into the VICT tree or any other
   repository outside the two allowed input paths.

## 4. Evaluator verification results (independent, sequential)

| Check | Result |
| --- | --- |
| `verify --app` | **5/5 ALL CHECKS PASSED** (schema, packId identity, bootstrap binding, input provenance — brief digest `046558c9…` matches the operator pin — and release-set identity of all 13 installed packages); reproduced after rebuild |
| Build + run | `npm run build` exit 0 (twice); app served HTTP 200 |
| Builder tests | `npm test` exit 0 — 3 files / **16 passed** |
| VICT `verify:builder-kit` | **18/18 ALL CHECKS PASSED** |
| VICT `verify:release-set` | **ALL CHECKS PASSED — 13 packages, 0.3.1, `v1_1c695280d3afec5…`** (frozen set unchanged) |

## 5. Real-browser record (real Chrome via CDP; real keyboard; 390×844 and 1366×768)

Evidence: `eval-p2b-artifacts/browser-record/` (16 screenshots + 3
interaction logs). Key observed outcomes:

- **Mounted task rows (the first attempt's decisive failure):** the table
  island mounts and renders live — 4 rows before seeding, 8 rows per page
  after; zero console errors on dashboard and tasks screens.
- **Visible colored badges:** per-row badges render with three distinct
  computed palettes (low: gray `rgb(241,245,249)`; medium: amber
  `rgb(254,243,199)`; high: red `rgb(254,226,226)`), consistent at phone
  and laptop widths.
- **Search (server-side):** `Bravo` → 8→2 rows (first "Bravo supplies
  (seeded)"); `seeded` → 8 rows page 1 of "Page 1 of 3 (18 tasks)";
  status filter `done` → exactly the completed rows. All through the
  declared `act.queryTasks` boundary.
- **Sort:** Title asc → alphabetical (`sorted: true` observed over the
  full page); Title desc → reversed; Priority sort → semantic rank order
  (low first ascending). Caveat: sort header buttons are hidden ≤640 px
  (the row-card layout keeps data visible; the same narrow-width gap
  class as the first attempt — recorded, not excused).
- **Pagination:** page 1 → Next → page 2 with **zero row overlap** (8
  rows); Previous returns the identical page-1 first row; indicator
  "Page X of 3 (22 tasks)".
- **Row Complete action (the governed boundary, exercised from the
  mounted row):** clicking the row's Complete produced the live notice
  "Task completed (governed action recorded).", flipped the row to done,
  and produced a durable run (§7).
- **Edit flow (laptop):** row Edit → prefilled form (title read back
  "Read a book") → real-keyboard edit → saved → navigated → persisted
  (boundary search found the edited title). Invalid priority
  `urgent-not-allowed` at the boundary → **`DATA_CONTRACT_REJECTED`**;
  stored value unchanged.
- **Dashboard:** open-count island live (**18 open** of 22 tasks —
  consistent with 4 completions), 14-day chart (SVG, 14 bars) with an
  accessible per-day table (15 rows, zero-filled days) — no console
  errors.
- **DEFECT P2B-DEFECT-1 (real browser):** the **create** form never
  mounts live. On `/tasks/new` the SSR HTML contains the full form, but
  after hydration the island shows "This task does not exist." (its edit
  id derivation treats the path segment `new` as a task id, the lookup
  fails, and the form is replaced by the missing-state branch). The
  create flow is therefore unusable in the real browser as delivered;
  tasks were created during evaluation through the app's own declared
  `act.createTask` boundary. The edit path (`/tasks/:id` with a real id)
  is unaffected and works end-to-end.

## 6. Boundary probes

| Probe | Observed |
| --- | --- |
| `act.createTask` with undeclared field `hacker:true` | **`DATA_INVALID_INPUT`** (rejected, explicit message) |
| `act.completeTask`, unknown id (+ undeclared `force`,`note`) | `ok:true, found:false` (graceful not-found shape) |
| `act.completeTask`, valid open id | completes: `status:"done"`, ISO `completedAt`, `completedDay` |
| replay on completed task | `alreadyDone:true` — idempotent |
| undeclared fields on complete input | **stripped by the contract's normalizing parser** — `task.complete.input@1.parse` extracts exactly `{id}` (empty id → rejected with issues); the capability can never observe extras. Design difference vs the first attempt's hard `CONTRACT_REJECTED`: both enforce the declared input shape; recorded as an observed difference, not a defect |
| `act.queryTasks` with unknown fields / hostile strings | ignored safely; parameterized store; no injection |
| status forgery via update | status is never caller-writable (server composes the record from a read; builder's hostile-edit probe + evaluator's contract-rejection probe agree) |

## 7. Durability and identity probes

- **F7 (hard kill / restart):** server process killed (`taskkill //F`;
  connection refused verified), restarted from the same SQLite files:
  task state **byte-identical** (`appdata_tasks` digest `c768dd126540d1f1…`
  before == after, 22 rows); durable ledger intact: **8 completed runs** of
  `graph.task.complete`, **32 events** (`run.started → node.started →
  node.completed → run.completed`, `vict.run-event@1`), **one pinned
  activation** `v1_39207983…` restored (not re-activated).
- **F8 (identity across content-identical rebuild):**
  `applicationVersion:"v1_59b3a3dfb9f09de972b3eef95213a6991335e272b02e503301886f0ff8acffdc"`
  **identical** before and after rebuild; `verify --app` 5/5 and tests
  16/16 green after rebuild.

## 8. Negative controls (app-level; red → restore → green)

| Control | Observed |
| --- | --- |
| Content drift (recorded brief byte changed) | `FAIL: inputs:app-pack [content-drift] — content drift: taskledger-brief.txt`, exit 1 → restore (digest re-verified `046558c9…`) → **5/5 green** |
| Pack tamper (schema-valid name change) | `FAIL: identity:app-pack [pack-tamper] — packId does not match the canonical bytes` → restore → **5/5 green** |

## 9. F1–F8 scoring of the reattempt, and the two-attempt comparison

| ID | Attempt 1 (corrected) | Attempt 2 (P2B) |
| --- | --- | --- |
| F1 builds/runs from empty project | PASS | **PASS** |
| F2 create/edit form validates | PASS (both flows worked live) | **FAIL as delivered** — create form unreachable live (P2B-DEFECT-1); edit flow fully works live (prefill, keyboard edit, persistence, invalid rejected) |
| F3 table: search, sort, pagination | **FAIL** (island never mounted) | **PASS** — live server-side search, both sort directions, 3-page pagination round-trip; ≤640 px sort-control gap recorded |
| F4 dashboard chart + count | PASS | **PASS** (18 open consistent; per-day table zero-filled; SVG chart) |
| F5 row Complete = governed durable action | PASS at boundary only (row button unavailable) | **PASS in full** — row button works live; boundary probes; durable runs + events + pinned activation; idempotent replay |
| F6 badge island visible | NOT DEMONSTRATED | **PASS** — island declared/registered AND visibly rendered with 3 distinct color palettes |
| F7 kill/restart persistence | PASS | **PASS** (identical digest; ledger intact) |
| F8 identity stable across rebuild | PASS | **PASS** (`v1_59b3a3df…` unchanged) |

**Attempt 2 score: 7 of 8 PASS; F2 FAIL** (one localized real-browser
defect: the create form's client-side mount), with the ≤640 px sort gap
recorded under F3 as a caveat. Both attempts' claims-vs-observations are
on record: attempt 1 claimed client-rendered rows that did not render;
attempt 2 claimed the create form "implemented and exercised" on
HTTP-level evidence that did not establish live-client rendering. In both
cases the real-browser record is the deciding evidence.

**Complementary defect profiles:** attempt 1's single root defect
disabled everything inside the table (rows, search/sort/pagination, row
Complete, visible badges) while its forms worked; attempt 2's single root
defect disables only the create form's client mount while the table,
badges, row action, and edit flow all work live. Neither attempt required
steering; both were built from the same pinned brief, kit bytes, and
registry set.

## 10. Preservation

- Attempt 1: untouched — first app repository, bundle
  (`6d353b9c…`), governance record, scoring-correction record, and the
  file-once implementation report are unchanged.
- Attempt 2: preserved as its **own repository**
  (`C:\Users\RZ1\Desktop\taskledger-p2b-20260926`, HEAD `76c5727`, tree
  clean apart from runtime logs) with reproducible bundle
  `taskledger-p2b-builder-repo.bundle` (SHA-256
  `36a6e94a5955737c0e05160e75e09cfe1153a2a9bc19f6441e3c1f4e7d662dc1`) and
  result document (SHA-256 `252a1b01…`). Builder session transcript
  preserved (SHA-256 `a1616323…`). Nothing merged into VICT; the
  application is not part of any VICT package or release set.
- This record and its artifacts live in the P2 worktree
  `.builder-kit/prep/eval-p2b-artifacts/` (gitignored) with digests
  above; governance documents are tracked.

## 11. Proposed G3 disposition (for owner ratification; NOT self-executed)

The reattempt satisfied the owner-directed protocol: same pinned inputs
(verified before issuance), fresh empty external project, genuinely fresh
uninterrupted isolated builder session, independent evaluation against
the pinned rubric with a real-browser record of mounted rows, search,
sort, pagination, colored badges, and the row Complete action; boundary
negative probes, restart and rebuild probes, clean-consumer checks, and
app-level negative controls all executed with every result recorded,
including failures.

Proposal for the owner: **authorize one final bounded fix round (P2C)**
addressing exactly P2B-DEFECT-1 (create-form client mount on
`/tasks/new`) and optionally the ≤640 px sort-control visibility gap —
re-issued to a fresh isolated builder session with the defect report as
operator feedback (no rubric disclosure), followed by the same evaluation
ladder; **or** accept the P2B package with F2 FAIL recorded and let the
independent audit weigh the complementary defect profiles of both
attempts. **No gate satisfaction is declared by this record.** Standing
non-claims unchanged: Stage 8 and every BLD requirement remain NOT
Verified; no publication; no production activation; no Quellight access;
no G4 start.

**Stop point: P2B evidence package and comparison complete — for owner
review.**
