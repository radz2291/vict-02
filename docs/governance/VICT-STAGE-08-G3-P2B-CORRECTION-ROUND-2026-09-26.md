# Stage 8 G3 — P2B Correction Round Evidence and Comparison (2026-09-26)

> **Document type:** owner-authorized, bounded P2B correction round —
> evidence record and comparison across all three evaluations (attempt 1,
> attempt 2, attempt 2 corrected). This is a **disclosed feedback round**
> on the app originally created from the pinned brief — NOT a new
> clean-brief-only attempt; the distinction is kept explicit throughout.
> **No Verified claim is made; G3 evidence-completeness is PROPOSED for
> owner review (§6), not declared.**

## 1. Authorization and scope

The owner authorized one bounded correction round: resume the ORIGINAL
isolated P2B builder session in its existing TaskLedger repository, give
it ONLY user-observable QA feedback (the two observed failures), evaluate
the single final commit against all F1–F8, and preserve both original
attempts with their commits, bundles, failed results, and governance
records. Scope limits honored: changes confined to the P2B application;
no changes to VICT, the Builder Kit, published packages, or the pinned
brief.

## 2. Session resume and environment deviations (recorded honestly)

- The resume (same session id `01a0dc4a…`, same transcript, same
  isolation flags `-p -nc -ns -ne -np`) appended the owner's QA feedback
  **verbatim** as the new turn — nothing else was supplied: no rubric, no
  implementation diagnosis, no defect classification.
- **Provider quota interruption:** the first two resume attempts died
  with a provider 429 ("Usage limit reached for 5 hour", reset
  16:34:11) before any model response; recorded in the transcript as
  duplicated user turns. The owner then asked the operator to switch the
  provider from the operator side; the third resume used
  `--provider zai --model glm-5.3-flash` (same model, separate quota) and
  ran to completion **uninterrupted**. All three resume attempts are
  visible in the single preserved transcript (final transcript SHA-256
  `e5476fda…`).
- The correction round is a disclosed feedback round: the builder's own
  result document and this record both state that fixes were made in
  response to operator QA feedback, not discovered independently.

## 3. What the builder delivered (its commits, its evidence)

- `a19181e` — "Fix /tasks/new misdetected as edit route; restore phone
  sort access; real-browser brief verification":
  - `TaskForm`: explicit `/tasks/new` guard in the path-derived edit id
    (regression-tested) — the create form is no longer replaced by the
    missing-state branch;
  - `TaskTable`: dedicated narrow-screen sort controls (field select +
    direction toggle, testids) so sorting is accessible where the header
    row is hidden, plus a repaired literal `\n` that had disabled the
    mobile thead CSS rule; `data-sort-field` attributes;
  - derived 14-day projection emits short `MM-DD` chart labels
    (legibility at all widths);
  - `scripts/browser-check.mjs` + `browser-evidence/`: its own
    real-browser verification at 390×844 and 1440×900, **70/70 checks**,
    failures found and fixed during the round (documented);
  - `RESULT.md` updated with diagnoses, observations, and the explicit
    statement that this was a feedback round.
- `d53a152` — untrack a transient build log. HEAD after the round:
  `d53a152`; tree clean.

## 4. Independent evaluation of the single final commit (HEAD `d53a152`)

All observations below are from this one commit; nothing is combined
with earlier commits. Pins re-verified: all 13 platform dependencies
exact `0.3.1` in `package.json` + lockfile registry integrity; kit
artifact bytes unchanged (`c3df869f…`); brief input digest `046558c9…`
matches the operator pin. `verify --app` **5/5**; `npm run build` exit 0
(twice); `npm test` **4 files / 20 passed**; VICT gates re-run in the P2
worktree: `verify:builder-kit` **18/18**, `verify:release-set` frozen set
unchanged (`v1_1c695280…`).

Real-browser record (real Chrome via CDP; real keyboard; 390×844 and
1366×768; evidence `eval-p2bc-artifacts/browser-record/`, 16 screenshots
+ 2 interaction logs):

