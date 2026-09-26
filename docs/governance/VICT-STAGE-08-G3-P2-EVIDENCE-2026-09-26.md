# Stage 8 G3 — Proof P2 Evidence Record (2026-09-26)

> **Document type:** P2 evidence record (handoff WP-7; architecture §5.4;
> gate G3). Companion to the same-day owner authorization record and the
> handoff-named implementation report. Claim record, NOT independently
> authoritative. **No Verified claim is made; the G3 gate decision (pass /
> fail / fix-round) belongs to the owner and the independent audit.**

## 1. Inputs and byte pins (evaluator-recorded)

| Item | Digest | Location |
| --- | --- | --- |
| P2 brief (verbatim, from frozen handoff §"P2 brief") | SHA-256 `046558c9f99a05b6812ab0db10ec51e8fe5873964af03b3bee78e8eb56476a0d` | builder workspace `taskledger-brief.txt` (supplied bytes identical) |
| Evaluator rubric (F1–F8 + claims table, from frozen architecture §5.4) | SHA-256 `b7531d5b621bc670d2cc1b5ed4c10077f541ff4119b0290d72b15d85ad65a9b0` | evaluator-only; outside builder workspace |
| Builder Kit artifact `@victframework/builder-kit@0.1.0` (local, D-1′) | SHA-256 `c3df869f54f07da9996274ea114d9ded3f9c2f5003918ed4d6795bed62e78018` | tarball in evaluator artifacts; no-checkout-leakage probe: NONE (108 entries scanned; only `.pi/` literal stop-rule text) |
| Clean-consumer start state | `eval-p2-empty-dir-record.json` (SHA-256 `52770392…`) | `C:\Users\RZ1\Desktop\taskledger-p2-20260926` created empty: 0 entries, **no `package.json`**, no git repo; outside VICT and all P1 worktrees |
| Frozen release set | `vict-release-set@1/0.3.1`, content ID `v1_1c695280d3afec5e91bfc75d3c99a5a85bc27f6d91127c4d0ce7bd51563c2583` (recomputed == recorded) | registry evidence: 13/13 packages at 0.3.1, `latest`=0.3.1, every `dist.integrity` matched against downloaded bytes, every internal pin exact |

## 2. Builder session (genuinely fresh, isolated)

- Separate pi process, fresh context; flags `-nc -ns -ne -np` (no project
  context files, no skills, no extensions, no prompt templates); session
  stored under the evaluator's audit directory.
- Supplied context: empty workspace, `taskledger-brief.txt`, the kit
  tarball + SHA-256, the release-set id, and logistics only. The rubric,
  claims table, handoff, operator instruction, and all P1 material were
  outside its workspace and context.
- **Isolation audit: clean** — a scan of the full session transcript found
  zero references into the VICT tree outside the two allowed input paths.
- **Environment deviation:** an external process killer on this machine
  killed the builder process twice mid-run (12:36:17, 12:40:26 local).
  Each time the session was resumed from its persisted transcript with
  identical isolation flags; no work was lost. The builder disclosed both
  interruptions in its own result document.

## 3. Delivered application

TaskLedger — own git repository at `C:\Users\RZ1\Desktop\taskledger-p2-20260926`,
HEAD `7400f33403451e28c50de35daae174cc584bf994`, 6 commits
(`8a32e67` bootstrap → `f80f9a6` platform install → `cdb345c` scaffold →
`e9a64b3` application authoring → `77234d0` contract fixes + tests →
`7400f33` result document). Reproducible local bundle:
`taskledger-builder-repo.bundle`, SHA-256
`6d353b9c371a4befd95cd5eae182f6a74e4243a491a20414cc806f17aaf18a23`.
Builder result document `RESULT.md` (SHA-256
`39ae5ef40fa75a9e83abaf4e74a3cfe3909ffbbd03e893b9c3b266adc7380234`).

Bootstrap binding (verified): app-local base pack `packId
89d508e267e3a0a9e4ce8e0cb95eeebc624cbeadb8e73c653eebf8e8e8db090b`;
records release set `vict-release-set@1/0.3.1`, the kit artifact spec +
SHA-256 (D-1′ consumption record), and the brief as a content-addressed
input with digest `046558c9…` — **identical to the operator's pre-pinned
brief bytes**. App manifest pins all 13 platform packages at exact `0.3.1`;
lockfile carries registry URLs + sha512 integrity for all 13. Observed
wrinkle: the pack's `app` identity (`taskledger-p2-20260926@1.0.0`) is the
provisional manifest identity at init-app time and differs from the final
scaffolded manifest (`taskledger@0.1.0`); no gate checks this field and no
authority is affected — recorded as an observed inconsistency.

