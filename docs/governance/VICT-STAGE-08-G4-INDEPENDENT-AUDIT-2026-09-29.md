# Stage 8 — Independent G4 Audit Record (2026-09-29)

> **Document type:** independent G4 audit record per the frozen gate ladder
> (architecture §5.1: "G4 — Independent audit (§27.3) over the whole stage;
> dispositions per §22.3") and the reference governance rules (§27.3,
> §27.4, §22.3). Prepared by an auditor who did not implement the Builder
> Kit, did not build TaskLedger, and did not evaluate G3. **No finding
> below is self-graded by the implementer; every material claim was
> independently reproduced or its non-reproduction is stated.** Stage 8
> closure remains the owner's decision; this record recommends, and does
> not execute, closure.

## 0. Auditor, evidence point, and method

- **Auditor independence:** fresh session; no role in G1 implementation,
  the P1/P2 proofs, the G3 evaluation, or any owner disposition. All
  reproduction work was done in auditor-created locations: worktree
  `C:/Users/RZ1/Desktop/RZ/g4-audit-vict` (branch `g4/stage8-independent-audit-20260929`,
  created from `e1bddf2`), app clone `C:/Users/RZ1/Desktop/RZ/g4-audit-evidence/app`
  (cloned from the reconciled bundle), artifact/registry evidence under
  `C:/Users/RZ1/Desktop/RZ/g4-audit-evidence/`.
- **Handed-off evidence point:** `main` @ `e1bddf2`. Verified: remote
  `refs/heads/main = e1bddf214ec35d13f1e3dc459af386bfc459a53a` (verified
  twice by `git ls-remote`, at audit start and before the audit-record
  push); local HEAD identical; working tree clean except pre-existing
  owner-local untracked files (`.pi/` — never read — plus one session
  HTML and one kit tarball). Frozen bytes re-verified at `e1bddf2`:
  architecture SHA-256 `ba3fde1b51e9b24b6b9dcef393593fe9fb3e7dc476c87fafd7d6a4fc1ed4c57a`,
  handoff SHA-256 `4aa83c1510faa4877becaeadd3a4335c87a8b02cc4812e0db93c5ebd737ad3e2` —
  both match the pins in the G1/G2/G3 records.
- **Concurrent activity check:** the machine carries live processes from
  other workstreams (node processes; a leftover preview server of the
  FIRST-session TaskLedger app on :4173 serving identity `v1_33edadd3…`
  with the old chart island — the reconciled app was correctly served on
  the handoff's port 47931 instead; shared Chrome with other workstreams'
  tabs, which this audit did not touch). No concurrent git mutation of
  the VICT repository was observed (no index locks; reflog tail predates
  the audit). The repository verification ladder was run sequentially;
  its ambient-load caveat is recorded in §3.1.
- **Method:** frozen Stage 8 architecture + handoff; reference §§5.1,
  22.3, 27.3–27.5; the G1 corrective-pass and gate-authority records; the
  three G2 records; the G3 P2/P2B/RC1 chain, version disposition, F6
  reconciliation, and owner disposition D-6/D-7; the final G3 handoff.
  Every reproduction command below was executed by this audit unless
  explicitly marked as a recorded-not-re-executed limit.

## 1. Measured identities (all recomputed by this audit)