| ID | Criterion | Result |
| --- | --- | --- |
| F1 | builds/runs from empty project | **PASS** |
| F2 | create/edit form validates against declared contract | **PASS** — create form present live (fix verified: save button present, missing-branch gone); empty submit → native `required` validation visible ("Please fill out this field."), submit blocked, nothing persisted; valid create via real keyboard persisted; edit prefilled → valid edit persisted (boundary search hit); over-length title clipped to 200 at the input and a 240-char title rejected at the boundary (`DATA_CONTRACT_REJECTED`); invalid priority `DATA_CONTRACT_REJECTED` |
| F3 | table: search, sort, pagination | **PASS** — mounted rows (8/page); server-side search (`Alpha` → 3 correct rows); header sort title asc+desc (`sortedAsc: true`, `sortedDesc: true`, toggled), semantic priority sort; pagination page 1↔2 with zero row overlap and round-trip `true`; **narrow-screen sort controls work at 390 px** (field select + direction toggle — the fix) |
| F4 | dashboard chart reflects persisted completions | **PASS** — live open count, 14-day chart with legible `MM-DD` labels and accessible per-day table; after completions the chart/count reflect them |
| F5 | row Complete crosses the governed boundary, durable | **PASS** — row button live: "Task completed (governed action recorded)."; durable ledger after the round: 4 runs / 16 events / 1 pinned activation; undeclared complete-input fields stripped by the normalizing contract (`idMatchesRequested: true`), replay idempotent |
| F6 | badge = versioned code island, visibly rendered | **PASS** — three distinct computed palettes (gray/amber/red) on mounted rows at both widths |
| F7 | kill/restart preserves tasks + durable effects | **PASS** — hard kill (`taskkill //F`, connection refused verified) + restart: task-table digest identical (`3ebdcf89…`, 21 rows), ledger identical (4/16/1) |
| F8 | application identity stable across content-identical rebuild | **PASS** — `applicationVersion v1_59b3a3df…` identical before/after rebuild (definition unchanged by the fix, so the identity is unchanged — consistent with the identity rule) |

Negative controls on the final commit: content drift → `FAIL: inputs:app-pack
[content-drift]` → restore (digest re-verified) → green; pack tamper →
`FAIL: identity:app-pack [pack-tamper]` → restore → **5/5 green**.
No regressions were observed relative to the pre-fix evaluation: every
criterion that passed before still passes in the final commit's own
browser session.

## 5. Comparison across the three evaluations

| ID | Attempt 1 (corrected scoring) | Attempt 2 (P2B) | P2B corrected (final commit `d53a152`) |
| --- | --- | --- | --- |
| F1 | PASS | PASS | **PASS** |
| F2 | PASS | FAIL (create form unreachable live) | **PASS** |
| F3 | FAIL (table never mounted) | PASS (≤640 px sort hidden) | **PASS** (narrow-screen sort controls added) |
| F4 | PASS | PASS | **PASS** |
| F5 | PASS at boundary only | PASS in full | **PASS in full** |
| F6 | NOT DEMONSTRATED | PASS | **PASS** |
| F7 | PASS | PASS | **PASS** |
| F8 | PASS | PASS | **PASS** |

Lineage: attempt 1 (fresh-brief attempt; failed table island) → attempt 2
(clean reattempt from the same pinned brief; complementary defect) →
corrected attempt 2 (owner-authorized disclosed feedback round; both QA
failures fixed, all eight criteria pass on the final commit). Each state
is preserved as its own repository state with a reproducible bundle:
attempt 1 bundle `6d353b9c…`; attempt 2 bundle `36a6e94a…`; corrected
state bundle `ca4a77259a80ee11112a01895490d6c44b93208af8a059faff1ecb947e286246`
(builder result document for the corrected state: SHA-256
`9a42a71e…`). Earlier governance records and the file-once
implementation report are untouched.

## 6. Proposed disposition (for owner ratification; NOT self-executed)

All F1–F8 criteria pass on the single final commit under independent
real-browser evaluation, with pins verified and controls behaving as
designed. The evaluator therefore **proposes G3 evidence-complete for
owner review**: the P2 evidence package now contains a clean-consumer
greenfield proof (attempt 2) plus a bounded, disclosed correction round
demonstrating the same builder session diagnosing and fixing
user-observable defects from QA feedback — with every intermediate
failure honestly recorded. The independent audit and the owner make the
actual gate decision; nothing here is a Verified claim. Standing
non-claims unchanged: Stage 8 NOT Verified; no publication; no
production activation; no Quellight access; no G4 start.

**Stop point: P2B correction round filed — for owner review.**