## 4. Evaluator verification results

| Check | Result |
| --- | --- |
| `npx vict-builder-kit verify --app` | **5/5 ALL CHECKS PASSED** (schema, packId identity, bootstrap binding, input provenance, release-set identity of all 13 installed packages) — reproduced multiple times, incl. after rebuild |
| Build + run | `npm run build` exit 0 (twice); app served HTTP 200 on :4173 |
| Builder tests | `npm test` exit 0 — 2 files / **33 passed** |
| VICT `verify:builder-kit` (P2 worktree) | **18/18 ALL CHECKS PASSED** (exit 0) |
| VICT `verify:release-set` | **ALL CHECKS PASSED — 13 packages, 0.3.1, `v1_1c695280d3afec5…`** (frozen set unchanged) |

## 5. Real-browser record (real Chrome via CDP; real keyboard events)

Screenshots + interaction logs: `.builder-kit/prep/eval-p2-artifacts/browser-record/`
(17 files; combined log `interaction-log.json`, SHA-256 recorded by the
evaluator). Key observed outcomes:

- **Dashboard (phone + laptop):** chart surface renders with accessible
  data table; open-count island hydrates live through the declared query
  boundary; after one governed completion: count **12 → 11**, table shows
  `2026-09-26 → 1` (F4 observable).
- **Create/edit forms:** empty submit → validation state, nothing
  persisted; real-keyboard create persisted; edit prefilled + saved via
  keyboard, persisted; invalid priority `urgent-not-allowed` → rejected,
  stored value unchanged (F2 observable).
- **Keyboard use:** Tab navigation across dashboard and table controls;
  form entry via `page.keyboard.type`; Enter submits.
- **DEFECT P2-DEFECT-1 (real browser):** the task-table island never
  mounts — `pageerror: PriorityBadge is not defined` on every load
  (5/5 reproduced). Cause: `TaskTable.svelte` uses `<PriorityBadge>`
  without importing it; the built route chunk contains the call site with
  no definition in scope. Consequences in-browser: no task rows, no
  search/sort/pagination controls, no row Complete button, no visible
  priority badges. Neutral surfaces (dashboard, detail, forms) are
  unaffected.

## 6. Governed action probes (at the declared `/api/act` boundary)

| Probe | Observed |
| --- | --- |
| `act.completeTask` with exact `{id}` | `ok:true` — status `done`, `completedAt` set |
| undeclared input `{id, force, note}` | **`CONTRACT_REJECTED`** — "Complete-task input accepts only 'id'." |
| unknown id | **`TASK_NOT_FOUND`** |
| replay of completed task | **`ALREADY_COMPLETE`** (idempotent; no new ledger rows) |

Durable ledger (direct observation, `vict-stores.sqlite`, read-only):
`vict_activation` pins the activation for graph `taskledger.complete-graph`;
`vict_run` carries one `completed` run pinned to that activation version;
`vict_run_event` carries exactly `run.started → node.started →
node.completed → run.completed` (`vict.run-event@1`). The action is a
recorded durable Vict run, not a UI toggle.

## 7. Restart and rebuild probes

- **F7 (real-process kill/restart):** server process hard-killed
  (`Stop-Process -Force`; connection refused verified), restarted from the
  same databases: task state **byte-identical** (sorted-rows JSON digest
  `1d6d5cadb4c15bc2…` before == after; 12 rows; completion timestamp
  intact); run ledger intact (1 run, 4 events).
- **F8 (identity across content-identical rebuild):** `npm run build`
  re-run with zero source changes; served
  `applicationVersion:"v1_bc4389e0c7fcabdbb1d393f5494dc67ab02f44504674b914230e72c4192cd631"`
  **identical** before and after; `verify --app` green after rebuild.

## 8. Negative controls (app-level; observed red → restored → green)

| Control | Observed |
| --- | --- |
| Content drift (recorded input byte changed) | `FAIL: inputs:app-pack [content-drift] — content drift: taskledger-brief.txt`, exit 1 → restore from pinned bytes (digest re-verified `046558c9…`) → **5/5 green** |
| Pack tamper (schema-invalid field) | schema fail-closed: "Unknown field; the schema at '(root)' is closed" → restore → green |
| Pack tamper (schema-valid value change) | **`FAIL: identity:app-pack [pack-tamper]` — packId does not match the canonical bytes** → restore → **5/5 green** |