| Item | Recorded | Measured by G4 | Result |
| --- | --- | --- | --- |
| Remote `main` | `e1bddf2` | `e1bddf2…` (ls-remote ×2) | MATCH |
| Frozen architecture | `ba3fde1b…` | same (sha256sum at `e1bddf2`) | MATCH |
| Frozen handoff | `4aa83c15…` | same | MATCH |
| Kit source `fa8937c`↔`e1bddf2` | identical | `git diff` = 0 lines | MATCH |
| Kit artifact (mainline) | `fa7cea37…` | `fa7cea37…` (repacked from my worktree) | **BYTE MATCH** |
| Kit artifact (snapshot-corrected `d7bd0030+a9bc53b4`) | `9d20e1c7…` | vendored in app `tools/*.tgz` = `9d20e1c7…` | MATCH (hash; see §3.4 for the re-pack limit) |
| P2 brief blob | `046558c9…` | `git show 0e6735a:taskledger-brief.txt` = `046558c9…` (identical at `c6bb365`) | MATCH |
| Rubric isolation | — | transcript (297 records, `0fd7b872…` verified) contains **zero** rubric/evaluator/criteria content; all `handoff`/`island` hits are kit-shipped docs/CLI text | CLEAN |
| Builder RESULT | `faeb0471…` | same (artifacts copy and in-repo `RESULT.md` @ `c6bb365`) | MATCH |
| First-session bundle | `0d44135c…` | same | MATCH |
| Reconciled bundle | `97a780d5…` | same | MATCH |
| Workflow artifact `release-evidence` | zip `40fb2ff6…` | downloaded via API (artifact 10971793723): `40fb2ff6…`; GitHub-side metadata digest also `sha256:40fb2ff6…`; head_sha `d7bd0030…` | **MATCH (independently fetched)** |
| Published set content ID | `v1_2a70a29a…` | recomputed from the 14 `name@version` pairs in the artifact: identical | MATCH |
| Registry integrity ×14 | dist.integrity == artifact | live `npm view --prefer-online` ×14: 14/14 MATCH; tag `vict-0.4.0-rc → 0.4.0-rc.1` on all 14; `latest`: 12 @ `0.3.1`, `ui`/`ui-svelte` @ `0.0.0-bootstrap.1` | MATCH |
| Application identity | `v1_ecb2b4e7…` | served live at :47931 (`data-application-version`), unchanged after content-identical rebuild | MATCH (F8) |

Run 36427806906 step-level facts (GitHub API, unauthenticated): step 17
"Publish the exact tarballs (OIDC — no token of any kind)" = **success**;
step 18 "Verify registry state and record release evidence" = **failure**
(the read-only registry check; fail-closed); step 19 (artifact upload) =
success; run conclusion `failure`. **The record's phrasing is accurate:
publication succeeded; the run's later read-only verification timed out.**

## 2. G1 — Builder Kit: findings

- **Authority and gate correction chain:** `verify:builder-kit` executes
  and is green on `e1bddf2` (**18/18, exit 0** — reproduced). The G1
  gate-authority correction (`3740fac…`) is present in source (eight
  task-pack authority checks; scope carried from the committed
  accepted-task-scope record; conservative glob coverage), and its
  permanent negative-control tests are in the suite (see §3.1, run C:
  2733 passed incl. the builder-kit tests; `task-pack-authority`,
  `app-bootstrap`, `release-set-version` all green in isolation).
- **Deterministic generation:** double `kit:generate` → exit 0/0, **zero
  tracked churn** (reproduced); second scaffold generation byte-identical
  (§5). Committed stable layer at `e1bddf2` self-consistent (gate green).
- **Scope/permission/stale/tamper controls:** the kit suite's
  authority tests (scope expansion, ignore widening, handoff-byte drift,
  recomputed-packId forgeries) pass; the app-level controls were also
  demonstrated for real against my own checkout — an unintended CRLF
  smudge of `taskledger-brief.txt` in my clone produced a genuine
  `FAIL [content-drift]` (exit 1) until the working file matched the
  pinned bytes; the deliberate controls reproduce §6.
- **Clean external installation:** `app-bootstrap.test.ts` (build → pack
  → install into an EMPTY external temp project → `init-app` →
  `verify --app`, checkout-independence asserted, tamper sequence
  content-drift/pack-tamper) — **5/5 in isolation** (49.9 s). The
  ladder's `verify:clean-clone` also exit 0.
- **Mainlined prerelease correction:** `5a82273` + mechanical `fa8937c`
  verified at source: pristine `d7bd0030` regex
  `/^vict-release-set@1\/(\d+\.\d+\.\d+)$/` (full-semver only — the
  recorded incompatibility mechanism is real); mainline
  `/^vict-release-set@1\/(\d+\.\d+\.\d+[-0-9A-Za-z.]*)$/`, fail-closed
  null. Regression tests `release-set-version.test.ts`: **4/4** (0.3.1 +
  0.4.0-rc.1 + shapes + fail-closed). Kit artifact rebuilt by G4 from the
  mainline source: **byte-identical `fa7cea37…`**.
- **G1 process deviations** (`.pi/` staging incident; autonomy-exceeding
  repairs; checkpoint erratum) were disclosed by the implementer and
  dispositioned by the dated owner decisions recorded inside the two G1
  governance records (retained-with-scope; deviations-no-precedent;
  scratch refs preserved and excluded). No contradicting evidence found;
  `scratch/*` refs remain local-only and out of every evidence path used
  here. `docs/report/` history untouched by Stage 8 work (spot-checked).

**G4 G1 conclusion: the gate's substantive claims are established.**

## 3. G2 — P1 self-hosting proof: findings

- **Lineage and pinning (reproduced):** `p1/host-a` = `5ceb557`,
  `p1/host-b` = `8fae474`, `codex/stage8-p1-builder-proof-20260926` =
  `7709dbb`; all three merge-base **exactly** at baseline
  `B = a746c34…`; task-card bytes at B = `d6a40c2e…`; handoff bytes at B
  = `4aa83c15…` — identical inputs for all sessions, as recorded.
- **Scope (reproduced):** changed-file lists B→tip per branch are inside
  the accepted P1 scope globs; the gate's baseline-vs-B comparison is
  additionally recorded 26/26 in both the G2 record and the Codex
  committed evidence (`verify:builder-kit` = 26 checks in the committed
  logs).