## 9. F1–F8 scoring (evaluator, against the byte-pinned rubric)

| ID | Criterion | Score | Evidence / notes |
| --- | --- | --- | --- |
| F1 | Builds/runs from empty project via scaffolder + renderer | **PASS** | scaffold 16 files; build exit 0; served 200; routes render from the compiled plan |
| F2 | Create/edit validates against a declared contract | **PASS** | probes §5: invalid → validation state, not persisted; valid → persisted |
| F3 | Table with search, sort, pagination | **FAIL** | P2-DEFECT-1: island never mounts in a real browser; also sort controls absent ≤640px (independent UX gap) |
| F4 | Dashboard chart reflects persisted completions | **PASS** | count 12→11; `2026-09-26 → 1` after completion |
| F5 | Complete crosses governed boundary; durable, not a toggle | **PASS** | §6 probes + §6 durable ledger; caveat: row button unavailable in-browser (F3 defect) — exercised at the declared boundary |
| F6 | Badge = versioned code island; rest definition-driven; scaffolder contract | **PASS with caveat** | wiring verified (definition `app.priority-badge@1` + registry + props-only); badges not visible in-browser due to F3 defect; disclosed edits to generated route plumbing recorded (one-time non-destructive tool contract respected) |
| F7 | Kill/restart preserves tasks + durable effects; idempotent | **PASS** | §7: identical state digest, ledger intact, `ALREADY_COMPLETE` |
| F8 | Application identity stable across content-identical rebuild | **PASS** | `applicationVersion v1_bc4389e0…` unchanged after rebuild |

**Score: 7 of 8 PASS (one with caveat); F3 FAIL**, all traced to one root
defect (missing `PriorityBadge` import in `TaskTable.svelte`) plus one
independent narrow-width UX gap (sort hidden ≤640px).

## 10. Deviations and honesty notes

- External process killer killed the builder twice; resumed from persisted
  sessions (recorded; also self-disclosed by the builder).
- npm arborist crash on plain `npm install` (environment) — builder used
  `--legacy-peer-deps`; disclosed.
- The builder's claim "rendered rows in the built pages" is **contradicted
  by the real-browser record** for the client-rendered table (SSR skeleton
  only); the builder's verification was curl/DB-based and its test suite
  has no component-mount test. Recorded as a claim-vs-observation
  discrepancy; the builder otherwise disclosed its verification methods.
- Evaluator-state interactions with the delivered repo: `.data/` wiped once
  BEFORE the recorded browser record (builder's final `.data/` was backed
  up first: `builder-final-data-backup/`); one task created, edited,
  completed by the evaluator probes; `server.log` untracked runtime log
  remains; `git status` clean apart from that log at evaluation end.

## 11. Proposed G3 disposition (for owner ratification; NOT self-executed)

The P2 evidence package is **complete**: every required evidence class
exists, including real failures recorded honestly. The delivered
application satisfies 7 of 8 rubric criteria; the single FAIL (F3) has one
identified one-line root cause and a recorded independent UX gap.

Options for the owner: (a) authorize **one bounded P2 fix round** — re-issue
the same brief to a fresh isolated builder session with the defect report
as operator feedback (no rubric disclosure), then re-run this evaluation
ladder; or (b) accept the package with F3 FAIL recorded and let the
independent audit weigh it. **No gate satisfaction is declared by this
record.** Standing non-claims unchanged: Stage 8 and every BLD requirement
remain NOT Verified; no publication; no production activation; no
Quellight access; P2 application kept as its own repository (bundle
preserved); nothing merged from the builder branch into VICT.

## 12. Evidence locations

- Builder repo: `C:\Users\RZ1\Desktop\taskledger-p2-20260926` (own git;
  bundle + hashes in evaluator artifacts).
- Builder session transcript (audit): evaluator artifacts
  `eval-p2-builder-session/` (+ isolation audit script + result).
- Registry evidence, empty-dir record, operator note, rubric/brief pins,
  browser record: `.builder-kit/prep/eval-p2-artifacts/` in the P2
  worktree (gitignored; hashes recorded above).
- Evaluator probe scripts and gate logs: `.builder-kit/prep/eval-*` in the
  P2 worktree.
- Gate logs: `eval-p2-gate-builder-kit.log` (18/18),
  `eval-p2-gate-release-set.log` (13 packages, `v1_1c695280…`).

**Stop point: G3/P2 evidence package complete — for owner review. No G4
start; no Verified claims; nothing published; production untouched.**