- **Result comparison (verified against committed evidence, not the
  report):** Codex branch carries `result.json` (validates `ok` against
  the kit's own validator — reproduced by G4) and 13 ladder logs +
  `summary.json` with **all 13 exitCode 0**; spot-read counts match the
  comparison record exactly (test 2475/3 of 2478; release-set "13
  packages, 0.3.1, v1_1c695280…"; gate 26/26). Red-run history
  (dist-ordering, cp1252 mojibake, wrapper refusal, catalog-drift) is
  committed and attributed.
- **Independence and limitations (confirmed as recorded):** the two pi
  sessions are **same-agent/same-model process-repeatability evidence,
  not different-host evidence** — the records say so and G4 concurs; they
  must not be read as host diversity. The distinct-host evidence is the
  Codex result, which is **attested** (host recorded in its own result +
  session setup), with the disclosed provenance caveat that all commits
  carry the shared automation git identity. G4 accepts the pair
  (pi host-a integrated; Codex preserved unmerged) as the P1
  two-host evidence package under the owner's dated substitution +
  reconciliation decisions, with that caveat attached.
- **Selection/integration (reproduced):** host-a is an ancestor of
  `main` (fast-forward `a746c34..5ceb557` per record); Codex and host-b
  branches exist locally and are **not** merged (verified
  `merge-base --is-ancestor` both ways).
- **Corrected integrated implementation:** `main` @ `e1bddf2` binds the
  pack's own `notes.readingTime@1` via `installCapabilityPack` (the
  Stage 04 path) with no app-local duplicate — as the reconciliation
  record states; the correction is itself gate-verified on `main`
  (§3.1) and properly recorded as NOT retroactively altering the host
  results.

**G4 G2 conclusion: the P1 evidence package is complete, honest, and
matches its records; its host-diversity caveat is accurately bounded.**

## 4. G3 — fresh proof against published `0.4.0-rc.1`, reconciliation, and runtime behavior

### 4.1 Release identity and integrity — established

See §1: artifact byte-fetched and hashed; 14/14 member versions/status/
integrity verified against the LIVE registry; content ID recomputed
exact; tag and `latest` states as recorded (including the corrected
`ui`/`ui-svelte` bootstrap `latest` — the fresh-proof handoff's stale
"unoccupied" wording was corrected in-workstream, disclosed, and the
correction is right).

### 4.2 Reconciled app `0e6735a` — established

Reproduced from the bundle (`97a780d5…`), checked out at `0e6735a`
(parent `c6bb365`):

- `npm ci` 0; `npm test` **26/26** (incl. the new `count`-rejection
  case, verified in source: `count === 1` enforced, `count: 2` rejected,
  contract `event.create` rev 2); `npm run build` exit 0;
  `npx vict-builder-kit verify --app` **ALL CHECKS PASSED (5), exit 0**
  (after correcting my own checkout's CRLF smudge — the blob bytes are
  the pinned `046558c9…`).
- Definition/registry inspection: exactly two registered islands
  (`cmp.priority-badge@1`, `cmp.task-edit-link@1`); chart is the built-in
  `role:'chart'` over `v.completionEvents` (`xField completedDay`,
  `yField count`); governed `act.completeTask` persists through the
  author-owned fail-closed effect hook (`capabilityEffects`): output
  contract parse → existence check → already-done refusal → port.mutate
  update + event create; 14 dependencies exact `0.4.0-rc.1`; **zero**
  `renderer-svelte` references in the lockfile.
- **Scaffold byte-compare (reproduced with the PUBLISHED scaffolder
  0.4.0-rc.1 and a release-set derived independently from the workflow
  artifact):** two generations byte-identical (determinism); vs app @
  `0e6735a`: **13 functional host files byte-IDENTICAL**
  (application-server.ts, all three routes, configs, app.html/app.d.ts,
  .gitignore, README.md, components/README.md); `package.json` differs
  by **exactly one added line** (the kit verification tool
  devDependency, `file:tools/…`); `definition.ts`/`registry.ts` differ
  (author-owned by designation). This matches the final handoff's claim
  precisely. (The preserved `scaffold-host-diff-f6recon.txt` shows the
  earlier 4-hunk state from the pre-re-scaffold attempt; the final state
  is the one above.)
- **Real-browser ladder (real Chrome via CDP, both widths):**
  - Phone 390×844: table surface mounts; pageSize 8; search
    "Smoke"→2 rows; "zzq-none"→0 rows with the declared empty message;
    cleared→8; title sort asc; priority sort asc = **semantic** order
    (all p1-high first) with `aria-sort` descending↔ascending toggles;
    pagination Next→page 2 (2 rows, zero overlap)→Previous→round-trip;
    create dialog (`f.createTask`): empty submit → visible validation
    ("This field is required." ×2 + summary); 10 tasks created through
    the declared form; edit-link island navigates to `/tasks/:id` with
    prefilled form; edit saved ("Changes saved.") and persisted;
    row Complete → open count 10→9; chart disclosure shows
    `2026-09-29 | 1`; badge islands styled per priority
    (p1 `rgb(254,226,226)/rgb(153,27,27)`, p2 amber, p3 green, 999px
    pill) — matching the fresh-proof record's exact values.
  - Laptop 1366×768: rows/badges/links render; governed Complete from
    laptop width; a second Complete on the already-done row was
    **refused** (open count stayed 9, chart stayed 1) — the fail-closed
    double-complete behavior demonstrated live; completing an open task
    → open 9→8, chart `2026-09-29 | 2` (count-weighted buckets).
- **F5 raw-boundary probe (reproduced):**
  `POST /api/act {"actionId":"act.completeTask","input":{"id":<open task
  id>,"escalate":true,"operatorNote":"g4-audit-raw-probe"}}` →
  `{"ok":false,"code":"CONTRACT_REJECTED","message":"The action input was
  rejected by contract 'task.complete@1'; no run or mutation was
  performed.","fieldErrors":{"escalate":"This field was rejected by the
  declared contract."}}` and **all 36 SQLite table digests byte-identical**
  before/after (my digest = row count + sha256 over sorted-column
  serialization per table). Valid control → `ok:true` durable
  (status done, completedAt, completedDay; completion_events +1; runs
  +2 including the failed replay). Replay of the completed task →
  `ACTION_FAILED` generic safe failure (the recorded 0.3.1→0.4.0
  difference from specific `ALREADY_COMPLETE`; disclosed, non-blocking).
- **F7 (reproduced, strict):** hard `taskkill` of the listener PID →
  connection refused → restart → **all 36 table digests byte-identical**
  across the restart.
- **F8 (reproduced):** content-identical rebuild → exit 0 → identity
  `v1_ecb2b4e7…` unchanged.
- **Negative controls (reproduced):** brief drift → `FAIL
  [content-drift]` exit 1 → restore (digest re-verified) → green;
  schema-valid `base-pack.json` value tamper → `FAIL [pack-tamper]` →
  restore → **5/5 green**.
- Preserved first-session evidence spot-checked as intact: 17 screenshots
  (+1 duplicate-numbered variant) + 19-record interaction log; F5/F7
  f6recon artifacts internally consistent (before==after digests).

**G4 G3 conclusion: every runtime claim in the final handoff that G4
re-tested reproduced exactly. The published-set identity, the reconciled
app's behavior, the governed boundary, persistence, identity stability,
and the drift/tamper controls are established.**

## 5. The two owner dispositions

### 5.1 D-6 — edit-link island (F6 clause B)

**Facts established independently:**
1. The literal F6 clause-B result at `0e6735a` is **FAIL**: two
   registered islands exist; the frozen wording allows only the badge.
   Nothing in the chain relabels this — the reconciliation record, the
   owner disposition, and the final handoff all preserve the literal
   FAIL, and G4's own registry/scaffold inspection confirms the two
   islands.
2. The exception's bounds are true at source level: `TaskEditLink`
   receives only `id`, renders one anchor to the declared
   parameterized route, owns no task data, and issues no `act`/fetch —
   completion remains the declared governed action. The badge is
   presentational.
3. The platform-limitation premise is **true against the published
   interfaces**: `@victframework/ui@0.4.0-rc.1` `UiTableIntent` columns
   are text-or-island; `rowAction` is dispatch-only (`actionId`,
   `label`, `input` — no navigation variant); navigation links exist
   only at shell level (`UiShellLink`); the application compiler's
   chart/table surface grammars contain no link/navigation/windowing
   members. A row-scoped edit link therefore cannot be expressed
   definition-only on the shipped set, and F2 (record editing) makes
   dropping per-row navigation untenable. The reconciliation's §5
   limitation is accurate, not rationalization.
4. **Authority:** the frozen contract's own procedures anticipate exactly
   this path — findings classify as gating/corrective/deferred/rejected
   (§27.4), the disposition record is dated, names the class
   (**deferred** to the formal UI track), bounds the exception, adds the
   definition-driven link proposal (`columns[].link` or `rowNavigation`)
   with NO Stage 8 UI patch and NO new release, and explicitly states
   G3 stays HELD with closure reserved to owner + G4. Reference §22.3
   permits stage progression only via PASS **or an explicit owner
   decision accepting listed issues** — this is such a decision, in the
   contract's own vocabulary, and it is consistent with the
   reference's established practice of dated owner-decision records
   (G0 ratification, D-1′–D-5, the D-2 host substitution, the version
   disposition). Provenance caveat: owner decisions in this repository
   are attested by dated filed records, not cryptographic signature;
   G4 notes this applies equally to every prior accepted decision and
   does not distinguish this one.

**G4 assessment of D-6: sufficient for the Stage 8 gate.** The finding
is real, remains literally recorded as FAIL, is bounded narrowly, is
technically unavoidable on the shipped interfaces (independently
verified), and is routed to a tracked future platform amendment. What
remains for closure is listed in §8.

### 5.2 F6 clause C residual — the one-line kit devDependency

Verified byte-level: exactly one added line (`@victframework/builder-kit`
as a `file:` devDependency — a build tool, not a host member). The F6
reconciliation records clause C as **PASS on substance, one recorded
tool addition**; the D-6 owner disposition addresses clause B only and
does not explicitly cover clause C. G4 assesses the addition as
non-functional tooling with zero host-content drift (13/13 host files
byte-identical), correctly recorded — but the owner should acknowledge
it explicitly at closure so clause C's literal record is complete (§8,
item 3). This does not re-open clause C: the alternative reading
(hand-editing = any manifest change) would equally condemn the vendored
kit tool that D-1′ itself requires, which cannot be the frozen text's
intent; the record's calibration is reasonable and disclosed.

### 5.3 D-7 — chart 14-day window

**Facts established independently:**
1. The frozen brief's dashboard item literally reads "tasks completed
   per day over the last 14 days as a chart".
2. The published chart surface grammar accepts only
   `kind/viewId/summary/xField/yField` (+ conditions) — **no windowing
   field exists** (verified in the shipped compiler and renderer
   types). The app charts the whole declared view; the title drops the
   window qualifier. The handoff's statement that **the brief is not
   satisfied on this point** is accurate, and G4 confirms it
   behaviorally: the disclosure table lists only buckets present in the
   view, with no 14-day frame.
3. Consequence on G3: F4's rubric text ("the dashboard chart reflects
   the persisted completion data") is **demonstrated** — the chart
   reflects persisted completions via contract-enforced count-weighted
   day buckets, live (`2026-09-29 | 1` then `| 2` after governed
   completions). The unmet part is the brief's window qualifier — a
   platform capability gap plus an honest app-level title change, not a
   false claim. The legacy pre-`count` rows aggregating as zero buckets
   is a disclosed data-continuity note (backfill = production
   migration, correctly out of Stage 8 scope).
4. Disclosure quality: the limitation is retained explicitly in the
   owner disposition and the final handoff; it is not scored as met
   anywhere.

**G4 assessment of D-7: a genuine, correctly-disclosed limitation.
Classification: deferred/corrective — a platform amendment (chart
windowing) must be scheduled on the formal UI/platform track, and the
record must not be read as satisfying the brief's item (3).** It does
not defeat the stage objective (the chart is definition-driven,
accessible, governed-data-reflecting), but it is a named issue that
travels to closure.

## 6. Additional findings (this audit's own)

| # | Finding | Class (§27.4) | Notes |
| --- | --- | --- | --- |
| F-A | `npm test` red on a fresh worktree (child-process/spawn tests require built `dist/`; ladder places `npm test` before `npm run build`) | corrective (Low, tooling) | Same class the G2 host-b record disclosed and superseded in its own run 1. G4: red run A recorded honestly; green after build (§3.1). The ladder's implicit precondition ("works on a built tree") should be documented or reordered. |
| F-B | `scripts/test/release-authority.test.mjs` (release-exec workstream tests, merged to main after the Stage-8-era G1 evidence): 3 tests default-timeout at 5000 ms under full-suite load on this machine; one live-registry probe flipped once under load | corrective (Low, tooling) | In isolation: **65/65 pass** (60 s bound). Same suite green on this machine the prior day. Timing-bound hygiene fix recommended; not a Stage 8 defect; the live-probe design also re-demonstrates why the workflow's own read-only verify step is fail-closed. |
| F-C | One full-suite run ended exit 1 with a vitest worker teardown crash **after** all 2733 tests passed | environmental (recorded) | Machine showed similar instability during the builder session (two disclosed external kills). Not a code defect; recorded for completeness. |
| F-D | Builder-forwarded platform observations (generated host carries 2 pre-existing `tsc --noEmit` strict errors no toolchain checks; `appdata-sqlite` accepts only create/update/delete verbs vs declared domain verbs; host double-validates contract output; SDK `CapabilityDefinition.description` rejected by the closed registry schema) | corrective (Low, platform track) | Verified present as described (host file; verb refusal forced the exact two-field `update` shape in `capabilityEffects`). Honest forwardings, not workarounds. |
| F-E | `/favicon.ico` 404 (cosmetic) | rejected (no action) | As recorded. |
| F-F | Owner decisions are attested by dated filed records, not signatures | noted | Applies to the whole governance history equally; no evidence of inconsistency. |

## 7. Verification-ladder execution (G4's own run)

Sequential run on my worktree at `e1bddf2` (ambient load ~25% — the
machine was not idle; pi harness + one idle preview server present;
disclosed per the Codex evaluator's precedent):

| # | Command | Exit (run A) | Note |
| --- | --- | --- | --- |
| 1 | `npm run format:check` | 0 | |
| 2 | `npm run lint` | 0 | |
| 3 | `npm run typecheck` | 0 | |
| 4 | `npm test` | **1** | fresh-worktree dist ordering + 5000 ms spawn timeouts (F-A/F-B); 10 failed tests, all in those classes |
| 5 | `npm run build` | 0 | |
| 6 | `npm run build -w @victframework/builder-kit` | 0 | |
| 7 | `npm run verify:stage5` | **1** | 4 failures, all `release-authority` timeouts + 1 live-registry probe flip (F-B); reference-app suites 66/66 green |
| 8 | `npm run verify:stage6a` | 0 | |
| 9 | `npm run verify:stage6b` | 0 | |
| 10 | `npm run verify:stage7a` | 0 | |
| 11 | `npm run verify:release-set` | 0 | "ALL CHECKS PASSED — 14 packages, 0.4.0-rc.1, v1_2a70a29af12fa88…" |
| 12 | `npm run verify:clean-clone` | 0 | |
| 13 | `npm run verify:builder-kit` | 0 | ALL CHECKS PASSED (18) |

Resolutions on the built tree, recorded honestly: `npm test` rerun B
(5 failed — all release-authority 5000 ms timeouts); isolated
`release-authority` **65/65** (60 s bound); isolated `app-bootstrap`
**5/5**; rerun C (quiet): **2733 passed / 3 skipped, 0 failed**, exit 1
solely from a vitest worker teardown crash after the summary (F-C).
Gate conclusion: **the substantive verification state of `e1bddf2` is
green**; the two red classes are environmental/timing and are carried
as F-A/F-B, not as Stage 8 exit-criteria failures. Kit reproduction:
regression tests 4/4; gate 18/18; repacked artifact byte-identical
`fa7cea37…`.

## 8. What must happen before owner closure

1. **Owner decision only:** the owner accepts this G4 record and closes
   or withholds Stage 8. Nothing in this record executes closure, and
   nothing here marks any requirement Verified beyond what the owner
   now adopts.
2. **Record the deferred UI/platform track with a dated reference
   entry:** the D-6 amendment proposal (`columns[].link` /
   `rowNavigation`) and the D-7 chart-windowing gap must land in the
   reference/formal track as scheduled, owned work — today they live in
   governance records only. (Deferred per D-6/D-7; no Stage 8 UI patch,
   no new release.)
3. **Explicit owner acknowledgment of the clause-C one-line kit-tool
   devDependency** so the literal clause-C record is complete (it is
   currently implementer-recorded; G4 concurs with the calibration).
4. **Carry F-A/F-B into the release/tooling workstream** (test-timeout
   hygiene + ladder-ordering note + the live-probe design remark) and
   forward F-D to the platform track (host strict-mode errors first).
5. D-3 remains as ratified: the kit is still distributed as a local
   artifact; its inclusion in a future release set is a separate,
   owner-authorized action (the published 14-member rc set correctly
   excludes it).

## 9. Limits of this audit

- The **pristine `d7bd0030` kit artifact hash (`c3df869f…`) was not
  re-packed by G4** (would require a second full worktree install);
  instead the incompatibility is verified at source level (the old
  regex) and the snapshot-corrected artifact hash is verified via the
  vendored `tools/` tarball actually consumed by the app. The recorded
  pristine hash was reproduced by two independent implementer-side
  workstreams.
- The **Codex host identity is attested** (result document + session
  setup), not provable from git metadata (shared automation identity) —
  carried as the recorded caveat.
- The 17 screenshots and interaction log of the first session were
  checked for existence/structure, not pixel-re-examined; G4 performed
  its **own** full real-browser ladder instead.
- The verification ladder was run on a machine with ambient load and a
  known Windows/Node 22 environment; no second OS was available (same
  environmental limitation recorded by prior stages).

## 10. Recommendation

**VERDICT: PASS WITH ISSUES.**

Under reference §22.3 — *PASS WITH ISSUES: stage objective stands, but
named corrective work is required or scheduled.* The stage objective —
a working Builder Kit that bootstraps verified builder sessions on the
VICT repository itself (P1) and drives a greenfield, governed,
persisting application from an empty project and a natural-language
brief on the published platform (P2) — is demonstrated by evidence this
audit independently reproduced at every material point. The issues are
named, bounded, and either deferred with owner authority (D-6 clause-B
exception; D-7 windowing; §8 items 2–4) or low-severity tooling items
outside the stage's own scope (F-A/F-B/F-D). The alternative — FAIL —
would require holding that a literal rubric point whose impossibility
on the shipped interfaces G4 independently verified, and whose
exception the contract's own disposition machinery has already
recorded, defeats a stage whose every other claim reproduced exactly;
§22.3's explicit owner-acceptance path exists precisely for this shape.

**Stage 8 is NOT marked Verified by this record. Only the owner closes
the stage (§5.1).** If the owner accepts, closure should cite: this
record; the D-6/D-7 dispositions (with §8 items 2–3 as adopted
conditions); the carried findings F-A/F-B/F-D/E; and the standing
non-claims (no publication, no tag movement, no production activation,
Quellight untouched, frozen bytes untouched — all re-verified true at
the audited tip).

*Auditor stop point: end of the independent G4 audit. No platform or
app code changed by this audit; the only commit is this record.*
